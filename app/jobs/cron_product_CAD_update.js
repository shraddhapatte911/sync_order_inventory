import cron from 'node-cron';
import prisma from '../db.server';
import fetchListedProducts from '../apis/fetchListedProducts';
import { graphqlRequest } from '../components/graphqlRequest';
import { json } from '@remix-run/node';

// const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function cron_product_CAD_update() {
    // for testing quantity of products
    // 5650-1SS240106CWHS-BLAC
    // DH4692-003
    const task = async () => {
        try {
            const shopData = await prisma.session.findMany()

            if (!shopData.length) return

            console.log('Task executed at:', new Date(), shopData);
            console.log("sync process has been started of products through cron!");
            const api_key = process.env.crewsupply_api_key;

            const firstStatus = await prisma.SyncStatus.findFirst();
            if (firstStatus?.isProductProcessing === true) {
                // console.log("firstStatus?.isProductProcessing", firstStatus?.isProductProcessing);
                return json({ message: "Already processing products." })
            }
            // console.log("trigger on cron after firstStatus?.isProductProcessing:", firstStatus?.isProductProcessing);
            if (!firstStatus) {
                console.error("No records found in SyncStatus");
            } else {
                const updateFirstStatus = await prisma.SyncStatus.update({
                    where: { id: firstStatus.id },
                    data: { isProductProcessing: true },
                });
                // console.log("updateFirstStatus", updateFirstStatus);
            }

            let totalProductsToUpdate = [];
            let kickscrewCurrentPage = 0;
            const kickscrewItemsPerPage = 20;
            let kickscrewHasNextPage = true;

            while (kickscrewHasNextPage) {
                const { totalProducts, gotProducts } = await fetchListedProducts(kickscrewCurrentPage, kickscrewItemsPerPage, api_key);
                totalProductsToUpdate.push(...gotProducts);

                kickscrewHasNextPage = (kickscrewCurrentPage + 1) * kickscrewItemsPerPage < totalProducts;
                kickscrewCurrentPage++;
            }

            // console.log("First Product:", totalProductsToUpdate[0]);
            // console.log("Total Products To Update:", totalProductsToUpdate.length);

            for (const product of totalProductsToUpdate) {
                // console.log("product.model_number", product.model_number);
                try {
                    const productTagQuery = `
                        query {
                            products(first: 10, query: "tag:${product.model_number}") {
                                edges {
                                    node {
                                        id
                                        title
                                        handle
                                        totalInventory
                                    }
                                }
                            }
                        }
                    `;
                    const dataOfProductTag = await graphqlRequest(shopData, productTagQuery);
                    const tagValue = dataOfProductTag.data?.products?.edges?.[0]?.node?.id;

                    if (tagValue) {
                        const productVariantsQuery = `
                            query {
                                product(id: "${tagValue}") {
                                    title
                                    variants(first: 250) {
                                        edges {
                                            node {
                                                id
                                                inventoryQuantity
                                                selectedOptions {
                                                    name
                                                    value
                                                }
                                                inventoryItem {
                                                    id
                                                    inventoryLevels(first: 10) {
                                                        edges {
                                                            node {
                                                                id
                                                                location {
                                                                    id
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        `;

                        const dataOfProductVariants = await graphqlRequest(shopData, productVariantsQuery);

                        const variantToUpdate = dataOfProductVariants?.data?.product?.variants?.edges.find(edge =>
                            edge.node.selectedOptions?.[0].value === product.model_size
                        );

                        if (variantToUpdate) {
                            const inventoryItemID = variantToUpdate.node.inventoryItem.id;
                            const locationID = variantToUpdate.node.inventoryItem.inventoryLevels.edges[0]?.node?.location?.id;
                            const delta = product.quantity - variantToUpdate.node.inventoryQuantity;

                            // if (product.model_number === "5650-1SS240106CWHS-BLAC") {
                            //     console.log("5650-1SS240106CWHS-BLAC product.model_size", product.model_size);
                            //     console.log("5650-1SS240106CWHS-BLAC delta", delta);
                            //     console.log("5650-1SS240106CWHS-BLAC product.quantity", product.quantity);
                            //     console.log("5650-1SS240106CWHS-BLAC variantToUpdate.node.inventoryQuantity", variantToUpdate.node.inventoryQuantity);

                            // }

                            // console.log("Quantity delta......", delta, "inventoryItemID...", inventoryItemID, "locationID.....", locationID);

                            if (locationID) {

                                const inventoryAdjustmentMutation = `
                                    mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
                                        inventoryAdjustQuantities(input: $input) {
                                            userErrors {
                                                field
                                                message
                                            }
                                            inventoryAdjustmentGroup {
                                                createdAt
                                                reason
                                                changes {
                                                    name
                                                    delta
                                                }
                                            }
                                        }
                                    }
                                `;

                                await graphqlRequest(shopData, inventoryAdjustmentMutation, {
                                    variables: {
                                        input: {
                                            reason: "correction",
                                            name: "available",
                                            changes: [
                                                {
                                                    delta,
                                                    inventoryItemId: inventoryItemID,
                                                    locationId: locationID
                                                }
                                            ]
                                        }
                                    }
                                });
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error processing product ${product.model_number}:`, error);
                }
            };

            const secondStatus = await prisma.SyncStatus.findFirst();
            await prisma.SyncStatus.update({
                where: { id: secondStatus.id },
                data: { isProductProcessing: false },
            });

            console.log("Sync completed successfully. All products have been processed of cron.");

        } catch (error) {
            const thirdStatus = await prisma.SyncStatus.findFirst();
            await prisma.SyncStatus.update({
                where: { id: thirdStatus.id },
                data: { isProductProcessing: false },
            });
            console.error("Error while syncing products:", error);
        }
    };

    // try {
    //     await task()
    // } catch (error) {
    //     console.log("error on task.........", error);
    // }

    // const scheduledTime = '0 */48 * * *'   // cron job to run every 48 hours

    // const scheduledTime = '0 * * * *';  // cron job to run every hour

    const scheduledTime = '*/30 * * * *';  // cron job to run every 30 minutes

    // const scheduledTime = '*/5 * * * *';  // cron job to run every 5 minutes

    // const scheduledTime = '0 */2 * * *';  // cron job to run every 2 hours

    // const scheduledTime = '*/20 * * * * *' // to run every 20 seconds

    const scheduledJob = cron.schedule(scheduledTime, task);

    scheduledJob.on('error', (err) => {
        console.error('Error in cron scheduling of cron_product_CAD_update:', err.message);

    });

    console.log('Cron job scheduled to run every 30 minutes of cron_product_CAD_update');

}




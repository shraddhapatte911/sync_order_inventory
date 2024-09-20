import cron from 'node-cron';
import prisma from '../db.server';
import fetchListedProducts from '../apis/fetchListedProducts';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const graphqlRequest = async (shopData, query, variables) => {
    // console.log("dsfsdfdfsddffd------------------sdfdfsdfsd", query, "       ", variables);
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // console.log("shopData[0]?.shop----------------->", shopData[0]?.shop);
        // console.log("shopData[0]?.accessToken------------>", shopData[0]?.accessToken);

        try {
            const response = await fetch(`https://${shopData[0]?.shop}/admin/api/2024-07/graphql.json`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": shopData[0]?.accessToken
                },
                body: JSON.stringify({
                    query: query, ...(variables ? variables : {})
                })
            })

            const data = await response.json();
            // console.log('data===============================================+>', data);


            if (data.errors) {
                if (attempt === MAX_RETRIES) {
                    console.error(`Failed after ${MAX_RETRIES} attempts:`, data.errors);

                }
                console.warn(`Retrying request (${attempt}/${MAX_RETRIES}) due to error:`, data.errors);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }

            if (!response.ok) {
                throw new Error(`GraphQL error: ${data?.errors?.map(e => e.message).join(', ')}`);
            }
            return data;
        } catch (error) {
            if (attempt === MAX_RETRIES) {
                console.error(`Failed after ${MAX_RETRIES} attempts:`, error);
                throw error;
            }
            console.warn(`Retrying request (${attempt}/${MAX_RETRIES}) due to error:`, error);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
};


export async function cron_product_CAD_update() {


    const task = async () => {
        try {
            const shopData = await prisma.session.findMany()
            console.log('Task executed at:', new Date(), shopData);
            console.log("sync process has been started of cron!");
            const api_key = process.env.crewsupply_api_key;
            // console.log("api_key", api_key);


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

            console.log("First Product:", totalProductsToUpdate[0]);
            console.log("Total Products Updated:", totalProductsToUpdate.length);

            await Promise.all(totalProductsToUpdate.map(async (product) => {

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

                            if (product.model_number === "5650-1SS240106CWHS-BLAC") {
                                console.log("5650-1SS240106CWHS-BLAC product.model_size", product.model_size);
                                console.log("5650-1SS240106CWHS-BLAC delta", delta);
                                console.log("5650-1SS240106CWHS-BLAC product.quantity", product.quantity);
                                console.log("5650-1SS240106CWHS-BLAC variantToUpdate.node.inventoryQuantity", variantToUpdate.node.inventoryQuantity);

                            }

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
            }));

            console.log("Sync completed successfully. All products have been processed of cron.");

        } catch (error) {
            console.error("Error while syncing products:", error);
        }
    };

    // try {
    //     task()
    // } catch (error) {
    //     console.log("error on task.........", error);
    // }

    // const scheduledTime = '0 */48 * * *'   // cron job to run every 48 hours

    // const scheduledTime = '0 * * * *';  // cron job to run every hour

    const scheduledTime = '0 */2 * * *';  // cron job to run every 2 hours

    // // const scheduledTime = '*/15 * * * * *' // to run every 10 seconds

    const scheduledJob = cron.schedule(scheduledTime, task);

    scheduledJob.on('error', (err) => {
        console.error('Error in cron scheduling of cron_product_CAD_update:', err.message);

    });

    console.log('Cron job scheduled to run every 2 hours of cron_product_CAD_update');

}




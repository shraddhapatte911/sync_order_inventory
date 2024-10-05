import { json } from "@remix-run/node";
import fetchListedProducts from "../apis/fetchListedProducts";
import { graphqlRequest } from "../components/graphqlRequest";
import prisma from "../db.server";

export const loader = async ({ request }) => {
    try {
        const shopData = await prisma.session.findMany()

        if (!shopData.length) return

        console.log('Task executed at:', new Date(), shopData);
        console.log("sync process has been started of products through api!");
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
        // console.log("Total Products To Update:", totalProductsToUpdate.length);

        await Promise.all(totalProductsToUpdate.map(async (product) => {
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
        }));

        console.log("Sync completed successfully. All products have been processed of cron.");
        return json({message: "successfully synced products"})

    } catch (error) {
        console.error("Error while syncing products:", error);
        return json({message: "Error while syncing products"})

    }
};

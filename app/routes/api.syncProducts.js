import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import fetchListedProducts from "../apis/fetchListedProducts";

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000; // 1 second delay incase any aerror.

console.log("sync process has been started!");


const graphqlRequest = async (admin, query, variables = {}) => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await admin.graphql(query, { variables });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(`GraphQL error: ${data.errors?.map(e => e.message).join(', ')}`);
            }
            return data;
        } catch (error) {
            if (attempt === MAX_RETRIES) {
                console.error(`Failed after ${MAX_RETRIES} attempts:`, error);
                throw error; // Rethrow error after last attempt.
            }
            console.warn(`Retrying request (${attempt}/${MAX_RETRIES}) due to error:`, error);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS)); // Waiting before retrying processs.
        }
    }
};

export const loader = async ({ request }) => {
    console.log("sync process has been started!");
    try {
        const { session, admin } = await authenticate.admin(request);
        const api_key = process.env.crewsupply_api_key;

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
                    #graphql
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
                const dataOfProductTag = await graphqlRequest(admin, productTagQuery);
                const tagValue = dataOfProductTag.data?.products?.edges?.[0]?.node?.id;

                if (tagValue) {
                    const productVariantsQuery = `
                        #graphql
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
                    const dataOfProductVariants = await graphqlRequest(admin, productVariantsQuery);
                    console.log("sssssss dataOfProductVari");


                    const variantToUpdate = dataOfProductVariants?.data?.product?.variants?.edges.find(edge =>
                        edge.node.selectedOptions?.[0].value === product.model_size
                    );

                    if (variantToUpdate) {
                        const inventoryItemID = variantToUpdate.node.inventoryItem.id;
                        const locationID = variantToUpdate.node.inventoryItem.inventoryLevels.edges[0]?.node?.location?.id;
                        const delta = product.quantity - variantToUpdate.node.inventoryQuantity;

                        console.log("Quantity delta......", delta);


                        if (locationID) {
                            const inventoryAdjustmentMutation = `
                                #graphql
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
                            await graphqlRequest(admin, inventoryAdjustmentMutation, {
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
                            });
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing product ${product.model_number}:`, error);
            }
        }));

        console.log("Sync completed successfully. All products have been processed.");
        return json({ message: 'Got Data Successfully!' });

    } catch (error) {
        console.error("Error while syncing products:", error);
        return json({ message: 'Error while syncing products' });
    }
};

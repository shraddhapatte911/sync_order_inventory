import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import fetchListedProducts from "../apis/fetchListedProducts";

export const loader = async ({ request }) => {
    try {
        const { session, admin } = await authenticate.admin(request);
        const api_key = process.env.crewsupply_api_key;

        // ........................................kickscrew products fetching..........................................

        let kickscrewProducts = []
        let kickscrewHasNextPage = true
        let kickscrewTotalPages;
        let kickscrewTotalItems;
        let kickscrewItemsPerPage = 20
        let kickscrewCurrentPage = 0

        while (kickscrewHasNextPage) {
            const { totalProducts, gotProducts } = await fetchListedProducts(kickscrewCurrentPage, kickscrewItemsPerPage, api_key);

            // console.log("totalProducts, gotProducts ", totalProducts, "            ", gotProducts);


            const hasNextPageS = (kickscrewCurrentPage + 1) * kickscrewItemsPerPage < totalProducts;
            const hasPrevPageS = kickscrewCurrentPage > 0;

            kickscrewProducts = [...gotProducts]
            kickscrewHasNextPage = hasNextPageS
            kickscrewTotalPages = Math.ceil(totalProducts / kickscrewItemsPerPage)
            kickscrewTotalItems = totalProducts
            // console.log("kickscrewHasNextPage", kickscrewHasNextPage);

            // ................................store products.....................................
            let count = 0;
            // console.log("count !== kickscrewProducts.length", count !== kickscrewProducts.length);

            while (count !== kickscrewProducts.length) {
                console.log("kickscrewProducts.length", kickscrewProducts.length, '      ', kickscrewProducts[count].model_number);
                // console.log("kickscrewProducts[count]", kickscrewProducts[count]);


                // console.log('storeProductsHasNextPage', storeProductsHasNextPage);
                // console.log('storeProductsEndcursor', JSON.stringify(storeProductsEndcursor));
                const responseProductTag = await admin.graphql(
                    `#graphql
                    query {
                        products(first: 10, query: "tag:${kickscrewProducts[count].model_number}") {
                            edges {
                                node {
                                    id
                                    title
                                    handle
                                    totalInventory
                                }
                            }
                        }
                    }`,
                );

                const dataOfProductTag = await responseProductTag.json();
                // console.log('kickscrewProducts[count].model_number--------------------------', kickscrewProducts[count].model_number);

                // console.log("kickscrewProducts ", kickscrewProducts);

                // console.log("dataOfProductTag.data?.products?.edges?.[0]?.node?.id", dataOfProductTag.data?.products?.edges);


                const tagValue = dataOfProductTag.data?.products?.edges?.[0]?.node?.id || null
                console.log("dataOfProductTag.data?.products?.edges", dataOfProductTag.data?.products?.edges);

                if (tagValue) {
                    const responseProductVariants = await admin.graphql(
                        `#graphql
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
                                                    node{
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
                        }`,
                    );

                    const dataOfProductVariants = await responseProductVariants.json()

                    // console.log("dataOfProductVariants?.data?.product?.variants?.edges:    ", dataOfProductVariants?.data?.product?.variants?.edges);

                    if (dataOfProductVariants?.data?.product?.variants?.edges && dataOfProductVariants?.data?.product?.variants?.edges.length > 0) {

                        let compareCount = 0

                        while (compareCount !== dataOfProductVariants?.data?.product?.variants?.edges.length) {
                            const edge = dataOfProductVariants?.data?.product?.variants?.edges[compareCount]

                            // console.log("edge.node.selectedOptions?.[0].value === kickscrewProducts[count].model_size------------------------------------------", edge.node.selectedOptions?.[0].value === kickscrewProducts[count].model_size);
                            // console.log("edge.node.selectedOptions?.[0].value", edge.node.selectedOptions?.[0].value);
                            // console.log("kickscrewProducts[count].model_size", kickscrewProducts[count].model_size);
                            // console.log("kickscrewProducts[count].quantity", kickscrewProducts[count].quantity);
                            // console.log("edge.node.inventoryQuantity", edge.node.inventoryQuantity);
                            // console.log("kickscrewProducts[count].quantity === edge.node.inventoryQuantity", kickscrewProducts[count].quantity === edge.node.inventoryQuantity);
                            if (edge.node.selectedOptions?.[0].value === kickscrewProducts[count].model_size) {
                                console.log("-------------------------------------------------Size is same-------------------------------");

                                if (kickscrewProducts[count].quantity === edge.node.inventoryQuantity) {
                                    // console.log("-------------------------------------------------Quantity is same no need to update-------------------------------");

                                } else {
                                    // console.log("kickscrewProducts[count].quantity, edge.node.inventoryQuantity", kickscrewProducts[count].quantity, edge.node.inventoryQuantity);

                                    console.log("-------------------------------------------------Need to update quantity--------------------------");
                                    // console.log("variant id=========", edge.node.id);
                                    // console.log("location id=========", edge?.node?.inventoryItem?.inventoryLevels?.edges?.[0]?.node?.location?.id);
                                    // console.log("edge?.node=========", edge?.node);


                                    const locationID = edge?.node?.inventoryItem?.inventoryLevels?.edges?.[0]?.node?.location?.id || null
                                    console.log("locationID---------------->", locationID);
                                    const inventoryItemID = edge?.node?.inventoryItem?.id
                                    console.log("inventoryItemID---------------->", inventoryItemID);
                                    const delta = Number(kickscrewProducts[count].quantity) - edge.node.inventoryQuantity


                                    if (locationID) {

                                        // const responseOfQuantityUpdate = await admin.graphql(
                                        //     `#graphql
                                        //         mutation {
                                        //             productVariantUpdate(input: {id: "${edge.node.id}", inventoryQuantities: {availableQuantity : ${Number(kickscrewProducts[count].quantity)}, locationId: "${locationID}" } }) {
                                        //                 productVariant {
                                        //                     id
                                        //                     inventoryQuantity
                                        //                     selectedOptions {
                                        //                         name
                                        //                         value
                                        //                     }
                                        //                     product {
                                        //                         id
                                        //                         title
                                        //                         legacyResourceId
                                        //                     }
                                        //                 }
                                        //                 userErrors {
                                        //                     field
                                        //                     message
                                        //                 }
                                        //             }
                                        //         }`,
                                        // );

                                        const responseOfQuantityUpdate = await admin.graphql(
                                            `#graphql
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
                                            }`,
                                            {
                                                variables: {
                                                    "input": {
                                                        "reason": "correction",
                                                        "name": "available",
                                                        "changes": [
                                                            {
                                                                "delta": delta,
                                                                "inventoryItemId": inventoryItemID,
                                                                "locationId": locationID
                                                            }
                                                        ]
                                                    }
                                                },
                                            },
                                        );

                                        const dataOfQuantityUpdate = await responseOfQuantityUpdate.json();

                                        console.log("dataOfQuantityUpdate", dataOfQuantityUpdate?.data);

                                    }

                                }

                            } else {
                                console.log("-------------------------------------------------Size is not same-------------------------------");

                            }
                            compareCount++
                        }


                        // const compareQuantity = dataOfProductVariants?.data?.product?.variants?.edges?.map(async (edge) => {


                        // })
                        // console.log("compareQuantity", compareQuantity);
                    }


                } else {
                    // console.log("tagValue doesnt exist");

                }


                count++
            }

            // ................................end................................................
            kickscrewCurrentPage++
        }

        console.log("First Page Products........................", kickscrewProducts?.[0]);
        console.log("All Products........................", kickscrewProducts.length);

        return json({ message: 'Got Data Successfully!' })

    } catch (error) {
        console.log("error while syncProducts.......", error);
        return json({ message: 'error while syncProducts.......' })
    }

}
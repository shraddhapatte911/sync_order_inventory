import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import fetchListedProducts from "../apis/fetchListedProducts";

export const loader = async ({ request }) => {
    try {
        const { session, admin } = await authenticate.admin(request);
        const api_key = process.env.crewsupply_api_key;

        // ....................................shopify products fetching...........................................

        // const metafield = new admin.rest.resources.Metafield({ session: session });
        // metafield.product_id = 7893852749959;
        // metafield.namespace = "crewsupply_info";
        // metafield.key = "model_no";
        // metafield.value = "DH4692-003";
        // metafield.type = "single_line_text_field";
        // await metafield.save({
        //     update: true,
        // });

        // return json({ message: 'success' })
        // let storeProducts = [];
        // let storeProductsHasNextPage = true;
        // let storeProductsEndcursor = null
        // // let count = 0
        // while (storeProductsHasNextPage) {
        //     // console.log('storeProductsHasNextPage', storeProductsHasNextPage);
        //     // console.log('storeProductsEndcursor', JSON.stringify(storeProductsEndcursor));
        //     const response = await admin.graphql(
        //         `#graphql
        //             query {
        //                 products(first: 30, after: ${storeProductsEndcursor}) {
        //                     edges {
        //                         node {
        //                         id
        //                         title
        //                         handle
        //                         totalInventory
        //                         }
        //                         cursor
        //                     }
        //                     pageInfo {
        //                         hasNextPage
        //                         hasPreviousPage
        //                         startCursor
        //                         endCursor
        //                     }
        //                 }
        //             }`,
        //     );

        //     const data = await response.json();
        //     // console.log('data--------------------------',data);

        //     storeProducts.push(...data.data?.products?.edges);
        //     // storeProductsHasNextPage = data.data?.products.pageInfo.hasNextPage;
        //     storeProductsHasNextPage = false
        //     storeProductsEndcursor = data.data?.products.pageInfo.endCursor;

        //     console.log('after data?.products.pageInfo.hasNextPage', data.data?.products.pageInfo.hasNextPage);
        //     // count++
        // }
        // console.log("storeProducts[0].........", storeProducts?.[0]);
        // console.log("storeProducts.........", storeProducts);

        // ........................................kickscrew products fetching..........................................

        let kickscrewProducts = []
        let kickscrewHasNextPage = true
        let kickscrewTotalPages;
        let kickscrewTotalItems;
        let kickscrewItemsPerPage = 2
        let kickscrewCurrentPage = 0

        while (kickscrewHasNextPage && kickscrewCurrentPage < 2) {
            const { totalProducts, gotProducts } = await fetchListedProducts(kickscrewCurrentPage, kickscrewItemsPerPage, api_key);

            // console.log("totalProducts, gotProducts ", totalProducts, "            ", gotProducts);


            const hasNextPageS = (kickscrewCurrentPage + 1) * kickscrewItemsPerPage < totalProducts;
            const hasPrevPageS = kickscrewCurrentPage > 0;

            kickscrewProducts = [...kickscrewProducts, ...gotProducts]
            kickscrewHasNextPage = hasNextPageS
            kickscrewTotalPages = Math.ceil(totalProducts / kickscrewItemsPerPage)
            kickscrewTotalItems = totalProducts
            // console.log("kickscrewHasNextPage", kickscrewHasNextPage);

            // ................................store products.....................................
            let count = 0;
            // console.log("count !== kickscrewProducts.length", count !== kickscrewProducts.length);

            while (count !== kickscrewProducts.length) {
                // console.log("kickscrewProducts.length", kickscrewProducts.length, '      ', kickscrewProducts[count].model_number);
                console.log("kickscrewProducts[count]", kickscrewProducts[count]);


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
                // console.log('data.data?.products?.edges--------------------------', dataOfProductTag.data?.products?.edges);

                const responseProductVariants = await admin.graphql(
                    `#graphql
                    query {
                        product(id: "gid://shopify/Product/7893747236999") {
                            title
                            variants(first: 10) {
                                edges {
                                    node {
                                    id
                                    inventoryQuantity
                                        selectedOptions {
                                            name
                                            value
                                        }
                                    
                                    }
                                }
                            }
                        }
                    }`,
                );

                const dataOfProductVariants = await responseProductVariants.json()

                // console.log("Product variants size value:", dataOfProductVariants?.data?.product?.variants?.edges?.map(edge => edge.node.selectedOptions));


                const compareQuantity = dataOfProductVariants?.data?.product?.variants?.edges?.map(edge => {

                    console.log("edge.node.selectedOptions?.[0].value === kickscrewProducts[count].model_size------------------------------------------", edge.node.selectedOptions?.[0].value === kickscrewProducts[count].model_size);
                    console.log("edge.node.selectedOptions?.[0].value", edge.node.selectedOptions?.[0].value);
                    console.log("kickscrewProducts[count].model_size", kickscrewProducts[count].model_size);
                    console.log("kickscrewProducts[count].quantity", kickscrewProducts[count].quantity);
                    console.log("edge.node.inventoryQuantity", edge.node.inventoryQuantity);
                    console.log("kickscrewProducts[count].quantity === edge.node.inventoryQuantity", kickscrewProducts[count].quantity === edge.node.inventoryQuantity);
                    if (edge.node.selectedOptions?.[0].value === kickscrewProducts[count].model_size) {
                        console.log("hit size true------");

                        if (kickscrewProducts[count].quantity === edge.node.inventoryQuantity) {
                            console.log("hit quantity true------");
                            return true

                        } else {
                            console.log("hit quantity false------");
                            return false

                        }

                    } else {
                        console.log("hit size false------");
                        return false

                    }
                })

                console.log("compareQuantity", compareQuantity);



                count++
            }

            // ................................end................................................
            kickscrewCurrentPage++
        }

        // console.log("First Page Products........................", kickscrewProducts?.[0]);
        // console.log("All Products........................", kickscrewProducts.length);

        return json({ message: 'Got Data Successfully!' })

    } catch (error) {
        console.log("error while syncProducts.......", error);
        return json({ message: 'error while syncProducts.......' })
    }

}
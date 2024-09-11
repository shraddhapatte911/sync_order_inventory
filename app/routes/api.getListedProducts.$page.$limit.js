import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import fetchListedProducts from "../apis/fetchListedProducts";

export const loader = async ({ request, params }) => {
    console.log("triggered getListedProducts api");

    try {
        const { admin, session } = await authenticate.admin(request);
        const page_no = parseInt(params.page, 10);
        const page_size = parseInt(params.limit, 10);
        const api_key = process.env.crewsupply_api_key;

        const { totalProducts, gotProducts } = await fetchListedProducts(page_no, page_size, api_key);

        const hasNextPage = (page_no + 1) * page_size < totalProducts;
        const hasPrevPage = page_no > 0;

        // console.log("gotProducts from fetchListedProducts..........", gotProducts.length,
        //     "       totalProducts", totalProducts,
        //     "         hasNextPage", hasNextPage,
        //     "         hasPrevPage", hasPrevPage,
        //     "         page_no", page_no,
        //     "         page_size", page_size
        // );

        return json({
            ProductsData: gotProducts,
            hasNextPageS: hasNextPage,
            hasPrevPageS: hasPrevPage,
            totalItemsS: totalProducts,
            limit: page_size
        })
    } catch (error) {
        console.log("Error while fetching data in getListedProducts:", error);
        return json({ message: "Error while fetching data in getListedProducts", error });
    }
}

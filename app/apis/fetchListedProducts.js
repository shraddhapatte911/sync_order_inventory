const fetchListedProducts = async (page_no, page_size, api_key) => {
    let totalProducts;
    let gotProducts = [];
    // console.log("page_no, page_size, api_key", page_no, "    ", page_size, "     ", api_key);

    try {
        const responseOfModelNo = await fetch("https://api.crewsupply.kickscrew.com/sapi/v2/stock/list", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "x-api-key": api_key,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                page_no,
                page_size,
                min_qty: 1
            })
        });

        const dataOfModelNo = await responseOfModelNo.json();
        // console.log("dataOfModelNo from fetchListedProducts..........", dataOfModelNo);

        if (dataOfModelNo?.data) {
            totalProducts = dataOfModelNo.total;

            for (const _d of dataOfModelNo.data) {
                const responseOfProducts = await fetch(`https://api.crewsupply.kickscrew.com/sapi/v2/product/${_d.model_no}`, {
                    method: "GET",
                    headers: {
                        "accept": "application/json",
                        "x-api-key": api_key,
                    },
                });
                const dataOfProducts = await responseOfProducts.json();
                // console.log("dataOfProducts from fetchListedProducts.........", dataOfProducts);

                gotProducts.push({ ...(dataOfProducts.data), model_no_id: _d.id, quantity: _d.qty, model_size: _d.size, modal_price: _d.price });
            }

            // console.log("gotProducts from fetchListedProducts..........", gotProducts);
            return { totalProducts, gotProducts };

        } else {
            return { message: "error occurred no data in response" };
        }

    } catch (error) {
        console.log("caught error in fetchListedProducts:", error);
        return { message: "error occurred in fetchListedProducts", error };
    }
}

export default fetchListedProducts;

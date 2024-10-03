const fetchCreatedOrders = async (page_no, api_key) => {
    let totalOrders;
    let gotOrders = [];
    // console.log("page_no, page_size, api_key", page_no, "    ", page_size, "     ", api_key);

    try {
        const urlWithDateRange = `https://api.crewsupply.kickscrew.com/sapi/v2/orders?page=${page_no}&date_from=${"2024-08-02T02:33:14.000Z"}&date_to=${"2024-08-02T02:33:14.000Z"}&status=${"order.confirmed,order.packed,order.completed,order.canceled"}`
        const urlWithoutDateRange = `https://api.crewsupply.kickscrew.com/sapi/v2/orders?page=${page_no}&status=${"order.confirmed,order.packed,order.completed,order.canceled"}`
        const responseOfOrders = await fetch(urlWithDateRange, {
            method: "GET",
            headers: {
                "accept": "application/json",
                "x-api-key": api_key,
                "Content-Type": "application/json"
            },
        });

        const dataOfOrders = await responseOfOrders.json();
        // console.log("dataOfOrders from fetchCreatedOrders..........", dataOfOrders);
        if (dataOfOrders?.data?.length) {
            totalOrders = dataOfOrders.meta
            gotOrders = dataOfOrders?.data
        }

        return { totalOrders, gotOrders };


    } catch (error) {
        console.log("caught error in fetchCreatedOrders:", error);
        return { message: "error occurred in fetchCreatedOrders", error };
    }
}

export default fetchCreatedOrders;

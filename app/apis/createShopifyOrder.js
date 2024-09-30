async function createShopifyOrder() {
    try {
        const responseOfCreateOrders = await fetch("/api/createShopifyOrders");

        // console.log("responseOfCreateOrders", responseOfCreateOrders);

        if (responseOfCreateOrders.ok) {
            return { status: "finished", message: "Order created successfully", };
        } else {
            const errorData = await responseOfCreateOrders.json();
            console.error("Error creating order:", errorData);
            return { status: "error", message: errorData.message || "Failed to create order" };
        }
    } catch (error) {
        console.error("Network error while creating order:", error);
        return { status: "error", message: "Network error while creating order" };
    }
}

export default createShopifyOrder;

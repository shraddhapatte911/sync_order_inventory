async function updateShopifyProducts() {
    try {
        const responseOfStoreProducts = await fetch("/api/updateShopifyProducts");

        // console.log("responseOfStoreProducts", responseOfStoreProducts);

        if (responseOfStoreProducts.ok) {
            return { status: "finished", message: "successfully updated Shopify products" };
        } else {
            const errorData = await responseOfStoreProducts.json();
            console.error("Error updating products:", errorData);
            return { status: "error", message: errorData.message || "Failed to update Shopify products" };
        }
    } catch (error) {
        console.error("Fetch error:", error);
        return { status: "error", message: "Network error while updating Shopify products" };
    }
}

export default updateShopifyProducts;

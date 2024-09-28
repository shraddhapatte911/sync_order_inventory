
async function updateShopifyProducts() {
    const responseOfStoreProducts = await fetch("/api/updateShopifyProducts")

    // console.log("responseOfStoreProducts", await responseOfStoreProducts.json())
}

export default updateShopifyProducts
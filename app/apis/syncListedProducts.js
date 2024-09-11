
async function syncListedProducts() {
    const responseOfStoreProducts = await fetch("/api/syncProducts")

    console.log("responseOfStoreProducts", await responseOfStoreProducts.json())
}

export default syncListedProducts
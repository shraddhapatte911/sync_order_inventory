const updateKickscrewProducts = async (variants, tag, api_key) => {
    try {
        // console.log("api_key", api_key);

        const modelNoResponse = await fetch("https://api.crewsupply.kickscrew.com/sapi/v2/stock/get", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "x-api-key": api_key,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ "model_no": tag })
        });

        const modelNoData = await modelNoResponse.json();

        if (!modelNoData?.data?.length) {
            return `model_no not found on kickscrew for tag: ${tag}`;
        }


        const sizeDataMap = new Map();

        modelNoData.data.forEach(d => {
            sizeDataMap.set(d.size, d);
        });
        // console.log("sizeDataMap", sizeDataMap);

        const items = variants.map(variant => {
            const filteredData = sizeDataMap.get(variant.option1);
            if (filteredData) {
                return {
                    model_no: tag,
                    size_system: filteredData.size_system,
                    size: variant.option1,
                    qty: variant.inventory_quantity,
                    price: filteredData.price,
                    brand: filteredData.brand,
                    ext_ref: "",
                    sku: variant.sku
                };
            }
            return null;
        }).filter(item => item !== null);

        if (items.length === 0) {
            return `No valid variants found for tag: ${tag}`;
        }


        const quantityUpdateBody = { items };

        // console.log("quantityUpdateBody", quantityUpdateBody);

        const quantityUpdateResponse = await fetch("https://api.crewsupply.kickscrew.com/sapi/v2/stock/batch-update", {
            method: "POST",
            headers: {
                "accept": "application/json",
                "x-api-key": api_key,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(quantityUpdateBody)
        });

        const quantityUpdateData = await quantityUpdateResponse.json();
        return quantityUpdateData;

    } catch (error) {
        console.error("error from updateKickscrewProducts", error);
        throw error;
    }
};

export default updateKickscrewProducts;

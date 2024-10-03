const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 3000;

export const graphqlRequest = async (shopData, query, variables, api_version = "2024-07") => {
    // console.log("dsfsdfdfsddffd------------------sdfdfsdfsd", shopData, "     ", query, "       ", variables);
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        // console.log("shopData[0]?.shop----------------->", shopData[0]?.shop);
        // console.log("shopData[0]?.accessToken------------>", shopData[0]?.accessToken);

        try {
            const response = await fetch(`https://${shopData[0]?.shop}/admin/api/${api_version}/graphql.json`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": shopData[0]?.accessToken
                },
                body: JSON.stringify({
                    query: query, ...(variables ? variables : {})
                })
            })

            const data = await response.json();
            // console.log('data===============================================+>', data);


            if (data.errors) {
                if (attempt === MAX_RETRIES) {
                    console.error(`Failed after ${MAX_RETRIES} attempts on data.errors:`, data.errors);

                }
                console.warn(`Retrying request (${attempt}/${MAX_RETRIES}) due to error:`, data.errors);
                await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
            }

            if (!response.ok) {
                // throw new Error(`GraphQL error: ${data?.errors?.map(e => e.message).join(', ')}`);
                console.log("data of errors", data);

            }
            return data;
        } catch (error) {
            if (attempt === MAX_RETRIES) {
                console.error(`Failed after ${MAX_RETRIES} attempts:`, error);
                throw error;
            }
            console.warn(`Retrying request (${attempt}/${MAX_RETRIES}) due to error:`, error);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
};
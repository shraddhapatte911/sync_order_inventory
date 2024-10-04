const MAX_RETRIES = 3;
const DELAY_DUR = 5000

export const restApiRequest = async (shopData, bodyData, endPoint, method = "POST") => {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const apiURL = `https://${shopData[0]?.shop}${endPoint}`;

            const response = await fetch(apiURL, {
                method,
                headers: {
                    "Content-Type": "application/json",
                    "X-Shopify-Access-Token": shopData[0]?.accessToken
                },
                ...(method === "GET" ? {} : { body: JSON.stringify(bodyData) })
            });

            const data = await response.json();

            if (!response.ok) {
                console.error("Response isn't ok of rest api:", data);

                if (data.errors && data.errors.includes('API rate limit')) {
                    const retryAfter = 60 * 1000; // 60 seconds
                    console.warn(`Rate limit exceeded. Retrying request after ${retryAfter / 1000} seconds.`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter));
                    continue; 
                }

                if (attempt === MAX_RETRIES) {
                    throw new Error(`Failed response isn't ok after ${MAX_RETRIES} attempts: ${JSON.stringify(data.errors)}`);
                }

                console.warn(`Retrying request due to error (${attempt}/${MAX_RETRIES}):`, data.errors);
                await new Promise(resolve => setTimeout(resolve, DELAY_DUR)); 
                continue; 
            }

            return data; 
        } catch (error) {
            if (attempt === MAX_RETRIES) {
                console.error(`Failed after ${MAX_RETRIES} attempts:`, error);
                throw error;
            }
            console.warn(`Retrying request due to error (${attempt}/${MAX_RETRIES}):`, error);
            await new Promise(resolve => setTimeout(resolve, DELAY_DUR)); 
        }
    }
};

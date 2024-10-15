import cron from 'node-cron';
import prisma from '../db.server';
import fetchCreatedOrders from '../apis/fetchCreatedOrders';
import { graphqlRequest } from '../components/graphqlRequest';
import { restApiRequest } from '../components/restApiRequest';

const ORDERS_PER_PAGE = 100;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export async function cron_orders_shopify_create() {

    const task = async () => {
        try {
            const shopData = await prisma.session.findMany();
            if (!shopData.length) return console.log("No shop data found on order cron.");

            const apiKey = process.env.crewsupply_api_key;
            if (!apiKey) return console.log("API key is empty on order cron.");

            console.log("Sync order has started of orders through cron!");

            const firstStatus = await prisma.SyncStatus.findFirst();
            if (!firstStatus) {
                console.error("No records found in SyncStatus");
            } else {

                const updateFirstStatus = await prisma.SyncStatus.update({
                    where: { id: firstStatus.id },
                    data: { isOrderProcessing: true },
                });
                // console.log("updateFirstStatus", updateFirstStatus);
            }

            let totalOrdersToCreate = [];
            let currentPage = 0;
            let hasNextPage = true;

            while (hasNextPage) {
                const { totalOrders, gotOrders } = await fetchCreatedOrders(currentPage, apiKey);
                totalOrdersToCreate.push(...gotOrders);
                hasNextPage = (currentPage + 1) * ORDERS_PER_PAGE < totalOrders;
                currentPage++;
            }

            await Promise.all(totalOrdersToCreate.map(processOrder(shopData)));

            console.log("Sync completed successfully. All orders have been created on Shopify store of cron.");
            return console.log("Successfully created orders!");

        }
        catch (error) {
            console.error("Error during order creation on cron:", error);
            return console.log("Error occurred while creating orders on cron!");
        } finally {

            const firstStatus = await prisma.SyncStatus.findFirst();

            if (!firstStatus) {
                console.error("No records found in SyncStatus");
            } else {

                const updateFirstStatus = await prisma.SyncStatus.update({
                    where: { id: firstStatus.id },
                    data: { isOrderProcessing: false },
                });
                // console.log("updateFirstStatus", updateFirstStatus);
            }
        }
    };

    // try {
    //     task()
    // } catch (error) {
    //     console.log("error on task  cron orders.........", error);
    // }

    // const scheduledTime = '0 */48 * * *'   // cron job to run every 48 hours

    const scheduledTime = '0 * * * *';  // cron job to run every hour

    // const scheduledTime = '0 */2 * * *';  // cron job to run every 2 hours

    // // const scheduledTime = '*/15 * * * * *' // to run every 10 seconds

    const scheduledJob = cron.schedule(scheduledTime, task);

    scheduledJob.on('error', (err) => {
        console.error('Error in cron scheduling of cron_orders_shopify_create:', err.message);

    });

    console.log('Cron job scheduled to run every 2 hours of cron_orders_shopify_create');

}



const processOrder = (shopData) => async (order) => {
    try {
        const variantId = await getVariantId(shopData, order);
        // variantId ? console.log("YES order.model_no", order.model_no) : console.log("NO order.model_no", order.model_no)
        if (!variantId) return console.warn(`Variant not found for model_no: ${order.model_no}`);

        const existingOrder = await findExistingOrder(shopData, order.order_id);
        // console.log("existingOrder.............................>",existingOrder);

        if (existingOrder) {
            await updateExistingOrder(shopData, existingOrder, order);
        } else {
            await createNewOrder(shopData, order, variantId);
        }
    } catch (error) {
        console.error(`Error processing order ${order.order_id}:`, error);
    }
};

const getVariantId = async (shopData, order) => {
    const productTagQuery = `
        query {
            products(first: 10, query: "tag:${order.model_no}") {
                edges {
                    node {
                        id
                        variants(first: 250) {
                            edges {
                                node {
                                    id
                                    selectedOptions {
                                        name
                                        value
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }`;

    const data = await graphqlRequest(shopData, productTagQuery);
    if (data?.data?.products?.edges) {
        const productEdges = data.data.products.edges;

        if (productEdges.length) {
            const variants = productEdges[0].node.variants.edges;
            const filteredVariants = variants.filter(variant =>
                variant.node.selectedOptions[0].value === order.size.displayValue.split(" ")[1]
            );
            return filteredVariants.length ? Number(filteredVariants[0].node.id.slice(29)) : null;
        }
    }
    console.warn("No products found for model_no:", order.model_no);
    return null;
};

const findExistingOrder = async (shopData, orderId) => {
    const orderIDQuery = `
        query {
            orders(first: 10, query: "name:K_ID-${orderId}") {
                edges {
                    node {
                        id
                        displayFulfillmentStatus
                        cancelledAt
                    }
                }
            }
        }`;

    const data = await graphqlRequest(shopData, orderIDQuery);
    return data?.data?.orders?.edges?.[0]?.node || null;
};

const updateExistingOrder = async (shopData, existingOrder, order) => {
    const createdOrderID = existingOrder.id.slice(20);
    if (order.status === "order.completed" && existingOrder.displayFulfillmentStatus !== "FULFILLED") {
        console.log("update to completed");
        await fulfillOrder(shopData, createdOrderID);
    } else if (order.status === "order.canceled" && existingOrder.cancelledAt === null) {
        console.log("update to canceled");
        await cancelOrder(shopData, createdOrderID);
    } else {
        console.log("No update needed for existing order:", existingOrder);
    }
};

const fulfillOrder = async (shopData, orderID) => {
    // console.log("fullfillment create >>>>>>>>>>>>>>>>>>>>>>>>>>>>");
    const orderFulfillmentQuery = `
        mutation fulfillmentCreate($fulfillment: FulfillmentInput!) {
            fulfillmentCreate(fulfillment: $fulfillment) {
                fulfillment {
                    id
                }
                userErrors {
                    field
                    message
                }
            }
        }`;

    const orderEndpoint = `/admin/api/2023-04/orders/${orderID}/fulfillment_orders.json`;
    const orderResponse = await restApiRequest(shopData, {}, orderEndpoint, "GET");
    if (orderResponse?.fulfillment_orders?.[0]?.line_items?.[0]?.fulfillment_order_id) {
        const orderFulfillmentId = orderResponse.fulfillment_orders[0].line_items[0].fulfillment_order_id;

        await graphqlRequest(shopData, orderFulfillmentQuery, {
            variables: {
                fulfillment: {
                    lineItemsByFulfillmentOrder: [{
                        fulfillmentOrderId: `gid://shopify/FulfillmentOrder/${orderFulfillmentId}`
                    }]
                }
            }
        }, "2024-10");
    }
};

const cancelOrder = async (shopData, orderID) => {
    const orderCancEndpoint = `/admin/api/2024-07/orders/${orderID}/cancel.json`;
    await restApiRequest(shopData, {}, orderCancEndpoint);
};

const createNewOrder = async (shopData, order, variantId) => {
    const nameArray = order.recipient_name.split(" ");
    const orderCreateReqBody = {
        order: {
            name: `K_ID-${order.order_id}`,
            line_items: [{
                variant_id: variantId,
                quantity: 1,
                price: order.price,
                properties: {
                    "_kickscrew_order-id": order.order_id,
                    "_kickscrew_order-size": order.size,
                    "_kickscrew_order-on_hold": order.on_hold,
                    "_kickscrew_order-brand": order.brand,
                    "_kickscrew_order-currency": order.currency,
                    "_kickscrew_order-status": order.status,
                    "_kickscrew_order-cancel_reason": order.cancel_reason,
                    "_kickscrew_order-service_fee": order.service_fee,
                    "_kickscrew_order-operation_fee": order.operation_fee,
                    "_kickscrew_order-income": order.income,
                    "_kickscrew_order-customer_order_reference": order.customer_order_reference,
                    "_kickscrew_order-created_at": order.created_at,
                    "_kickscrew_order-ext_ref": order.ext_ref,
                    "_kickscrew_order-payout": order.payout,
                },
                ...(order.status === "order.completed" ? { fulfillment_status: "fulfilled" } : {})
            }],
            customer: {
                first_name: nameArray.slice(0, -1).join(" "),
                last_name: nameArray[nameArray.length - 1],
            },
            shipping_address: {
                first_name: nameArray.slice(0, -1).join(" "),
                last_name: nameArray[nameArray.length - 1],
                address1: order.address_line1,
                address2: order.address_line2,
                phone: order.mobile,
                city: order.city,
                province: order.state_province,
                country: order.country,
                zip: order.zip,
            }
        }
    };

    const orderCreateEndpoint = "/admin/api/2024-07/orders.json";
    const orderCreateResData = await restApiRequest(shopData, orderCreateReqBody, orderCreateEndpoint)
    // console.log("orderCreateResData", orderCreateResData);
    if (orderCreateResData?.order?.id) {

        const createdOrderID = orderCreateResData.order.id
        // console.log("createdOrderID", createdOrderID);
        await delay(4000)
        // for now uncomment
        if (order.status === "order.completed") {
            console.log('on completed');
        } else if (order.status === "order.canceled") {
            console.log('on cancel');
            const orderCancEndPoint = `/admin/api/2024-07/orders/${createdOrderID}/cancel.json`
            const orderCancReqBody = {}
            const orderCancResData = await restApiRequest(shopData, orderCancReqBody, orderCancEndPoint)
            // console.log("orderCancResData", orderCancResData);
        } else {
            console.log('no operation needed status:', order.status);
        }
    }
    console.log(`New order created for order ID: ${order.order_id}`);
};




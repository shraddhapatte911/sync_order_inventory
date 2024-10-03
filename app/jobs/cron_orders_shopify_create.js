import cron from 'node-cron';
import prisma from '../db.server';
import fetchCreatedOrders from '../apis/fetchCreatedOrders';
import { graphqlRequest } from '../components/graphqlRequest';
import { restApiRequest } from '../components/restApiRequest';


export async function cron_orders_shopify_create() {

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const task = async () => {
        try {
            const shopData = await prisma.session.findMany()

            if (!shopData.length) return

            // console.log('Task executed at:', new Date(), shopData);
            console.log("sync order has been started of cron!");
            const api_key = process.env.crewsupply_api_key;
            // console.log("api_key", api_key);


            let totalOrdersToCreate = [];
            let kickscrewCurrentPage = 0;
            const kickscrewOrdersPerPage = 100;
            let kickscrewHasNextPage = true;

            while (kickscrewHasNextPage) {
                const { totalOrders, gotOrders } = await fetchCreatedOrders(kickscrewCurrentPage, api_key);
                totalOrdersToCreate.push(...gotOrders);

                kickscrewHasNextPage = (kickscrewCurrentPage + 1) * kickscrewOrdersPerPage < totalOrders;
                kickscrewCurrentPage++;
            }

            // console.log("First Order:", totalOrdersToCreate[0]);
            // console.log("Total Orders To Update:", totalOrdersToCreate);

            await Promise.all(totalOrdersToCreate.map(async (order) => {
                // console.log("order", order);

                const productTagQuery = `
                            query {
                                products(first: 10, query: "tag:${order.model_no}") {
                                    edges {
                                        node {
                                            id
                                            title
                                            handle
                                            totalInventory
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
                            }
                        `;
                const dataOfProductTag = await graphqlRequest(shopData, productTagQuery);
                // console.log("dataOfProductTag.data.products.edges", dataOfProductTag.data.products.edges);
                // console.log("dataOfProductTag.data.products.edges[0].node.variants.edges", dataOfProductTag.data.products.edges[0].node.variants.edges);

                let varantIdForOrder;

                if (dataOfProductTag.data.products.edges.length) {
                    if (dataOfProductTag.data.products.edges[0].node.variants.edges.length) {
                        const filteredSize = dataOfProductTag.data.products.edges[0].node.variants.edges.map(element => {
                            // console.log("element", element);

                            if (element.node.selectedOptions.length) {
                                // console.log(`order.size.displayValue.split(" ")[1]`, order.size.displayValue.split(" ")[1]);

                                return element.node.selectedOptions[0].value === order.size.displayValue.split(" ")[1] ? { id: element.node.id, size: element.node.selectedOptions[0].value } : null
                            } else {
                                console.warn("no options found on cron_orders for the modal_no:", order.model_no);
                            }
                        }).filter(e => e !== null);

                        // console.log("filteredSize on cron_order", filteredSize);
                        varantIdForOrder = Number(filteredSize[0].id.slice(29))
                        // console.log("varantIdForOrder",varantIdForOrder , "  ", typeof varantIdForOrder);

                    } else {
                        console.warn("no variant found cron_orders for the modal_no:", order.model_no);
                    }


                } else {
                    console.warn("not products found on cron_orders for the modal_no:", order.model_no);
                }


                try {

                    const orderIDQuery = `
                        query {
                            orders(first: 10, query: "name:K_ID-${order.order_id}") {
                                edges {
                                    node {
                                        id
                                        displayFulfillmentStatus
                                        cancelledAt
                                    }
                                }
                            }
                        }
                    `;

                    const dataOfOrderID = await graphqlRequest(shopData, orderIDQuery);

                    // console.log("dataOfOrderID", dataOfOrderID?.data?.orders?.edges);

                    if (dataOfOrderID?.data?.orders?.edges && dataOfOrderID?.data?.orders?.edges.length === 1) {
                        console.log("ORDER ALREADY PRESENT NOW UPDATING IT..............");
                        const createdOrderID = dataOfOrderID.data.orders.edges?.[0]?.node.id.slice(20)

                        if (order.status === "order.completed" && dataOfOrderID.data.orders.edges?.[0]?.node.displayFulfillmentStatus !== "FULFILLED") {
                            // console.log("on update completed  order.status", order.status);
                            // console.log("on update completed  dataOfOrderID.data.orders.edges?.[0]?.node.displayFulfillmentStatus", dataOfOrderID.data.orders.edges?.[0]?.node.displayFulfillmentStatus);
                            console.log("not completed");

                            const order_idEndPoint = `/admin/api/2023-04/orders/${createdOrderID}/fulfillment_orders.json`
                            const order_idReqBody = {}
                            const order_idResData = await restApiRequest(shopData, order_idReqBody, order_idEndPoint, "GET")
                            // console.log("order_idResData", order_idResData);
                            // console.log("sdsdfsdfsdfsdfsdfsdfsdf", order_idResData.fulfillment_orders[0].line_items);

                            const order_fulfillment_id = order_idResData.fulfillment_orders[0].line_items[0].fulfillment_order_id
                            // console.log("order_fulfillment_id", order_fulfillment_id);

                            const orderCompIDQuery = `
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
                                }
                            `;
                            const api_version = "2024-10"
                            const dataOfOrderComp = await graphqlRequest(shopData, orderCompIDQuery, {
                                variables: {
                                    "fulfillment": {
                                        "lineItemsByFulfillmentOrder": [
                                            {
                                                "fulfillmentOrderId": `gid://shopify/FulfillmentOrder/${order_fulfillment_id}`
                                            }
                                        ]
                                    }
                                }
                            },api_version);

                            // console.log("dataOfOrderComp", dataOfOrderComp);

                        } else if (order.status === "order.canceled" && dataOfOrderID.data.orders.edges?.[0]?.node.cancelledAt === null) {
                            // console.log("on update canceled  order.status", order.status);
                            // console.log("on update canceled  dataOfOrderID.data.orders.edges?.[0]?.node.cancelledAt", dataOfOrderID.data.orders.edges?.[0]?.node.cancelledAt === null);
                            console.log("not canceled");
                            const orderCancEndPoint = `/admin/api/2024-07/orders/${createdOrderID}/cancel.json`
                            const orderCancReqBody = {}
                            const orderCancResData = await restApiRequest(shopData, orderCancReqBody, orderCancEndPoint)
                            // console.log("orderCancResData", orderCancResData);
                        } else {
                            console.log("completed or canceled no need to update, node data:", dataOfOrderID.data.orders.edges?.[0]?.node);

                        }
                    } else if (dataOfOrderID.data.orders.edges.length > 1) {
                        console.warn("TWO SAME KICKSCREW ORDERS DETECTED......................");
                    } else {
                        console.log("ITS NEW ORDER NOW CREATING IT...............");

                        const nameArray = order.recipient_name.split(" ")
                        // console.log("order.mobile", order.mobile, "    type    ", typeof order.mobile);

                        const orderCreateReqBody = {
                            "order": {
                                "name": `K_ID-${order.order_id}`,
                                "line_items": [
                                    {
                                        "variant_id": varantIdForOrder,
                                        "quantity": 1, // need to confirm first
                                        "price": order.price,
                                        "properties": {
                                            "kickscrew_order-id": order.order_id,
                                            "kickscrew_order-size": order.size,
                                            "kickscrew_order-on_hold": order.on_hold,
                                            "kickscrew_order-brand": order.brand,
                                            "kickscrew_order-currency": order.currency,
                                            "kickscrew_order-status": order.status,
                                            "kickscrew_order-cancel_reason": order.cancel_reason,
                                            "kickscrew_order-service_fee": order.service_fee,
                                            "kickscrew_order-operation_fee": order.operation_fee,
                                            "kickscrew_order-income": order.income,
                                            "kickscrew_order-customer_order_reference": order.customer_order_reference,
                                            "kickscrew_order-created_at": order.created_at,
                                            "kickscrew_order-ext_ref": order.ext_ref,
                                            "kickscrew_order-payout": order.payout,
                                        },
                                        ...(order.status === "order.completed" ? { "fulfillment_status": "fulfilled" } : {})
                                    }
                                ],
                                "customer": {
                                    "first_name": nameArray.slice(0, -1).join(" "),
                                    "last_name": nameArray[nameArray.length - 1],
                                },
                                "shipping_address": {
                                    "first_name": nameArray.slice(0, -1).join(" "),
                                    "last_name": nameArray[nameArray.length - 1],
                                    "address1": order.address_line1,
                                    "address2": order.address_line2,
                                    "phone": order.mobile,
                                    "city": order.city,
                                    "province": order.state_province,
                                    "country": order.country,
                                    "zip": order.zip
                                }

                            }
                        }
                        const orderCreateEndPoint = "/admin/api/2024-07/orders.json"
                        const orderCreateResData = await restApiRequest(shopData, orderCreateReqBody, orderCreateEndPoint)
                        // console.log("orderCreateResData", orderCreateResData);
                        const createdOrderID = orderCreateResData.order.id

                        // console.log("createdOrderID", createdOrderID);


                        await delay(4000)

                        // for now uncomment
                        if (order.status === "order.completed") {
                            // console.log('on completed', order.status);

                        } else if (order.status === "order.canceled") {
                            console.log('on cancel', order.status);
                            const orderCancEndPoint = `/admin/api/2024-07/orders/${createdOrderID}/cancel.json`
                            const orderCancReqBody = {}
                            const orderCancResData = await restApiRequest(shopData, orderCancReqBody, orderCancEndPoint)
                            // console.log("orderCancResData", orderCancResData);
                        } else {
                            console.log('no operation needed status:', order.status);
                        }
                    }

                } catch (error) {
                    console.error(`Error creating order ${order.order_id}:`, error);
                }
            }));

            console.log("Sync completed successfully. All orders have been created on shopify store using cron.");

        } catch (error) {
            console.error("Error while syncing orders:", error);
        }
    };

    try {
        task()
    } catch (error) {
        console.log("error on task  cron orders.........", error);
    }

    // const scheduledTime = '0 */48 * * *'   // cron job to run every 48 hours

    // const scheduledTime = '0 * * * *';  // cron job to run every hour

    // const scheduledTime = '0 */2 * * *';  // cron job to run every 2 hours

    // // const scheduledTime = '*/15 * * * * *' // to run every 10 seconds

    // const scheduledJob = cron.schedule(scheduledTime, task);

    // scheduledJob.on('error', (err) => {
    //     console.error('Error in cron scheduling of cron_orders_shopify_create:', err.message);

    // });

    console.log('Cron job scheduled to run every 2 hours of cron_orders_shopify_create');

}




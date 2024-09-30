import cron from 'node-cron';
import prisma from '../db.server';
import fetchCreatedOrders from '../apis/fetchCreatedOrders';
import { graphqlRequest } from '../components/graphqlRequest';
import { restApiRequest } from '../components/restApiRequest';


export async function cron_orders_shopify_create() {


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
            console.log("Total Orders To Update:", totalOrdersToCreate.length);

            await Promise.all(totalOrdersToCreate.map(async (order) => {
                // console.log("order.order_id", order);

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
                // console.log("dataOfProductTag", dataOfProductTag.data.products.edges);

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
                    const nameArray = order.recipient_name.split(" ")
                    console.log("order.mobile",order.mobile, "    type    ", typeof order.mobile);
                    
                    const orderCreateReqBody = {
                        "order": {
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
                            // "email": "jane@example.com",
                            // "phone": order.mobile,
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
                    const endPoint = "/admin/api/2024-07/orders.json"
                    const orderCreateResData = await restApiRequest(shopData, orderCreateReqBody, endPoint)
                    // console.log("orderCreateResData", orderCreateResData);

                } catch (error) {
                    console.error(`Error creating order ${order.order_id}:`, error);
                }
            }));

            console.log("Sync completed successfully. All orders have been created on shopify store using cron.");

        } catch (error) {
            console.error("Error while syncing orders:", error);
        }
    };

    // try {
    //     task()
    // } catch (error) {
    //     console.log("error on task  cron orders.........", error);
    // }

    // const scheduledTime = '0 */48 * * *'   // cron job to run every 48 hours

    // const scheduledTime = '0 * * * *';  // cron job to run every hour

    const scheduledTime = '0 */2 * * *';  // cron job to run every 2 hours

    // // const scheduledTime = '*/15 * * * * *' // to run every 10 seconds

    const scheduledJob = cron.schedule(scheduledTime, task);

    scheduledJob.on('error', (err) => {
        console.error('Error in cron scheduling of cron_orders_shopify_create:', err.message);

    });

    console.log('Cron job scheduled to run every 2 hours of cron_orders_shopify_create');

}




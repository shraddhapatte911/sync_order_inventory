import { Page, Button, Text, ChoiceList, BlockStack, Card, Grid, ProgressBar, Divider, ResourceList, ResourceItem } from '@shopify/polaris';
import React, { useCallback, useEffect, useState } from 'react';
import TableOfSelectedProducts from './TableOfSelectedProducts';
import Placeholder from '../Placeholder';
import { PlusIcon } from '@shopify/polaris-icons';
import ModalComponent from '../ModalComponent';
import updateShopifyProducts from '../../apis/updateShopifyProducts';
import createShopifyOrder from '../../apis/createShopifyOrder';

export default function ProductsAndOrdersSync() {
    const [products, setProducts] = useState([])
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPrevPage, setHasPrevPage] = useState(false);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(0);
    const [isLoadingTableData, setLoadingTableData] = useState(true)
    const itemsPerPage = 5
    const [isAction, setAction] = useState({
        isActionTrue: false,
        actionIDS: []
    })
    const [totalItems, setTotalItems] = useState(0)
    const [isLoading, setLoading] = useState({
        orderSync: false,
        productSync: false
    })

    useEffect(() => {
        fetchListedProducts()
        fetchSyncStatus()
    }, [currentPage])

    const fetchSyncStatus = async () => {
        try {
            const response = await fetch("/api/getSyncStatus")
            if (response.ok) {
                const data = await response.json()
                if (data?.syncStatus) {
                    setLoading({
                        orderSync: data?.syncStatus[0].isOrderProcessing,
                        productSync: data?.syncStatus[0].isProductProcessing
                    })
                }
                console.log("data of getSyncStatus", data);
            }
        } catch (error) {
            console.log("error while fetching syncstatus", error);
        }
    }

    const fetchListedProducts = async () => {
        try {
            const response = await fetch(`/api/getListedProducts/${currentPage}/${itemsPerPage}`, {
                method: 'GET',
                headers: {
                    "Content-Type": "application/json",
                }
            })

            if (response.ok) {
                const { ProductsData, hasNextPageS, hasPrevPageS, totalItemsS, limit } = await response.json()

                const dataWithRowNumber = ProductsData.map((product, index) => ({
                    rowNumber: currentPage * limit + index + 1,
                    ...product
                }));
                // console.log("ProductsData-----", ProductsData);
                setProducts(dataWithRowNumber)
                setHasNextPage(hasNextPageS)
                setHasPrevPage(hasPrevPageS)
                setTotalPages(Math.ceil(totalItemsS / limit));
                setTotalItems(totalItemsS)
            }

        } catch (error) {
            console.log("error while", error);
        } finally {
            setLoadingTableData(false)
        }
    }

    // const handleProductSelect = async () => {
    //     try {
    //         const selected = await shopify.resourcePicker({
    //             type: resourcetype,
    //             multiple: true,
    //             filter: {
    //                 // hidden: true,
    //                 variants: false,
    //                 // draft: false,
    //                 // archived: false,
    //             },
    //             selectionIds: selectedProducts
    //         });

    //         const selectedIDS = selected.map(d => ({
    //             id: d.id,
    //             ...(d.variants?.length > 0 ? {
    //                 variants: d.variants.map(cd => ({ id: cd.id }))
    //             } : {})
    //         }));

    //         console.log("selectedIDS", selectedIDS);
    //         setSelectedProducts(selectedIDS);

    //         const filteredIDS = selectedIDS.map(da => Number(da.id.slice(22)));
    //         console.log("filteredIDS", filteredIDS);

    //         const response = await fetch('/api/syncProduct', {
    //             method: 'POST',
    //             headers: {
    //                 'Content-Type': 'application/json'
    //             },
    //             body: JSON.stringify({ ids: filteredIDS })
    //         });

    //         if (response.ok) {
    //             const { message } = await response.json();
    //             // console.log("data from response", message);
    //             return shopify.toast.show(message);
    //         } else {
    //             console.error("Failed to sync products", await response.json());
    //         }
    //     } catch (error) {
    //         console.log("error occurred from handleProductSelect", error);
    //     }
    // };

    // const handleResourceTypeChange = useCallback((value) => setResourceType(value[0]), []);

    const handleToggleModal = () => {
        setAction(prev => ({
            ...prev,
            isActionTrue: !prev.isActionTrue
        }))
    }

    const handleRemoveProduct = async () => {
        setAction(prev => ({
            ...prev,
            isActionTrue: false
        }))
        // console.log("handleRemoveProduct clicked", isAction.actionIDS);
        try {
            shopify.toast.show('Product deletion process has started!');

            const response = await fetch(`/api/removeSyncProduct`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    idsToRemove: isAction.actionIDS
                })
            })

            if (response.ok) {
                const { message } = await response.json()
                shopify.toast.show(message)
            } else {
                console.log("Failed to remove products:", response.statusText);
            }
        } catch (error) {
            console.log("error while handleRemoveProduct", error);
        } finally {
            setCurrentPage(0)
        }
    }

    // const calculateItemNumber = (index) => {
    //     return currentPage * itemsPerPage + index + 1;
    // };

    const pollSyncStatus = async (type) => {
        await new Promise(resolve => setTimeout(resolve, 10000));
        let isComplete = false;

        while (!isComplete) {
            try {
                console.log("poling.........");
                const responseSyncStatus = await fetch("/api/getSyncStatus");

                if (!responseSyncStatus.ok) {
                    throw new Error("Failed to fetch Sync Status");
                }

                const dataSyncStatus = await responseSyncStatus.json();

                if (dataSyncStatus?.syncStatus?.length > 0) {
                    const { isOrderProcessing, isProductProcessing } = dataSyncStatus.syncStatus[0];

                    console.log(" isOrderProcessing, isProductProcessing", isOrderProcessing, isProductProcessing);


                    if (type === "product" ? !isProductProcessing : !isOrderProcessing) {
                        console.log("Process finished!", dataSyncStatus);
                        isComplete = true;
                        setLoading((prev) => ({
                            orderSync: type !== "product" ? false : prev.orderSync,
                            productSync: type === "product" ? false : prev.productSync
                        }));
                        await fetchListedProducts();
                    }
                }

            } catch (pollingError) {
                console.error("Polling error:", pollingError);
            }

            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }

    const handleSync = useCallback(async (type) => {
        try {
            setLoading((prev) => ({
                orderSync: type !== "product" ? true : prev.orderSync,
                productSync: type === "product" ? true : prev.productSync
            }))

            pollSyncStatus(type)
            const data = type === "product" ? await updateShopifyProducts() : await createShopifyOrder();

            // if (data?.status === "finished") {
            //     console.log("process finished!");

            //     setLoading((prev) => ({
            //         orderSync: type !== "product" ? false : prev.orderSync,
            //         productSync: type === "product" ? false : prev.productSync
            //     }))
            //     await fetchListedProducts();
            // } else {
            //     const actionMessage = type === "product" ? "Products update failed:" : "Orders creation failed";
            //     console.log(actionMessage, data?.message);
            // }
        } catch (error) {
            console.log("Error in handleSync for", type === "product" ? "products:" : "orders:", error);
        }
    }, []);



    return (
        <>
            <Grid  >
                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                    <>
                        <Placeholder
                            component={<Text variant="headingMd">Your Products on Kicks Crew Store.</Text>}
                            marginBottom='1rem'
                            marginTop='0px'
                            paddingTop='0px'
                        />

                        <TableOfSelectedProducts
                            products={products}
                            setCurrentPage={setCurrentPage}
                            currentPage={currentPage}
                            hasNextPage={hasNextPage}
                            hasPrevPage={hasPrevPage}
                            totalPages={totalPages}
                            isLoadingTableData={isLoadingTableData}
                            setAction={setAction}
                        // calculateItemNumber={calculateItemNumber}
                        />
                        <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '1rem' }}>

                            <Text variant="headingSm" as="h6">{`Total Products: ${totalItems}`}</Text>
                        </div>
                    </>
                </Grid.Cell>

                <Grid.Cell columnSpan={{ xs: 6, sm: 3, md: 3, lg: 6, xl: 6 }}>
                    <Placeholder
                        component={
                            <>
                                <BlockStack>
                                    <Placeholder
                                        component={<Text variant="headingMd">Sync Products and Orders</Text>}
                                        marginBottom='1rem'
                                        marginTop='0px'
                                        paddingTop='0px'
                                    />
                                    {/* <SpacingBackground margin>
                                    <Card title="Tags">
                                        <Placeholder
                                            component={<Text variant="headingSm" as="h6" >Please select a type of resource you want to sync.</Text>}
                                            marginBottom='1rem'
                                            marginTop='0px'
                                            paddingTop='0px'
                                        />
                                        <ChoiceList
                                            choices={[
                                                { label: 'Variant', value: 'variant' },
                                                { label: 'Product', value: 'product' },
                                                { label: 'Collection', value: 'collection' },
                                            ]}
                                            selected={resourcetype}
                                            onChange={handleResourceTypeChange}
                                        />
                                    </Card>
                                </SpacingBackground> */}
                                    <Divider borderColor="transparent" />
                                    <SpacingBackground margin>

                                        <Card>
                                            <Placeholder
                                                component={<Text variant="headingSm" as="h6" >To manually sync your orders and products from Kicks Crew, please click the button below.</Text>}
                                                marginBottom='1rem'
                                                marginTop='0px'
                                                paddingTop='0px'
                                            />

                                            <Placeholder
                                                component={
                                                    <Button variant="primary" loading={isLoading.productSync} onClick={() => handleSync('product')}>
                                                        Sync Products
                                                    </Button>
                                                }
                                                marginBottom='8px'
                                                marginTop='0px'
                                                paddingTop='0px'
                                            />

                                            <Divider borderColor="transparent" />

                                            <Button variant="primary" loading={isLoading.orderSync} onClick={() => handleSync('order')}>
                                                Sync Orders
                                            </Button>
                                        </Card>
                                    </SpacingBackground>
                                    <Divider borderColor="transparent" />
                                    {/* <SpacingBackground margin>

                                        <Card>
                                            <BlockStack gap={200}>
                                                <Text variant="headingSm" as="h6">
                                                    Products sync status
                                                </Text>
                                                <BlockStack gap="200">
                                                    <ResourceList
                                                        items={importItems}
                                                        emptyState={<Text>No product is imported yet!</Text>}
                                                        renderItem={(item) => {
                                                            // console.log('item', item)
                                                            const { id, count, progress, lastFinishedAt } = item;

                                                            return (
                                                                <ResourceItem
                                                                    id={id}
                                                                >
                                                                    <Text variant="bodyMd" fontWeight="bold" as="h3">
                                                                        {count} Products
                                                                    </Text>
                                                                    <div>
                                                                        {
                                                                            `${progress === 100 ? 'Completed at ' + new Date(lastFinishedAt).toLocaleString() : progress + '%'}`
                                                                        }
                                                                    </div>
                                                                </ResourceItem>
                                                            )

                                                        }}
                                                    />
                                                </BlockStack>
                                            </BlockStack>
                                        </Card>

                                    </SpacingBackground> */}

                                </BlockStack>
                            </>
                        }
                        marginTop='0'
                        paddingTop='0px'
                        paddingBottom='30px'
                        paddingLeft="3rem"
                        paddingRight="15rem"
                        itemsCentered
                    />

                </Grid.Cell>
            </Grid>

            <ModalComponent
                isTrue={isAction.isActionTrue}
                toggleModal={handleToggleModal}
                handlePrimaryAction={handleRemoveProduct}
                primaryContent={"Delete"}
                secondaryContent={"Cancel"}
            />
        </>

    );
}

const SpacingBackground = ({ children, margin = false }) => {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                marginBlockEnd: margin ? '15px' : 'none',
            }}
        >
            {children}
        </div>
    );
};

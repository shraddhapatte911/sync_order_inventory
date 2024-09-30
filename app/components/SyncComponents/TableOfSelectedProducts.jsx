import {
    IndexTable,
    Card,
    useIndexResourceState,
    Text,
    Thumbnail,
    useBreakpoints,
    EmptySearchResult,
    SkeletonBodyText, Badge
} from '@shopify/polaris';
import { DeleteIcon } from '@shopify/polaris-icons';
import React, { useEffect } from 'react';

export default function TableOfSelectedProducts({ products, setCurrentPage, hasNextPage, hasPrevPage, totalPages, isLoadingTableData, currentPage
    // calculateItemNumber
}) {

    const resourceName = {
        singular: 'product',
        plural: 'products',
    };

    // const { selectedResources, allResourcesSelected, handleSelectionChange, clearSelection } = useIndexResourceState(products ?? []);

    const emptyStateMarkup = (
        <EmptySearchResult
            title={'No products to show'}
            description={"To see products in this table, products must be added to the 'Kicks Crew' store."}
            withIllustration
        />
    );

    // useEffect(() => {
    //     console.log("products------------------<<--->>", products);

    // }, [])


    const rowMarkup = products?.map(
        ({ model_no_id, rowNumber, title, image, brand, category, quantity, model_size, primary_size_code }, index) => (
            <IndexTable.Row
                id={model_no_id}
                key={model_no_id}
            >
                <IndexTable.Cell>
                    <Text fontWeight="bold" as="span">
                        {/* {calculateItemNumber(index)} */}
                        {rowNumber}
                    </Text>
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <div style={{
                        maxWidth: '200px',
                        whiteSpace: 'normal'
                    }}>
                        {title}
                    </div>
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <div style={{
                        maxWidth: '150px',
                        whiteSpace: 'normal'
                    }}>
                        {brand}
                    </div>
                </IndexTable.Cell>
                <IndexTable.Cell>
                    {category}
                </IndexTable.Cell>
                <IndexTable.Cell>
                    {quantity}
                </IndexTable.Cell>
                <IndexTable.Cell>
                    {`${primary_size_code}  ${model_size}`}
                </IndexTable.Cell>
                <IndexTable.Cell>
                    <Thumbnail source={image} size="large" alt={title} />
                </IndexTable.Cell>
            </IndexTable.Row>
        ),
    );

    // const bulkActions = [
    //     {
    //         icon: DeleteIcon,
    //         destructive: true,
    //         content: 'Remove Product',
    //         onAction: () => {
    //             setAction({
    //                 actionIDS: selectedResources,
    //                 isActionTrue: true
    //             })
    //             clearSelection()
    //         }
    //     },
    // ];

    const breakpoints = useBreakpoints();

    return (
        <Card
            padding={{ xs: '190', sm: '190' }}
        >
            {isLoadingTableData ? (
                <div style={{ padding: '1rem' }}>
                    <SkeletonBodyText lines={9} />
                </div>
            ) : (
                <IndexTable
                    condensed={breakpoints.smDown}
                    // resourceName={resourceName}
                    itemCount={products.length}
                    // selectedItemsCount={allResourcesSelected ? 'All' : selectedResources.length}
                    // onSelectionChange={handleSelectionChange}
                    headings={[
                        { title: 'No.' },
                        { title: 'Title' },
                        { title: 'Brand' },
                        { title: 'Category' },
                        { title: 'Quantity' },
                        { title: 'Size' },
                        { title: 'Image' }
                    ]}
                    // bulkActions={bulkActions}
                    // select
                    selectable={false}
                    emptyState={emptyStateMarkup}
                    pagination={{
                        hasNext: hasNextPage,
                        hasPrevious: hasPrevPage,
                        onNext: () => {
                            setCurrentPage(prevPage => Math.min(prevPage + 1, totalPages - 1));
                        },
                        label: `Page ${currentPage + 1} of ${totalPages}`,
                        onPrevious: () => {
                            setCurrentPage(prevPage => Math.max(prevPage - 1, 0));
                        },
                    }}


                >
                    {rowMarkup}
                </IndexTable>
            )}
        </Card>
    );
}

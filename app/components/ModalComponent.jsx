import { Modal, TextField, FormLayout, Text } from '@shopify/polaris';
import { useState, useCallback } from 'react';

export default function ModalComponent({ isTrue, toggleModal, handlePrimaryAction, primaryContent, secondaryContent }) {

    return (
        <Modal
            open={isTrue}
            onClose={toggleModal}
            title={'Confirmation'}
            primaryAction={{
                content: primaryContent,
                onAction: handlePrimaryAction,
                ...(primaryContent === "Reject" || primaryContent === "Delete" ? { destructive: true } : {})
            }}
            secondaryActions={[
                {
                    content: secondaryContent,
                    onAction: toggleModal,
                },
            ]}
        >
            <Modal.Section>
                <Text>
                    Are you sure you want to {primaryContent.toLowerCase()}.
                </Text>
            </Modal.Section>
        </Modal>
    );
}
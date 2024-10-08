import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }) => {
    console.log("Triggered getSyncStatus API");

    try {
        const { admin, session } = await authenticate.admin(request);
        
        const syncStatusAll = await prisma.SyncStatus.findMany();

        if (syncStatusAll.length === 0) {
            const newSyncStatus = await prisma.SyncStatus.create({
                data: {
                    isOrderProcessing: false,
                    isProductProcessing: false,
                },
            });
            console.log("Created new sync status:", newSyncStatus);
            syncStatusAll.push(newSyncStatus); 
        }

        console.log("Sync status data:", syncStatusAll);
        
        return json({ message: 'Sync data fetched successfully', syncStatus: syncStatusAll });
    } catch (error) {
        console.error("Error while fetching data in getSyncStatus:", error); // Enhanced error logging
        return json({ message: "Error while fetching data in getSyncStatus", error: error.message });
    }
}

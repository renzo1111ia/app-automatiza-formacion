"use server";

import { crmPollingProcessor } from "../core/processors/CRMPollingProcessor";
import { zohoPollingProcessor } from "../core/processors/ZohoPollingProcessor";

/**
 * Manually triggers the background ingestion processors.
 * This starts the polling cycle for CRM and Zoho across all tenants.
 */
export async function runSystemDeployment() {
    try {
        console.log("[SYSTEM] Manually triggering system deployment / ingestion...");
        
        // We run them without awaiting for long-tail completion in the action, 
        // to return "Started" status to the UI quickly, but since these are 
        // small batches they can be awaited.
        await Promise.allSettled([
            crmPollingProcessor.run(),
            zohoPollingProcessor.run()
        ]);

        return { success: true, message: "Orquestador de ingesta iniciado correctamente." };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error: any) {
        console.error("[SYSTEM ACTION] Deployment failed:", error);
        return { success: false, error: error.message };
    }
}

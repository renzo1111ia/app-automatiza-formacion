"use server";

import { whatsappBridge, WhatsAppConfig } from "@/lib/integrations/whatsapp";
import { updateTenantConfig } from "./tenant";

/**
 * Sincroniza las plantillas de WhatsApp Business (Meta Cloud API) 
 * y las guarda en la configuración del cliente (tenant).
 */
export async function syncWhatsAppTemplates(tenantId: string, waConfig: WhatsAppConfig) {
    if (!tenantId || !waConfig.accessToken || !waConfig.wabaId) {
        return { success: false, error: "Credenciales de WhatsApp incompletas para sincronizar." };
    }

    try {
        console.log(`[WHATSAPP SYNC] Sincronizando plantillas para tenant: ${tenantId}`);
        
        // 1. Fetch from Meta
        const templates = await whatsappBridge.getAvailableTemplates(waConfig);
        
        if (!templates || templates.length === 0) {
            console.warn("[WHATSAPP SYNC] No se encontraron plantillas o la API devolvió vacío.");
        }

        // 2. Persist in Tenant Config
        const result = await updateTenantConfig(tenantId, {
            whatsapp: {
                ...waConfig,
                templates: templates,
                lastSync: new Date().toISOString()
            }
        });

        if (!result.success) {
            return { success: false, error: result.error || "Error al guardar la configuración." };
        }

        return { 
            success: true, 
            data: templates,
            message: `Sincronización exitosa. Se detectaron ${templates.length} plantillas.` 
        };

    } catch (err: unknown) {
        const error = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
        console.error("[WHATSAPP SYNC] Error crítico:", error);
        return { 
            success: false, 
            error: error.response?.data?.error?.message || error.message || "Error desconocido al conectar con Meta." 
        };
    }
}

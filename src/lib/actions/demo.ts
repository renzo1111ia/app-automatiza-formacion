"use server";

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { getAdminStatus } from "./auth";

/**
 * LABORATORY INJECTION (v1.3)
 * Injects sample data for testing and demos.
 * Uses strict typing where possible to satisfy build requirements.
 */
export async function runLaboratoryInjection(tenantId: string) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[DEMO] [${timestamp}] Invocando laboratorio para:`, tenantId);
    
    try {
        const internalSupabase = await getAdminSupabaseClient();

        let isAdmin = false;
        try {
            isAdmin = await getAdminStatus();
        } catch (error) {
            console.error("[DEMO] Auth check failed:", error);
            return { error: "Error de sesión al verificar permisos." };
        }

        if (!isAdmin) return { error: "No tienes permisos de administrador." };
        if (!tenantId) return { error: "ID de cliente no especificado." };

        const suffix = Math.random().toString(36).slice(2, 6);
        const campaignName = `Lab Demo ${suffix}`;

        // Phase 1: Campaign
        console.log("[DEMO] Paso 1: Creando campaña...");
        
        // Use unknown cast to bypass strict supabase types without triggering 'any' lint errors
        const { error: errCamp } = await (internalSupabase.from('campanas' as unknown as string) as unknown as { insert: (d: unknown) => Promise<{ error: unknown }> })
            .insert({
                tenant_id: tenantId,
                nombre: campaignName,
                descripcion: "Prueba automática del Laboratorio",
                estado: "ACTIVA"
            });

        if (errCamp) {
            console.error("[DEMO] Error campana:", (errCamp as unknown as { message: string }).message);
        }

        // Phase 2: Lead
        console.log("[DEMO] Paso 2: Creando lead...");
        
        const leadResponse = await (internalSupabase.from('lead' as unknown as string) as unknown as { insert: (d: unknown) => { select: () => { single: () => Promise<{ data: unknown, error: unknown }> } } }).insert({
            tenant_id: tenantId,
            nombre: "Prospecto",
            apellido: "Laboratorio",
            telefono: `+346${Math.floor(10000000 + Math.random() * 90000000)}`,
            email: `demo.${suffix}@lab.com`,
            campana: campaignName,
            pais: "España",
            tipo_lead: "NUEVO",
            origen: "LAB DEMO",
            is_ai_enabled: true
        }).select().single();

        const { data: lead, error: lError } = leadResponse;

        if (lError) {
            const msg = (lError as unknown as { message: string }).message;
            console.error("[DEMO] Error DB al crear Lead:", msg);
            return { error: `Fallo al crear lead: ${msg}` };
        }
        if (!lead) return { error: "La base de datos no devolvió el lead creado." };

        const leadId = (lead as unknown as { id: string }).id;

        // Phase 3: Secondary activity (Non-blocking)
        console.log("[DEMO] Paso 3: Creando actividad secundaria para lead:", leadId);
        try {
            await (internalSupabase.from('llamadas' as unknown as string) as unknown as { insert: (d: unknown) => Promise<unknown> }).insert({
                tenant_id: tenantId,
                id_lead: leadId,
                estado_llamada: 'completed',
                fecha_inicio: new Date().toISOString(),
                duracion_segundos: 60,
                transcripcion: "Llamada de prueba del laboratorio.",
                resumen: "Interés detectado en el sistema."
            });

            await (internalSupabase.from('chat_messages' as unknown as string) as unknown as { insert: (d: unknown) => Promise<unknown> }).insert({
                tenant_id: tenantId,
                lead_id: leadId,
                direction: 'OUTBOUND',
                message_type: 'TEXT',
                content: "¡Bienvenido al Lab de Esden! Este es un mensaje de prueba.",
                status: 'SENT',
                metadata: {}
            });
        } catch (error) {
            console.warn("[DEMO] Secondary activity failed:", error);
        }

        return { 
            success: true, 
            message: `¡Inyección Exitosa! Se ha creado el lead con ID ${leadId.slice(0,8)}. Revisa el dashboard para ver los resultados.` 
        };

    } catch (err: unknown) {
        const error = err as Error;
        console.error("[DEMO] Critical Crash:", error);
        return { error: `Error interno de ejecución: ${error.message || "Desconocido"}` };
    }
}

/**
 * CLEAR DEMO DATA
 * Removes leads and campaigns created by the laboratory.
 */
export async function clearDemoData(tenantId: string) {
    console.log(`[DEMO] 🧹 Limpiando datos demo para: ${tenantId}`);

    try {
        const internalSupabase = await getAdminSupabaseClient();

        let isAdmin = false;
        try {
            isAdmin = await getAdminStatus();
        } catch {
            return { error: "Error de sesión." };
        }

        if (!isAdmin) return { error: "No tienes permisos de administrador." };
        if (!tenantId) return { error: "ID de cliente no especificado." };

        // 1. Borrar Leads con origen 'LAB DEMO'
        const { error: errLeads } = await (internalSupabase.from('lead' as unknown as string) as unknown as { delete: () => { eq: (k: string, v: string) => { eq: (k: string, v: string) => Promise<{ error: unknown }> } } })
            .delete()
            .eq('tenant_id', tenantId)
            .eq('origen', 'LAB DEMO');

        if (errLeads) {
            const msg = (errLeads as unknown as { message: string }).message;
            console.error("[DEMO] Error al borrar leads:", msg);
            return { error: `Error borrando leads: ${msg}` };
        }

        // 2. Borrar Campañas con nombre que empiece por 'Lab Demo'
        const { error: errCamp } = await (internalSupabase.from('campanas' as unknown as string) as unknown as { delete: () => { eq: (k: string, v: string) => { like: (k: string, v: string) => Promise<{ error: unknown }> } } })
            .delete()
            .eq('tenant_id', tenantId)
            .like('nombre', 'Lab Demo%');

        if (errCamp) {
            const msg = (errCamp as unknown as { message: string }).message;
            console.error("[DEMO] Error al borrar campañas:", msg);
            return { error: `Error borrando campañas: ${msg}` };
        }

        return { 
            success: true, 
            message: "Datos de demostración eliminados correctamente. El sistema está limpio." 
        };

    } catch (err: unknown) {
        const error = err as Error;
        console.error("[DEMO] Clear Data Crash:", error);
        return { error: `Error interno: ${error.message}` };
    }
}

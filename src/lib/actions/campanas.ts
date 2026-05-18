"use server";

import { getAdminSupabaseClient, getActiveTenantId } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { Campana } from "@/types/database";

export async function createCampaign(data: Partial<Campana>) {
    try {
        const client = await getAdminSupabaseClient();
        const tenantId = await getActiveTenantId();
        
        if (!tenantId) return { success: false, error: "No hay un cliente activo seleccionado." };

        if (!data.nombre) return { success: false, error: "El nombre es obligatorio." };

        const campaignData = {
            tenant_id: tenantId,
            nombre: data.nombre,
            descripcion: data.descripcion || null,
            estado: data.estado || "ACTIVA",
            fecha_inicio: data.fecha_inicio || new Date().toISOString(),
            fecha_fin: data.fecha_fin || null,
            agente_texto_id: data.agente_texto_id || null,
            agente_llamada_id: data.agente_llamada_id || null,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: newCampaign, error } = await (client.from("campanas" as any) as any)
            .insert(campaignData)
            .select()
            .single();

        if (error) {
            console.error("createCampaign ERROR:", error);
            return { success: false, error: error.message };
        }

        revalidatePath("/dashboard/campanas");
        return { success: true, data: newCampaign };
    } catch (e: unknown) {
        console.error("createCampaign EXCEPTION:", e);
        return { success: false, error: e instanceof Error ? e.message : "Error desconocido" };
    }
}

export async function getCampaigns() {
    try {
        const supabase = await getAdminSupabaseClient();
        const tenantId = await getActiveTenantId();
        if (!tenantId) return [];

        const { data, error } = await supabase
            .from("campanas")
            .select("*")
            .eq("tenant_id", tenantId)
            .order("fecha_creacion", { ascending: false });

        if (error) throw new Error(error.message);
        return data || [];
    } catch (e) {
        console.error("getCampaigns ERROR:", e);
        return [];
    }
}

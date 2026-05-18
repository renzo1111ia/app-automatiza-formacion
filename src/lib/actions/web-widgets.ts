"use server";

import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { getActiveTenantConfig } from "./tenant";
import { WebWidget } from "@/types/database";

export async function getWebWidgets() {
    const tenant = await getActiveTenantConfig();
    if (!tenant) return { success: false, error: "No tenant active" };

    const supabase = await getAdminSupabaseClient();
    const { data, error } = await supabase
        .from("web_widgets")
        .select("*")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });

    if (error) return { success: false, error: error.message };
    return { success: true, data: data as WebWidget[] };
}

export async function saveWebWidget(widget: Partial<WebWidget>) {
    const tenant = await getActiveTenantConfig();
    if (!tenant) return { success: false, error: "No tenant active" };

    const supabase = await getAdminSupabaseClient();
    
    if (widget.id) {
        const { data, error } = await supabase
            .from("web_widgets")
            .update({ ...widget, updated_at: new Date().toISOString() } as never)
            .eq("id", widget.id)
            .select()
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data as WebWidget };
    } else {
        const { data, error } = await supabase
            .from("web_widgets")
            .insert([{ ...widget, tenant_id: tenant.id }] as never)
            .select()
            .single();

        if (error) return { success: false, error: error.message };
        return { success: true, data: data as WebWidget };
    }
}

export async function deleteWebWidget(id: string) {
    const supabase = await getAdminSupabaseClient();
    const { error } = await supabase
        .from("web_widgets")
        .delete()
        .eq("id", id);

    if (error) return { success: false, error: error.message };
    return { success: true };
}

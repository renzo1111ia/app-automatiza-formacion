"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY } from "@/lib/auth-config";
import { Tenant } from "@/types/tenant";

/**
 * Sets the active tenant cookie using tenantId (V2 multi-tenant model).
 * No longer stores supabase URL/key — the central DB handles all tenants.
 */
export async function setTenantCookies(tenantId: string, name: string = "") {
    const cookieStore = await cookies();

    if (tenantId) {
        cookieStore.set("esden-tenant-id", tenantId, { path: "/", maxAge: 30 * 24 * 60 * 60 });
        cookieStore.set("esden-tenant-name", name, { path: "/", maxAge: 30 * 24 * 60 * 60 });
    } else {
        cookieStore.delete("esden-tenant-id");
        cookieStore.delete("esden-tenant-name");
    }
}


async function getAdminSupabase() {
    if (!AUTH_SUPABASE_URL || !AUTH_SUPABASE_ANON_KEY) {
        throw new Error("Configuración de administración (AUTH) incompleta. Verifique las variables de entorno.");
    }
    const cookieStore = await cookies();
    return createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
        cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                });
            },
        },
    });
}

/**
 * Client using SERVICE ROLE KEY to perform administrative tasks
 */
async function getServiceSupabase() {
    // 1. Intentamos leer de las variables de entorno (Lo ideal)
    let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || AUTH_SUPABASE_URL;

    // 2. Si no existe (problema de Hetzner/Dokploy), usamos la llave directa como respaldo
    if (!serviceKey) {
        serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzI0OTEyMjksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.5VpQVwUhqDkHgplZiPE4iGjduuB2NfGNq-5vsASGAbI";
    }

    if (!url || !serviceKey) {
        throw new Error("Error crítico: No se pudo determinar la URL o la Llave Maestra de Supabase.");
    }

    const cookieStore = await cookies();
    return createServerClient(url, serviceKey, {
        cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll() { },
        },
    });
}

export async function getTenants(): Promise<Tenant[]> {
    try {
        // 1. Intentamos leer de las variables de entorno
        let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL || AUTH_SUPABASE_URL;

        // 2. Fallback de emergencia (mismo que en createTenant)
        if (!serviceKey) {
            serviceKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NzI0OTEyMjksImV4cCI6MTg5MzQ1NjAwMCwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIn0.5VpQVwUhqDkHgplZiPE4iGjduuB2NfGNq-5vsASGAbI";
        }

        const cookieStore = await cookies();
        const supabase = createServerClient(url!, serviceKey, {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll() { },
            },
        });

        const { data, error } = await supabase
            .from("tenants")
            .select("*")
            .order("name");

        if (error) {
            console.error("ERROR FETCHING TENANTS:", error);
            return [];
        }

        // Map is_admin, username and api_type from config to top level for UI convenience
        return (data || []).map(t => ({
            ...t,
            is_admin: !!(t.config as Record<string,unknown>)?.is_admin,
            api_type: ((t.config as Record<string,unknown>)?.api_type as 'internal' | 'client') || 'internal',
            username: ((t.config as Record<string,unknown>)?.username as string) || ""
        }));
    } catch (e) {
        console.error("CRITICAL ERROR IN getTenants:", e);
        return [];
    }
}

export async function getActiveTenantConfig(): Promise<Tenant | null> {
    const cookieStore = await cookies();
    const tenantId = cookieStore.get("esden-tenant-id")?.value;
    if (!tenantId) return null;

    const supabase = await getAdminSupabase();
    const { data, error } = await supabase.from("tenants").select("*").eq("id", tenantId).single();
    if (error || !data) return null;

    return {
        ...data,
        is_admin: !!(data.config as Record<string,unknown>)?.is_admin,
        api_type: ((data.config as Record<string,unknown>)?.api_type as 'internal' | 'client') || 'internal',
        username: ((data.config as Record<string,unknown>)?.username as string) || ""
    } as Tenant;
}

export async function getTenantByUserId(userId: string): Promise<Tenant | null> {
    const supabase = await getAdminSupabase();
    const { data, error } = await supabase.from("tenants").select("*").eq("auth_user_id", userId).single();
    if (error || !data) return null;

    return {
        ...data,
        is_admin: !!(data.config as Record<string,unknown>)?.is_admin,
        api_type: ((data.config as Record<string,unknown>)?.api_type as 'internal' | 'client') || 'internal',
        username: ((data.config as Record<string,unknown>)?.username as string) || ""
    } as Tenant;
}

export async function createTenant(tenant: Partial<Tenant> & { password?: string }) {
    try {
        const supabase = await getAdminSupabase();
        const serviceSupabase = await getServiceSupabase();

        let authUserId: string | undefined;

        // 1. If email and password provided, create user in Auth
        if (tenant.client_email && tenant.password) {
            const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
                email: tenant.client_email,
                password: tenant.password,
                email_confirm: true,
                user_metadata: {
                    admin: !!tenant.is_admin,
                    tenant_name: tenant.name,
                    username: tenant.username || ""
                }
            });

            if (authError) {
                console.error("AUTH USER CREATION ERROR:", authError.message);
                return { error: `Error en Auth: ${authError.message}` };
            }
            authUserId = authData.user?.id;
        }

        // We move is_admin, username and api_type into config, then remove them from the top-level insert
        // password is for auth only
        const { is_admin, username, api_type, password, ...tenantData } = tenant;
        const config = {
            ...(tenantData.config || {}),
            is_admin: !!is_admin,
            username: username || "",
            api_type: api_type || "internal"
        };

        const { data, error } = await supabase
            .from("tenants")
            .insert({
                ...tenantData,
                config,
                auth_user_id: authUserId
            })
            .select()
            .single();

        if (error) {
            console.error("CREATE TENANT ERROR:", error.message);
            return { error: `Error en Base de Datos: ${error.message}` };
        }
        return { success: true, data };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        console.error("UNEXPECTED CREATE TENANT ERROR:", e);
        return { error: `Error inesperado: ${msg}` };
    }
}

export async function updateTenant(id: string, updates: Partial<Tenant> & { password?: string }) {
    try {
        const supabase = await getAdminSupabase();
        const serviceSupabase = await getServiceSupabase();

        // 1. If password is provided AND auth_user_id exists, update it
        if (updates.password && updates.auth_user_id) {
            const { error: authError } = await serviceSupabase.auth.admin.updateUserById(
                updates.auth_user_id,
                {
                    password: updates.password,
                    user_metadata: {
                        admin: !!updates.is_admin,
                        username: updates.username
                    }
                }
            );
            if (authError) {
                console.error("AUTH USER UPDATE ERROR:", authError.message);
                return { error: `Error actualizando usuario en Auth: ${authError.message}` };
            }
        } else if ((updates.is_admin !== undefined || updates.username !== undefined) && updates.auth_user_id) {
            // Update metadata even if password is not provided
            const { error: authError } = await serviceSupabase.auth.admin.updateUserById(
                updates.auth_user_id,
                {
                    user_metadata: {
                        admin: !!updates.is_admin,
                        username: updates.username
                    }
                }
            );
            if (authError) {
                console.error("AUTH METADATA UPDATE ERROR:", authError.message);
                return { error: `Error actualizando metadatos: ${authError.message}` };
            }
        }

        // We move is_admin, username and api_type into config to avoid needing a new column in the table
        // password is for auth only
        const { is_admin, username, api_type, password, ...cleanUpdates } = updates;
        
        const newConfig = { ...(cleanUpdates.config as Record<string, unknown> || {}) };
        if (is_admin !== undefined) newConfig.is_admin = !!is_admin;
        if (username !== undefined) newConfig.username = username;
        if (api_type !== undefined) newConfig.api_type = api_type;

        cleanUpdates.config = newConfig;

        const { data, error } = await supabase.from("tenants").update(cleanUpdates).eq("id", id).select().single();
        if (error) {
            console.error("UPDATE TENANT ERROR:", error.message);
            return { error: `Error en Base de Datos: ${error.message}` };
        }
        return {
            success: true,
            data: {
                ...data,
                is_admin: !!(data.config as Record<string,unknown>)?.is_admin,
                api_type: ((data.config as Record<string,unknown>)?.api_type as 'internal' | 'client') || 'internal',
                username: ((data.config as Record<string,unknown>)?.username as string) || ""
            }
        };
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Error desconocido";
        console.error("UNEXPECTED UPDATE TENANT ERROR:", e);
        return { error: `Error inesperado: ${msg}` };
    }
}

/**
 * Partial update for the config object only.
 * Deep merges the new configuration into the existing one.
 */
export async function updateTenantConfig(id: string, partialConfig: Record<string, unknown>) {
    try {
        const supabase = await getAdminSupabase();
        
        // 1. Get current config
        const { data: tenant, error: fetchError } = await supabase
            .from("tenants")
            .select("config")
            .eq("id", id)
            .single();

        if (fetchError || !tenant) {
            return { success: false, error: "No se encontró el cliente para actualizar la configuración." };
        }

        const currentConfig = (tenant.config as Record<string, unknown>) || {};
        
        // 2. Deep merge and normalization
        const updatedConfig = { ...currentConfig };
        for (const key in partialConfig) {
            const val = partialConfig[key];
            if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                updatedConfig[key] = { 
                    ...(updatedConfig[key] as Record<string, unknown> || {}), 
                    ...(val as Record<string, unknown>) 
                };

                // Strict normalization for Retell
                if (key === 'retell') {
                    const retell = updatedConfig[key] as Record<string, unknown>;
                    if (retell.apiKey) {
                        retell.api_key = retell.apiKey;
                        delete retell.apiKey;
                    }
                    if (retell.agentId) {
                        retell.agent_id = retell.agentId;
                        delete retell.agentId;
                    }
                }
            } else {
                updatedConfig[key] = val;
            }
        }

        // 3. Save
        const { data, error } = await supabase
            .from("tenants")
            .update({ config: updatedConfig })
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;

        return { success: true, data };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        console.error("UPDATE TENANT CONFIG ERROR:", err);
        return { success: false, error: message };
    }
}

export async function deleteTenant(id: string) {
    const supabase = await getAdminSupabase();
    const { error } = await supabase.from("tenants").delete().eq("id", id);
    if (error) {
        console.error("DELETE TENANT ERROR:", error.message);
        throw new Error(error.message);
    }
    return true;
}

export async function setTenantToInternalDatabase(tenantId: string) {
    try {
        const supabase = await getAdminSupabase();
        
        // 1. Get current config
        const { data: tenant, error: fetchError } = await supabase
            .from("tenants")
            .select("config")
            .eq("id", tenantId)
            .single();

        if (fetchError || !tenant) {
            return { success: false, error: "No se encontró el cliente." };
        }

        const config = (tenant.config as Record<string, unknown>) || {};
        
        // 2. Set to internal and clear specific supabase credentials
        const updatedConfig = { 
            ...config, 
            api_type: "internal" 
        };

        const { error: updateError } = await supabase
            .from("tenants")
            .update({ 
                config: updatedConfig,
                supabase_url: null,
                supabase_key: null
            })
            .eq("id", tenantId);

        if (updateError) throw updateError;

        return { success: true };
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        console.error("SET TENANT TO INTERNAL ERROR:", err);
        return { success: false, error: message };
    }
}

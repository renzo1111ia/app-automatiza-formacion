"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY } from "@/lib/auth-config";
import { requireEnvAny } from "@/lib/env";
import { Tenant } from "@/types/tenant";
import { OverviewKpisArraySchema } from "@/lib/schemas/overview-kpi";

/**
 * Sprint 0 tarea 1-17: gate de admin para server actions sensibles
 * (createTenant, updateTenant, deleteTenant). Antes cualquier usuario
 * autenticado podía ejecutarlas → DA-2-004.
 *
 * Lee el user vía SSR cookies y verifica `app_metadata.is_admin` (1-16).
 * Devuelve error tipado para que las actions retornen `{ error }` consistente.
 */
async function assertAdminAccess(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // read-only en server actions de gating
        },
      },
    });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) {
      return { ok: false, error: "No autenticado. Inicia sesión." };
    }
    const appMeta = data.user.app_metadata ?? {};
    const isAdmin =
      appMeta.is_admin === true ||
      appMeta.is_admin === "true" ||
      appMeta.admin === true ||
      appMeta.admin === "true";
    if (!isAdmin) {
      return { ok: false, error: "Acción requiere rol admin." };
    }
    return { ok: true };
  } catch (e) {
    console.error("[assertAdminAccess] error:", e);
    return { ok: false, error: "Error verificando permisos." };
  }
}

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
    throw new Error(
      "Configuración de administración (AUTH) incompleta. Verifique las variables de entorno."
    );
  }
  const cookieStore = await cookies();
  return createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
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
  // Sprint 0 tarea 1-04: sin fallback hardcoded. Si la env var falta, falla explícitamente.
  const serviceKey = requireEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
  const url = requireEnvAny(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);

  const cookieStore = await cookies();
  return createServerClient(url, serviceKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
}

export async function getTenants(): Promise<Tenant[]> {
  try {
    // Sprint 0 tarea 1-17: solo admin puede listar todos los tenants
    // (devuelve cross-tenant data; sin gate cualquier user autenticado lo veía).
    const adminGate = await assertAdminAccess();
    if (!adminGate.ok) return [];

    // Sprint 0 tarea 1-04: sin fallback hardcoded.
    const serviceKey = requireEnvAny(["SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY"]);
    const url = requireEnvAny(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL"]);

    const cookieStore = await cookies();
    const supabase = createServerClient(url, serviceKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const { data, error } = await supabase.from("tenants").select("*").order("name");

    if (error) {
      console.error("ERROR FETCHING TENANTS:", error);
      return [];
    }

    // Map is_admin, username and api_type from config to top level for UI convenience
    return (data || []).map((t) => ({
      ...t,
      is_admin: !!(t.config as Record<string, unknown>)?.is_admin,
      api_type:
        ((t.config as Record<string, unknown>)?.api_type as "internal" | "client") || "internal",
      username: ((t.config as Record<string, unknown>)?.username as string) || "",
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
    is_admin: !!(data.config as Record<string, unknown>)?.is_admin,
    api_type:
      ((data.config as Record<string, unknown>)?.api_type as "internal" | "client") || "internal",
    username: ((data.config as Record<string, unknown>)?.username as string) || "",
  } as Tenant;
}

export async function getTenantByUserId(userId: string): Promise<Tenant | null> {
  const supabase = await getAdminSupabase();
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq("auth_user_id", userId)
    .single();
  if (error || !data) return null;

  return {
    ...data,
    is_admin: !!(data.config as Record<string, unknown>)?.is_admin,
    api_type:
      ((data.config as Record<string, unknown>)?.api_type as "internal" | "client") || "internal",
    username: ((data.config as Record<string, unknown>)?.username as string) || "",
  } as Tenant;
}

export async function createTenant(tenant: Partial<Tenant> & { password?: string }) {
  try {
    const adminGate = await assertAdminAccess();
    if (!adminGate.ok) return { error: adminGate.error };

    const supabase = await getAdminSupabase();
    const serviceSupabase = await getServiceSupabase();

    let authUserId: string | undefined;

    // 1. If email and password provided, create user in Auth
    if (tenant.client_email && tenant.password) {
      // Sprint 0 tarea 1-16: `is_admin` se escribe en app_metadata (server-controlled).
      // Antes iba en user_metadata, editable por el propio usuario via
      // supabase.auth.updateUser → privilege escalation trivial (DA-2-005).
      const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
        email: tenant.client_email,
        password: tenant.password,
        email_confirm: true,
        app_metadata: {
          is_admin: !!tenant.is_admin,
        },
        user_metadata: {
          tenant_name: tenant.name,
          username: tenant.username || "",
        },
      });

      if (authError) {
        console.error("AUTH USER CREATION ERROR:", authError.message);
        return { error: `Error en Auth: ${authError.message}` };
      }
      authUserId = authData.user?.id;
    }

    // We move is_admin, username and api_type into config, then remove them from the top-level insert
    // password is for auth only
    const { is_admin, username, api_type, password: _password, ...tenantData } = tenant;

    const config = {
      ...(tenantData.config || {}),
      is_admin: !!is_admin,
      username: username || "",
      api_type: api_type || "internal",
    };

    const { data, error } = await supabase
      .from("tenants")
      .insert({
        ...tenantData,
        config,
        auth_user_id: authUserId,
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
    const adminGate = await assertAdminAccess();
    if (!adminGate.ok) return { error: adminGate.error };

    const supabase = await getAdminSupabase();
    const serviceSupabase = await getServiceSupabase();

    let targetAuthUserId = updates.auth_user_id;

    // 0. Self-healing: If auth_user_id is missing, try to find the user by email
    if (!targetAuthUserId && updates.client_email) {
      const { data: userData, error: findError } = await serviceSupabase.auth.admin.listUsers();
      if (!findError && userData.users) {
        const existingUser = userData.users.find((u) => u.email === updates.client_email);
        if (existingUser) {
          targetAuthUserId = existingUser.id;
          // Update the tenant record immediately to link it for the future
          await supabase.from("tenants").update({ auth_user_id: targetAuthUserId }).eq("id", id);
        }
      }
    }

    // 1. If password is provided AND we have/found an auth_user_id, update it
    if (updates.password && targetAuthUserId) {
      // Sprint 0 tarea 1-16: is_admin va en app_metadata (server-controlled).
      const { error: authError } = await serviceSupabase.auth.admin.updateUserById(
        targetAuthUserId,
        {
          password: updates.password,
          app_metadata: {
            is_admin: !!updates.is_admin,
          },
          user_metadata: {
            username: updates.username,
          },
        }
      );
      if (authError) {
        console.error("AUTH USER UPDATE ERROR:", authError.message);
        return { error: `Error actualizando usuario en Auth: ${authError.message}` };
      }
    }
    // 1b. If password is provided but NO user exists yet, CREATE it
    else if (updates.password && !targetAuthUserId && updates.client_email) {
      // Sprint 0 tarea 1-16: is_admin va en app_metadata (server-controlled).
      const { data: authData, error: authError } = await serviceSupabase.auth.admin.createUser({
        email: updates.client_email,
        password: updates.password,
        email_confirm: true,
        app_metadata: {
          is_admin: !!updates.is_admin,
        },
        user_metadata: {
          username: updates.username || "",
        },
      });

      if (authError) {
        console.error("AUTH USER CREATION ON UPDATE ERROR:", authError.message);
        return { error: `Error creando usuario en Auth: ${authError.message}` };
      }
      targetAuthUserId = authData.user?.id;
      // We'll update the tenant record with the new auth_user_id below in the main update
      updates.auth_user_id = targetAuthUserId;
    } else if (
      (updates.is_admin !== undefined || updates.username !== undefined) &&
      targetAuthUserId
    ) {
      // Update metadata even if password is not provided.
      // Sprint 0 tarea 1-16: is_admin va en app_metadata (server-controlled).
      const { error: authError } = await serviceSupabase.auth.admin.updateUserById(
        targetAuthUserId,
        {
          app_metadata: {
            is_admin: !!updates.is_admin,
          },
          user_metadata: {
            username: updates.username,
          },
        }
      );
      if (authError) {
        console.error("AUTH METADATA UPDATE ERROR:", authError.message);
        return { error: `Error actualizando metadatos: ${authError.message}` };
      }
    }

    // We move is_admin, username and api_type into config to avoid needing a new column in the table
    // password is for auth only
    const { is_admin, username, api_type, password: _password, ...cleanUpdates } = updates;

    const newConfig = { ...((cleanUpdates.config as Record<string, unknown>) || {}) };
    if (is_admin !== undefined) newConfig.is_admin = !!is_admin;
    if (username !== undefined) newConfig.username = username;
    if (api_type !== undefined) newConfig.api_type = api_type;

    // Sprint 2B: validar overview_kpis si viene en config (max 8 KPIs hero, shape valido).
    if (newConfig.overview_kpis !== undefined) {
      const parsed = OverviewKpisArraySchema.safeParse(newConfig.overview_kpis);
      if (!parsed.success) {
        return {
          error: `overview_kpis inválido: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }
    }

    cleanUpdates.config = newConfig;

    const { data, error } = await supabase
      .from("tenants")
      .update(cleanUpdates)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      console.error("UPDATE TENANT ERROR:", error.message);
      return { error: `Error en Base de Datos: ${error.message}` };
    }
    return {
      success: true,
      data: {
        ...data,
        is_admin: !!(data.config as Record<string, unknown>)?.is_admin,
        api_type:
          ((data.config as Record<string, unknown>)?.api_type as "internal" | "client") ||
          "internal",
        username: ((data.config as Record<string, unknown>)?.username as string) || "",
      },
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
      return {
        success: false,
        error: "No se encontró el cliente para actualizar la configuración.",
      };
    }

    const currentConfig = (tenant.config as Record<string, unknown>) || {};

    // 2. Deep merge and normalization
    const updatedConfig = { ...currentConfig };
    for (const key in partialConfig) {
      const val = partialConfig[key];
      if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        updatedConfig[key] = {
          ...((updatedConfig[key] as Record<string, unknown>) || {}),
          ...(val as Record<string, unknown>),
        };

        // Strict normalization for Retell
        if (key === "retell") {
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

    // 2.5 Sprint 2B: validar overview_kpis si viene en config (max 8, shape valido).
    if (updatedConfig.overview_kpis !== undefined) {
      const parsed = OverviewKpisArraySchema.safeParse(updatedConfig.overview_kpis);
      if (!parsed.success) {
        return {
          success: false,
          error: `overview_kpis inválido: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
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
  // Sprint 0 tarea 1-17: gate admin (antes cualquier user autenticado podía borrar tenants).
  const adminGate = await assertAdminAccess();
  if (!adminGate.ok) {
    throw new Error(adminGate.error);
  }

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
      api_type: "internal",
    };

    const { error: updateError } = await supabase
      .from("tenants")
      .update({
        config: updatedConfig,
        supabase_url: null,
        supabase_key: null,
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

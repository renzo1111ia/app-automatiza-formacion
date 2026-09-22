"use server";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY } from "@/lib/auth-config";
import { getTenantByUserId } from "./tenant";

export interface SessionContext {
  userId: string;
  email: string;
  isSuperAdmin: boolean;
  tenantId: string | null;
  tenantName: string | null;
  businessType: string;
}

/**
 * Obtiene el contexto de sesión actual del usuario autenticado:
 * - Identifica si es Super Admin (developer que gestiona la plataforma)
 * - O Tenant Admin (dueño/administrador de un único cliente)
 * - Provee tenantId, tenantName y businessType
 */
export async function getSessionContext(): Promise<SessionContext | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const isSuperAdmin =
      user.app_metadata?.is_super_admin === true ||
      user.app_metadata?.is_super_admin === "true" ||
      user.app_metadata?.is_admin === true ||
      user.app_metadata?.is_admin === "true" ||
      user.app_metadata?.admin === true ||
      user.app_metadata?.admin === "true";

    let tenantId = cookieStore.get("esden-tenant-id")?.value || null;
    let tenantName = cookieStore.get("esden-tenant-name")?.value || null;
    let businessType = "general";

    if (!isSuperAdmin) {
      // Para Tenant Admin: se asocia estrictamente al tenant donde auth_user_id = user.id
      const tenant = await getTenantByUserId(user.id);
      if (tenant) {
        tenantId = tenant.id;
        tenantName = tenant.name;
        businessType =
          tenant.business_type ||
          ((tenant.config as Record<string, unknown>)?.business_type as string) ||
          "general";
      }
    } else if (tenantId) {
      // Para Super Admin que tiene un tenant activo seleccionado
      const { data: tenantData } = await supabase
        .from("tenants")
        .select("business_type, config")
        .eq("id", tenantId)
        .maybeSingle();

      if (tenantData) {
        businessType =
          tenantData.business_type ||
          ((tenantData.config as Record<string, unknown>)?.business_type as string) ||
          "general";
      }
    }

    return {
      userId: user.id,
      email: user.email || "",
      isSuperAdmin,
      tenantId,
      tenantName,
      businessType,
    };
  } catch (err) {
    console.error("[getSessionContext] Error:", err);
    return null;
  }
}

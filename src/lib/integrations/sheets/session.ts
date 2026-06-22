// Sprint 4 - helper de sesion para resolver el tenant del usuario autenticado.
// Compartido entre OAuth routes, server actions y webhook receivers (en este
// ultimo no aplica, los webhooks identifican por channel_token).

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY } from "@/lib/auth-config";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

export interface CurrentTenantInfo {
  tenantId: string;
  userId: string;
  isAdmin: boolean;
}

/**
 * Resuelve el tenant del usuario en sesion (cookies SSR). Lanza si no hay
 * sesion activa o si el usuario no esta asociado a ningun tenant.
 */
export async function requireCurrentTenant(): Promise<CurrentTenantInfo> {
  const cookieStore = await cookies();
  const supabase = createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // read-only en este helper
      },
    },
  });

  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error("No autenticado");
  }

  const userId = data.user.id;
  const appMeta = data.user.app_metadata ?? {};
  const isAdmin = appMeta.is_admin === true || appMeta.is_admin === "true";

  const admin = await getAdminSupabaseClient();

  // El tenant ACTIVO lo decide el selector "Cliente activo" (cookie
  // `esden-tenant-id`), igual que el resto de la app (CRM vía
  // getActiveTenantId). Sin esto, Sheets resolvía siempre el tenant DUEÑO del
  // usuario (auth_user_id) e ignoraba el selector → un admin que cambiaba de
  // tenant seguía viendo la conexión OAuth del primero.
  const activeTenantId = cookieStore.get("esden-tenant-id")?.value || null;

  if (activeTenantId) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: active, error: activeErr } = await admin
      .from("tenants")
      .select("id, auth_user_id")
      .eq("id", activeTenantId)
      .maybeSingle();
    if (activeErr) {
      throw new Error(`Error resolviendo tenant activo: ${activeErr.message}`);
    }
    // Autorización: admin puede operar cualquier tenant; un no-admin solo el
    // suyo (defensa por si la cookie se manipula). Si no cumple, caemos al
    // tenant propio del usuario más abajo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (active && (isAdmin || (active as any).auth_user_id === userId)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { tenantId: (active as any).id as string, userId, isAdmin };
    }
  }

  // Fallback: tenant del que el usuario es dueño (clientes sin selector, o
  // cookie ausente/no autorizada).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow, error: tenantErr } = await admin
    .from("tenants")
    .select("id")
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (tenantErr) {
    throw new Error(`Error resolviendo tenant: ${tenantErr.message}`);
  }
  if (!tenantRow) {
    throw new Error("Usuario sin tenant asociado");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { tenantId: (tenantRow as any).id as string, userId, isAdmin };
}

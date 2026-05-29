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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tenantRow, error: tenantErr } = await (admin.from("tenants" as any) as any)
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

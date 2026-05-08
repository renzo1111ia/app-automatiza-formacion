"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY } from "@/lib/auth-config";
import { getTenantByUserId, setTenantCookies } from "./tenant";

export async function loginAction(email: string, password: string) {
    const cookieStore = await cookies();

    const supabase = createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
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

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        console.error("LOGIN ERROR:", error.message);
        return { error: `Error de Supabase: ${error.message}` };
    }

    // Check both 'admin' (set by our createTenant) and 'is_admin' for backward compatibility
    const isAdmin =
        data.user?.user_metadata?.admin === true ||
        data.user?.user_metadata?.admin === "true" ||
        data.user?.user_metadata?.is_admin === true ||
        data.user?.user_metadata?.is_admin === "true";

    // ⚡ AUTO-CONFIG FOR CLIENTS
    // If not admin, find their tenant and set cookies automatically
    if (!isAdmin && data.user) {
        const tenant = await getTenantByUserId(data.user.id);
        if (tenant) {
            await setTenantCookies(tenant.id, tenant.name);
        }
    }

    return { success: true, isAdmin };
}

export async function logoutAction() {
    const cookieStore = await cookies();

    const supabase = createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set(name, value, { ...options, maxAge: 0 }); // forcefully expire
                });
            },
        },
    });

    await supabase.auth.signOut();

    // Clear our custom tenant logic cookies as well
    cookieStore.delete("esden-tenant-url");
    cookieStore.delete("esden-tenant-key");
    cookieStore.delete("esden-tenant-name");

    return { success: true };
}

export async function getAdminStatus(): Promise<boolean> {
    const cookieStore = await cookies();
    const supabase = createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
        cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll() { },
        },
    });

    const { data } = await supabase.auth.getUser();
    const user = data.user;
    // Check both 'admin' (set by our createTenant) and 'is_admin' for backward compatibility
    const isAdm =
        user?.user_metadata?.admin === true ||
        user?.user_metadata?.admin === "true" ||
        user?.user_metadata?.is_admin === true ||
        user?.user_metadata?.is_admin === "true" ||
        user?.app_metadata?.is_admin === true ||
        user?.app_metadata?.is_admin === "true";
    return isAdm;
}

export async function resetPasswordAction(email: string) {
    const cookieStore = await cookies();
    const supabase = createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
        cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value, options }) => {
                    cookieStore.set(name, value, options);
                });
            },
        },
    });

    // We use the origin from the request if possible, or a default
    // In server actions we can get headers
    const { headers } = await import("next/headers");
    const h = await headers();
    const origin = h.get("origin") || h.get("host") || "http://localhost:3000";
    const protocol = origin.startsWith("http") ? "" : "https://";
    const redirectTo = `${protocol}${origin}/auth/callback`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
    });

    if (error) {
        console.error("RESET PASSWORD ERROR:", error.message);
        return { error: "No se pudo enviar el correo de recuperación. Intentá de nuevo." };
    }

    return { success: true };
}

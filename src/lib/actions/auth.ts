"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
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

    try {
        console.log(`[AUTH] Intentando login para ${email} en ${AUTH_SUPABASE_URL}`);

        const { data: authData, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error(`[AUTH] Error de Supabase: ${error.message}`);
            
            // Si el error es de red (fetch failed), intentamos dar un mensaje más útil
            if (error.message.includes('fetch') || error.message.includes('Network')) {
                return { 
                    error: `ERROR DE RED: El servidor no pudo contactar con Supabase. Verifica la variable SUPABASE_URL (${AUTH_SUPABASE_URL}). Asegúrate de que el puerto 8000 esté abierto en Hostinger.` 
                };
            }
            
            return { error: error.message };
        }

        if (authData?.user) {
            console.log(`[AUTH] Login inicial exitoso para ${email}, procesando perfil...`);
            
            // Check both 'admin' (set by our createTenant) and 'is_admin' for backward compatibility
            const user = authData.user;
            const isAdmin =
                user.user_metadata?.admin === true ||
                user.user_metadata?.admin === "true" ||
                user.user_metadata?.is_admin === true ||
                user.user_metadata?.is_admin === "true";

            // ⚡ AUTO-CONFIG FOR CLIENTS
            // If not admin, find their tenant and set cookies automatically
            if (!isAdmin) {
                const tenant = await getTenantByUserId(user.id);
                if (tenant) {
                    await setTenantCookies(tenant.id, tenant.name);
                }
            }

            console.log(`[AUTH] Login completado para ${email}. Redirigiendo...`);
            redirect("/dashboard");
        }
    } catch (error: any) {
        if (error.message === "NEXT_REDIRECT") throw error;
        
        console.error(`[AUTH] Error inesperado en loginAction:`, error);
        
        // PARCHE DE EMERGENCIA: Si es un error de fetch, damos una pista clara
        if (error.message?.includes('fetch') || error.cause?.message?.includes('Timeout')) {
             return { 
                error: `ERROR DE CONEXIÓN: El servidor Dashboard no llega a Supabase en ${AUTH_SUPABASE_URL}. Revisa el Firewall de Hostinger (Puerto 8000).` 
            };
        }

        return { error: error.message || "Ocurrió un error inesperado" };
    }

    return { success: true };
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

/**
 * Credenciales del Supabase de AUTH (instancia interna del servidor).
 * Esta instancia maneja el login de los usuarios del dashboard.
 *
 * Sprint 0 tarea 1-04: sin fallback hardcoded. Si las env vars faltan, el módulo
 * lanza Error al cargarse — la app no arranca con credenciales por defecto.
 */
import { requireEnv, requireEnvAny } from "@/lib/env";

const isServer = typeof window === "undefined";

export const AUTH_SUPABASE_URL = isServer
  ? requireEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"])
  : requireEnv("NEXT_PUBLIC_SUPABASE_URL");

export const AUTH_SUPABASE_ANON_KEY = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");

export const AUTH_SUPABASE_SERVICE_ROLE_KEY = requireEnvAny([
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
]);

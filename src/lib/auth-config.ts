/**
 * Credenciales del Supabase de AUTH (instancia interna del servidor).
 * Esta instancia maneja el login de los usuarios del dashboard.
 *
 * Sprint 0 tarea 1-04: sin fallback hardcoded. Si las env vars faltan, el módulo
 * lanza Error al cargarse — la app no arranca con credenciales por defecto.
 *
 * 23-05-2026: refactor para Edge runtime (middleware). Next.js sólo bakea
 * `process.env.NEXT_PUBLIC_*` cuando se accede de forma DIRECTA (literal
 * property), no via lookup dinámico `process.env[name]`. requireEnvAny usa
 * lookup dinámico → el bundle del middleware veía las vars como undefined
 * aunque estuvieran como Build Args en Dokploy. Aquí leemos las constantes
 * en acceso directo a nivel módulo para garantizar el bake en Edge.
 */

// Acceso DIRECTO (Next.js sustituye en build time para NEXT_PUBLIC_* en
// cualquier runtime — Node, Edge, browser).
const PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Variables server-only: en Node runtime están disponibles en runtime; en Edge
// runtime sólo si se declaran en next.config.js `env: {}`. Acceso directo igual.
const SERVER_SUPABASE_URL = process.env.SUPABASE_URL;
const SERVER_SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SERVER_SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

const isServer = typeof window === "undefined";

function pickFirstNonEmpty(...values: Array<string | undefined>): string | null {
  for (const v of values) {
    if (v && v.trim() !== "") return v;
  }
  return null;
}

export const AUTH_SUPABASE_URL: string = (() => {
  const v = isServer
    ? pickFirstNonEmpty(SERVER_SUPABASE_URL, PUBLIC_SUPABASE_URL)
    : pickFirstNonEmpty(PUBLIC_SUPABASE_URL);
  if (!v) {
    throw new Error(
      `Missing required env: ${isServer ? "SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_URL"}. ` +
        `Check Dokploy Build Args (NEXT_PUBLIC_*) and Environment (SUPABASE_URL).`
    );
  }
  return v;
})();

export const AUTH_SUPABASE_ANON_KEY: string = (() => {
  const v = pickFirstNonEmpty(PUBLIC_SUPABASE_ANON_KEY);
  if (!v) {
    throw new Error(
      "Missing required env: NEXT_PUBLIC_SUPABASE_ANON_KEY. " +
        "Debe ser un Build Arg en Dokploy (no solo Environment)."
    );
  }
  return v;
})();

export const AUTH_SUPABASE_SERVICE_ROLE_KEY: string = (() => {
  const v = pickFirstNonEmpty(SERVER_SUPABASE_SERVICE_ROLE_KEY, SERVER_SERVICE_ROLE_KEY);
  if (!v) {
    throw new Error(
      "Missing required env: SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY. " +
        "Check Dokploy Environment tab."
    );
  }
  return v;
})();

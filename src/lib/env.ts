/**
 * Env var helpers — dashboard-af
 *
 * Política Sprint 0 tarea 1-04: prohibido usar valores fallback hardcoded para
 * credenciales o URLs sensibles. Si una env var requerida falta, la app debe
 * fallar explícitamente con un mensaje claro, NO arrancar con un valor por
 * defecto inseguro.
 *
 * Referencia: plans/260520-1342-sprint-0-hotfixes-seguridad/phase-02-secretos-y-credenciales.md
 */

/**
 * Lee una variable de entorno obligatoria. Lanza Error si no está definida o
 * está vacía. Pensado para credenciales (JWTs, API keys) y URLs de servicios.
 *
 * Usar SIEMPRE en lugar de `process.env.X || "fallback"`.
 *
 * @example
 *   const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Check your .env.local (development) or Easypanel env vars (production).`
    );
  }
  return value;
}

/**
 * Lee la primera variable de entorno definida de una lista de alias.
 * Útil cuando hay convenciones legacy: en este repo conviven
 * `SUPABASE_URL` (server-only) y `NEXT_PUBLIC_SUPABASE_URL` (cliente+server)
 * apuntando a la misma instancia.
 *
 * Lanza Error si ninguna de las variables está definida.
 *
 * @example
 *   const url = requireEnvAny(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"]);
 */
export function requireEnvAny(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim() !== "") return value;
  }
  throw new Error(
    `Missing required environment variable. Tried (in order): ${names.join(", ")}. ` +
      `Check your .env.local (development) or Easypanel env vars (production).`
  );
}

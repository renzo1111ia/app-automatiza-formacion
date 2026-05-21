/**
 * API Auth helpers — dashboard-af
 *
 * Sprint 0 tareas 1-07 (auth endpoints orquestación) y 1-08 (auth cron).
 *
 * Tres modos de protección para API routes:
 *
 *   1. requireApiUser()     → exige sesión Supabase válida. Devuelve user + isAdmin.
 *   2. requireApiAdmin()    → como anterior + obliga `is_admin` en metadata.
 *   3. requireTenantAccess(ctx, tenantId) → no-admin debe ser dueño del tenant
 *                                            (`tenants.auth_user_id === user.id`).
 *   4. requireCronSecret()  → header `x-cron-secret` o `Authorization: Bearer ...`
 *                              comparado timing-safe contra `CRON_SECRET` env.
 *
 * Patrón de uso en `route.ts`:
 *
 *   const ctx = await requireApiUser();
 *   if (ctx instanceof NextResponse) return ctx;        // 401
 *   const guard = await requireTenantAccess(ctx, body.tenantId);
 *   if (guard) return guard;                             // 403
 *   // ...lógica del endpoint con ctx.user / ctx.isAdmin
 */

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";
import { AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY } from "@/lib/auth-config";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

export interface ApiUserContext {
  user: { id: string; email?: string };
  isAdmin: boolean;
}

const unauthorized = (msg = "Unauthorized") => NextResponse.json({ error: msg }, { status: 401 });
const forbidden = (msg = "Forbidden") => NextResponse.json({ error: msg }, { status: 403 });
const serviceUnavailable = (msg: string) => NextResponse.json({ error: msg }, { status: 503 });

/**
 * Exige sesión de usuario Supabase válida vía cookies. 401 si no hay sesión.
 * Devuelve `ApiUserContext` con flag `isAdmin` derivada de user/app metadata.
 */
export async function requireApiUser(): Promise<ApiUserContext | NextResponse> {
  const cookieStore = await cookies();
  const supabase = createServerClient(AUTH_SUPABASE_URL, AUTH_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // read-only en API routes
      },
    },
  });

  let user;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user) return unauthorized();
    user = data.user;
  } catch (err) {
    console.error("[api-auth] requireApiUser fetch error:", err);
    return unauthorized();
  }

  const meta = user.user_metadata ?? {};
  const appMeta = user.app_metadata ?? {};
  const isAdmin =
    meta.admin === true ||
    meta.admin === "true" ||
    meta.is_admin === true ||
    meta.is_admin === "true" ||
    appMeta.is_admin === true ||
    appMeta.is_admin === "true" ||
    appMeta.admin === true ||
    appMeta.admin === "true";

  return {
    user: { id: user.id, email: user.email ?? undefined },
    isAdmin,
  };
}

/**
 * Como `requireApiUser` pero exige además rol admin. 403 si no es admin.
 */
export async function requireApiAdmin(): Promise<ApiUserContext | NextResponse> {
  const ctx = await requireApiUser();
  if (ctx instanceof NextResponse) return ctx;
  if (!ctx.isAdmin) return forbidden("Admin role required");
  return ctx;
}

/**
 * Verifica que el `tenantId` pasado pertenece al usuario actual.
 * - Si el user es admin → siempre permitido (return null).
 * - Si no es admin → consulta `tenants.auth_user_id === ctx.user.id`.
 *
 * Devuelve `null` si OK o un `NextResponse` 403/404 si no.
 */
export async function requireTenantAccess(
  ctx: ApiUserContext,
  tenantId: string | null | undefined
): Promise<NextResponse | null> {
  if (!tenantId) return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });
  if (ctx.isAdmin) return null;

  const supabase = await getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("auth_user_id")
    .eq("id", tenantId)
    .single();

  if (error || !data) return forbidden("Tenant not accessible");
  const ownerId = (data as { auth_user_id: string | null }).auth_user_id;
  if (!ownerId || ownerId !== ctx.user.id) return forbidden("Tenant not accessible");
  return null;
}

/**
 * Sprint 0 tarea 1-09: guard temporal de orquestación por tenant.
 *
 * Lee `tenants.config.test_orchestrator_enabled` (JSONB). DENY por defecto:
 * si el flag no está explícitamente a `true`, devuelve 403. Pensado para
 * proteger los endpoints de orquestación mientras el flujo no esté validado
 * en producción. Eliminar en Fase 3.
 *
 * Devuelve `null` si OK, o `NextResponse` 403/404 en caso contrario.
 */
export async function requireOrchestrationEnabled(tenantId: string): Promise<NextResponse | null> {
  const supabase = await getAdminSupabaseClient();
  const { data, error } = await supabase
    .from("tenants")
    .select("config")
    .eq("id", tenantId)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
  }

  const config = (data as { config: Record<string, unknown> | null }).config ?? {};
  const enabled = config["test_orchestrator_enabled"] === true;

  if (!enabled) {
    return forbidden(
      "Orchestration disabled for this tenant. Admin must set tenants.config.test_orchestrator_enabled = true."
    );
  }
  return null;
}

/**
 * Valida el header de cron secret. Acepta `x-cron-secret: <secret>` o
 * `Authorization: Bearer <secret>`. Compara en tiempo constante.
 *
 * Devuelve `null` si OK o `NextResponse` (401/503) en caso contrario.
 *
 * Requiere `CRON_SECRET` en env. Si la env var falta, devuelve 503 — explícito
 * para no permitir el endpoint sin configurar el secreto.
 */
export function requireCronSecret(req: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return serviceUnavailable(
      "CRON_SECRET not configured. Set it in .env.local / Easypanel before invoking cron endpoints."
    );
  }

  const headerValue =
    req.headers.get("x-cron-secret")?.trim() ||
    req.headers
      .get("authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ||
    "";

  if (!headerValue) return unauthorized("Missing cron secret");

  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return unauthorized("Invalid cron secret");

  try {
    if (!timingSafeEqual(a, b)) return unauthorized("Invalid cron secret");
  } catch {
    return unauthorized("Invalid cron secret");
  }
  return null;
}

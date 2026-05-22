// Sprint 1 — Bloque 2.3 (tarea 2-12)
// Interface base + helpers compartidos para todos los repositorios.
// Convención: todo método multi-tenant SIEMPRE filtra por tenant_id (helper withTenantFilter).
// Sin ORM — usamos @supabase/ssr directamente (R-019 / ADR-016).

import type { SupabaseClient } from "@supabase/supabase-js";

// Resultado normalizado de los repositorios.
export interface RepoResult<T> {
  data: T | null;
  error: string | null;
}

export interface RepoListResult<T> {
  data: T[];
  error: string | null;
  count?: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// Interface base que cada repository implementa parcialmente.
// CreateDTO / UpdateDTO normalmente derivados de z.infer<typeof CreateXxxSchema>.
export interface IRepository<T, CreateDTO, UpdateDTO> {
  findByTenant(tenantId: string, params?: PaginationParams): Promise<RepoListResult<T>>;
  findById(id: string, tenantId: string): Promise<RepoResult<T>>;
  create(tenantId: string, data: CreateDTO): Promise<RepoResult<T>>;
  update(id: string, tenantId: string, data: UpdateDTO): Promise<RepoResult<T>>;
}

// Normaliza errores supabase-js a string serializable.
export function handleSupabaseError(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const e = error as { message?: string; code?: string; details?: string };
    return e.message || e.details || e.code || "Unknown Supabase error";
  }
  return "Unknown error";
}

// Calcula offset/limit a partir de page/pageSize. page 1-based.
export function paginate(params?: PaginationParams): { from: number; to: number; limit: number } {
  const page = Math.max(1, params?.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, params?.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  return { from, to, limit: pageSize };
}

// Helper para inyectar el filtro tenant_id de forma fluida sobre el query builder.
// Tipo amplio porque la inferencia de @supabase/supabase-js es complicada con generics.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withTenantFilter<Q extends { eq: (col: string, val: any) => Q }>(
  query: Q,
  tenantId: string,
  column = "tenant_id"
): Q {
  return query.eq(column, tenantId);
}

// Tipo helper: cliente Supabase generico tipado.
// Usamos `any` en el generic porque los repos abstractan sobre Database tipado y no tipado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericSupabaseClient = SupabaseClient<any, "public", any>;

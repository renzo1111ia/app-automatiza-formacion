import { ICRMProvider } from "./interface";
import { ZohoCRMProvider } from "./providers/zoho";
import { getValidTokens, resolveApiBase } from "./token-manager";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * CRM FACTORY — Sprint 2 update (24-05-2026).
 *
 * Dos modos de uso:
 *
 *   1. LEGACY (`getProvider(tenantId, config)`): leer credenciales desde
 *      `tenant.config.crm` (formato Sprint 1). Usado todavía por:
 *        - src/lib/services/post-analysis.ts
 *        - src/lib/core/orchestrator.ts
 *        - src/lib/core/processors/CRMExport|PollingProcessor.ts
 *      Será migrado al modo 2 en sprints siguientes.
 *
 *   2. SPRINT 2 (`getProviderForIntegration(integrationId)`): leer credenciales
 *      desde tabla `integrations` + `TokenManager` con dedup + DB writeback.
 *      Es el camino correcto a partir de Phase 02.
 *
 * Cache:
 *   - Modo 1: por `tenantId:providerName` (compat con código actual).
 *   - Modo 2: por `integrationId` (más granular, alineado con TokenManager).
 *
 * TTL: 30 min (limpieza perezosa en cada lookup).
 */
export class CRMFactory {
  // Cache + timestamps para TTL
  private static legacyInstances: Record<string, ICRMProvider> = {};
  private static newInstances: Record<string, { provider: ICRMProvider; expiresAt: number }> = {};

  private static readonly TTL_MS = 30 * 60 * 1000; // 30 min

  // ─── Modo 1: legacy compat (Sprint 1 callers) ──────────────────────────────

  /**
   * @deprecated Sprint 2: usa `getProviderForIntegration(integrationId)` en código
   *   nuevo. Este método queda para no romper callers de Sprint 1.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static getProvider(tenantId: string, config: any): ICRMProvider {
    const crmConfig = config?.crm || {};
    const providerName = (crmConfig.provider || "zoho").toLowerCase();

    const cacheKey = `legacy:${tenantId}:${providerName}`;
    if (this.legacyInstances[cacheKey]) return this.legacyInstances[cacheKey];

    const credentials = {
      clientId: crmConfig.credentials?.client_id || process.env.ZOHO_CLIENT_ID || "",
      clientSecret: crmConfig.credentials?.client_secret || process.env.ZOHO_CLIENT_SECRET || "",
      refreshToken: crmConfig.credentials?.refresh_token || process.env.ZOHO_REFRESH_TOKEN || "",
      apiBase: crmConfig.credentials?.api_base,
      tokenUrl: crmConfig.credentials?.token_url,
    };

    let provider: ICRMProvider;
    switch (providerName) {
      case "zoho":
        provider = new ZohoCRMProvider(credentials);
        break;
      case "hubspot":
        // Phase 03 implementará HubSpotCRMProvider. Por ahora cae a Zoho para no
        // romper callers (legacy compat). Limpiar en Phase 03.
        provider = new ZohoCRMProvider(credentials);
        break;
      default:
        provider = new ZohoCRMProvider(credentials);
    }

    this.legacyInstances[cacheKey] = provider;
    return provider;
  }

  // ─── Modo 2: Sprint 2 (TokenManager + tabla integrations) ──────────────────

  /**
   * Devuelve un provider listo para usar, con tokens frescos garantizados.
   * Lee la row de `integrations` por id, resuelve `crm_type`, construye la
   * instance y la cachea por `integrationId` con TTL 30 min.
   *
   * Phase 02 (Zoho) y Phase 03 (HubSpot) son los primeros callers reales.
   */
  static async getProviderForIntegration(integrationId: string): Promise<ICRMProvider> {
    if (!integrationId) throw new Error("getProviderForIntegration: integrationId requerido");

    const cached = this.newInstances[integrationId];
    if (cached && cached.expiresAt > Date.now()) {
      return cached.provider;
    }

    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("integrations" as any) as any)
      .select("id, crm_type, data_center, metadata")
      .eq("id", integrationId)
      .single();

    if (error || !data) {
      throw new Error(`Integration ${integrationId} not found: ${error?.message ?? "no row"}`);
    }

    // Token fetch — dispara refresh si está caducado (con dedup in-process).
    const tokens = await getValidTokens(integrationId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    const apiBase =
      tokens.apiBase ?? resolveApiBase(row.crm_type, row.data_center, row.metadata ?? {});

    const provider = this.instantiate(row.crm_type, {
      clientId: this.envFor(row.crm_type, "CLIENT_ID"),
      clientSecret: this.envFor(row.crm_type, "CLIENT_SECRET"),
      refreshToken: tokens.refreshToken,
      apiBase,
      tokenUrl: this.tokenUrlFor(row.crm_type, apiBase),
      apiDomain: tokens.apiBase,
      integrationId,
    });

    this.newInstances[integrationId] = {
      provider,
      expiresAt: Date.now() + this.TTL_MS,
    };
    return provider;
  }

  /** Invalida cache para una integración (útil tras disconnect/reconnect). */
  static invalidateProvider(integrationId: string): void {
    delete this.newInstances[integrationId];
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private static instantiate(
    crmType: string,
    config: {
      clientId: string;
      clientSecret: string;
      refreshToken: string;
      apiBase: string;
      tokenUrl: string;
      apiDomain: string | undefined;
      integrationId: string;
    }
  ): ICRMProvider {
    switch (crmType) {
      case "zoho":
        return new ZohoCRMProvider(config);
      case "hubspot":
        // Phase 03 reemplazará por `new HubSpotCRMProvider(config)`.
        throw new Error("HubSpotCRMProvider aún no implementado (Phase 03). Sprint 2 lo entrega.");
      default:
        throw new Error(`CRM type '${crmType}' no soportado`);
    }
  }

  private static envFor(crmType: string, suffix: "CLIENT_ID" | "CLIENT_SECRET"): string {
    const key = `${crmType.toUpperCase()}_${suffix}`;
    return process.env[key] ?? "";
  }

  private static tokenUrlFor(crmType: string, apiBase: string): string {
    if (crmType === "zoho") {
      // Zoho multi-DC: accounts.zoho.{ext} mismo TLD que apiBase (www.zohoapis.{ext}).
      // Si apiBase trae el DC correcto, derivamos accounts.
      try {
        const host = new URL(apiBase).host; // www.zohoapis.eu
        const ext = host.split(".").slice(-1)[0]; // eu, com, in, ...
        const baseExt = host.endsWith(".com.au") ? "com.au" : ext;
        return `https://accounts.zoho.${baseExt}/oauth/v2/token`;
      } catch {
        return "https://accounts.zoho.com/oauth/v2/token";
      }
    }
    if (crmType === "hubspot") return "https://api.hubapi.com/oauth/v1/token";
    throw new Error(`tokenUrlFor: crm_type='${crmType}' no soportado`);
  }
}

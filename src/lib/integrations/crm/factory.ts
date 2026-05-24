import { ICRMProvider } from "./interface";
import { ZohoCRMProvider } from "./providers/zoho";
import { HubSpotCRMProvider } from "./providers/hubspot";
import { getValidTokens, resolveApiBase } from "./token-manager";
import { getAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * CRM FACTORY — Sprint 2 (24-05-2026).
 *
 * Modo único productivo: `getProviderForIntegration(integrationId)` — lee
 * credenciales desde tabla `integrations` + `TokenManager` con dedup + DB
 * writeback. El modo legacy de Sprint 1 ya no aplica (los callers usaban
 * tenant.config.crm que será deprecated en Sprint 3).
 *
 * Cache TTL 30 min por integrationId.
 */
export class CRMFactory {
  private static instances: Record<string, { provider: ICRMProvider; expiresAt: number }> = {};
  private static legacyInstances: Record<string, ICRMProvider> = {};
  private static readonly TTL_MS = 30 * 60 * 1000;

  /**
   * @deprecated Sprint 2 → Sprint 3 migration: usa `getProviderForIntegration(id)`.
   * Mantiene compat con callers Sprint 1 (orchestrator + processors + post-analysis)
   * que pasan `tenant.config.crm` con credentials embebidas. Estos callers serán
   * migrados a `integrations` table en Sprint 3 (tarea SP-4-XX).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  static getProvider(tenantId: string, config: any): ICRMProvider {
    const crmConfig = config?.crm ?? {};
    const providerName = String(crmConfig.provider ?? "zoho").toLowerCase();
    const cacheKey = `legacy:${tenantId}:${providerName}`;
    if (this.legacyInstances[cacheKey]) return this.legacyInstances[cacheKey];

    const creds = crmConfig.credentials ?? {};
    const apiDomain: string =
      creds.api_domain ||
      creds.api_base ||
      process.env.ZOHO_API_DOMAIN ||
      "https://www.zohoapis.com";
    const fallbackTokens = {
      accessToken: creds.access_token ?? "",
      refreshToken: creds.refresh_token ?? process.env.ZOHO_REFRESH_TOKEN ?? "",
      expiresAt: new Date(Date.now() + 3600_000),
      scopes: [],
      apiBase: apiDomain,
    };

    let provider: ICRMProvider;
    if (providerName === "zoho") {
      provider = new ZohoCRMProvider({
        tokens: fallbackTokens,
        metadata: { api_domain: apiDomain, location: creds.location ?? "us" },
        clientId: creds.client_id ?? process.env.ZOHO_CLIENT_ID,
        clientSecret: creds.client_secret ?? process.env.ZOHO_CLIENT_SECRET,
      });
    } else if (providerName === "hubspot") {
      provider = new HubSpotCRMProvider({
        tokens: fallbackTokens,
        metadata: { portal_id: creds.portal_id },
        clientId: creds.client_id ?? process.env.HUBSPOT_CLIENT_ID,
        clientSecret: creds.client_secret ?? process.env.HUBSPOT_CLIENT_SECRET,
      });
    } else {
      // Fallback: Zoho con env vars.
      provider = new ZohoCRMProvider({
        tokens: fallbackTokens,
        metadata: { api_domain: apiDomain },
      });
    }

    this.legacyInstances[cacheKey] = provider;
    return provider;
  }

  /**
   * Devuelve un provider listo para usar, con tokens frescos garantizados.
   * Lee la row de `integrations` por id y construye la instance con metadata.
   */
  static async getProviderForIntegration(integrationId: string): Promise<ICRMProvider> {
    if (!integrationId) throw new Error("getProviderForIntegration: integrationId requerido");

    const cached = this.instances[integrationId];
    if (cached && cached.expiresAt > Date.now()) return cached.provider;

    const supabase = await getAdminSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("integrations" as any) as any)
      .select("id, crm_type, data_center, metadata")
      .eq("id", integrationId)
      .single();

    if (error || !data) {
      throw new Error(`Integration ${integrationId} not found: ${error?.message ?? "no row"}`);
    }

    // Dispara refresh si está caducado (con dedup in-process).
    await getValidTokens(integrationId);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = data as any;
    const metadata = (row.metadata ?? {}) as Record<string, unknown>;
    const apiDomain =
      (metadata.api_domain as string | undefined) ??
      resolveApiBase(row.crm_type, row.data_center, metadata);

    const provider = this.instantiate(row.crm_type, integrationId, {
      ...metadata,
      api_domain: apiDomain,
    });

    this.instances[integrationId] = {
      provider,
      expiresAt: Date.now() + this.TTL_MS,
    };
    return provider;
  }

  /** Invalida cache para una integración (útil tras disconnect/reconnect). */
  static invalidateProvider(integrationId: string): void {
    delete this.instances[integrationId];
  }

  /** Para tests. */
  static __resetForTests(): void {
    this.instances = {};
  }

  /**
   * Crea una instance "pre-OAuth" — sin integrationId y sin tokens — usada por
   * los routes `/auth/start` (genera URL de autorización) y `/auth/callback`
   * (intercambia code por tokens). Caller decide qué CRM por el path param.
   */
  static createForOAuthFlow(
    crmType: "zoho" | "hubspot",
    opts: {
      clientId: string;
      clientSecret: string;
      redirectUri: string;
      metadata?: Record<string, unknown>;
    }
  ): ICRMProvider {
    if (crmType === "zoho") {
      return new ZohoCRMProvider({
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
        redirectUri: opts.redirectUri,
        metadata: opts.metadata as never,
      });
    }
    if (crmType === "hubspot") {
      return new HubSpotCRMProvider({
        clientId: opts.clientId,
        clientSecret: opts.clientSecret,
        redirectUri: opts.redirectUri,
      });
    }
    throw new Error(`CRMFactory.createForOAuthFlow: crmType '${crmType}' no soportado`);
  }

  // ─── Internos ──────────────────────────────────────────────────────────────

  private static instantiate(
    crmType: string,
    integrationId: string,
    metadata: Record<string, unknown>
  ): ICRMProvider {
    if (crmType === "zoho") {
      return new ZohoCRMProvider({
        integrationId,
        metadata: metadata as never,
        clientId: process.env.ZOHO_CLIENT_ID,
        clientSecret: process.env.ZOHO_CLIENT_SECRET,
      });
    }
    if (crmType === "hubspot") {
      return new HubSpotCRMProvider({
        integrationId,
        metadata: metadata as never,
        clientId: process.env.HUBSPOT_CLIENT_ID,
        clientSecret: process.env.HUBSPOT_CLIENT_SECRET,
      });
    }
    throw new Error(`CRMFactory: crm_type '${crmType}' no soportado`);
  }
}

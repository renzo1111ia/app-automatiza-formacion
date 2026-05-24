import { ICRMProvider, CRMLead, CRMProviderConfig, CRMCapabilities, CRMTokens } from "../interface";

/**
 * ZOHO CRM PROVIDER
 *
 * Sprint 1: implementación inicial (single-DC US, sin OAuth init flow).
 * Sprint 2 Phase 02: bugfixes B-01..B-07 (multi-DC, 401→refresh, OAuth init,
 * paginación, email exact search).
 *
 * Phase 01 (este archivo) sólo añade stubs de los nuevos métodos para que el
 * TypeScript compile. Phase 02 reemplaza los stubs por implementación real.
 */
export class ZohoCRMProvider implements ICRMProvider {
  private clientId: string;
  private clientSecret: string;
  private refreshToken: string;
  private apiBase: string;
  private tokenUrl: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(config: CRMProviderConfig) {
    this.clientId = config.clientId;
    this.clientSecret = config.clientSecret;
    this.refreshToken = config.refreshToken;
    this.apiBase = config.apiBase || "https://www.zohoapis.com/crm/v2";
    this.tokenUrl = config.tokenUrl || "https://accounts.zoho.com/oauth/v2/token";
  }

  private async refreshAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) return;

    console.log("[ZOHO_PROVIDER] Refreshing access token...");
    const response = await fetch(this.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: this.refreshToken,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Zoho Auth Error: ${data.error || response.statusText}`);
    }

    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  }

  private async request(path: string, options: RequestInit = {}) {
    await this.refreshAccessToken();

    const url = path.startsWith("http") ? path : `${this.apiBase}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Zoho-oauthtoken ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 204) return null; // No Content

    const data = await response.json();
    if (!response.ok) {
      console.error(`[ZOHO_PROVIDER] API Error (${response.status}):`, data);
      throw new Error(data.message || `Zoho API Error ${response.status}`);
    }

    return data;
  }

  private mapToLead(raw: Record<string, unknown>): CRMLead {
    return {
      id: String(raw.id ?? ""),
      fields: {
        nombre: raw.First_Name || "",
        apellido: raw.Last_Name || "",
        email: raw.Email || "",
        telefono: raw.Phone || "",
        pais: raw.Country || "",
        source: raw.Lead_Source || "",
      },
      raw: raw,
    };
  }

  // ── Capabilities + lifecycle + OAuth (Sprint 2 Phase 01 stubs) ─────────────

  getCapabilities(): CRMCapabilities {
    return {
      hasBlueprints: true,
      hasCustomFields: true,
      hasWebhooks: true,
      hasDeals: true, // "Potentials" en Zoho
      hasTags: true,
      hasDataCenters: true,
      oauthFlow: "authorization_code",
    };
  }

  async healthcheck(): Promise<boolean> {
    try {
      await this.request("/Leads?per_page=1");
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Phase 02 implementará revoke via Zoho OAuth revoke endpoint.
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  getAuthorizationUrl(_state: string, _redirectUri: string): string {
    // Phase 02 implementará: https://accounts.zoho.{DC}/oauth/v2/auth?scope=...
    throw new Error("ZohoCRMProvider.getAuthorizationUrl: implementado en Phase 02");
  }

  async completeOAuth(_code: string, _redirectUri: string): Promise<CRMTokens> {
    // Phase 02 implementará: POST /oauth/v2/token con grant_type=authorization_code.
    throw new Error("ZohoCRMProvider.completeOAuth: implementado en Phase 02");
  }

  async createLead(data: Record<string, unknown>): Promise<CRMLead> {
    const response = await this.request("/Leads", {
      method: "POST",
      body: JSON.stringify({ data: [data] }),
    });
    const created = response?.data?.[0];
    if (!created?.details?.id) {
      throw new Error("ZohoCRMProvider.createLead: respuesta sin id");
    }
    // GET para devolver el lead completo (Zoho create solo retorna metadata)
    const full = await this.getLead(created.details.id);
    if (!full) throw new Error("ZohoCRMProvider.createLead: getLead tras POST vacío");
    return full;
  }

  /**
   * SEARCH LEADS
   */
  async searchLeads(criteria: string): Promise<CRMLead[]> {
    const data = await this.request(`/Leads/search?criteria=${encodeURIComponent(criteria)}`);
    return (data?.data || []).map((lead: Record<string, unknown>) => this.mapToLead(lead));
  }

  /**
   * UPDATE LEAD
   */
  async updateLead(leadId: string, data: Record<string, unknown>) {
    return this.request(`/Leads/${leadId}`, {
      method: "PUT",
      body: JSON.stringify({ data: [data] }),
    });
  }

  /**
   * ADD TAGS
   */
  async addTags(leadId: string, tags: string[]) {
    return this.request(`/Leads/${leadId}/actions/add_tags?tag_names=${tags.join(",")}`, {
      method: "POST",
    });
  }

  /**
   * EXECUTE BLUEPRINT (Specific Zoho implementation of generic action)
   */
  async executeAction(leadId: string, actionId: string, data: Record<string, unknown> = {}) {
    if (actionId === "BLUEPRINT") {
      const { transitionId, transition_id } = data as {
        transitionId?: string;
        transition_id?: string;
      };
      return this.request(`/Leads/${leadId}/actions/blueprint`, {
        method: "PUT",
        body: JSON.stringify({
          blueprint: [
            {
              transition_id: transitionId || transition_id,
              data: data,
            },
          ],
        }),
      });
    }
    return null;
  }

  /**
   * GET LEAD
   */
  async getLead(leadId: string): Promise<CRMLead | null> {
    const data = await this.request(`/Leads/${leadId}`);
    return data.data?.[0] ? this.mapToLead(data.data[0]) : null;
  }

  /**
   * CREATE CALENDAR EVENT (Zoho Events)
   */
  async createEvent(
    leadId: string,
    eventData: { subject: string; startTime: string; durationMinutes: number; description?: string }
  ) {
    const endTime = new Date(
      new Date(eventData.startTime).getTime() + eventData.durationMinutes * 60000
    ).toISOString();

    return this.request(`/Events`, {
      method: "POST",
      body: JSON.stringify({
        data: [
          {
            Event_Title: eventData.subject,
            Start_DateTime: eventData.startTime,
            End_DateTime: endTime,
            Description: eventData.description || "",
            What_Id: {
              id: leadId,
              name: "Leads",
            },
            $se_module: "Leads",
          },
        ],
      }),
    });
  }

  /**
   * CREATE TASK (Zoho Tasks)
   */
  async createTask(
    leadId: string,
    taskData: { subject: string; description?: string; dueDate?: string; priority?: string }
  ) {
    return this.request(`/Tasks`, {
      method: "POST",
      body: JSON.stringify({
        data: [
          {
            Subject: taskData.subject,
            Description: taskData.description || "",
            Due_Date: taskData.dueDate || new Date().toISOString().split("T")[0],
            Priority: taskData.priority || "Normal",
            Status: "Not Started",
            What_Id: {
              id: leadId,
              name: "Leads",
            },
            $se_module: "Leads",
          },
        ],
      }),
    });
  }
}

/**
 * GENERIC CRM PROVIDER INTERFACE — Sprint 2 update (24-05-2026).
 *
 * Sprint 2 amplía la interface original (Sprint 1) con:
 *   - Capability flags estáticos (`getCapabilities`).
 *   - Lifecycle hooks (`healthcheck`, `disconnect`).
 *   - OAuth 2.0 handshake (`getAuthorizationUrl`, `completeOAuth`).
 *   - `createLead` (alta de leads — flow inbound webhook).
 *
 * Compatibilidad: los métodos antiguos (`getLead`, `searchLeads`, `updateLead`,
 * `addTags`, `executeAction`, `createEvent`, `createTask`) se mantienen.
 *
 * Ref:
 *   plans/260524-1330-sprint-2-adapter-hubspot-zoho/research/researcher-03-adapter-pattern.md §1
 */

// ───────────────────────────────────────────────────────────────────────────
// Domain types
// ───────────────────────────────────────────────────────────────────────────

/** Lead normalizado al formato interno del proyecto */
export interface CRMLead {
  id: string;
  fields: Record<string, unknown>; // sigue VARIABLES DEFINIDAS del cliente
  raw?: unknown;
}

/** Contexto inyectado por `WriteGuard` antes de invocar `updateLead`. */
export interface WriteContext {
  tenantId: string;
  actorId: string;
  writePolicy: "append_only" | "overwrite_with_audit";
  allowedOverrideFields?: string[];
}

/** Capability flags estáticos — usados por la UI para mostrar/ocultar features. */
export interface CRMCapabilities {
  hasBlueprints: boolean;
  hasCustomFields: boolean;
  hasWebhooks: boolean;
  hasDeals: boolean;
  hasTags: boolean;
  hasDataCenters: boolean;
  oauthFlow: "authorization_code" | "refresh_token_only";
}

/** Tokens descifrados en memoria — nunca se persisten en claro. */
export interface CRMTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scopes: string[];
  apiBase?: string; // Zoho multi-DC (viene de `api_domain` en el token response)
}

/** Configuración entregada al constructor del provider (Sprint 1 compat). */
export interface CRMProviderConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  apiBase?: string;
  tokenUrl?: string;
  /** Multi-DC Zoho: api_domain del token response, persistido en integrations.metadata. */
  apiDomain?: string;
  /** Identificador del row `integrations` (UUID) — usado por TokenManager. */
  integrationId?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// Provider interface
// ───────────────────────────────────────────────────────────────────────────

export interface ICRMProvider {
  // ── Capabilities ──────────────────────────────────────────────────────────

  /** Capability flags estáticos. No hace network. */
  getCapabilities(): CRMCapabilities;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  /**
   * Valida conexión: llama a un endpoint ligero del CRM (e.g. `/Leads?per_page=1`).
   * Devuelve `true` si está autenticado y alcanzable.
   */
  healthcheck(): Promise<boolean>;

  /**
   * Revoca tokens en el provider y limpia estado local en memoria.
   * NO borra row en `integrations` (eso lo hace el caller — server action).
   */
  disconnect(): Promise<void>;

  // ── OAuth handshake ───────────────────────────────────────────────────────

  /**
   * Devuelve la URL de autorización a la que redirigir al usuario.
   * @param state HMAC-signed opaque state (CSRF + carry tenantId)
   * @param redirectUri callback URI registrado en el CRM
   */
  getAuthorizationUrl(state: string, redirectUri: string): string;

  /**
   * Intercambia el authorization code por access + refresh tokens.
   * Persiste los tokens cifrados en `integrations.credentials_cipher`.
   * Devuelve los tokens normalizados (caller los recibe para confirmar).
   */
  completeOAuth(code: string, redirectUri: string): Promise<CRMTokens>;

  // ── Lead operations ───────────────────────────────────────────────────────

  /** Lee un lead por su CRM ID */
  getLead(leadId: string): Promise<CRMLead | null>;

  /** Busca leads por criteria string (sintaxis específica del provider) */
  searchLeads(criteria: string): Promise<CRMLead[]>;

  /**
   * Crea un lead nuevo en el CRM.
   * Sprint 2 add — necesario para flows inbound (webhook → lead nuevo).
   */
  createLead(data: Record<string, unknown>): Promise<CRMLead>;

  /**
   * Actualiza campos de un lead.
   * `WriteGuard` enforza `write_policy` ANTES de llamar a este método.
   * El adapter confía en que el guard ya filtró el payload.
   */
  updateLead(leadId: string, data: Record<string, unknown>): Promise<unknown>;

  /** Append-only por naturaleza. */
  addTags(leadId: string, tags: string[]): Promise<unknown>;

  // ── Acciones CRM-específicas ──────────────────────────────────────────────

  /**
   * Dispara una automation nativa del CRM.
   *   Zoho:    actionId = 'BLUEPRINT'      , data = { transitionId }
   *   HubSpot: actionId = 'WORKFLOW_ENROLL', data = { workflowId }
   */
  executeAction(leadId: string, actionId: string, data?: unknown): Promise<unknown>;

  // ── Activities ────────────────────────────────────────────────────────────

  createEvent(
    leadId: string,
    eventData: {
      subject: string;
      startTime: string;
      durationMinutes: number;
      description?: string;
    }
  ): Promise<unknown>;

  createTask(
    leadId: string,
    taskData: { subject: string; description?: string; dueDate?: string; priority?: string }
  ): Promise<unknown>;
}

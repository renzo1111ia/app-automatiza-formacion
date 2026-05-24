/**
 * MSW v2 handlers para Zoho CRM API v8 + OAuth.
 *
 * Cada test suite usa `server.use(...zohoHandlers(opts))` y opcionalmente
 * `server.use(...customHandlers)` para sobreescribir comportamiento por caso.
 */
import { http, HttpResponse } from "msw";

export interface ZohoMockOptions {
  /** API base — usa el del provider (https://www.zohoapis.eu por defecto). */
  apiBase?: string;
  accountsServer?: string;
  /** Para casos 401: devuelve 401 X veces y luego 200. */
  authFailures?: number;
  /** Para casos 429. */
  rateLimitedOnce?: boolean;
  /** Para casos 5xx. */
  serverErrorsBefore200?: number;
  /** Módulo. */
  moduleName?: string;
  /** Refresh response (Zoho típicamente NO rota refresh_token). */
  rotateRefreshToken?: boolean;
  /** Override para token exchange (OAuth complete). */
  tokenExchangeResponse?: Record<string, unknown>;
}

export function zohoHandlers(opts: ZohoMockOptions = {}) {
  const apiBase = opts.apiBase ?? "https://www.zohoapis.eu";
  const accountsServer = opts.accountsServer ?? "https://accounts.zoho.eu";
  const moduleName = opts.moduleName ?? "Leads";

  let auth401Remaining = opts.authFailures ?? 0;
  let server5xxRemaining = opts.serverErrorsBefore200 ?? 0;
  let rateLimited = !!opts.rateLimitedOnce;

  return [
    // ── OAuth token endpoint ────────────────────────────────────────────────
    http.post(`${accountsServer}/oauth/v2/token`, async ({ request }) => {
      const body = await request.text();
      const params = new URLSearchParams(body);
      const grant = params.get("grant_type");
      if (grant === "authorization_code") {
        return HttpResponse.json(
          opts.tokenExchangeResponse ?? {
            access_token: "zoho_at_initial",
            refresh_token: "zoho_rt_initial",
            api_domain: apiBase,
            expires_in: 3600,
            scope: "ZohoCRM.modules.leads.READ,ZohoCRM.modules.leads.WRITE",
            token_type: "Bearer",
          }
        );
      }
      if (grant === "refresh_token") {
        return HttpResponse.json({
          access_token: "zoho_at_refreshed",
          ...(opts.rotateRefreshToken ? { refresh_token: "zoho_rt_rotated" } : {}),
          api_domain: apiBase,
          expires_in: 3600,
          scope: "ZohoCRM.modules.leads.READ,ZohoCRM.modules.leads.WRITE",
          token_type: "Bearer",
        });
      }
      return new HttpResponse(JSON.stringify({ error: "unsupported_grant_type" }), { status: 400 });
    }),

    // ── Revoke ──────────────────────────────────────────────────────────────
    http.post(`${accountsServer}/oauth/v2/token/revoke`, () =>
      HttpResponse.json({ status: "success" })
    ),

    // ── Module list / search / get / create / update ───────────────────────
    http.get(`${apiBase}/crm/v8/${moduleName}`, () => {
      if (auth401Remaining > 0) {
        auth401Remaining--;
        return HttpResponse.json(
          { code: "INVALID_TOKEN", message: "invalid oauth token" },
          { status: 401 }
        );
      }
      if (rateLimited) {
        rateLimited = false;
        return new HttpResponse(JSON.stringify({ code: "TOO_MANY_REQUESTS" }), {
          status: 429,
          headers: { "Retry-After": "0" },
        });
      }
      if (server5xxRemaining > 0) {
        server5xxRemaining--;
        return new HttpResponse(JSON.stringify({ code: "INTERNAL_ERROR" }), { status: 503 });
      }
      return HttpResponse.json({
        data: [{ id: "111", First_Name: "Ana", Last_Name: "Gómez", Email: "ana@example.com" }],
        info: { count: 1, more_records: false },
      });
    }),

    http.get(`${apiBase}/crm/v8/${moduleName}/search`, ({ request }) => {
      if (auth401Remaining > 0) {
        auth401Remaining--;
        return HttpResponse.json(
          { code: "INVALID_TOKEN", message: "invalid oauth token" },
          { status: 401 }
        );
      }
      const url = new URL(request.url);
      const page = Number(url.searchParams.get("page") ?? 1);
      const email = url.searchParams.get("email");
      const perPage = Number(url.searchParams.get("per_page") ?? 200);
      if (email) {
        // Exact email search
        return HttpResponse.json({
          data: [{ id: "999", First_Name: "Exact", Last_Name: "Match", Email: email }],
        });
      }
      if (page === 1) {
        const rows = Array.from({ length: perPage }, (_, i) => ({
          id: String(1000 + i),
          First_Name: `User${i}`,
          Last_Name: "Page1",
          Email: `u${i}@example.com`,
        }));
        return HttpResponse.json({ data: rows, info: { more_records: true, page } });
      }
      if (page === 2) {
        const rows = Array.from({ length: 50 }, (_, i) => ({
          id: String(2000 + i),
          First_Name: `User${i}`,
          Last_Name: "Page2",
          Email: `u${i}@p2.com`,
        }));
        return HttpResponse.json({ data: rows, info: { more_records: false, page } });
      }
      return HttpResponse.json({ data: [], info: { more_records: false, page } });
    }),

    http.get(`${apiBase}/crm/v8/${moduleName}/:id`, ({ params }) => {
      return HttpResponse.json({
        data: [
          {
            id: String(params.id),
            First_Name: "Ana",
            Last_Name: "Gómez",
            Email: "ana@example.com",
            Phone: "+34600000000",
          },
        ],
      });
    }),

    http.post(`${apiBase}/crm/v8/${moduleName}`, () =>
      HttpResponse.json({
        data: [{ code: "SUCCESS", details: { id: "newlead123" }, message: "record added" }],
      })
    ),

    http.put(`${apiBase}/crm/v8/${moduleName}/:id`, () =>
      HttpResponse.json({
        data: [{ code: "SUCCESS", details: { id: "updated" }, message: "record updated" }],
      })
    ),

    http.post(`${apiBase}/crm/v8/${moduleName}/:id/actions/add_tags`, () =>
      HttpResponse.json({ data: [{ code: "SUCCESS" }] })
    ),

    http.post(`${apiBase}/crm/v8/Events`, () =>
      HttpResponse.json({ data: [{ code: "SUCCESS", details: { id: "event1" } }] })
    ),

    http.post(`${apiBase}/crm/v8/Tasks`, () =>
      HttpResponse.json({ data: [{ code: "SUCCESS", details: { id: "task1" } }] })
    ),
  ];
}

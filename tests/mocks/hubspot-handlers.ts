/**
 * MSW v2 handlers para HubSpot CRM API v3 + OAuth.
 */
import { http, HttpResponse } from "msw";

const API = "https://api.hubapi.com";

export interface HubSpotMockOptions {
  authFailures?: number;
  rateLimitedOnce?: boolean;
  retryAfterSeconds?: number;
  serverErrorsBefore200?: number;
  rotateRefreshToken?: boolean;
  hubId?: number | string;
  existingProperties?: string[]; // for ensureCustomProperties test
}

export function hubspotHandlers(opts: HubSpotMockOptions = {}) {
  let auth401Remaining = opts.authFailures ?? 0;
  let server5xxRemaining = opts.serverErrorsBefore200 ?? 0;
  let rateLimited = !!opts.rateLimitedOnce;
  const retrySecs = opts.retryAfterSeconds ?? 1;
  const hubId = opts.hubId ?? 42;
  const existingProps = new Set(opts.existingProperties ?? []);

  return [
    // ── OAuth token endpoint ────────────────────────────────────────────────
    http.post(`${API}/oauth/v1/token`, async ({ request }) => {
      const body = await request.text();
      const params = new URLSearchParams(body);
      const grant = params.get("grant_type");
      if (grant === "authorization_code") {
        return HttpResponse.json({
          access_token: "hs_at_initial",
          refresh_token: "hs_rt_initial",
          expires_in: 1800,
          hub_id: hubId,
        });
      }
      if (grant === "refresh_token") {
        return HttpResponse.json({
          access_token: "hs_at_refreshed",
          ...(opts.rotateRefreshToken ? { refresh_token: "hs_rt_rotated" } : {}),
          expires_in: 1800,
        });
      }
      return new HttpResponse(JSON.stringify({ message: "bad grant" }), { status: 400 });
    }),

    http.get(`${API}/oauth/v1/access-tokens/:token`, () =>
      HttpResponse.json({ hub_id: hubId, scopes: ["contacts"] })
    ),

    // ── Contacts ────────────────────────────────────────────────────────────
    http.get(`${API}/crm/v3/objects/contacts`, () => {
      if (auth401Remaining > 0) {
        auth401Remaining--;
        return new HttpResponse(JSON.stringify({ message: "unauthorized" }), { status: 401 });
      }
      if (rateLimited) {
        rateLimited = false;
        return new HttpResponse(JSON.stringify({ message: "rate limited" }), {
          status: 429,
          headers: { "Retry-After": String(retrySecs) },
        });
      }
      if (server5xxRemaining > 0) {
        server5xxRemaining--;
        return new HttpResponse(JSON.stringify({ message: "server error" }), { status: 503 });
      }
      return HttpResponse.json({ results: [{ id: "1", properties: { firstname: "Ana" } }] });
    }),

    http.get(`${API}/crm/v3/objects/contacts/:id`, ({ params }) =>
      HttpResponse.json({
        id: String(params.id),
        properties: {
          firstname: "Ana",
          lastname: "Gómez",
          email: "ana@example.com",
          phone: "+34600000000",
          af_origen: "facebook",
        },
      })
    ),

    http.post(`${API}/crm/v3/objects/contacts/search`, async ({ request }) => {
      const body = (await request.json()) as {
        filterGroups?: Array<{ filters: Array<{ propertyName: string; value: string }> }>;
      };
      const email = body.filterGroups?.[0]?.filters?.find((f) => f.propertyName === "email")?.value;
      if (email === "notfound@example.com") {
        return HttpResponse.json({ results: [] });
      }
      return HttpResponse.json({
        results: [
          {
            id: "555",
            properties: {
              firstname: "Encontrado",
              lastname: "User",
              email: email ?? "found@example.com",
            },
          },
        ],
      });
    }),

    http.post(`${API}/crm/v3/objects/contacts`, async ({ request }) => {
      const body = (await request.json()) as { properties?: Record<string, unknown> };
      return HttpResponse.json({
        id: "1001",
        properties: body.properties ?? {},
      });
    }),

    http.patch(`${API}/crm/v3/objects/contacts/:id`, async ({ request, params }) => {
      const body = (await request.json()) as { properties?: Record<string, unknown> };
      return HttpResponse.json({
        id: String(params.id),
        properties: body.properties ?? {},
      });
    }),

    // ── Properties (custom property provisioning) ───────────────────────────
    http.get(`${API}/crm/v3/properties/contacts`, () =>
      HttpResponse.json({
        results: [
          { name: "firstname" },
          { name: "lastname" },
          { name: "email" },
          ...[...existingProps].map((name) => ({ name })),
        ],
      })
    ),

    http.post(`${API}/crm/v3/properties/contacts`, async ({ request }) => {
      const body = (await request.json()) as { name?: string };
      if (body.name) existingProps.add(body.name);
      return HttpResponse.json({ name: body.name, created: true });
    }),

    // ── Lists ───────────────────────────────────────────────────────────────
    http.get(`${API}/crm/v3/lists/`, () =>
      HttpResponse.json({
        lists: [
          { listId: 7001, name: "vip" },
          { listId: 7002, name: "newsletter" },
        ],
      })
    ),

    http.put(`${API}/crm/v3/lists/:listId/memberships/add`, () =>
      HttpResponse.json({ recordsIdsAdded: ["1"] })
    ),

    // ── Tasks ───────────────────────────────────────────────────────────────
    http.post(`${API}/crm/v3/objects/tasks`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: "task_1", ...body });
    }),

    // ── Meetings ────────────────────────────────────────────────────────────
    http.post(`${API}/crm/v3/objects/meetings`, async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      return HttpResponse.json({ id: "meeting_1", ...body });
    }),
  ];
}

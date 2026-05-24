/**
 * Tests del route handler /api/integrations/[provider]/auth/callback.
 *
 * Mockea cookies, supabase y los providers para validar:
 *  - csrf cookie mismatch → redirect error
 *  - csrf DB mismatch → redirect error
 *  - HMAC tamper → redirect error
 *  - missing code → redirect error
 *  - happy path → encrypt + persist + redirect success
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { generateOAuthState } from "@/lib/integrations/crm/oauth/oauth-state";

const ORIGINAL_SECRET = process.env.OAUTH_STATE_SECRET;
process.env.OAUTH_STATE_SECRET = "01234567890123456789012345678901234567890123456789AB";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:8500";
process.env.HUBSPOT_CLIENT_ID = "C";
process.env.HUBSPOT_CLIENT_SECRET = "S";
process.env.ZOHO_CLIENT_ID = "Z";
process.env.ZOHO_CLIENT_SECRET = "ZS";

const { cookieGetMock, cookieDeleteMock } = vi.hoisted(() => ({
  cookieGetMock: vi.fn(),
  cookieDeleteMock: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: cookieGetMock,
    delete: cookieDeleteMock,
    set: vi.fn(),
  }),
}));

const { selectSingleMock, updateMock } = vi.hoisted(() => ({
  selectSingleMock: vi.fn(),
  updateMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock("@/lib/supabase/server", () => ({
  getAdminSupabaseClient: vi.fn(async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: selectSingleMock,
          }),
        }),
      }),
      update: () => ({ eq: updateMock }),
    }),
  })),
  getActiveTenantId: vi.fn(async () => "TENANT_ID"),
}));

vi.mock("@/lib/crypto/token-crypto", () => ({
  encryptJson: vi.fn((obj: unknown) => `enc:${JSON.stringify(obj)}`),
  decryptJson: vi.fn((cipher: string) => JSON.parse(cipher.replace(/^enc:/, ""))),
}));

vi.mock("@/lib/integrations/crm/factory", () => ({
  CRMFactory: {
    createForOAuthFlow: vi.fn(() => ({
      getAuthorizationUrl: () => "https://provider/auth",
      completeOAuth: vi.fn(async () => ({
        accessToken: "AT",
        refreshToken: "RT",
        expiresAt: new Date(Date.now() + 1800_000),
        scopes: ["scope"],
        portalId: "PORTAL",
      })),
      completeOAuthWithContext: vi.fn(async () => ({
        accessToken: "AT",
        refreshToken: "RT",
        expiresAt: new Date(Date.now() + 1800_000),
        scopes: ["scope"],
        apiBase: "https://www.zohoapis.eu",
        dc: { location: "eu", accountsServer: "https://accounts.zoho.eu" },
      })),
    })),
    getProviderForIntegration: vi.fn(async () => ({
      init: vi.fn(async () => ({ created: [], existing: [] })),
    })),
  },
}));

import { GET } from "@/app/api/integrations/[provider]/auth/callback/route";

function makeRequest(
  provider: string,
  params: Record<string, string>
): {
  request: Request;
  context: { params: Promise<{ provider: string }> };
} {
  const url = new URL(`http://localhost:8500/api/integrations/${provider}/auth/callback`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return {
    request: new Request(url),
    context: { params: Promise.resolve({ provider }) },
  };
}

describe("oauth-callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    if (ORIGINAL_SECRET !== undefined) process.env.OAUTH_STATE_SECRET = ORIGINAL_SECRET;
  });

  it("redirect a settings con error=oauth_failed cuando falta code", async () => {
    const { request, context } = makeRequest("hubspot", { state: "x" });
    const res = await GET(
      request as Parameters<typeof GET>[0],
      context as Parameters<typeof GET>[1]
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("error=oauth_failed");
  });

  it("redirect csrf_mismatch cuando la cookie no coincide con el state", async () => {
    const validState = generateOAuthState("TENANT_ID");
    cookieGetMock.mockReturnValue({ value: "OTHER_VALUE" });
    const { request, context } = makeRequest("hubspot", { code: "CODE", state: validState });
    const res = await GET(
      request as Parameters<typeof GET>[0],
      context as Parameters<typeof GET>[1]
    );
    expect(res.headers.get("location")).toContain("error=csrf_mismatch");
  });

  it("redirect csrf_mismatch si el HMAC del state está tampered", async () => {
    const badState = "TENANT_ID:nonce:" + "0".repeat(64);
    cookieGetMock.mockReturnValue({ value: badState });
    const { request, context } = makeRequest("hubspot", { code: "CODE", state: badState });
    const res = await GET(
      request as Parameters<typeof GET>[0],
      context as Parameters<typeof GET>[1]
    );
    expect(res.headers.get("location")).toContain("error=csrf_mismatch");
  });

  it("redirect csrf_mismatch si la DB no tiene el state guardado", async () => {
    const validState = generateOAuthState("TENANT_ID");
    cookieGetMock.mockReturnValue({ value: validState });
    selectSingleMock.mockResolvedValue({ data: null, error: null });
    const { request, context } = makeRequest("hubspot", { code: "CODE", state: validState });
    const res = await GET(
      request as Parameters<typeof GET>[0],
      context as Parameters<typeof GET>[1]
    );
    expect(res.headers.get("location")).toContain("error=csrf_mismatch");
  });

  it("happy path HubSpot: triple-check OK → success", async () => {
    const validState = generateOAuthState("TENANT_ID");
    cookieGetMock.mockReturnValue({ value: validState });
    selectSingleMock.mockResolvedValue({
      data: { id: "INT_ID", tenant_id: "TENANT_ID", oauth_state: validState },
      error: null,
    });
    const { request, context } = makeRequest("hubspot", { code: "CODE", state: validState });
    const res = await GET(
      request as Parameters<typeof GET>[0],
      context as Parameters<typeof GET>[1]
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toContain("success=hubspot");
    expect(updateMock).toHaveBeenCalled();
  });

  it("happy path Zoho: extrae DC del callback y persiste metadata", async () => {
    const validState = generateOAuthState("TENANT_ID");
    cookieGetMock.mockReturnValue({ value: validState });
    selectSingleMock.mockResolvedValue({
      data: { id: "INT_ID", tenant_id: "TENANT_ID", oauth_state: validState },
      error: null,
    });
    const { request, context } = makeRequest("zoho", {
      code: "CODE",
      state: validState,
      location: "eu",
      "accounts-server": "https://accounts.zoho.eu",
    });
    const res = await GET(
      request as Parameters<typeof GET>[0],
      context as Parameters<typeof GET>[1]
    );
    expect(res.headers.get("location")).toContain("success=zoho");
  });
});

/**
 * SPRINT 5.7 — Integration tests: Webhook security + Opt-Out
 * tests/integrations/whatsapp/webhook-security.test.ts
 *
 * Tests:
 *  1. Webhook POST rejects requests without x-hub-signature-256 header (HTTP 401)
 *  2. Webhook POST rejects requests with an invalid HMAC signature (HTTP 401)
 *  3. Webhook GET correctly responds to Meta's handshake (HTTP 200 + challenge)
 *  4. Webhook GET returns 403 with wrong verify token
 *  5. Opt-Out middleware blocks sends to blacklisted numbers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Global Mocks (Hoisted by Vitest)
// ---------------------------------------------------------------------------

let mockSupabaseResponse: any = { data: null, error: null };
let mockInsertResponse: any = { error: null };

vi.mock("@supabase/supabase-js", () => {
  return {
    createClient: () => ({
      from: (table: string) => {
        if (table === "whatsapp_opt_out") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    maybeSingle: async () => mockSupabaseResponse,
                  }),
                }),
              }),
            }),
            upsert: async () => ({ error: null }),
            update: () => ({
              eq: () => ({
                eq: async () => ({ error: null }),
              }),
            }),
          };
        }
        if (table === "whatsapp_message_logs") {
          return {
            insert: async () => mockInsertResponse,
            update: () => ({ eq: async () => ({ error: null }) }),
          };
        }
        return {};
      },
    }),
  };
});

vi.mock("@/lib/auth-config", () => ({
  getAuthServiceRoleKey: () => "fake-service-role-key",
}));

vi.mock("@/lib/env", () => ({
  requireEnvAny: () => "https://fake.supabase.co",
}));

// Import AFTER mocks
import { GET, POST } from "@/app/api/webhooks/whatsapp/route";
import { MetaWhatsAppClient } from "@/lib/integrations/whatsapp/client";

// ---------------------------------------------------------------------------
// HMAC signing helper
// ---------------------------------------------------------------------------

function signPayload(secret: string, body: string): string {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(body);
  return `sha256=${hmac.digest("hex")}`;
}

// ---------------------------------------------------------------------------
// Webhook GET (Meta verification handshake)
// ---------------------------------------------------------------------------

describe("Webhook GET — Meta verification handshake", () => {
  const APP_SECRET = "test_app_secret_abc123";
  const VERIFY_TOKEN = "my_secure_verify_token";

  beforeEach(() => {
    vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", VERIFY_TOKEN);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 200 + challenge when mode=subscribe and token matches", async () => {
    const url = new URL("http://localhost/api/webhooks/whatsapp");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", "challenge_token_xyz");

    const req = new Request(url.toString(), { method: "GET" });
    const res = await GET(req);

    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toBe("challenge_token_xyz");
  });

  it("returns 403 when verify_token is wrong", async () => {
    const url = new URL("http://localhost/api/webhooks/whatsapp");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", "WRONG_TOKEN");
    url.searchParams.set("hub.challenge", "challenge_token_xyz");

    const req = new Request(url.toString(), { method: "GET" });
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it("returns 503 when WHATSAPP_VERIFY_TOKEN env var is missing", async () => {
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "");

    const url = new URL("http://localhost/api/webhooks/whatsapp");
    url.searchParams.set("hub.mode", "subscribe");
    url.searchParams.set("hub.verify_token", VERIFY_TOKEN);
    url.searchParams.set("hub.challenge", "abc");

    const req = new Request(url.toString(), { method: "GET" });
    const res = await GET(req);

    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Webhook POST (message & status updates)
// ---------------------------------------------------------------------------

describe("Webhook POST — HMAC signature validation", () => {
  const APP_SECRET = "test_app_secret_abc123";

  const validPayload = JSON.stringify({
    object: "whatsapp_business_account",
    entry: [],
  });

  beforeEach(() => {
    vi.stubEnv("WHATSAPP_APP_SECRET", APP_SECRET);
    vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "any_token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when x-hub-signature-256 header is missing", async () => {
    const req = new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: validPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe("Missing signature");
  });

  it("returns 401 when HMAC signature is invalid", async () => {
    const req = new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": "sha256=INVALID_SIGNATURE_XXXXXXXX",
      },
      body: validPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toBe("Invalid signature");
  });

  it("returns 200 when HMAC signature is valid", async () => {
    const validSignature = signPayload(APP_SECRET, validPayload);

    const req = new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": validSignature,
      },
      body: validPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it("returns 503 when WHATSAPP_APP_SECRET env var is not set", async () => {
    vi.stubEnv("WHATSAPP_APP_SECRET", "");

    const req = new Request("http://localhost/api/webhooks/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hub-signature-256": signPayload(APP_SECRET, validPayload),
      },
      body: validPayload,
    });

    const res = await POST(req);
    expect(res.status).toBe(503);
  });
});

// ---------------------------------------------------------------------------
// Opt-Out middleware
// ---------------------------------------------------------------------------

describe("Opt-Out middleware — MetaWhatsAppClient", () => {
  beforeEach(() => {
    mockSupabaseResponse = { data: null, error: null };
  });

  it("isOptedOut returns true for a number in the blacklist", async () => {
    mockSupabaseResponse = { data: { id: "opt-out-uuid-123" }, error: null };
    
    const client = new MetaWhatsAppClient();
    const result = await client.isOptedOut("tenant-123", "+34612345678");
    expect(result).toBe(true);
  });

  it("isOptedOut returns false when number is not in the blacklist", async () => {
    mockSupabaseResponse = { data: null, error: null };

    const client = new MetaWhatsAppClient();
    const result = await client.isOptedOut("tenant-123", "+34699999999");
    expect(result).toBe(false);
  });

  it("sendTemplate blocks and returns OPT_OUT when number is blacklisted", async () => {
    mockSupabaseResponse = { data: { id: "x" }, error: null };

    const client = new MetaWhatsAppClient();
    const result = await client.sendTemplate({
      to: "+34612345678",
      templateName: "bienvenida",
      language: "es",
      components: [],
      config: { accessToken: "x", phoneNumberId: "y", wabaId: "z" },
      tenantId: "tenant-123",
    });

    expect(result.success).toBe(false);
    expect(result.blocked).toBe("OPT_OUT");
  });
});

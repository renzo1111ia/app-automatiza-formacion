/**
 * Tests para `crm-error.ts` — mappers HubSpot/Zoho → CRMError.
 */

import { describe, it, expect } from "vitest";
import {
  CRMError,
  mapHubSpotError,
  mapZohoError,
  networkError,
} from "@/lib/integrations/crm/crm-error";

describe("CRMError", () => {
  it("conserva code + provider + message + retryable", () => {
    const e = new CRMError({
      code: "RATE_LIMITED",
      message: "Too many",
      provider: "hubspot",
      retryable: true,
      retryAfterMs: 5000,
    });
    expect(e).toBeInstanceOf(Error);
    expect(e.code).toBe("RATE_LIMITED");
    expect(e.provider).toBe("hubspot");
    expect(e.message).toBe("Too many");
    expect(e.retryable).toBe(true);
    expect(e.retryAfterMs).toBe(5000);
  });

  it("retryable default false si no se pasa", () => {
    const e = new CRMError({ code: "AUTH_FAILED", message: "x", provider: "zoho" });
    expect(e.retryable).toBe(false);
  });
});

describe("mapHubSpotError", () => {
  it("401 → AUTH_FAILED", () => {
    const e = mapHubSpotError(401, { message: "Bad token" });
    expect(e.code).toBe("AUTH_FAILED");
    expect(e.provider).toBe("hubspot");
    expect(e.message).toBe("Bad token");
  });

  it("403 → AUTH_FAILED", () => {
    expect(mapHubSpotError(403, {}).code).toBe("AUTH_FAILED");
  });

  it("404 → NOT_FOUND", () => {
    expect(mapHubSpotError(404, {}).code).toBe("NOT_FOUND");
  });

  it("429 default → RATE_LIMITED retryable retryAfterMs 10s", () => {
    const e = mapHubSpotError(429, {});
    expect(e.code).toBe("RATE_LIMITED");
    expect(e.retryable).toBe(true);
    expect(e.retryAfterMs).toBe(10000);
  });

  it("429 con policyName DAILY → retryAfterMs 24h", () => {
    const e = mapHubSpotError(429, { policyName: "DAILY" });
    expect(e.retryAfterMs).toBe(86400000);
  });

  it("422 → VALIDATION con originalError", () => {
    const body = { message: "Field missing", category: "VALIDATION_ERROR" };
    const e = mapHubSpotError(422, body);
    expect(e.code).toBe("VALIDATION");
    expect(e.message).toBe("Field missing");
    expect(e.originalError).toEqual(body);
  });

  it("500 → PROVIDER_ERROR retryable", () => {
    const e = mapHubSpotError(500, {});
    expect(e.code).toBe("PROVIDER_ERROR");
    expect(e.retryable).toBe(true);
  });

  it("status raro → PROVIDER_ERROR", () => {
    const e = mapHubSpotError(418, {});
    expect(e.code).toBe("PROVIDER_ERROR");
  });
});

describe("mapZohoError", () => {
  it("401 → AUTH_FAILED", () => {
    expect(mapZohoError(401, {}).code).toBe("AUTH_FAILED");
  });

  it("code INVALID_TOKEN → AUTH_FAILED", () => {
    const e = mapZohoError(200, { code: "INVALID_TOKEN", message: "expired" });
    expect(e.code).toBe("AUTH_FAILED");
    expect(e.message).toBe("expired");
  });

  it("code OAUTH_SCOPE_MISMATCH → AUTH_FAILED", () => {
    expect(mapZohoError(200, { code: "OAUTH_SCOPE_MISMATCH" }).code).toBe("AUTH_FAILED");
  });

  it("404 → NOT_FOUND", () => {
    expect(mapZohoError(404, {}).code).toBe("NOT_FOUND");
  });

  it("code RECORD_NOT_FOUND → NOT_FOUND", () => {
    expect(mapZohoError(200, { code: "RECORD_NOT_FOUND" }).code).toBe("NOT_FOUND");
  });

  it("429 → RATE_LIMITED retryAfterMs 60s", () => {
    const e = mapZohoError(429, {});
    expect(e.code).toBe("RATE_LIMITED");
    expect(e.retryAfterMs).toBe(60000);
  });

  it("code MANDATORY_NOT_FOUND → VALIDATION con originalError", () => {
    const body = { code: "MANDATORY_NOT_FOUND", message: "Last_Name required" };
    const e = mapZohoError(200, body);
    expect(e.code).toBe("VALIDATION");
    expect(e.originalError).toEqual(body);
  });

  it("500 → PROVIDER_ERROR retryable", () => {
    expect(mapZohoError(503, {}).retryable).toBe(true);
  });
});

describe("networkError", () => {
  it("crea CRMError NETWORK retryable", () => {
    const original = new Error("ECONNREFUSED");
    const e = networkError("zoho", original);
    expect(e.code).toBe("NETWORK");
    expect(e.retryable).toBe(true);
    expect(e.originalError).toBe(original);
    expect(e.provider).toBe("zoho");
  });
});

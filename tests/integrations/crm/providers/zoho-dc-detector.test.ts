import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOCATION,
  LOCATION_TO_ACCOUNTS,
  extractDCFromCallback,
} from "@/lib/integrations/crm/providers/zoho-dc-detector";

describe("zoho-dc-detector — extractDCFromCallback", () => {
  it("extracts EU location and accounts-server from callback params", () => {
    const params = new URLSearchParams({
      code: "abc",
      state: "x",
      location: "eu",
      "accounts-server": "https://accounts.zoho.eu",
    });
    const dc = extractDCFromCallback(params);
    expect(dc.location).toBe("eu");
    expect(dc.accountsServer).toBe("https://accounts.zoho.eu");
  });

  it("falls back to default US when params missing", () => {
    const params = new URLSearchParams({ code: "abc", state: "x" });
    const dc = extractDCFromCallback(params);
    expect(dc.location).toBe(DEFAULT_LOCATION);
    expect(dc.accountsServer).toBe(LOCATION_TO_ACCOUNTS[DEFAULT_LOCATION]);
  });

  it("uses LOCATION_TO_ACCOUNTS table when accounts-server missing but location present", () => {
    const params = new URLSearchParams({ code: "abc", state: "x", location: "in" });
    const dc = extractDCFromCallback(params);
    expect(dc.location).toBe("in");
    expect(dc.accountsServer).toBe(LOCATION_TO_ACCOUNTS.in);
  });

  it("rejects non-https accounts-server (anti-SSRF) and falls back to table", () => {
    const params = new URLSearchParams({
      location: "eu",
      "accounts-server": "http://malicious.example.com",
    });
    const dc = extractDCFromCallback(params);
    expect(dc.accountsServer).toBe(LOCATION_TO_ACCOUNTS.eu);
  });

  it("supports all 9 DCs in LOCATION_TO_ACCOUNTS", () => {
    const expected = ["us", "eu", "in", "au", "jp", "ca", "sa", "uk", "cn"];
    for (const dc of expected) {
      expect(LOCATION_TO_ACCOUNTS[dc]).toMatch(/^https:\/\//);
    }
  });
});

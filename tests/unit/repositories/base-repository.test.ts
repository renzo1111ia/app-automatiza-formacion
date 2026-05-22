import { describe, it, expect } from "vitest";
import {
  paginate,
  handleSupabaseError,
  withTenantFilter,
} from "@/lib/repositories/_base-repository";

describe("paginate", () => {
  it("default: page=1 pageSize=50 -> from=0 to=49", () => {
    const r = paginate();
    expect(r.from).toBe(0);
    expect(r.to).toBe(49);
    expect(r.limit).toBe(50);
  });

  it("clamps pageSize a max 200", () => {
    const r = paginate({ pageSize: 500 });
    expect(r.limit).toBe(200);
  });

  it("page 2 con pageSize 20 -> from=20 to=39", () => {
    const r = paginate({ page: 2, pageSize: 20 });
    expect(r.from).toBe(20);
    expect(r.to).toBe(39);
  });

  it("page 0 o negativo se clamp a 1", () => {
    expect(paginate({ page: 0 }).from).toBe(0);
    expect(paginate({ page: -5 }).from).toBe(0);
  });
});

describe("handleSupabaseError", () => {
  it("string passthrough", () => {
    expect(handleSupabaseError("oops")).toBe("oops");
  });

  it("error object con message", () => {
    expect(handleSupabaseError({ message: "DB down" })).toBe("DB down");
  });

  it("error object con details solo", () => {
    expect(handleSupabaseError({ details: "PK collision" })).toBe("PK collision");
  });

  it("null/undefined -> string vacio", () => {
    expect(handleSupabaseError(null)).toBe("");
    expect(handleSupabaseError(undefined)).toBe("");
  });

  it("Error instance", () => {
    expect(handleSupabaseError(new Error("boom"))).toBe("boom");
  });
});

describe("withTenantFilter", () => {
  it("inyecta .eq('tenant_id', value) por defecto", () => {
    const calls: Array<{ col: string; val: unknown }> = [];
    const fakeQuery = {
      eq(col: string, val: unknown) {
        calls.push({ col, val });
        return this;
      },
    };
    withTenantFilter(fakeQuery, "tenant-123");
    expect(calls).toEqual([{ col: "tenant_id", val: "tenant-123" }]);
  });

  it("permite columna custom", () => {
    const calls: Array<{ col: string; val: unknown }> = [];
    const fakeQuery = {
      eq(col: string, val: unknown) {
        calls.push({ col, val });
        return this;
      },
    };
    withTenantFilter(fakeQuery, "tid", "tenant");
    expect(calls).toEqual([{ col: "tenant", val: "tid" }]);
  });
});

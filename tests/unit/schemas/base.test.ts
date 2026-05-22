import { describe, it, expect } from "vitest";
import {
  uuidSchema,
  emailSchema,
  phoneSchema,
  LeadStageEnum,
  HandoffReasonEnum,
  QualificationEnum,
  AppointmentStatusEnum,
  CampaignStatusEnum,
} from "@/lib/schemas/_base";

describe("schemas/_base helpers", () => {
  it("uuidSchema acepta UUID v4 valido", () => {
    expect(uuidSchema.safeParse("550e8400-e29b-41d4-a716-446655440000").success).toBe(true);
  });

  it("uuidSchema rechaza string no-UUID", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
    expect(uuidSchema.safeParse(123).success).toBe(false);
  });

  it("emailSchema valida formato", () => {
    expect(emailSchema.safeParse("user@example.com").success).toBe(true);
    expect(emailSchema.safeParse("invalid").success).toBe(false);
  });

  it("phoneSchema rechaza demasiado corto", () => {
    expect(phoneSchema.safeParse("12345").success).toBe(false);
    expect(phoneSchema.safeParse("+34699123456").success).toBe(true);
  });
});

describe("schemas/_base enums", () => {
  it("LeadStageEnum incluye UNREACHABLE (NEW-13)", () => {
    expect(LeadStageEnum.options).toContain("UNREACHABLE");
    expect(LeadStageEnum.options).toContain("QUALIFICATION");
    expect(LeadStageEnum.options).toContain("SCHEDULING");
    expect(LeadStageEnum.options).toContain("COMPLETED");
    expect(LeadStageEnum.options).toContain("DROPPED");
  });

  it("HandoffReasonEnum tiene 3 razones (ADR-014)", () => {
    expect(HandoffReasonEnum.options).toEqual([
      "invalid_phone",
      "max_attempts_exceeded",
      "user_requested_stop",
    ]);
  });

  it("QualificationEnum incluye UNREACHABLE", () => {
    expect(QualificationEnum.options).toContain("UNREACHABLE");
  });

  it("AppointmentStatusEnum incluye estados core", () => {
    for (const s of ["scheduled", "completed", "cancelled", "no_show"]) {
      expect(AppointmentStatusEnum.options).toContain(s);
    }
  });

  it("CampaignStatusEnum espanol mayusculas", () => {
    expect(CampaignStatusEnum.options).toEqual(["ACTIVA", "PAUSADA", "FINALIZADA"]);
  });
});

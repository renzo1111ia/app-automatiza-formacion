/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchCalls } from "@/lib/actions/calls";

// Mock Supabase server client
vi.mock("@/lib/supabase/server", () => {
  const mockSupabase = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
  };

  return {
    getSupabaseServerClient: vi.fn(() => mockSupabase),
    getActiveTenantId: vi.fn(() => "tenant-123"),
    getAdminSupabaseClient: vi.fn(() => mockSupabase),
  };
});

describe("fetchCalls - Mapping & Flags", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should select conversaciones_whatsapp and map tiene_whatsapp and tiene_voz flags correctly", async () => {
    const { getSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = (await getSupabaseServerClient()) as any;

    const mockLeadsData = [
      {
        id: "lead-123",
        nombre: "Test",
        apellido: "User",
        telefono: "+34600000000",
        email: "test@example.com",
        pais: "ES",
        tipo_lead: "nuevo",
        origen: "google_ads",
        campana: "campana_1",
        fecha_ingreso_crm: "2026-06-12T15:00:00Z",
        llamadas: [
          {
            id: "call-1",
            estado_llamada: "CONTACTED",
            razon_termino: "COMPLETED",
            fecha_inicio: "2026-06-12T15:05:00Z",
            duracion_segundos: 60,
            url_grabacion: "http://grabacion.mp3",
            resumen: "Llamada de test",
            tipo_agente: "RETELL_AI",
          },
        ],
        lead_cualificacion: [
          {
            cualificacion: "APTA",
            fecha_creacion: "2026-06-12T15:06:00Z",
          },
        ],
        conversaciones_whatsapp: [
          {
            id: "conv-1",
            estado: "ACTIVA",
            opt_in_whatsapp: true,
            fecha_ultimo_mensaje: "2026-06-12T15:04:00Z",
          },
        ],
      },
    ];

    // Mock the chain of calls for lead selection
    // First query: lead selection
    const leadQueryPromise = Promise.resolve({
      data: mockLeadsData,
      count: 1,
      error: null,
    });
    
    // Second query: appointments selection
    const apptsQueryPromise = Promise.resolve({
      data: [
        {
          lead_id: "lead-123",
          scheduled_at: "2026-06-13T10:00:00Z",
          status: "CONFIRMED",
          created_at: "2026-06-12T15:10:00Z",
        },
      ],
      error: null,
    });

    vi.spyOn(supabase, "from").mockImplementation((table: any) => {
      if (table === "lead") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockImplementation(() => leadQueryPromise),
          filter: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
        } as any;
      }
      if (table === "appointments") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockImplementation(() => apptsQueryPromise),
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
      } as any;
    });

    const result = await fetchCalls({ page: 1, pageSize: 50 });

    // Assertions
    expect(result.data).toHaveLength(1);
    const mappedRow = result.data[0];
    
    // Check channel flags
    expect(mappedRow.tiene_whatsapp).toBe(true);
    expect(mappedRow.tiene_voz).toBe(true);
    
    // Check other mapped fields
    expect(mappedRow.nombre).toBe("Test");
    expect(mappedRow.whatsapp_status).toBe("ACTIVA");
    expect(mappedRow.opt_in_whatsapp).toBe(true);
    expect(mappedRow.total_llamadas).toBe(1);
    expect(mappedRow.cualificacion).toBe("APTA");
    expect(mappedRow.confirmado).toBe(true);
  });

  it("should return false for tiene_whatsapp and tiene_voz when their lists are empty", async () => {
    const { getSupabaseServerClient } = await import("@/lib/supabase/server");
    const supabase = (await getSupabaseServerClient()) as any;

    const mockLeadsData = [
      {
        id: "lead-456",
        nombre: "Solo",
        apellido: "User",
        llamadas: [],
        lead_cualificacion: [],
        conversaciones_whatsapp: [],
      },
    ];

    const leadQueryPromise = Promise.resolve({
      data: mockLeadsData,
      count: 1,
      error: null,
    });
    
    const apptsQueryPromise = Promise.resolve({
      data: [],
      error: null,
    });

    vi.spyOn(supabase, "from").mockImplementation((table: any) => {
      if (table === "lead") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          range: vi.fn().mockImplementation(() => leadQueryPromise),
          filter: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
        } as any;
      }
      if (table === "appointments") {
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockImplementation(() => apptsQueryPromise),
        } as any;
      }
      return {
        select: vi.fn().mockReturnThis(),
      } as any;
    });

    const result = await fetchCalls({ page: 1, pageSize: 50 });

    expect(result.data).toHaveLength(1);
    const mappedRow = result.data[0];
    expect(mappedRow.tiene_whatsapp).toBe(false);
    expect(mappedRow.tiene_voz).toBe(false);
  });
});

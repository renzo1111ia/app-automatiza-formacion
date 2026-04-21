import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { type SupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

/**
 * RETELL LIVE TOOLING WEBHOOK
 * Handles real-time function calls from Retell agents during a call.
 * This endpoint processes actions like booking appointments or fetching CRM data.
 */
export async function POST(req: Request) {
    try {
        const payload = await req.json();
        
        // Retell sends: { name, args, call: { call_id, metadata: { lead_id, tenant_id } } }
        const { name: toolName, args, call } = payload;
        
        console.log(`[RETELL TOOLS] Incoming function call: ${toolName}`, args);

        const supabase = await getAdminSupabaseClient();
        
        // Metadata extraction (must be passed during createCall)
        const metadata = call?.metadata || {};
        const leadId = metadata.lead_id;
        const tenantId = metadata.tenant_id;

        if (!leadId || !tenantId) {
            console.warn("[RETELL TOOLS] Missing lead_id or tenant_id in call metadata. Using fallback search.");
            // In a real scenario, we would search the DB by call_id if metadata is missing.
        }

        switch (toolName) {
            case "book_appointment":
            case "agendar_cita":
                return await handleBookAppointment(supabase, tenantId, leadId, args);
            
            case "get_lead_info":
            case "consultar_datos":
                return await handleGetLeadInfo(supabase, leadId);
            
            default:
                console.warn(`[RETELL TOOLS] Unknown tool called: ${toolName}`);
                return NextResponse.json({ error: "Tool implementation not found" }, { status: 404 });
        }

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error("[RETELL TOOLS CRITICAL ERROR]:", errorMessage);
        return NextResponse.json({ 
            error: "Internal Server Error", 
            details: errorMessage 
        }, { status: 500 });
    }
}

/**
 * Tool: book_appointment
 * Creates a new appointment in the system database.
 */
async function handleBookAppointment(supabase: SupabaseClient<Database>, tenantId: string, leadId: string, args: Record<string, unknown>) {
    const date = args.date as string;
    const time = args.time as string | undefined;
    const notes = args.notes as string | undefined;
    
    // 1. Format date (ISO 8601)
    let scheduledAt = date;
    if (time) {
        scheduledAt = `${date}T${time}:00Z`;
    }

    // 2. Assign an advisor (Pick the first active one for the tenant)
    const { data: advisorData } = await (supabase as any)
        .from("advisors")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .limit(1)
        .single();
    
    const advisor = advisorData as any;

    if (!advisor) {
        throw new Error("No available advisors to assign the appointment.");
    }

    // 3. Insert record
    const { data: appointmentData, error } = await (supabase as any)
        .from("appointments")
        .insert({
            tenant_id: tenantId,
            lead_id: leadId,
            advisor_id: advisor.id,
            scheduled_at: scheduledAt,
            status: "SCHEDULED",
            notes: notes || "Agendado automáticamente por el Agente de Voz (Retell AI)",
            watchdog_processed: false
        })
        .select()
        .single();
    
    const data = appointmentData as any;

    if (error) {
        console.error("DB Error booking appointment:", error);
        throw error;
    }

    console.log(`[RETELL TOOLS] Appointment booked for lead ${leadId} at ${scheduledAt}`);

    return NextResponse.json({ 
        success: true, 
        message: "Cita agendada correctamente",
        appointment_id: data?.id 
    });
}

/**
 * Tool: get_lead_info
 * Returns relevant CRM data to the agent so it can personalize the conversation.
 */
async function handleGetLeadInfo(supabase: SupabaseClient<Database>, leadId: string) {
    const { data, error } = await supabase
        .from("lead")
        .select(`
            nombre, 
            apellido, 
            email, 
            pais,
            lead_programas (
                id_programa,
                programas ( nombre )
            )
        `)
        .eq("id", leadId)
        .single();

    if (error) {
        console.error("DB Error fetching lead info:", error);
        throw error;
    }

    const leadData = data as unknown as { 
        nombre: string; 
        apellido: string | null; 
        email: string | null; 
        pais: string | null; 
        lead_programas?: { programas?: { nombre: string } | null }[] | null 
    };
    
    const programName = leadData.lead_programas?.[0]?.programas?.nombre || "Sin programa definido";

    return NextResponse.json({
        lead_name: leadData.nombre,
        full_name: `${leadData.nombre} ${leadData.apellido || ""}`.trim(),
        email: leadData.email,
        country: leadData.pais,
        program_of_interest: programName,
        status: "INTERESADO_ALTA_PRIORIDAD"
    });
}

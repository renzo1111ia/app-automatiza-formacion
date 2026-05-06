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
    
    // 1. Get Lead context (Course of interest)
    const { data: lead } = await supabase
        .from("lead")
        .select(`
            *,
            lead_programas (
                id_programa,
                programas ( nombre )
            )
        `)
        .eq("id", leadId)
        .single();
    
    const leadData = lead as unknown as { 
        id: string; 
        tipo_lead: string | null; 
        lead_programas: { 
            id_programa: string; 
            programas: { nombre: string } | null 
        }[] | null 
    };
    const programId = leadData?.lead_programas?.[0]?.id_programa;
    const programName = leadData?.lead_programas?.[0]?.programas?.nombre;

    // 2. Format date (ISO 8601)
    let scheduledAt = date;
    if (time) {
        // Handle HH:MM or HH:MM:SS
        const timeStr = time.includes(':') ? (time.split(':').length === 2 ? `${time}:00` : time) : `${time}:00:00`;
        scheduledAt = `${date}T${timeStr}Z`;
    }

    // 3. Smart Advisor Assignment
    // Try to find an advisor that specializes in this program
    type AdvisorRow = Database['public']['Tables']['advisors']['Row'];
    const { data: allAdvisors } = await supabase
        .from("advisors")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("is_active", true) as { data: AdvisorRow[] | null };
    
    let selectedAdvisor: AdvisorRow | null = null;
    if (allAdvisors && allAdvisors.length > 0) {
        // Priority 1: Specialist for this program
        selectedAdvisor = allAdvisors.find((a) => a.specialties?.includes(programId || "") || a.specialties?.includes(programName || "")) || null;
        
        // Priority 2: Matches lead type (e.g. "nuevo")
        if (!selectedAdvisor) {
            selectedAdvisor = allAdvisors.find((a) => a.handled_lead_types?.includes(leadData?.tipo_lead || "")) || null;
        }

        // Priority 3: First available
        if (!selectedAdvisor) {
            selectedAdvisor = allAdvisors[0] || null;
        }
    }

    // 4. Check for overlaps (informational for now)
    let overlaps = 0;
    if (selectedAdvisor) {
        const { count } = await supabase
            .from("appointments")
            .select("*", { count: 'exact', head: true })
            .eq("advisor_id", selectedAdvisor.id)
            .eq("scheduled_at", scheduledAt)
            .neq("status", "CANCELLED");
        overlaps = count || 0;
    }

    // 5. Insert record (REFACTORED to use AppointmentService)
    const { AppointmentService } = await import("@/lib/services/appointment-service");
    
    let appointmentData;
    try {
        appointmentData = await AppointmentService.bookAppointment(tenantId, leadId, date, time, notes);
    } catch (e) {
        const error = e as Error;
        console.error("DB Error booking appointment:", error.message);
        throw error;
    }

    // 6. Enqueue Appointment Reminder
    try {
        const { getOrchestratorConfigForTenant } = await import("@/lib/actions/orchestrator-config");
        const { enqueueLeadStep } = await import("@/lib/core/queue/lead-sequence-queue");
        
        const config = await getOrchestratorConfigForTenant(tenantId);
        const reminderLeadTimeHours = config.scheduling?.reminder_hours || 24;
        
        const appointmentTime = new Date(appointmentData.scheduled_at).getTime();
        const reminderTime = appointmentTime - (reminderLeadTimeHours * 60 * 60 * 1000);
        const now = Date.now();
        const delayMs = Math.max(0, reminderTime - now);

        if (delayMs > 0 || Math.abs(reminderTime - now) < 1000 * 60 * 5) {
            await enqueueLeadStep({
                leadId,
                tenantId,
                action: "APPOINTMENT_REMINDER",
                appointmentId: appointmentData.id,
                template: config.scheduling?.reminder_template || "appointment_reminder_es"
            }, delayMs);
        }
    } catch (reminderErr) {
        console.error("Failed to queue reminder:", reminderErr);
    }

    return NextResponse.json({ 
        success: true, 
        message: "Cita agendada correctamente",
        appointment_id: appointmentData.id,
        advisor_name: selectedAdvisor?.name || "Sin asignar",
        is_overlap: (overlaps || 0) > 0
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

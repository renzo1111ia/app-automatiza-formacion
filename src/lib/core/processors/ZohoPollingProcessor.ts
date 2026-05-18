import { zohoClient } from "../../integrations/zoho";
import { getSupabaseServerClient } from "../../supabase/server";
import { orchestrator } from "../../core/orchestrator";
import { Tenant } from "@/types/tenant";

/**
 * ZOHO POLLING PROCESSOR v2.0
 * Periodically checks Zoho CRM for new leads.
 * Replicates n8n "Zoho Trigger" logic with phone normalization and master matching.
 */
export class ZohoPollingProcessor {
    async run() {
        console.log("[ZOHO_POLLER] Starting polling cycle...");
        const supabase = await getSupabaseServerClient();

        const { data: tenants } = await supabase.from("tenants").select("*");
        if (!tenants) return;

        for (const tenant of (tenants as Tenant[])) {
            try {
                const config = tenant.config as Record<string, unknown>;
                const zohoConfig = config.zoho as { enabled?: boolean; provider?: string } | undefined;
                
                if (!zohoConfig?.enabled) continue;

                console.log(`[ZOHO_POLLER] Polling for tenant: ${tenant.name}`);

                // 1. Criteria matching n8n logic: New Meta leads, excluding basura, and not tagged VirginIA
                const criteria = "(Lead_Status:equals:Nuevo) and (Lead_Source:equals:Meta) and (Tag:not_contains:VirginIA)";
                const externalLeads = await zohoClient.searchLeads(criteria);

                if (externalLeads.length === 0) continue;

                console.log(`[ZOHO_POLLER] Found ${externalLeads.length} leads. Filtering by Line of Business...`);

                for (const extLead of (externalLeads as any[])) {
                    try {
                        // Extra Filter: L_nea_de_Negocio (n8n logic)
                        const ldn = extLead.L_nea_de_Negocio;
                        if (ldn === "GenD" || ldn === "EAP") {
                            console.log(`[ZOHO_POLLER] Skipping lead ${extLead.id} due to Ldn: ${ldn}`);
                            continue;
                        }

                        // 2. Normalize Phone Number (The "Mexico Patch")
                        const rawPhone = extLead.Phone || "";
                        const normalizedPhone = this.normalizePhone(rawPhone);

                        // 3. Upsert into "lead" table
                        const { data: lead, error: upsertError } = await (supabase.from("lead") as any)
                            .upsert({
                                tenant_id: tenant.id,
                                id_lead_externo: extLead.id,
                                nombre: extLead.First_Name || "Lead",
                                apellido: extLead.Last_Name || "Zoho",
                                telefono: normalizedPhone,
                                email: extLead.Email || "",
                                pais: extLead.Country || "España",
                                origen: extLead.Lead_Source || "Zoho",
                                tipo_lead: "nuevo",
                                metadata: { 
                                    ldn: extLead.L_nea_de_Negocio,
                                    raw_phone: rawPhone
                                },
                                fecha_ingreso_crm: new Date().toISOString()
                            }, { onConflict: "tenant_id, id_lead_externo" })
                            .select()
                            .single();

                        if (upsertError || !lead) {
                            console.error(`[ZOHO_POLLER] Upsert failed:`, upsertError);
                            continue;
                        }

                        // 4. Master/Program Matching
                        const masterName = extLead.Productos; // n8n field for program
                        if (masterName) {
                            await this.matchAndLinkProgram(supabase, lead.id, masterName, tenant.id);
                        }

                        // 5. Trigger Orchestrator
                        await orchestrator.handleNewLead(lead.id, tenant.id);

                    } catch (innerErr) {
                        console.error(`[ZOHO_POLLER] Lead error ${extLead.id}:`, innerErr);
                    }
                }

            } catch (err) {
                console.error(`[ZOHO_POLLER] Tenant error ${tenant.id}:`, err);
            }
        }
    }

    private normalizePhone(phone: string): string {
        let s = phone.replace(/\s+/g, "");
        if (!s.startsWith("+")) s = `+${s}`;
        
        // Parche México: +521... -> +52...
        if (s.startsWith("+521") && s.length === 14) {
            s = "+52" + s.slice(4);
        }
        return s;
    }

    private async matchAndLinkProgram(supabase: any, leadId: string, masterName: string, tenantId: string) {
        const { data: program } = await supabase
            .from("programas")
            .select("id")
            .eq("tenant_id", tenantId)
            .ilike("nombre", `%${masterName}%`)
            .maybeSingle();

        if (program) {
            await supabase.from("lead_programas").upsert({
                id_lead: leadId,
                id_programa: program.id
            }, { onConflict: "id_lead, id_programa" });
            console.log(`[ZOHO_POLLER] Linked lead ${leadId} to program ${program.id} (${masterName})`);
        } else {
            console.warn(`[ZOHO_POLLER] Program not found for name: ${masterName}`);
        }
    }
}

export const zohoPollingProcessor = new ZohoPollingProcessor();

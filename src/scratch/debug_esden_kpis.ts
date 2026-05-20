import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantId = "47e84fa2-73f3-4e23-9267-1e49d4442f70";

interface LeadItem {
    id: string;
    pais?: string;
    origen?: string;
    campana?: string;
    tipo_lead?: string;
}

interface AnalyticsFilters {
    search?: string;
    pais?: string;
    origen?: string;
    campana?: string;
    tipoLead?: string;
    cualificacion?: string;
}

interface KpiPart {
    targetCol: string;
    calcType: string;
    condCol?: string;
    condOp?: string;
    condVal?: string;
}

function applyLeadFilters(
    query: ReturnType<typeof supabase.from>,
    filters: AnalyticsFilters
) {
    let q = query;
    if (filters.pais) q = q.eq("pais", filters.pais) as any;
    if (filters.origen) q = q.eq("origen", filters.origen) as any;
    if (filters.campana) q = q.eq("campana", filters.campana) as any;
    if (filters.tipoLead) q = q.eq("tipo_lead", filters.tipoLead) as any;
    return q;
}

async function getGenericPartData(part: KpiPart, from: string, to: string, filters: AnalyticsFilters): Promise<number> {
    const [table, col] = part.targetCol.split('.');
    
    const TIME_COL_MAP: Record<string, string> = {
        lead: 'fecha_ingreso_crm',
        llamadas: 'fecha_inicio',
        agendamientos: 'fecha_agendada_cliente',
        appointments: 'scheduled_at',
        lead_cualificacion: 'fecha_creacion',
        intentos_llamadas: 'fecha_reintento',
        conversaciones_whatsapp: 'fecha_ultimo_mensaje',
    };
    const timeCol = TIME_COL_MAP[table] || 'fecha_creacion';

    // 1. Fetch leads for filtering
    const lq = supabase.from("lead")
        .select("id, pais, origen, campana, tipo_lead")
        .eq("tenant_id", tenantId);
    const filteredLq = applyLeadFilters(lq, filters);
    const { data: leadsRaw, error: lErr } = await filteredLq;
    if (lErr) console.error("[GenericPart] Lead fetch error:", lErr.message);
    const leadsMap = new Map((leadsRaw || []).map((l: LeadItem) => [l.id, l]));

    // 2. Fetch fact rows
    const joinCol = table === 'lead' ? 'id' : (table === 'appointments' ? 'lead_id' : 'id_lead');
    let q = supabase.from(table)
        .select(`${col}, ${joinCol}`)
        .eq("tenant_id", tenantId)
        .gte(timeCol, from)
        .lte(timeCol, to);

    // Apply fact-table conditions
    if (part.condCol && part.condVal) {
        const LEAD_COLS = ['pais', 'origen', 'campana', 'tipo_lead'];
        if (!LEAD_COLS.includes(part.condCol)) {
            const cc = part.condCol;
            let val: any = part.condVal;
            if (val === 'true') val = true;
            if (val === 'false') val = false;
            if (part.condOp === 'ILIKE') q = q.ilike(cc, `%${part.condVal}%`) as any;
            else q = q.eq(cc, val) as any;
        }
    }

    const { data: rowsRaw, error } = await q;
    if (error) {
        console.error(`[getGenericPartData] Error for ${table}:`, error.message);
        return 0;
    }

    // 3. Manual join and count/group
    const rows = (rowsRaw || []) as Record<string, any>[];
    let filteredRows = table === 'lead'
        ? rows.filter(r => leadsMap.has(r.id))
        : rows.filter(r => leadsMap.has(r[joinCol])).map(r => ({ ...r, lead: leadsMap.get(r[joinCol]) }));

    // Apply lead-side conditions
    if (part.condCol && part.condVal) {
        const LEAD_COLS = ['pais', 'origen', 'campana', 'tipo_lead'];
        if (LEAD_COLS.includes(part.condCol)) {
            const cc = part.condCol;
            const cv = part.condVal;
            const co = part.condOp;
            filteredRows = filteredRows.filter(r => {
                const val = table === 'lead' ? r[cc] : r.lead?.[cc];
                return co === '!=' ? val != cv : val == cv;
            });
        }
    }

    if (part.calcType === 'count') return filteredRows.length;
    return 0;
}

async function run() {
    const from = "2026-04-19T00:00:00.000Z";
    const to = "2026-05-20T23:59:59.000Z";
    const filters: AnalyticsFilters = {};

    console.log("Simulating def-2 (Leads localizados)...");
    const valDef2 = await getGenericPartData({
        targetCol: "llamadas.id_lead",
        calcType: "count",
        condCol: "estado_llamada",
        condOp: "=",
        condVal: "CONTACTED"
    }, from, to, filters);

    console.log(`- Value returned for def-2: ${valDef2}`);
}

run().catch((err: Error) => {
    console.error("Simulation failed:", err.message);
});

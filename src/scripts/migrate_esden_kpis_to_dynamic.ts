import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const tenantId = '47e84fa2-73f3-4e23-9267-1e49d4442f70'; // esden tenant ID

  // 1. Get current tenant config
  const { data: tenant, error: fetchErr } = await supabase
    .from('tenants')
    .select('config')
    .eq('id', tenantId)
    .single();

  if (fetchErr || !tenant) {
    console.error('Error fetching tenant config:', fetchErr);
    return;
  }

  const config = tenant.config as any;
  if (!config || !config.kpis) {
    console.error('No KPIs configuration found.');
    return;
  }

  console.log('Original KPIs count:', config.kpis.length);

  // Define new dynamic KPI configurations mapping exactly to the real business logic
  const updatedKpis = config.kpis.map((kpi: any) => {
    // We keep static keys for complex AI metrics that cannot be simply calculated
    const staticOnlyIds = ['def-1', 'def-5', 'def-6', 'def-11', 'def-16'];

    if (staticOnlyIds.includes(kpi.id)) {
      console.log(`Keeping ${kpi.id} ("${kpi.label}") as static KPI.`);
      return kpi;
    }

    // Otherwise, configure database connection fields and REMOVE the staticKey
    const base = {
      ...kpi,
      staticKey: undefined, // Remove staticKey so that it is processed as a dynamic database KPI!
    };

    switch (kpi.id) {
      case 'def-2': // Leads localizados
        console.log(`Migrating ${kpi.id} ("${kpi.label}") to dynamic: count llamadas.id_lead where estado_llamada = CONTACTED`);
        return {
          ...base,
          targetCol: 'llamadas.id_lead',
          calcType: 'count',
          condCol: 'estado_llamada',
          condOp: '=',
          condVal: 'CONTACTED'
        };

      case 'def-4': // Tasa de contacto (%)
        console.log(`Migrating ${kpi.id} ("${kpi.label}") to dynamic: percentage of calls contacted`);
        return {
          ...base,
          targetCol: 'llamadas.id_lead',
          calcType: 'count',
          condCol: 'estado_llamada',
          condOp: '=',
          condVal: 'CONTACTED',
          isPercentage: true,
          denomTargetCol: 'llamadas.id_lead',
          denomCalcType: 'count'
        };

      case 'def-7': // Citas Agendadas
        console.log(`Migrating ${kpi.id} ("${kpi.label}") to dynamic: count appointments.id where status = CONFIRMED`);
        return {
          ...base,
          targetCol: 'appointments.id',
          calcType: 'count',
          condCol: 'status',
          condOp: '=',
          condVal: 'CONFIRMED'
        };

      case 'def-12': // Tasa de agenda (%)
        console.log(`Migrating ${kpi.id} ("${kpi.label}") to dynamic: confirmed appointments / total leads`);
        return {
          ...base,
          targetCol: 'appointments.id',
          calcType: 'count',
          condCol: 'status',
          condOp: '=',
          condVal: 'CONFIRMED',
          isPercentage: true,
          denomTargetCol: 'lead.id',
          denomCalcType: 'count'
        };

      case 'def-8': // Leads Cualificados
        console.log(`Migrating ${kpi.id} ("${kpi.label}") to dynamic: count lead_cualificacion.id where cualificacion != NO`);
        return {
          ...base,
          targetCol: 'lead_cualificacion.id',
          calcType: 'count',
          condCol: 'cualificacion',
          condOp: '!=',
          condVal: 'NO'
        };

      case 'def-13': // Tasa de conversión (%)
        console.log(`Migrating ${kpi.id} ("${kpi.label}") to dynamic: qualified leads / total leads`);
        return {
          ...base,
          targetCol: 'lead_cualificacion.id',
          calcType: 'count',
          condCol: 'cualificacion',
          condOp: '!=',
          condVal: 'NO',
          isPercentage: true,
          denomTargetCol: 'lead.id',
          denomCalcType: 'count'
        };

      case 'def-9': // No aptos
        console.log(`Migrating ${kpi.id} ("${kpi.label}") to dynamic: count lead_cualificacion.id where cualificacion = NO`);
        return {
          ...base,
          targetCol: 'lead_cualificacion.id',
          calcType: 'count',
          condCol: 'cualificacion',
          condOp: '=',
          condVal: 'NO'
        };

      case 'def-10': // Descartados
        console.log(`Migrating ${kpi.id} ("${kpi.label}") to dynamic: count lead.id where tipo_lead = descartado`);
        return {
          ...base,
          targetCol: 'lead.id',
          calcType: 'count',
          condCol: 'tipo_lead',
          condOp: '=',
          condVal: 'descartado'
        };

      case 'def-14': // % Ilocalizables (%)
        console.log(`Migrating ${kpi.id} ("${kpi.label}") to dynamic: count lead.id where tipo_lead = ilocalizable / total leads`);
        return {
          ...base,
          targetCol: 'lead.id',
          calcType: 'count',
          condCol: 'tipo_lead',
          condOp: '=',
          condVal: 'ilocalizable',
          isPercentage: true,
          denomTargetCol: 'lead.id',
          denomCalcType: 'count'
        };

      default:
        return kpi;
    }
  });

  config.kpis = updatedKpis;

  // Update in database
  const { data, error: updateErr } = await supabase
    .from('tenants')
    .update({ config })
    .eq('id', tenantId)
    .select();

  if (updateErr) {
    console.error('Error updating tenant config:', updateErr);
  } else {
    console.log('Successfully migrated Esden KPIs configuration to dynamic database connections!');
  }
}

main();

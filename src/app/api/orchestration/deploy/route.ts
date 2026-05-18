import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function POST(req: Request) {
    try {
        const { tenantId, workflowId, status } = await req.json();
        const supabase = await getSupabaseServerClient();

        if (!tenantId || !workflowId) {
            return NextResponse.json({ error: 'Missing tenantId or workflowId' }, { status: 400 });
        }

        // 1. Desactivar todos los flujos de este tenant (si es un despliegue primario)
        // O simplemente marcar este como el activo
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateError } = await (supabase as any)
            .from('workflows')
            .update({ is_active: status === 'ACTIVE', is_primary: status === 'ACTIVE', updated_at: new Date().toISOString() })
            .eq('id', workflowId)
            .eq('tenant_id', tenantId);

        if (updateError) throw updateError;

        // 2. Opcional: Notificar a Redis o al Worker si fuera necesario
        // Por ahora, con actualizar la DB es suficiente para que el orquestador lo lea

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error('Deploy error:', error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

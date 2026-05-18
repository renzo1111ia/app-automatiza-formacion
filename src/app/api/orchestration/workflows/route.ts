import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { z } from "zod";

const workflowSchema = z.object({
    tenantId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().optional(),
    isPrimary: z.boolean().optional()
});

/**
 * API: WORKFLOW MANAGEMENT
 * CRUD operations for the Professional Multi-Workflow system.
 */

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const tenantId = searchParams.get("tenantId");

        if (!tenantId) return NextResponse.json({ error: "Missing tenantId" }, { status: 400 });

        const supabase = await getAdminSupabaseClient();
        const { data, error } = await (supabase
            .from("workflows" as any) as any)
            .select("*")
            .eq("tenant_id", tenantId)
            .order("created_at", { ascending: false });

        if (error) throw error;
        return NextResponse.json(data);
    } catch (error: unknown) {
        const err = error as { message: string };
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const result = workflowSchema.safeParse(body);
        
        if (!result.success) {
            return NextResponse.json({ 
                error: "Invalid input", 
                details: result.error.format() 
            }, { status: 400 });
        }

        const { tenantId, name, description, isPrimary } = result.data;
        const supabase = await getAdminSupabaseClient();

        // If setting as primary, unset others first
        if (isPrimary) {
            const { error: clearError } = await (supabase
                .from("workflows" as any) as any)
                .update({ is_primary: false })
                .eq("tenant_id", tenantId);
            
            if (clearError) {
                console.error("[WORKFLOW_POST] Clear Primary Error:", clearError.message);
            }
        }

        // 1. Create the workflow record
        const { data: workflowData, error: workflowError } = await (supabase
            .from("workflows" as any) as any)
            .insert({
                tenant_id: tenantId,
                name: name,
                description: description,
                is_primary: isPrimary || false
            })
            .select()
            .single();

        if (workflowError) {
            return NextResponse.json({ error: workflowError.message }, { status: 500 });
        }

        // 2. Initialize a blank graph for this workflow
        const { error: graphError } = await (supabase
            .from("orchestration_graphs" as any) as any)
            .insert({
                tenant_id: tenantId,
                workflow_id: (workflowData as any).id,
                graph_data: { nodes: [], edges: [] }
            });

        if (graphError) {
            console.error("[WORKFLOW_POST] Graph Init Failed:", graphError.message);
        }

        return NextResponse.json(workflowData);
    } catch (error: unknown) {
        const err = error as { message: string };
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const tenantId = searchParams.get("tenantId");

        if (!id || !tenantId) {
            return NextResponse.json({ error: "Missing id or tenantId" }, { status: 400 });
        }

        const supabase = await getAdminSupabaseClient();
        
        const { error } = await (supabase
            .from("workflows" as any) as any)
            .delete()
            .eq("id", id)
            .eq("tenant_id", tenantId);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        const err = error as { message: string };
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

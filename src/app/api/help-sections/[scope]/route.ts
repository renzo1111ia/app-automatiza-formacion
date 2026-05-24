import { NextResponse } from "next/server";
import { getAdminSupabaseClient } from "@/lib/supabase/server";
import { getAdminStatus } from "@/lib/actions/auth";

const VALID_SCOPES = new Set(["admin", "clientes"]);

export async function GET(_request: Request, { params }: { params: Promise<{ scope: string }> }) {
  const { scope } = await params;
  if (!VALID_SCOPES.has(scope)) {
    return NextResponse.json({ error: "Invalid scope" }, { status: 400 });
  }

  if (scope === "admin") {
    const isAdmin = await getAdminStatus();
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const supabase = await getAdminSupabaseClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("help_sections" as any) as any)
    .select("*")
    .eq("scope", scope)
    .order("display_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ sections: data ?? [] });
}

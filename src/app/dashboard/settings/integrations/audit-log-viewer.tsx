"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { IntegrationRow } from "./types";

interface AuditRow {
  id: string;
  lead_id: string;
  field_name: string;
  old_value: string | null;
  new_value: string;
  write_policy: string;
  actor_id: string | null;
  created_at: string;
}

interface Props {
  integration: IntegrationRow;
}

export function AuditLogViewer({ integration }: Props) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [leadFilter, setLeadFilter] = useState("");

  useEffect(() => {
    if (!open) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leadFilter]);

  async function load() {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ limit: "50" });
      if (leadFilter.trim()) qs.set("lead_id", leadFilter.trim());
      const res = await fetch(`/api/integrations/${integration.id}/audit?${qs.toString()}`);
      const data = (await res.json()) as { rows?: AuditRow[] };
      setRows(data.rows ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300"
        aria-expanded={open}
      >
        <span>Audit log de escrituras</span>
        {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-200 px-3 py-2 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Input
              value={leadFilter}
              onChange={(e) => setLeadFilter(e.target.value)}
              placeholder="Filtrar por lead_id…"
              className="h-8 text-xs"
            />
            <Button size="sm" variant="outline" onClick={() => load()}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Refrescar"}
            </Button>
          </div>
          {rows.length === 0 && !loading && (
            <p className="text-xs text-slate-500">Sin registros de audit aún.</p>
          )}
          {rows.length > 0 && (
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-[11px]">
                <thead className="text-left text-slate-500">
                  <tr>
                    <th className="py-1 pr-2">Fecha</th>
                    <th className="py-1 pr-2">Lead</th>
                    <th className="py-1 pr-2">Campo</th>
                    <th className="py-1 pr-2">Antes</th>
                    <th className="py-1 pr-2">Después</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1 pr-2 font-mono text-slate-500">
                        {new Date(r.created_at).toLocaleString("es-ES", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-1 pr-2 font-mono">{r.lead_id}</td>
                      <td className="py-1 pr-2 font-mono">{r.field_name}</td>
                      <td className="py-1 pr-2 text-slate-500">{r.old_value ?? "—"}</td>
                      <td className="py-1 pr-2">{r.new_value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

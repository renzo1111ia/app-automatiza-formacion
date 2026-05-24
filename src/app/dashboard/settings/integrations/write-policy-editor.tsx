"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import type { IntegrationRow } from "./types";

interface Props {
  integration: IntegrationRow;
  onSaved: () => void;
}

export function WritePolicyEditor({ integration, onSaved }: Props) {
  const [policy, setPolicy] = useState<"append_only" | "overwrite_with_audit">(
    (integration.write_policy as "append_only" | "overwrite_with_audit") ?? "append_only"
  );
  const [overrideFields, setOverrideFields] = useState<string>(
    (integration.override_fields ?? []).join("\n")
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const fields = overrideFields
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/integrations/manage/${integration.id}/write-policy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ write_policy: policy, override_fields: fields }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        toast({ variant: "success", title: "Política guardada" });
        onSaved();
      } else {
        toast({ variant: "error", title: `Error: ${data.error ?? "unknown"}` });
      }
    } catch (err) {
      toast({ variant: "error", title: `Falló: ${(err as Error).message}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
      <div>
        <Label htmlFor={`policy-${integration.id}`} className="text-xs font-bold">
          Política de escritura
        </Label>
        <select
          id={`policy-${integration.id}`}
          value={policy}
          onChange={(e) => setPolicy(e.target.value as typeof policy)}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="append_only">append_only — solo escribir campos vacíos</option>
          <option value="overwrite_with_audit">
            overwrite_with_audit — sobrescribir campos permitidos con audit
          </option>
        </select>
      </div>
      {policy === "overwrite_with_audit" && (
        <div>
          <Label htmlFor={`override-${integration.id}`} className="text-xs font-bold">
            Campos permitidos para sobrescribir (uno por línea)
          </Label>
          <textarea
            id={`override-${integration.id}`}
            value={overrideFields}
            onChange={(e) => setOverrideFields(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-1 font-mono text-xs dark:border-slate-700 dark:bg-slate-900"
            placeholder="telefono&#10;pais&#10;origen"
          />
        </div>
      )}
      <Button size="sm" onClick={handleSave} disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </Button>
    </div>
  );
}

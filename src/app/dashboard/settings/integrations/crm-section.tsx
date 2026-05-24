"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plug } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { CRMProviderCard } from "./crm-provider-card";
import { WritePolicyEditor } from "./write-policy-editor";
import { AuditLogViewer } from "./audit-log-viewer";
import type { IntegrationRow } from "./types";

const ERROR_MESSAGES: Record<string, string> = {
  csrf_mismatch: "Error CSRF: el state del OAuth no coincide. Reintenta la conexión.",
  oauth_failed: "El proveedor canceló o rechazó la conexión OAuth.",
  oauth_cancelled: "Conexión cancelada por el usuario.",
  unsupported_provider: "Proveedor no soportado.",
  persist_failed: "Error guardando credenciales en BD. Revisa logs.",
  server_misconfigured: "Falta configuración en el servidor (CLIENT_ID/SECRET).",
};

export function CRMSection() {
  const sp = useSearchParams();
  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations");
      const data = (await res.json()) as { rows?: IntegrationRow[] };
      setIntegrations(data.rows ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const success = sp.get("success");
    const error = sp.get("error");
    const provider = sp.get("provider");
    if (success)
      toast({ variant: "success", title: `${formatProvider(success)} conectado correctamente` });
    if (error) {
      toast({
        variant: "error",
        title: `${formatProvider(provider ?? "CRM")}: ${ERROR_MESSAGES[error] ?? error}`,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hubspot = integrations.find((i) => i.crm_type === "hubspot" && i.is_active) ?? null;
  const zoho = integrations.find((i) => i.crm_type === "zoho" && i.is_active) ?? null;
  const hubspotHistory = integrations.find((i) => i.crm_type === "hubspot") ?? null;
  const zohoHistory = integrations.find((i) => i.crm_type === "zoho") ?? null;
  const anyConnected = !!hubspot || !!zoho;

  return (
    <section className="mt-6 space-y-4" aria-labelledby="crm-section-heading">
      <div className="flex items-center gap-2">
        <Plug className="h-4 w-4 text-violet-600" />
        <h3
          id="crm-section-heading"
          className="text-sm font-black tracking-widest text-slate-900 uppercase dark:text-slate-100"
        >
          CRM
        </h3>
        <span className="text-[11px] text-slate-500">Solo puedes tener 1 CRM activo a la vez</span>
      </div>

      {!anyConnected && !loading && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-700 dark:bg-slate-950">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Sin CRM conectado
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Conecta HubSpot o Zoho para sincronizar leads, tasks y meetings.
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <CRMProviderCard
          provider="hubspot"
          integration={hubspotHistory}
          otherActive={!!zoho}
          onChanged={refresh}
        />
        <CRMProviderCard
          provider="zoho"
          integration={zohoHistory}
          otherActive={!!hubspot}
          onChanged={refresh}
        />
      </div>

      {hubspot && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            HubSpot — política de escritura + audit
          </h4>
          <WritePolicyEditor integration={hubspot} onSaved={refresh} />
          <AuditLogViewer integration={hubspot} />
        </div>
      )}
      {zoho && (
        <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
            Zoho — política de escritura + audit
          </h4>
          <WritePolicyEditor integration={zoho} onSaved={refresh} />
          <AuditLogViewer integration={zoho} />
        </div>
      )}
    </section>
  );
}

function formatProvider(p: string): string {
  if (p === "hubspot") return "HubSpot";
  if (p === "zoho") return "Zoho";
  return p;
}

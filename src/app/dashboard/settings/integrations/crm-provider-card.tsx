"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, Plug, PlugZap, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { IntegrationRow } from "./types";

interface Props {
  provider: "hubspot" | "zoho";
  integration: IntegrationRow | null;
  otherActive: boolean;
  onChanged: () => void;
}

const PROVIDER_META: Record<"hubspot" | "zoho", { label: string; color: string }> = {
  hubspot: { label: "HubSpot", color: "text-orange-600" },
  zoho: { label: "Zoho CRM", color: "text-red-600" },
};

export function CRMProviderCard({ provider, integration, otherActive, onChanged }: Props) {
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const isConnected = integration?.is_active === true;
  const isError = integration?.healthcheck_status === "error";
  const meta = PROVIDER_META[provider];

  const handleTest = async () => {
    if (!integration?.id) return;
    setTesting(true);
    try {
      const res = await fetch(`/api/integrations/manage/${integration.id}/healthcheck`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) toast({ variant: "success", title: `${meta.label} alcanzable` });
      else toast({ variant: "error", title: `${meta.label}: ${data.error ?? "error"}` });
      onChanged();
    } catch (err) {
      toast({ variant: "error", title: `Healthcheck falló: ${(err as Error).message}` });
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration?.id) return;
    if (!confirm(`¿Desconectar ${meta.label}? Las credenciales se eliminan localmente.`)) return;
    setDisconnecting(true);
    try {
      const res = await fetch(`/api/integrations/manage/${integration.id}/disconnect`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (data.ok) {
        toast({ variant: "success", title: `${meta.label} desconectado` });
        onChanged();
      } else {
        toast({ variant: "error", title: `Error: ${data.error ?? "unknown"}` });
      }
    } catch (err) {
      toast({ variant: "error", title: `Disconnect falló: ${(err as Error).message}` });
    } finally {
      setDisconnecting(false);
    }
  };

  const lastCheck =
    integration?.last_healthcheck_at &&
    new Date(integration.last_healthcheck_at).toLocaleString("es-ES", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Plug className={`h-4 w-4 ${meta.color}`} />
            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">{meta.label}</h4>
            {isConnected && !isError && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                <CheckCircle2 className="mr-1 h-3 w-3" /> Conectado
              </Badge>
            )}
            {isError && (
              <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
                <AlertTriangle className="mr-1 h-3 w-3" /> Error
              </Badge>
            )}
            {!isConnected && (
              <Badge variant="outline" className="text-slate-500">
                Sin conectar
              </Badge>
            )}
          </div>
          {integration?.portal_id && (
            <p className="text-xs text-slate-500">Portal ID: {integration.portal_id}</p>
          )}
          {(integration?.metadata as { api_domain?: string } | null)?.api_domain && (
            <p className="text-xs text-slate-500">
              API: {(integration?.metadata as { api_domain?: string }).api_domain}
            </p>
          )}
          {lastCheck && (
            <p className="text-[11px] text-slate-400">Último healthcheck: {lastCheck}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          {!isConnected && !otherActive && (
            <a href={`/api/integrations/${provider}/auth/start`}>
              <Button size="sm" variant="default">
                <PlugZap className="mr-1 h-3 w-3" /> Conectar
              </Button>
            </a>
          )}
          {!isConnected && otherActive && (
            <div
              className="cursor-not-allowed text-xs text-slate-500"
              title="Desconecta el otro CRM antes de conectar este"
            >
              Desconecta el otro CRM primero
            </div>
          )}
          {isConnected && (
            <>
              <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                <RefreshCw className={`mr-1 h-3 w-3 ${testing ? "animate-spin" : ""}`} />
                Test
              </Button>
              <a href={`/api/integrations/${provider}/auth/start`}>
                <Button size="sm" variant="outline">
                  Reconectar
                </Button>
              </a>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                Desconectar
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

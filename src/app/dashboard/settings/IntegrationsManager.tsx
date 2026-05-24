import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  MessageSquare,
  Key,
  Phone,
  Mic,
  PhoneCall,
  Zap,
  RefreshCw,
  CheckCircle2,
  Database,
  FileSpreadsheet,
} from "lucide-react";
import { syncRetellResources } from "@/lib/actions/retell-sync";
import { syncWhatsAppTemplates } from "@/lib/actions/whatsapp-sync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

interface TelephonyConfig {
  provider?: string;
  credentials?: {
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
  };
}

interface WhatsAppTemplate {
  name: string;
  language: string;
  status: string;
}

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  wabaId: string;
  verifyToken: string;
  templates?: WhatsAppTemplate[];
  lastSync?: string;
}

interface IntegrationsManagerProps {
  tenantId?: string;
  config: Record<string, unknown>;
  onChange: (newConfig: Record<string, unknown>) => void;
}

export function IntegrationsManager({ tenantId, config, onChange }: IntegrationsManagerProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSyncingWA, setIsSyncingWA] = useState(false);

  // ── WhatsApp Config ──
  const whatsapp = (config?.whatsapp as WhatsAppConfig) || {
    accessToken: "",
    phoneNumberId: "",
    wabaId: "",
    verifyToken: "",
  };

  // ── Retell AI Config ──
  const retell = (config?.retell as { api_key?: string }) || {};
  const retellApiKey = retell.api_key || "";

  // ── Ultravox AI Config ──
  const ultravox = (config?.ultravox as { api_key?: string }) || {};
  const ultravoxApiKey = ultravox.api_key || "";

  // ── Telephony Config ──
  const telephony = (config?.telephony as TelephonyConfig) || {};

  const updateField = (category: string, fields: Record<string, unknown>) => {
    const categoryData = { ...((config[category] as Record<string, unknown>) || {}), ...fields };

    if (category === "retell") {
      delete categoryData.apiKey;
      delete categoryData.agentId;
    }

    if (category === "ultravox" && (categoryData as Record<string, unknown>).apiKey) {
      const data = categoryData as Record<string, unknown>;
      data.api_key = data.apiKey;
      delete data.apiKey;
    }

    onChange({
      ...config,
      [category]: categoryData,
    });
  };

  const handleSync = async (apiKey: string) => {
    if (!apiKey) {
      toast({
        variant: "warning",
        title: "API Key requerida",
        description: "Introduce una API Key antes de sincronizar.",
      });
      return;
    }
    setIsSyncing(true);
    try {
      const res = await syncRetellResources(apiKey);
      if (!res.success) {
        toast({
          variant: "error",
          title: "Error al sincronizar con Retell",
          description: res.error,
        });
      }
    } catch {
      toast({ variant: "error", title: "Fallo crítico en la conexión con Retell" });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleWASync = async () => {
    if (!tenantId) {
      toast({
        variant: "warning",
        title: "Guarda el cliente primero",
        description: "Debes guardar el cliente antes de sincronizar sus plantillas.",
      });
      return;
    }
    if (!whatsapp.accessToken || !whatsapp.wabaId) {
      toast({
        variant: "warning",
        title: "Datos requeridos",
        description: "Se requiere Access Token y WABA ID para sincronizar.",
      });
      return;
    }

    setIsSyncingWA(true);
    try {
      const res = await syncWhatsAppTemplates(tenantId, whatsapp);
      if (res.success && res.data) {
        updateField("whatsapp", {
          templates: res.data,
          lastSync: new Date().toISOString(),
        });
      } else {
        toast({ variant: "error", title: "Error al sincronizar con Meta", description: res.error });
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast({ variant: "error", title: "Error de conexión", description: error.message });
    } finally {
      setIsSyncingWA(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 space-y-12 duration-700">
      {/* ── SECTION: RETELL AI ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-600">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-900 uppercase dark:text-white">
                Retell AI Integration
              </h3>
              <p className="text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Motor de Voz Conversacional de Baja Latencia
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleSync(retellApiKey)}
            disabled={isSyncing || !retellApiKey}
            className="h-8 gap-2 rounded-lg border-blue-100 bg-blue-50 text-[10px] font-black tracking-widest text-blue-600 uppercase hover:bg-blue-100"
          >
            <RefreshCw className={cn("h-3 w-3", isSyncing && "animate-spin")} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Recursos"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-left text-[10px] font-black tracking-widest text-slate-500 uppercase">
              <Key className="h-3 w-3" /> API Key
            </Label>
            <Input
              value={retellApiKey}
              onChange={(e) => updateField("retell", { api_key: e.target.value })}
              type="password"
              placeholder="key_..."
              className="h-11 rounded-xl border-slate-200 bg-white font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
        </div>
      </div>

      {/* ── SECTION: ULTRAVOX AI ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-purple-500/20 bg-purple-500/10 text-purple-600">
              <Mic className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-900 uppercase dark:text-white">
                Ultravox AI Integration
              </h3>
              <p className="text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Web-native Realtime Voice Inference
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-left text-[10px] font-black tracking-widest text-slate-500 uppercase">
              <Key className="h-3 w-3" /> API Key
            </Label>
            <Input
              value={ultravoxApiKey}
              onChange={(e) => updateField("ultravox", { api_key: e.target.value })}
              type="password"
              placeholder="Ultravox API Secret"
              className="h-11 rounded-xl border-slate-200 bg-white font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
        </div>
      </div>

      {/* ── SECTION: TELEPHONY (Hidden for now as per user request) ── */}
      <div className="hidden space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-600">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-900 uppercase dark:text-white">
                Telephony Settings
              </h3>
              <p className="text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                External Voice Connectors (Outbound Streams)
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2 text-left">
            <Label className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Provider
            </Label>
            <select
              title="Telephony Provider"
              value={telephony.provider || "twilio"}
              onChange={(e) => updateField("telephony", { provider: e.target.value })}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold dark:border-slate-800 dark:bg-slate-950"
            >
              <option value="twilio">Twilio (Recomendado)</option>
              <option value="telnyx">Telnyx</option>
              <option value="plivo">Plivo</option>
              <option value="custom">Personalizado (Custom SIP / Trunk)</option>
            </select>
          </div>
          <div className="space-y-2 text-left">
            <Label className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
              {telephony.provider === "custom"
                ? "Custom API Endpoint / SIP URI"
                : "Account SID / API Key"}
            </Label>
            <Input
              value={telephony.credentials?.accountSid || ""}
              onChange={(e) =>
                updateField("telephony", {
                  credentials: { ...(telephony.credentials || {}), accountSid: e.target.value },
                })
              }
              placeholder={
                telephony.provider === "custom" ? "https://api.miproveedor.com..." : "AC..."
              }
              className="h-11 rounded-xl border-slate-200 bg-white font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2 text-left">
            <Label className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
              {telephony.provider === "custom"
                ? "Custom Secret / Bearer Token"
                : "Auth Token / API Secret"}
            </Label>
            <Input
              value={telephony.credentials?.authToken || ""}
              onChange={(e) =>
                updateField("telephony", {
                  credentials: { ...(telephony.credentials || {}), authToken: e.target.value },
                })
              }
              type="password"
              placeholder="••••••••"
              className="h-11 rounded-xl border-slate-200 bg-white font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2 text-left">
            <Label className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Default From Number
            </Label>
            <Input
              value={telephony.credentials?.fromNumber || ""}
              onChange={(e) =>
                updateField("telephony", {
                  credentials: { ...(telephony.credentials || {}), fromNumber: e.target.value },
                })
              }
              placeholder="+1..."
              className="h-11 rounded-xl border-slate-200 bg-white text-xs font-bold dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
        </div>
      </div>

      {/* ── SECTION: CRM WEBHOOKS ⭐ NUEVO ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-600/20 bg-orange-600/10 text-orange-600">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-900 uppercase dark:text-white">
                CRM Webhook (Ingesta Inmediata)
              </h3>
              <p className="text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Entrada instantánea de leads desde Zoho, HubSpot, etc.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-3 rounded-xl border border-dashed border-slate-200 bg-slate-950/5 p-4 dark:border-slate-800">
            <div>
              <p className="mb-1 text-[9px] font-black tracking-widest text-slate-400 uppercase">
                Endpoint URL (POST)
              </p>
              <code className="font-mono text-[10px] break-all text-orange-600 select-all dark:text-orange-400">
                https://app.automatizaformacion.com/api/webhooks/crm
              </code>
            </div>
            <div className="border-t border-slate-100 pt-2 dark:border-slate-800">
              <p className="mb-1 text-[9px] font-black tracking-widest text-slate-400 uppercase">
                Cabeceras Obligatorias
              </p>
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[8px] font-bold text-slate-500 uppercase">Key</span>
                  <code className="font-mono text-[10px] font-black">x-tenant-id</code>
                </div>
                <div className="flex flex-1 flex-col">
                  <span className="text-[8px] font-bold text-slate-500 uppercase">
                    Value (Tu ID de Cliente)
                  </span>
                  <code className="truncate font-mono text-[10px] text-emerald-600 dark:text-emerald-400">
                    {tenantId || "ID_DEL_CLIENTE"}
                  </code>
                </div>
              </div>
            </div>
            <div className="pt-2">
              <p className="text-[9px] leading-relaxed font-bold text-slate-400 uppercase">
                💡 Configura una &quot;Función&quot; o &quot;Webhook&quot; en Zoho que dispare un
                JSON con: <br />
                <span className="font-mono text-[8px] text-slate-900 italic dark:text-white">
                  {
                    '{ "nombre": "...", "telefono": "...", "email": "...", "id_lead_externo": "..." }'
                  }
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── SECTION: WHATSAPP ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-900 uppercase dark:text-white">
                Meta API (WhatsApp Cloud)
              </h3>
              <p className="text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Configuraciones de mensajería empresarial
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleWASync}
            disabled={isSyncingWA || !whatsapp.accessToken || !whatsapp.wabaId}
            className="h-8 gap-2 rounded-lg border-emerald-100 bg-emerald-50 text-[10px] font-black tracking-widest text-emerald-600 uppercase hover:bg-emerald-100"
          >
            <RefreshCw className={cn("h-3 w-3", isSyncingWA && "animate-spin")} />
            {isSyncingWA ? "Sincronizando..." : "Sincronizar Plantillas"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2 text-left md:col-span-2">
            <Label className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Access Token (Permanent)
            </Label>
            <Input
              value={whatsapp.accessToken}
              onChange={(e) => updateField("whatsapp", { accessToken: e.target.value })}
              type="password"
              placeholder="EAAB..."
              className="h-11 rounded-xl border-slate-200 bg-white font-mono text-xs dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2 text-left">
            <Label className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Phone Number ID
            </Label>
            <Input
              value={whatsapp.phoneNumberId}
              onChange={(e) => updateField("whatsapp", { phoneNumberId: e.target.value })}
              placeholder="1234..."
              className="h-11 rounded-xl border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2 text-left">
            <Label className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
              WABA ID
            </Label>
            <Input
              value={whatsapp.wabaId}
              onChange={(e) => updateField("whatsapp", { wabaId: e.target.value })}
              placeholder="WABA ID"
              className="h-11 rounded-xl border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2 text-left">
            <Label className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Verify Token (Para Webhook)
            </Label>
            <Input
              value={whatsapp.verifyToken}
              onChange={(e) => updateField("whatsapp", { verifyToken: e.target.value })}
              placeholder="automatiza_for_2025"
              className="h-11 rounded-xl border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-950/5 p-4 md:col-span-2 dark:border-slate-800">
            <p className="mb-2 text-[9px] font-black tracking-widest text-slate-400 uppercase">
              Webhook URL (Pega esto en Meta Dashboard)
            </p>
            <code className="font-mono text-[10px] break-all text-emerald-600 dark:text-emerald-400">
              https://app.automatizaformacion.com/api/webhooks/whatsapp
            </code>
          </div>
        </div>

        {whatsapp.templates && whatsapp.templates.length > 0 && (
          <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-500 uppercase">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Plantillas Sincronizadas (
                {whatsapp.templates.length})
              </h4>
              {whatsapp.lastSync && (
                <span className="text-[9px] font-medium text-slate-400">
                  Último sync: {new Date(whatsapp.lastSync).toLocaleString()}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {whatsapp.templates.slice(0, 6).map((tp, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-950"
                >
                  <span
                    className="max-w-[120px] truncate text-[10px] font-bold text-slate-700 dark:text-slate-300"
                    title={tp.name}
                  >
                    {tp.name}
                  </span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[8px] font-black tracking-tighter uppercase",
                      tp.status === "APPROVED"
                        ? "bg-emerald-50 text-emerald-600"
                        : "bg-orange-50 text-orange-600"
                    )}
                  >
                    {tp.language} | {tp.status?.slice(0, 3)}
                  </span>
                </div>
              ))}
              {whatsapp.templates.length > 6 && (
                <div className="flex items-center justify-center rounded-lg border border-dashed border-slate-200 p-2 text-[9px] font-bold text-slate-400">
                  + {whatsapp.templates.length - 6} más...
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── SECTION: GOOGLE SHEETS (NEW) ── */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-green-500/20 bg-green-500/10 text-green-600">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight text-slate-900 uppercase dark:text-white">
                Google Sheets / Drive
              </h3>
              <p className="text-left text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Exportación automática de leads a Excel en la nube
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (!tenantId) {
                toast({
                  variant: "warning",
                  title: "Guarda el cliente primero",
                  description: "Debes guardar el cliente antes de conectar con Google.",
                });
                return;
              }
              window.location.href = `/api/integrations/google/auth?tenantId=${tenantId}`;
            }}
            className="h-8 gap-2 rounded-lg border-slate-200 bg-white text-[10px] font-black tracking-widest text-slate-600 uppercase hover:bg-slate-50"
          >
            <RefreshCw className="h-3 w-3" />
            {(config?.google as { connected?: boolean })?.connected
              ? "Reconectar Google"
              : "Conectar Google"}
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="space-y-2 text-left">
            <Label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Spreadsheet ID
            </Label>
            <Input
              value={(config?.google as { spreadsheetId?: string })?.spreadsheetId || ""}
              onChange={(e) => updateField("google", { spreadsheetId: e.target.value })}
              placeholder="ID de la hoja de cálculo (de la URL)"
              className="h-11 rounded-xl border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-950"
            />
            <p className="text-[9px] font-medium text-slate-400">
              Ejemplo: 1abc123... (se encuentra en la URL del documento)
            </p>
          </div>
          <div className="space-y-2 text-left">
            <Label className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
              Nombre de la Pestaña
            </Label>
            <Input
              value={(config?.google as { sheetName?: string })?.sheetName || "Leads"}
              onChange={(e) => updateField("google", { sheetName: e.target.value })}
              placeholder="Hoja1"
              className="h-11 rounded-xl border-slate-200 bg-white text-sm dark:border-slate-800 dark:bg-slate-950"
            />
          </div>
        </div>

        {(config?.google as { connected?: boolean })?.connected && (
          <div className="flex items-center gap-3 rounded-xl border border-green-100 bg-green-50 p-3 dark:border-green-900/30 dark:bg-green-950/20">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <span className="text-[10px] font-bold tracking-tight text-green-700 uppercase dark:text-green-400">
              Cuenta de Google vinculada correctamente
            </span>
          </div>
        )}
      </div>

      <div className="flex items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 text-left dark:border-blue-900/30 dark:bg-blue-900/10">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-500/20">
          <Zap className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <h4 className="text-[10px] font-black tracking-widest text-blue-600 uppercase dark:text-blue-400">
            Orquestación Multi-Agente
          </h4>
          <p className="text-[11px] leading-relaxed font-medium text-blue-700/70 dark:text-blue-300/60">
            Estas credenciales permiten al orquestador central disparar llamadas y mensajes
            automáticos bajo la identidad de este cliente.
          </p>
        </div>
      </div>
    </div>
  );
}

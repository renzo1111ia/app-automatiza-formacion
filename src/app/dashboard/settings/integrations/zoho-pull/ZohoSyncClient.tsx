"use client";

// Sprint 5 - Client Component principal: configuración Zoho CRM entrada leads.
//
// Gestiona activación event-driven (Notifications API + guía Workflow Webhook),
// mapeo de campos, toggles is_active/writeback, sync manual y estado de la
// última sincronización. Patrón de SheetsWizardClient.tsx.

import { useState, useTransition, useEffect } from "react";
import {
  AlertCircle,
  Bell,
  BellOff,
  ChevronDown,
  ChevronUp,
  Copy,
  Plug,
  RefreshCw,
  Loader2,
  Save,
  Unplug,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import {
  subscribeZohoNotificationsAction,
  unsubscribeZohoNotificationsAction,
  toggleZohoSyncActiveAction,
  toggleZohoWritebackAction,
  triggerManualZohoPullAction,
  saveZohoSyncConfigAction,
  suggestZohoFieldMappingAction,
  disconnectZohoAction,
  setManualWebhookModeAction,
} from "@/lib/integrations/zoho-pull/actions";
import type { ZohoSyncConnection } from "@/lib/integrations/zoho-pull/types";
import { ZohoFieldMappingEditor } from "./ZohoFieldMappingEditor";
import type { ZohoFieldMapping } from "@/lib/integrations/zoho-pull/types";

// ─── Tipos de status que devuelve getZohoSyncStatusAction ────────────────────

type ZohoStatus =
  | { ok: true; zohoConnected: boolean; connection: ZohoSyncConnection | null; webhookUrl: string }
  | { ok: false; error: string }
  | null;

interface Props {
  initialStatus: ZohoStatus;
  /** Mensaje de error del callback OAuth (?error=...). */
  oauthError?: string | null;
  /** Flag de éxito del callback OAuth (?success=1). */
  oauthSuccess?: boolean;
}

export function ZohoSyncClient({ initialStatus, oauthError = null, oauthSuccess = false }: Props) {
  const conn =
    (initialStatus?.ok && initialStatus.zohoConnected && initialStatus.connection) || null;

  // Banner de feedback del OAuth (éxito/error) — mismo patrón que Google Sheets.
  const banner = (
    <>
      {oauthError && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="text-destructive size-5 shrink-0" />
            <div>
              <p className="text-destructive font-medium">Error al conectar Zoho</p>
              <p className="text-muted-foreground text-sm">{decodeURIComponent(oauthError)}</p>
            </div>
          </CardContent>
        </Card>
      )}
      {oauthSuccess && (
        <Card className="border-green-500/40 bg-green-500/5">
          <CardContent className="flex items-center gap-3 pt-6">
            <CheckCircle2 className="size-5 shrink-0 text-green-500" />
            <p className="font-medium">
              Zoho CRM conectado correctamente. Ahora activa la recepción de leads.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );

  // Si no hay integración Zoho conectada, mostrar el paso de conexión OAuth
  // INTEGRADO en esta misma página (no se manda al usuario a otra pantalla),
  // igual que el wizard de Google Sheets.
  if (!initialStatus?.ok || !initialStatus.zohoConnected) {
    return (
      <div className="space-y-6">
        {banner}
        <ConnectOAuthCard />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {banner}
      <ZohoConfigPanel connection={conn} initialWebhookUrl={initialStatus.webhookUrl} />
    </div>
  );
}

// ─── Paso 1: Conectar Zoho OAuth (integrado, patrón Google Sheets) ────────────

// Data centers de Zoho. El usuario elige el suyo antes de conectar (.eu por
// defecto). Zoho re-enruta al DC real durante el login, pero arrancar en el DC
// correcto evita fricción y errores de client_id registrado en otro DC.
const ZOHO_DATA_CENTERS: { value: string; label: string }[] = [
  { value: "eu", label: "Europa (.eu)" },
  { value: "com", label: "EE. UU. (.com)" },
  { value: "in", label: "India (.in)" },
  { value: "au", label: "Australia (.com.au)" },
  { value: "jp", label: "Japón (.jp)" },
  { value: "ca", label: "Canadá (.zohocloud.ca)" },
  { value: "sa", label: "Arabia Saudí (.sa)" },
  { value: "uk", label: "Reino Unido (.uk)" },
  { value: "cn", label: "China (.com.cn)" },
];

function ConnectOAuthCard() {
  const [dc, setDc] = useState("eu");

  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="size-5 text-violet-600" />
          Conectar Zoho CRM
        </CardTitle>
        <CardDescription>
          Autoriza el acceso a tu cuenta Zoho para recibir leads en tiempo real. Te llevaremos a
          Zoho para iniciar sesión y aceptar los permisos; al volver, podrás activar la recepción y
          configurar el mapeo de campos aquí mismo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="zoho-dc">Servidor (data center)</Label>
            <select
              id="zoho-dc"
              value={dc}
              onChange={(e) => setDc(e.target.value)}
              className="border-input bg-background h-10 rounded-md border px-3 text-sm"
              aria-label="Data center de Zoho"
            >
              {ZOHO_DATA_CENTERS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <a href={`/api/integrations/zoho/auth/start?dc=${dc}`}>
            <Button className="w-full sm:w-auto">
              <Plug className="mr-2 size-4" />
              Conectar con Zoho
            </Button>
          </a>
        </div>
        <p className="text-muted-foreground text-xs">
          Elige el data center donde está tu cuenta Zoho (por defecto Europa). Se solicitan permisos
          de lectura/escritura de Leads y Contactos + notificaciones.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Panel principal (Zoho conectado) ────────────────────────────────────────

function ZohoConfigPanel({
  connection,
  initialWebhookUrl,
}: {
  connection: ZohoSyncConnection | null;
  initialWebhookUrl: string;
}) {
  const [fieldMapping, setFieldMapping] = useState<ZohoFieldMapping>(
    connection?.field_mapping ?? []
  );
  const [isActive, setIsActive] = useState(connection?.is_active ?? true);
  const [writeback, setWriteback] = useState(connection?.writeback_enabled ?? true);
  const [subscriptionExpiry, setSubscriptionExpiry] = useState<string | null>(
    connection?.subscription_expiry ?? null
  );
  const [manualGuideOpen, setManualGuideOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState(initialWebhookUrl);
  // Mapeo automático al cargar: si no hay mapeo guardado, lo sugerimos solo
  // (sin que el usuario tenga que pulsar "Sugerir mapeo").
  const [autoMapping, setAutoMapping] = useState(connection?.field_mapping?.length === 0);

  const [pending, startTransition] = useTransition();

  // Auto-sugerir el mapeo una vez al montar si está vacío (Zoho ya conectado).
  useEffect(() => {
    if (connection?.field_mapping?.length !== 0) return;
    let cancelled = false;
    (async () => {
      const res = await suggestZohoFieldMappingAction();
      if (cancelled) return;
      if (res.ok && res.fieldMapping.length > 0) {
        setFieldMapping(res.fieldMapping);
      }
      setAutoMapping(false);
    })();
    return () => {
      cancelled = true;
    };
    // Solo al montar — connection no cambia en vida del componente (hay reload tras mutaciones).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Modo activo (las dos vías son alternativas, no coexisten) ─────────────
  //   "auto"   → suscripción Notifications API activa (hay expiry).
  //   "manual" → vía Workflow Webhook elegida (method=workflow_webhook + token).
  //   "none"   → ninguna vía activa todavía.
  const isAutoActive = !!subscriptionExpiry;
  const isManualActive =
    !isAutoActive &&
    connection?.subscription_method === "workflow_webhook" &&
    !!connection?.subscription_token;
  const activeMode: "auto" | "manual" | "none" = isAutoActive
    ? "auto"
    : isManualActive
      ? "manual"
      : "none";

  // ── Suscripción automática ──────────────────────────────────────────────
  const handleSubscribe = () => {
    startTransition(async () => {
      const res = await subscribeZohoNotificationsAction();
      if (res.ok) {
        setSubscriptionExpiry(res.expiry);
        toast({
          variant: "success",
          description: "Suscripción activada. Zoho enviará leads en segundos.",
        });
        window.location.reload();
      } else {
        toast({ variant: "error", description: `Error: ${res.error}` });
      }
    });
  };

  const handleUnsubscribe = () => {
    startTransition(async () => {
      const res = await unsubscribeZohoNotificationsAction();
      if (res.ok) {
        setSubscriptionExpiry(null);
        toast({ variant: "success", description: "Suscripción desactivada." });
        window.location.reload();
      } else {
        toast({ variant: "error", description: `Error: ${res.error}` });
      }
    });
  };

  const handleCopyUrl = () => {
    void navigator.clipboard.writeText(webhookUrl);
    toast({ variant: "success", description: "URL copiada al portapapeles" });
  };

  // ── Elegir vía MANUAL (Workflow Webhook) ────────────────────────────────
  const handleSetManualMode = () => {
    startTransition(async () => {
      const res = await setManualWebhookModeAction();
      if (res.ok) {
        setWebhookUrl(res.webhookUrl);
        setManualGuideOpen(true);
        toast({
          variant: "success",
          description: "Vía manual activada. Configura la regla en Zoho con la URL de abajo.",
        });
        window.location.reload();
      } else {
        toast({ variant: "error", description: `Error: ${res.error}` });
      }
    });
  };

  // ── Toggles ────────────────────────────────────────────────────────────
  const handleToggleActive = () => {
    const next = !isActive;
    startTransition(async () => {
      const res = await toggleZohoSyncActiveAction(next);
      if (res.ok) {
        setIsActive(next);
        toast({
          variant: "success",
          description: next ? "Recepción activada" : "Recepción pausada",
        });
      } else {
        toast({ variant: "error", description: res.error });
      }
    });
  };

  const handleToggleWriteback = () => {
    const next = !writeback;
    startTransition(async () => {
      const res = await toggleZohoWritebackAction(next);
      if (res.ok) {
        setWriteback(next);
        toast({
          variant: "success",
          description: next ? "Write-back activado" : "Write-back desactivado",
        });
      } else {
        toast({ variant: "error", description: res.error });
      }
    });
  };

  // ── Sync manual ────────────────────────────────────────────────────────
  const handleManualSync = () => {
    startTransition(async () => {
      const res = await triggerManualZohoPullAction();
      if (res.ok) {
        toast({
          variant: "success",
          description: `Sincronización manual encolada (job: ${res.jobId.slice(0, 8)}…)`,
        });
      } else {
        toast({ variant: "error", description: res.error });
      }
    });
  };

  // ── Guardar mapeo ──────────────────────────────────────────────────────
  const handleSaveMapping = () => {
    startTransition(async () => {
      const res = await saveZohoSyncConfigAction({ field_mapping: fieldMapping });
      if (res.ok) {
        toast({ variant: "success", description: "Mapeo guardado correctamente." });
      } else {
        toast({ variant: "error", description: res.error });
      }
    });
  };

  // ── Sugerir mapeo ──────────────────────────────────────────────────────
  const handleSuggestMapping = () => {
    startTransition(async () => {
      const res = await suggestZohoFieldMappingAction();
      if (res.ok) {
        setFieldMapping(res.fieldMapping);
        if (res.warning) {
          toast({ variant: "info", description: res.warning });
        } else {
          toast({
            variant: "success",
            description: `Mapeo sugerido: ${res.fieldMapping.length} campos.`,
          });
        }
      } else {
        toast({ variant: "error", description: res.error });
      }
    });
  };

  // ── Desconectar Zoho (destructivo) ──────────────────────────────────────
  const handleDisconnect = () => {
    const ok = window.confirm(
      "¿Desconectar Zoho? Se cancelará la suscripción, se borrará la configuración de entrada de leads y se revocará el acceso OAuth. Tendrás que volver a conectar para recibir leads."
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await disconnectZohoAction();
      if (res.ok) {
        toast({ variant: "success", description: "Zoho desconectado correctamente." });
        window.location.reload();
      } else {
        toast({ variant: "error", description: `Error: ${res.error}` });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ── Banner de estado: qué vía está activa ── */}
      <div
        className={`flex items-center gap-3 rounded-lg border p-4 ${
          activeMode === "none"
            ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
            : "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
        }`}
      >
        {activeMode === "none" ? (
          <AlertCircle className="size-5 shrink-0 text-amber-500" />
        ) : (
          <CheckCircle2 className="size-5 shrink-0 text-green-600" />
        )}
        <div className="text-sm">
          {activeMode === "auto" && (
            <>
              <strong>Recepción activa — modo automático (Notifications API).</strong> Zoho envía
              los leads al instante. Se renueva solo el {formatDate(subscriptionExpiry!)}.
            </>
          )}
          {activeMode === "manual" && (
            <>
              <strong>Recepción activa — modo manual (Workflow Webhook).</strong> Los leads llegan
              mediante la regla que configuraste en tu panel Zoho.
            </>
          )}
          {activeMode === "none" && (
            <>
              <strong>Recepción no activada.</strong> Elige una de las dos vías de abajo para
              empezar a recibir leads de Zoho. Solo puede haber una activa a la vez.
            </>
          )}
        </div>
      </div>

      {/* ── Sección: Activación automática ── */}
      <Card className={activeMode === "auto" ? "border-green-400" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5 text-violet-600" />
            Activación automática (1 clic)
            {activeMode === "auto" && (
              <Badge variant="outline" className="border-green-500 text-green-600">
                Activa
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Usa la Notifications API de Zoho: cada create/edit de un Lead llega en segundos. La
            suscripción se renueva automáticamente cada 7 días.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeMode === "auto" ? (
            <div className="space-y-3">
              <span className="text-muted-foreground text-xs">
                Próxima renovación: {formatDate(subscriptionExpiry!)}
              </span>
              <div>
                <Button variant="outline" size="sm" onClick={handleUnsubscribe} disabled={pending}>
                  {pending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <BellOff className="mr-2 size-4" />
                  )}
                  Desactivar recepción automática
                </Button>
              </div>
            </div>
          ) : (
            <>
              {activeMode === "manual" && (
                <p className="text-muted-foreground text-xs">
                  Al activar la automática se desactivará la vía manual.
                </p>
              )}
              <Button onClick={handleSubscribe} disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Bell className="mr-2 size-4" />
                )}
                Activar recepción automática
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Sección: Activación manual (guía) ── */}
      <Card>
        <CardHeader>
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setManualGuideOpen((o) => !o)}
            aria-expanded={manualGuideOpen}
            aria-controls="manual-guide-content"
          >
            <CardTitle className="flex items-center gap-2 text-base">
              Activación manual (Workflow Webhook)
              {activeMode === "manual" && (
                <Badge variant="outline" className="border-green-500 text-green-600">
                  Activa
                </Badge>
              )}
            </CardTitle>
            {manualGuideOpen ? (
              <ChevronUp className="size-4 text-slate-500" />
            ) : (
              <ChevronDown className="size-4 text-slate-500" />
            )}
          </button>
          <CardDescription>
            Para tenants que prefieren configurar la regla directamente en el panel Zoho (no caduca,
            requiere acceso de admin a Zoho).
          </CardDescription>
        </CardHeader>
        {manualGuideOpen && (
          <CardContent id="manual-guide-content" className="space-y-4">
            {/* Botón para elegir/activar la vía manual */}
            {activeMode !== "manual" ? (
              <div className="space-y-2">
                {activeMode === "auto" && (
                  <p className="text-muted-foreground text-xs">
                    Al usar la vía manual se desactivará la recepción automática.
                  </p>
                )}
                <Button size="sm" onClick={handleSetManualMode} disabled={pending}>
                  {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  Usar esta vía (generar URL del webhook)
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={handleUnsubscribe} disabled={pending}>
                {pending ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <BellOff className="mr-2 size-4" />
                )}
                Desactivar recepción manual
              </Button>
            )}

            {webhookUrl && (
              <div className="space-y-2">
                <Label htmlFor="webhook-url-input">
                  URL del webhook (pégala en la regla de Zoho)
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    id="webhook-url-input"
                    readOnly
                    value={webhookUrl}
                    className="bg-muted text-muted-foreground flex-1 rounded border px-3 py-1.5 font-mono text-xs"
                    aria-label="URL del webhook para Zoho"
                  />
                  <Button size="sm" variant="ghost" onClick={handleCopyUrl} aria-label="Copiar URL">
                    <Copy className="size-4" />
                  </Button>
                </div>
              </div>
            )}
            <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
              <li>
                En Zoho CRM ve a <strong>Configuración → Automatización → Workflow</strong>.
              </li>
              <li>
                Crea una regla con módulo <strong>Leads</strong> y trigger{" "}
                <strong>Al crear / Al editar</strong>.
              </li>
              <li>
                En la acción elige <strong>Webhook</strong> y pega la URL de arriba (método POST).
              </li>
              <li>
                Añade el parámetro <strong>entity_id</strong> = <em>ID de Posible cliente</em>.
              </li>
              <li>Guarda y activa la regla. Los leads llegarán en segundos.</li>
            </ol>
            <a
              href="/docs/integrations/zoho-webhook-manual"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
            >
              <ExternalLink className="size-4" />
              Ver guía paso a paso (con capturas)
            </a>
          </CardContent>
        )}
      </Card>

      {/* ── Sección: Mapeo de campos ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mapeo de campos Zoho → AF</CardTitle>
          <CardDescription>
            El mapeo se detecta automáticamente de un lead de tu Zoho al conectar. Revísalo,
            ajústalo si quieres y pulsa <strong>Guardar mapeo</strong>. Si lo dejas vacío se usa el
            mapeo por defecto (First_Name, Email, Phone...).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {autoMapping ? (
            <div className="text-muted-foreground flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Detectando campos de tu Zoho automáticamente...
            </div>
          ) : (
            <ZohoFieldMappingEditor
              mapping={fieldMapping}
              onChange={setFieldMapping}
              disabled={pending}
            />
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSuggestMapping}
              disabled={pending || autoMapping}
            >
              {pending ? <Loader2 className="mr-1 size-3 animate-spin" /> : null}
              Volver a detectar
            </Button>
            <Button size="sm" onClick={handleSaveMapping} disabled={pending || autoMapping}>
              {pending ? (
                <Loader2 className="mr-1 size-3 animate-spin" />
              ) : (
                <Save className="mr-1 size-3" />
              )}
              Guardar mapeo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Sección: Controles + estado ── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Controles y estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggles */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <ToggleRow
              id="toggle-active"
              label="Recepción activa"
              description="Pausa o reactiva la entrada de leads"
              checked={isActive}
              onChange={handleToggleActive}
              disabled={pending}
            />
            <ToggleRow
              id="toggle-writeback"
              label="Write-back"
              description="Actualiza Zoho con cambios de estado desde AF"
              checked={writeback}
              onChange={handleToggleWriteback}
              disabled={pending}
            />
          </div>

          {/* Estado última sync */}
          {connection?.last_synced_at && (
            <p className="text-muted-foreground text-xs">
              Última recepción: {formatDate(connection.last_synced_at)}
            </p>
          )}
          {connection?.last_sync_error && (
            <div className="text-destructive bg-destructive/5 rounded p-2 text-xs">
              ⚠️ Último error: {connection.last_sync_error}
            </div>
          )}

          {/* Sync manual */}
          <Button variant="outline" size="sm" onClick={handleManualSync} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 size-4" />
            )}
            Sincronizar ahora
          </Button>
        </CardContent>
      </Card>

      {/* ── Sección: Zona de peligro (desconectar Zoho) ── */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive text-base">Desconectar Zoho</CardTitle>
          <CardDescription>
            Cancela la suscripción, borra la configuración de entrada de leads y revoca el acceso
            OAuth de Zoho. Esta acción no elimina los leads ya importados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Unplug className="mr-2 size-4" />
            )}
            Desconectar Zoho
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── ToggleRow ────────────────────────────────────────────────────────────────

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-1 items-start gap-3 rounded-lg border p-3">
      <input
        type="checkbox"
        id={id}
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="mt-0.5 size-4 cursor-pointer rounded"
      />
      <div>
        <Label htmlFor={id} className="cursor-pointer font-medium">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" });
}

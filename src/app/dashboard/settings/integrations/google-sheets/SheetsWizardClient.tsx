"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Pause,
  Play,
  RefreshCw,
  Settings as SettingsIcon,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import {
  saveAppCredentialsAction,
  disconnectSheetAction,
  toggleSheetActiveAction,
  triggerManualPullAction,
} from "@/lib/integrations/sheets/actions";
import type { SheetConnection } from "@/lib/integrations/sheets/types";
import { GooglePickerButton } from "./GooglePickerButton";
import { SheetMappingEditor } from "./SheetMappingEditor";

type Status = {
  hasCredentials: boolean;
  oauthConnected: boolean;
  email: string | null;
  sheetsCount: number;
};

interface Props {
  initialStatus: Status | null;
  initialSheets: SheetConnection[];
  oauthError: string | null;
  oauthSuccess: boolean;
}

export function SheetsWizardClient({
  initialStatus,
  initialSheets,
  oauthError,
  oauthSuccess,
}: Props) {
  const status = initialStatus ?? {
    hasCredentials: false,
    oauthConnected: false,
    email: null,
    sheetsCount: 0,
  };

  // Determinar paso activo del wizard
  const currentStep = !status.hasCredentials
    ? 1
    : !status.oauthConnected
      ? 2
      : initialSheets.length === 0
        ? 3
        : 4;

  return (
    <div className="space-y-6">
      {oauthError && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-3 pt-6">
            <AlertCircle className="text-destructive size-5 shrink-0" />
            <div>
              <p className="text-destructive font-medium">Error en OAuth</p>
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
              Cuenta Google conectada correctamente. Ahora selecciona las hojas a sincronizar.
            </p>
          </CardContent>
        </Card>
      )}

      <Step1Credentials completed={status.hasCredentials} active={currentStep === 1} />

      <Step2OAuth
        completed={status.oauthConnected}
        active={currentStep === 2}
        disabled={!status.hasCredentials}
        email={status.email}
      />

      <Step3ConnectSheets
        completed={initialSheets.length > 0}
        active={currentStep === 3 || currentStep === 4}
        disabled={!status.oauthConnected}
        sheets={initialSheets}
      />

      {initialSheets.length > 0 && <Step4ManageSheets sheets={initialSheets} />}
    </div>
  );
}

// ─── Step 1: Credenciales del tenant ──────────────────────────────────────

function Step1Credentials({ completed, active }: { completed: boolean; active: boolean }) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [pending, startTransition] = useTransition();

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveAppCredentialsAction({ clientId, clientSecret });
      if (res.ok) {
        toast({
          variant: "success",
          description: "Credenciales guardadas. Ahora puedes conectar tu cuenta Google.",
        });
        // refresh página
        window.location.reload();
      } else {
        toast({ variant: "error", description: `Error: ${res.error}` });
      }
    });
  };

  return (
    <Card className={active ? "border-primary" : completed ? "opacity-70" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StepBadge n={1} completed={completed} active={active} />
          Tu propia app de Google Cloud
        </CardTitle>
        <CardDescription>
          Sheets exige que cada tenant tenga su propia aplicación OAuth en Google Cloud (control de
          cuotas + privacidad). Una sola vez, ~5 minutos.{" "}
          <a
            href="/docs/integrations/google-sheets-setup-tenant"
            target="_blank"
            className="text-primary inline-flex items-center gap-1 hover:underline"
          >
            Ver guía paso a paso <ExternalLink className="size-3" />
          </a>
        </CardDescription>
      </CardHeader>
      {(active || completed) && (
        <CardContent className="space-y-4">
          {completed ? (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-green-500" />
              Credenciales guardadas (cifradas AES-256).
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="client-id">Client ID</Label>
                <Input
                  id="client-id"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="123456789-abcdef.apps.googleusercontent.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-secret">Client Secret</Label>
                <Input
                  id="client-secret"
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="GOCSPX-..."
                />
              </div>
              <Button
                onClick={handleSave}
                disabled={pending || !clientId || !clientSecret}
                className="w-full sm:w-auto"
              >
                {pending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                Guardar y seguir
              </Button>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Step 2: OAuth flow ───────────────────────────────────────────────────

function Step2OAuth({
  completed,
  active,
  disabled,
  email,
}: {
  completed: boolean;
  active: boolean;
  disabled: boolean;
  email: string | null;
}) {
  return (
    <Card className={active ? "border-primary" : completed ? "opacity-70" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StepBadge n={2} completed={completed} active={active} />
          Conectar tu cuenta Google
        </CardTitle>
        <CardDescription>
          Autoriza a la app a acceder solo a las hojas que tú elijas (scope <code>drive.file</code>{" "}
          — no podemos ver el resto de tu Drive).
        </CardDescription>
      </CardHeader>
      {(active || completed) && (
        <CardContent>
          {completed ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-green-500" />
              <div>
                <p className="font-medium">Conectado</p>
                {email && <p className="text-muted-foreground text-sm">como {email}</p>}
              </div>
            </div>
          ) : (
            <a href="/api/integrations/google/auth">
              <Button disabled={disabled} className="w-full sm:w-auto">
                Conectar con Google
              </Button>
            </a>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Step 3: Conectar Sheets (Picker) ─────────────────────────────────────

function Step3ConnectSheets({
  completed,
  active,
  disabled,
  sheets,
}: {
  completed: boolean;
  active: boolean;
  disabled: boolean;
  sheets: SheetConnection[];
}) {
  return (
    <Card className={active ? "border-primary" : completed ? "opacity-70" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <StepBadge n={3} completed={completed} active={active} />
          Selecciona hojas de cálculo
        </CardTitle>
        <CardDescription>
          Puedes conectar todas las hojas que necesites (entrada, exportación, reporting, etc). Cada
          una con su propio mapeo de columnas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sheets.length > 0 && (
          <div className="space-y-2">
            <p className="text-muted-foreground text-sm">Hojas conectadas:</p>
            <ul className="space-y-1">
              {sheets.map((s) => (
                <li key={s.id} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="size-4 text-green-500" />
                  <span>{s.spreadsheet_name ?? s.spreadsheet_id}</span>
                  <Badge variant="outline" className="text-xs">
                    {s.purpose}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}
        <GooglePickerButton disabled={disabled} />
      </CardContent>
    </Card>
  );
}

// ─── Step 4: Gestionar Sheets conectadas ──────────────────────────────────

function Step4ManageSheets({ sheets }: { sheets: SheetConnection[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar cada hoja</CardTitle>
        <CardDescription>
          Revisa el mapeo de columnas, el propósito y el write-back de cada hoja conectada.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sheets.map((s) => (
          <SheetCard key={s.id} sheet={s} />
        ))}
      </CardContent>
    </Card>
  );
}

function SheetCard({ sheet }: { sheet: SheetConnection }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      const res = await toggleSheetActiveAction(sheet.id, !sheet.is_active);
      if (res.ok) {
        toast({
          variant: "success",
          description: sheet.is_active ? "Hoja pausada" : "Hoja reactivada",
        });
        window.location.reload();
      } else {
        toast({ variant: "error", description: res.error });
      }
    });
  };

  const handlePull = () => {
    startTransition(async () => {
      const res = await triggerManualPullAction(sheet.id);
      if (res.ok) {
        toast({ variant: "success", description: "Sincronización manual lanzada" });
      } else {
        toast({ variant: "error", description: res.error });
      }
    });
  };

  const handleDelete = () => {
    if (!confirm(`¿Eliminar conexión a "${sheet.spreadsheet_name ?? sheet.spreadsheet_id}"?`))
      return;
    startTransition(async () => {
      const res = await disconnectSheetAction(sheet.id);
      if (res.ok) {
        toast({ variant: "success", description: "Conexión eliminada" });
        window.location.reload();
      } else {
        toast({ variant: "error", description: res.error });
      }
    });
  };

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{sheet.spreadsheet_name ?? sheet.spreadsheet_id}</h3>
            <Badge variant="outline" className="text-xs">
              {sheet.purpose}
            </Badge>
            {sheet.writeback_enabled && (
              <Badge variant="secondary" className="text-xs">
                ✏️ write-back
              </Badge>
            )}
            {!sheet.is_active && (
              <Badge variant="destructive" className="text-xs">
                pausada
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1 text-xs">
            Pestaña: {sheet.sheet_tab_name} · {sheet.column_mapping?.columns?.length ?? 0} columnas
            {sheet.last_synced_at && ` · sincronizada ${formatRelative(sheet.last_synced_at)}`}
          </p>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={handlePull}
            disabled={pending}
            title="Sincronizar ahora"
          >
            <RefreshCw className={`size-4 ${pending ? "animate-spin" : ""}`} />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggle}
            disabled={pending}
            title={sheet.is_active ? "Pausar" : "Reactivar"}
          >
            {sheet.is_active ? <Pause className="size-4" /> : <Play className="size-4" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpanded((e) => !e)}
            title="Editar mapeo"
          >
            <SettingsIcon className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDelete}
            disabled={pending}
            title="Eliminar"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {sheet.last_sync_error && (
        <div className="text-destructive bg-destructive/5 rounded p-2 text-xs">
          ⚠️ Último error: {sheet.last_sync_error}
        </div>
      )}

      {expanded && <SheetMappingEditor sheet={sheet} />}
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────

function StepBadge({ n, completed, active }: { n: number; completed: boolean; active: boolean }) {
  if (completed) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-green-500 text-sm font-bold text-white">
        <CheckCircle2 className="size-4" />
      </span>
    );
  }
  return (
    <span
      className={`inline-flex size-7 items-center justify-center rounded-full text-sm font-bold ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {n}
    </span>
  );
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "hace segundos";
  if (min < 60) return `hace ${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return d.toLocaleDateString("es-ES");
}

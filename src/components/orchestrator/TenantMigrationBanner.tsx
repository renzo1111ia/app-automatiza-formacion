import React, { useState, useEffect } from "react";
import {
  Database,
  Check,
  AlertCircle,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { setTenantToInternalDatabase, getActiveTenantConfig } from "@/lib/actions/tenant";

interface TenantMigrateResult {
  success: boolean;
  message?: string;
  error?: string;
  needsManualMigration?: boolean;
  sql?: string;
  tenant?: string;
  alreadyExists?: boolean;
}

export function TenantMigrationBanner() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error" | "manual" | "internal_success"
  >("idle");
  const [result, setResult] = useState<TenantMigrateResult | null>(null);
  const [showSQL, setShowSQL] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function checkStatus() {
      const tenant = await getActiveTenantConfig();
      if (tenant) {
        if (tenant.api_type === "internal") {
          setStatus("internal_success");
        }
      }
    }
    checkStatus();
  }, []);

  async function handleMigrate() {
    setStatus("loading");
    setResult(null);

    const res = await fetch("/api/tenant/migrate", { method: "POST" });
    const data: TenantMigrateResult = await res.json();
    setResult(data);

    if (data.needsManualMigration) {
      setStatus("manual");
    } else if (data.success) {
      setStatus("success");
    } else {
      setStatus("error");
    }
  }

  async function handleConnectInternal() {
    if (
      !confirm(
        "¿Estás seguro de que deseas vincular este cliente a la BASE INTERNA? No necesitará un Supabase externo."
      )
    )
      return;

    setStatus("loading");
    const tenant = await getActiveTenantConfig();
    if (!tenant) {
      setStatus("error");
      return;
    }

    const res = await setTenantToInternalDatabase(tenant.id);
    if (res.success) {
      setStatus("internal_success");
    } else {
      setStatus("error");
      setResult({ success: false, error: res.error });
    }
  }

  async function copySQL() {
    if (result?.sql) {
      await navigator.clipboard.writeText(result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // Hide banner if already successfully connected to internal
  if (status === "internal_success") {
    return (
      <div className="border-primary/20 bg-primary/5 animate-in fade-in flex items-center justify-between gap-4 rounded-3xl border p-6 duration-500">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 border-primary/20 flex h-10 w-10 items-center justify-center rounded-2xl border">
            <Home className="text-primary h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-black text-white/90">Conectado a Base Interna</p>
            <p className="mt-0.5 text-[10px] leading-none font-black tracking-widest text-white/40 uppercase">
              Este cliente usa la infraestructura central del sistema
            </p>
          </div>
        </div>
        <div className="text-primary bg-primary/10 border-primary/20 flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[10px] font-black tracking-widest uppercase">
          <Check className="h-3.5 w-3.5" />
          Activo
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "space-y-4 rounded-3xl border p-6 transition-all",
        status === "success"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : status === "manual"
            ? "border-amber-500/20 bg-amber-500/5"
            : status === "error"
              ? "border-red-500/20 bg-red-500/5"
              : "border-white/5 bg-white/[0.02]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border",
              status === "success"
                ? "border-emerald-500/20 bg-emerald-500/10"
                : status === "manual"
                  ? "border-amber-500/20 bg-amber-500/10"
                  : "border-white/10 bg-white/5"
            )}
          >
            <Database
              className={cn(
                "h-5 w-5",
                status === "success"
                  ? "text-emerald-400"
                  : status === "manual"
                    ? "text-amber-400"
                    : "text-white/40"
              )}
            />
          </div>
          <div>
            <p className="text-sm font-black">Inicializar Supabase del Cliente</p>
            <p className="mt-0.5 text-[10px] leading-none text-white/40">
              Crea las tablas del orquestador en la base de datos del cliente activo
            </p>
          </div>
        </div>

        {status === "idle" && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleConnectInternal}
              className="bg-primary/10 border-primary/20 hover:bg-primary/20 text-primary flex h-10 flex-shrink-0 items-center gap-2 rounded-xl border px-5 text-[10px] font-black tracking-widest uppercase transition-all"
            >
              <Home className="h-3.5 w-3.5" />
              Usar Base Interna
            </button>
            <div className="h-4 w-px bg-white/10" />
            <button
              onClick={handleMigrate}
              title="Inicializar tablas en el Supabase del cliente activo"
              className="flex h-10 flex-shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 text-[10px] font-black tracking-widest text-white/60 uppercase transition-all hover:bg-white/10"
            >
              <Database className="h-3.5 w-3.5" />
              Inicializar Externo
            </button>
          </div>
        )}

        {status === "loading" && (
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-white/40 uppercase">
            <Loader2 className="h-4 w-4 animate-spin" />
            Ejecutando...
          </div>
        )}

        {status === "success" && (
          <div className="flex items-center gap-2 text-[10px] font-black tracking-widest text-emerald-400 uppercase">
            <Check className="h-4 w-4" />
            Completado
          </div>
        )}
      </div>

      {/* Result messages */}
      {result && status === "success" && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs font-medium text-emerald-400">
          {result.alreadyExists
            ? "✅ Las tablas ya estaban configuradas en este cliente."
            : result.message}
        </div>
      )}

      {result && status === "error" && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-400">
          <AlertCircle className="mr-2 inline h-3.5 w-3.5" />
          {result.error}
        </div>
      )}

      {/* Manual Migration Mode */}
      {status === "manual" && result?.sql && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <div>
              <p className="font-bold">
                Acción requerida para: <span className="text-white">{result.tenant}</span>
              </p>
              <p className="mt-1 text-amber-400/70">
                Copia el SQL y ejecútalo en el Editor SQL del Supabase de este cliente.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowSQL(!showSQL)}
              title="Ver SQL de migración"
              className="flex items-center gap-2 text-[10px] font-black tracking-widest text-white/40 uppercase transition-all hover:text-white/60"
            >
              {showSQL ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
              {showSQL ? "Ocultar SQL" : "Ver SQL de Migración"}
            </button>
            <button
              onClick={copySQL}
              title="Copiar SQL"
              className={cn(
                "flex h-8 items-center gap-2 rounded-xl border px-4 text-[9px] font-black tracking-widest uppercase transition-all",
                copied
                  ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                  : "border-white/10 bg-white/5 text-white/40 hover:bg-white/10"
              )}
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" /> Copiar SQL
                </>
              )}
            </button>
          </div>

          {showSQL && (
            <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/5 bg-black/60 p-4">
              <pre className="font-mono text-[9px] leading-relaxed whitespace-pre-wrap text-white/50">
                {result.sql}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      {status === "idle" && (
        <p className="text-[9px] leading-relaxed text-white/20">
          Si el cliente no tiene su propia base de datos externa, usa la{" "}
          <strong className="text-primary/60">Base Interna</strong>. Si usas un Supabase
          independiente, el botón <strong className="text-white/40">Inicializar Externo</strong>{" "}
          creará las tablas necesarias (<code className="text-white/40">advisors</code>,{" "}
          <code className="text-white/40">appointments</code>, etc.) en su propio proyecto.
        </p>
      )}
    </div>
  );
}

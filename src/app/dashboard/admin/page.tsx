"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import {
  ShieldCheck,
  DollarSign,
  TrendingUp,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  ListChecks,
  Activity,
  ExternalLink,
  Building2,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getTenants, setTenantCookies } from "@/lib/actions/tenant";
import { useTenantStore } from "@/store/tenant";
import { Tenant } from "@/types/tenant";
import Link from "next/link";

/**
 * INTERNAL ADMIN PANEL (v2.0)
 * Financial control and team productivity for the Turnkey service.
 */

const FINANCIAL_DATA = [
  { name: "Ene", revenue: 4500, cost: 1200 },
  { name: "Feb", revenue: 5200, cost: 1450 },
  { name: "Mar", revenue: 6100, cost: 1800 },
];

export default function AdminPage() {
  const router = useRouter();
  const { tenantId: activeTenantId, setTenant } = useTenantStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    async function load() {
      setLoadingTenants(true);
      const data = await getTenants();
      setTenants(data);
      setLoadingTenants(false);
    }
    load();
  }, []);

  const handleSwitchTenant = async (t: Tenant) => {
    setTenant({
      tenantId: t.id,
      tenantName: t.name,
      config: t.config,
      isAdmin: !!t.is_admin,
    });
    await setTenantCookies(t.id, t.name);
    router.push("/dashboard");
    router.refresh();
  };
  return (
    <div className="animate-in fade-in flex flex-col gap-8 p-8 duration-700">
      {/* Header Area */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="space-y-1">
          <h1 className="flex items-center gap-3 text-left text-3xl font-extrabold tracking-tight">
            <div className="bg-primary/10 text-primary flex h-10 w-10 items-center justify-center rounded-xl">
              <ShieldCheck className="h-6 w-6" />
            </div>
            Panel de Control Turnkey
          </h1>
          <p className="text-muted-foreground text-left text-lg">
            Control financiero global y productividad del equipo.
          </p>
        </div>
      </div>

      {/* Financial Bento Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card space-y-4 rounded-3xl border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
              <DollarSign className="h-5 w-5" />
            </div>
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-500">
              <ArrowUpRight className="h-3 w-3" />
              +12%
            </span>
          </div>
          <div className="text-left">
            <p className="text-muted-foreground text-sm font-semibold">Ingresos Mensuales</p>
            <h2 className="text-2xl font-black">$15,800</h2>
          </div>
        </div>

        <div className="bg-card space-y-4 rounded-3xl border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
              <Activity className="h-5 w-5" />
            </div>
            <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-500">
              <ArrowDownRight className="h-3 w-3" />
              +4%
            </span>
          </div>
          <div className="text-left">
            <p className="text-muted-foreground text-sm font-semibold">Costos Operativos</p>
            <h2 className="text-2xl font-black">$4,250</h2>
          </div>
        </div>

        <div className="bg-card space-y-4 rounded-3xl border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="text-primary bg-primary/10 flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold">
              Margen: 73%
            </span>
          </div>
          <div className="text-left">
            <p className="text-muted-foreground text-sm font-semibold">Costo por Cita Agendada</p>
            <h2 className="text-2xl font-black">$2.14</h2>
          </div>
        </div>

        <div className="bg-card space-y-4 rounded-3xl border p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-500">
              <Users className="h-5 w-5" />
            </div>
            <span className="rounded-full bg-orange-500/10 px-2.5 py-0.5 text-[10px] font-black text-orange-600">
              {loadingTenants ? "..." : `${tenants.length} CLIENTES`}
            </span>
          </div>
          <div className="text-left">
            <p className="text-muted-foreground text-sm font-semibold">Tenants / Empresas</p>
            <h2 className="text-2xl font-black">{loadingTenants ? "..." : tenants.length}</h2>
          </div>
        </div>
      </div>

      {/* Clientes Registrados / Multi-Tenant Overview */}
      <div className="bg-card space-y-6 rounded-3xl border p-8 shadow-sm">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
              <Building2 className="text-primary h-5 w-5" />
              Clientes y Empresas Creadas
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Lista de todos los tenants registrados en el sistema con acceso rápido para
              administradores.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/settings"
              className="border-border bg-card/80 hover:bg-card text-foreground flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold shadow-sm transition-all"
            >
              <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
              Gestionar en Ajustes
            </Link>
          </div>
        </div>

        {loadingTenants ? (
          <div className="py-12 text-center text-sm text-slate-400">Cargando clientes...</div>
        ) : tenants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-700/60 p-8 text-center">
            <Building2 className="mx-auto h-8 w-8 text-slate-500" />
            <p className="mt-2 text-sm font-bold text-white">
              No se encontraron clientes o permisos insuficientes
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Verifica que tu usuario tenga el rol de administrador en Supabase Auth (
              <code className="text-indigo-400">app_metadata.is_admin: true</code>).
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tenants.map((t) => {
              const isCurrent = activeTenantId === t.id;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "flex flex-col justify-between rounded-2xl border p-5 transition-all",
                    isCurrent
                      ? "border-primary/50 bg-primary/5 shadow-primary/5 shadow-md"
                      : "border-border bg-card/60 hover:bg-card hover:border-slate-700"
                  )}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground flex items-center gap-2 text-base font-bold">
                        {t.name}
                        {t.is_admin && (
                          <span className="rounded-md border border-purple-500/30 bg-purple-500/20 px-1.5 py-0.5 text-[9px] font-black text-purple-400">
                            ADMIN
                          </span>
                        )}
                      </span>
                      {isCurrent && (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          ACTIVO
                        </span>
                      )}
                    </div>

                    <div className="text-muted-foreground space-y-1 text-xs">
                      {t.client_email && (
                        <p className="truncate">
                          <span className="text-slate-500">Email:</span> {t.client_email}
                        </p>
                      )}
                      {t.username && (
                        <p className="truncate">
                          <span className="text-slate-500">Usuario:</span> {t.username}
                        </p>
                      )}
                      <p className="truncate font-mono text-[10px] text-slate-500">ID: {t.id}</p>
                    </div>
                  </div>

                  <div className="border-border/60 mt-4 flex items-center justify-between border-t pt-3">
                    <span className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      Tipo: {t.api_type || "internal"}
                    </span>
                    <button
                      onClick={() => handleSwitchTenant(t)}
                      className={cn(
                        "flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold transition-all",
                        isCurrent
                          ? "bg-primary text-primary-foreground"
                          : "bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
                      )}
                    >
                      {isCurrent ? "Seleccionado" : "Entrar como"}
                      <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Charts & Notion-style Tasks */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Profitability Chart */}
        <div className="bg-card space-y-8 rounded-3xl border p-8 shadow-sm lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold tracking-tight italic">Rentabilidad del Servicio</h2>
            <div className="flex gap-4">
              <div className="flex items-center gap-2">
                <div className="bg-primary h-3 w-3 rounded-full" />
                <span className="text-xs font-bold">Ingresos</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="bg-muted-foreground/30 h-3 w-3 rounded-full" />
                <span className="text-xs font-bold">Costos (API)</span>
              </div>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={FINANCIAL_DATA}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fontWeight: 700 }}
                />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 700 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "12px",
                    border: "none",
                    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                  }}
                  cursor={{ fill: "#f1f5f9" }}
                />
                <Bar dataKey="revenue" fill="#0f172a" radius={[6, 6, 0, 0]} barSize={40} />
                <Bar dataKey="cost" fill="#94a3b8" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Team Productivity (Notion-style) */}
        <div className="flex flex-col gap-8 lg:col-span-4">
          <div className="bg-card flex-1 space-y-6 rounded-3xl border p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-bold">
                <ListChecks className="text-primary h-5 w-5" />
                Tareas Equipo
              </h2>
              <button
                title="Añadir tarea"
                className="hover:bg-muted flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {[
                { task: "Actualizar Prompts MBA", tenant: "ESDEN", status: "PENDIENTE" },
                { task: "Revisar Webhook Retell", tenant: "Salesforce", status: "HECHO" },
                { task: "Billing Mayo", tenant: "Global", status: "EN_CURSO" },
                { task: "Filtro Leads Pais", tenant: "ESDEN", status: "PENDIENTE" },
              ].map((item, i) => (
                <div
                  key={i}
                  className="group hover:bg-muted/50 hover:border-muted flex cursor-pointer items-start gap-4 rounded-xl border border-transparent p-3 text-left transition-all"
                >
                  <div
                    className={cn(
                      "mt-2 h-2 w-2 rounded-full",
                      item.status === "HECHO"
                        ? "bg-emerald-500"
                        : item.status === "EN_CURSO"
                          ? "bg-amber-500"
                          : "bg-muted-foreground/30"
                    )}
                  />
                  <div className="flex-1">
                    <p
                      className={cn(
                        "text-sm font-bold",
                        item.status === "HECHO" && "line-through opacity-40"
                      )}
                    >
                      {item.task}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-primary text-[10px] font-black tracking-tight uppercase">
                        {item.tenant}
                      </span>
                      <span className="text-muted-foreground text-[10px]">•</span>
                      <span className="text-muted-foreground text-[10px] font-semibold">
                        {item.status}
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="text-muted-foreground h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              ))}
            </div>
          </div>

          {/* Server Status (Real-time Feel) */}
          <div className="bg-primary text-primary-foreground shadow-primary/20 flex flex-col justify-between rounded-3xl p-6 text-left shadow-xl">
            <div className="flex items-center justify-between">
              <Zap className="h-6 w-6" />
              <span className="rounded-lg bg-white/20 px-2 py-1 text-[10px] font-black">
                CORE: OK
              </span>
            </div>
            <div className="mt-4">
              <p className="text-xs opacity-60">Infraestructura Elástica</p>
              <h3 className="text-lg leading-tight font-black tracking-tight">
                Clúster Distribuidor Operativo
              </h3>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Minimal Plus component for the team tasks
function Plus({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

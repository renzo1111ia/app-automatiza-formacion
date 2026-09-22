"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantStore } from "@/store/tenant";
import { setTenantCookies, getTenants, getActiveTenantConfig } from "@/lib/actions/tenant";
import { cn } from "@/lib/utils";
import { ChevronDown, Building2, Check, Plus } from "lucide-react";
import { Tenant } from "@/types/tenant";

export function TenantSelector({ collapsed, isAdmin }: { collapsed: boolean; isAdmin: boolean }) {
  const router = useRouter();
  const { tenantName, setTenant } = useTenantStore();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTenants() {
      if (!isAdmin) {
        // Tenant Admin: cargar únicamente su propio tenant
        if (!tenantName) {
          const myTenant = await getActiveTenantConfig();
          if (myTenant) {
            setTenant({
              tenantId: myTenant.id,
              tenantName: myTenant.name,
              config: myTenant.config,
              isAdmin: false,
              businessType: myTenant.business_type,
            });
          }
        }
        setLoading(false);
        return;
      }

      // Super Admin: cargar todos los tenants de clientes
      const data = await getTenants();
      const clientTenants = data.filter((t) => !t.is_admin);
      setTenants(clientTenants);
      setLoading(false);

      const cookieTenantId =
        typeof document !== "undefined"
          ? document.cookie
              .split("; ")
              .find((c) => c.startsWith("esden-tenant-id="))
              ?.split("=")[1]
          : undefined;

      if (!tenantName && cookieTenantId) {
        const active = clientTenants.find((t) => t.id === cookieTenantId);
        if (active) {
          setTenant({
            tenantId: active.id,
            tenantName: active.name,
            config: active.config,
            isAdmin: true,
            businessType: active.business_type,
          });
        }
      } else if (!tenantName && !cookieTenantId && clientTenants.length > 0) {
        const first = clientTenants[0];
        setTenant({
          tenantId: first.id,
          tenantName: first.name,
          config: first.config,
          isAdmin: true,
          businessType: first.business_type,
        });
        setTenantCookies(first.id, first.name).then(() => router.refresh());
      } else if (tenantName && !cookieTenantId) {
        const active = clientTenants.find((t) => t.name === tenantName);
        if (active) {
          setTenantCookies(active.id, active.name).then(() => router.refresh());
        }
      }
    }
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function handleSelect(t: Tenant) {
    if (!isAdmin) return;
    setTenant({
      tenantId: t.id,
      tenantName: t.name,
      config: t.config,
      isAdmin: true,
      businessType: t.business_type,
    });
    // Set a cookie with the tenant_id so server components can use it for RLS
    await setTenantCookies(t.id, t.name);
    setIsOpen(false);
    router.push("/dashboard");
    router.refresh();
  }

  if (collapsed) {
    return (
      <div className="border-border flex justify-center border-b px-2 py-4">
        <div className="bg-primary/10 text-primary flex h-8 w-8 items-center justify-center rounded-lg transition-colors">
          <Building2 className="h-4 w-4" />
        </div>
      </div>
    );
  }

  // Vista para Tenant Admin: solo muestra su negocio sin opción a desplegar otros clientes
  if (!isAdmin) {
    return (
      <div className="border-border relative border-b px-4 py-4">
        <label className="text-muted-foreground/40 mb-2 block text-[10px] font-bold tracking-widest uppercase">
          Tu Negocio
        </label>
        <div className="bg-card/50 border-border flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm">
          <Building2 className="text-primary h-4 w-4 flex-shrink-0" />
          <span className="text-foreground flex-1 truncate font-semibold">
            {tenantName || (loading ? "Cargando..." : "Mi Negocio")}
          </span>
          <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-emerald-500 uppercase">
            Activo
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-border relative border-b px-4 py-4">
      <label className="text-muted-foreground/40 mb-2 block text-[10px] font-bold tracking-widest uppercase">
        Cliente Activo
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-card border-border hover:bg-card/60 hover:border-primary/50 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition"
      >
        {(() => {
          const activeTenantObj = tenants.find((t) => t.name === tenantName);
          const logo = (activeTenantObj?.config as Record<string, unknown>)?.logo_url as
            | string
            | undefined;
          if (logo) {
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="" className="h-4 w-4 flex-shrink-0 rounded-sm object-contain" />
            );
          }
          return <Building2 className="text-primary h-4 w-4 flex-shrink-0" />;
        })()}
        <span className="text-foreground flex-1 truncate font-semibold">
          {tenantName || (loading ? "Cargando..." : "Seleccionar...")}
        </span>
        <ChevronDown
          className={cn(
            "text-muted-foreground/40 h-4 w-4 transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {isOpen && (
        <div className="border-border bg-popover absolute right-4 left-4 z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border p-1 shadow-lg shadow-black/20">
          <div className="py-1">
            {tenants.map((t) => {
              const logo = (t.config as Record<string, unknown>)?.logo_url as string | undefined;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t)}
                  className={cn(
                    "hover:bg-accent flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition",
                    tenantName === t.name
                      ? "text-primary bg-primary/10 font-bold"
                      : "text-popover-foreground font-medium"
                  )}
                >
                  {logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logo}
                      alt=""
                      className="h-4 w-4 flex-shrink-0 rounded-sm object-contain"
                    />
                  ) : (
                    <Building2 className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                  )}
                  <span className="flex-1 truncate">{t.name}</span>
                  {tenantName === t.name && <Check className="h-4 w-4" />}
                </button>
              );
            })}
          </div>
          {isAdmin && (
            <div className="border-border mt-1 border-t p-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  router.push("/dashboard/settings");
                }}
                className="text-primary hover:bg-primary/10 flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-black transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar nuevo cliente
              </button>
            </div>
          )}
          {tenants.length === 0 && !loading && (
            <div className="text-muted-foreground px-3 py-2 text-xs font-medium italic">
              No hay clientes configurados
            </div>
          )}
        </div>
      )}
    </div>
  );
}

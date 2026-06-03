"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTenantStore } from "@/store/tenant";
import { setTenantCookies, getTenants } from "@/lib/actions/tenant";
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
      const data = await getTenants();
      // Filter out admins from the selector, it's only for clients
      const clientTenants = data.filter((t) => !t.is_admin);
      setTenants(clientTenants);
      setLoading(false);

      // Auto-seleccionar el primer tenant SOLO en el primer arranque real:
      // cuando no hay ni store hidratado ni cookie `esden-tenant-id` previa.
      //
      // Bug previo (cross-tenant): este efecto corría antes de que zustand
      // rehidratara sessionStorage, veía `tenantName` vacío y auto-seleccionaba
      // el primer tenant, SOBRESCRIBIENDO la cookie `esden-tenant-id` que el
      // usuario había cambiado vía el selector. Como 13 módulos server leen esa
      // cookie (getActiveTenantId), toda la app multi-tenant revertía al primer
      // tenant en cada navegación con recarga. Leer la cookie aquí evita pisarla.
      const cookieTenantId =
        typeof document !== "undefined"
          ? document.cookie
              .split("; ")
              .find((c) => c.startsWith("esden-tenant-id="))
              ?.split("=")[1]
          : undefined;

      if (!tenantName && cookieTenantId) {
        // La cookie tiene un tenant activo pero el store (sessionStorage) aún
        // no ha hidratado → rehidratar el store desde la cookie, SIN tocar la
        // cookie. Mantiene selector + servidor coherentes tras recargar y
        // respeta la última selección del usuario (incl. admin cambiando de
        // tenant).
        const active = clientTenants.find((t) => t.id === cookieTenantId);
        if (active) {
          setTenant({
            tenantId: active.id,
            tenantName: active.name,
            config: active.config,
            isAdmin: !!active.is_admin,
          });
        }
      } else if (!tenantName && !cookieTenantId && clientTenants.length > 0) {
        // Primer arranque real (sin store ni cookie): auto-seleccionar el
        // primer tenant y persistir su cookie.
        const first = clientTenants[0];
        setTenant({
          tenantId: first.id,
          tenantName: first.name,
          config: first.config,
          isAdmin: !!first.is_admin,
        });
        setTenantCookies(first.id, first.name).then(() => router.refresh());
      }
    }
    loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSelect(t: Tenant) {
    setTenant({
      tenantId: t.id,
      tenantName: t.name,
      config: t.config,
      isAdmin: !!t.is_admin,
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

  return (
    <div className="border-border relative border-b px-4 py-4">
      <label className="text-muted-foreground/40 mb-2 block text-[10px] font-bold tracking-widest uppercase">
        Cliente Activo
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-card border-border hover:bg-card/60 hover:border-primary/50 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition"
      >
        <Building2 className="text-primary h-4 w-4 flex-shrink-0" />
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
            {tenants.map((t) => (
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
                <Building2 className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                <span className="flex-1 truncate">{t.name}</span>
                {tenantName === t.name && <Check className="h-4 w-4" />}
              </button>
            ))}
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

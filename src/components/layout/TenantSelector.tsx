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
            setTenants(data.filter(t => !t.is_admin));
            setLoading(false);
        }
        loadTenants();
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
            <div className="px-2 py-4 flex justify-center border-b border-border">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary transition-colors">
                    <Building2 className="h-4 w-4" />
                </div>
            </div>
        );
    }

    return (
        <div className="relative px-4 py-4 border-b border-border">
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2 block">
                Cliente Activo
            </label>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex w-full items-center gap-2 rounded-lg bg-card border border-border px-3 py-2 text-left text-sm transition hover:bg-card/60 hover:border-primary/50"
            >
                <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
                <span className="flex-1 truncate text-foreground font-semibold">
                    {tenantName || (loading ? "Cargando..." : "Seleccionar...")}
                </span>
                <ChevronDown className={cn("h-4 w-4 text-muted-foreground/40 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <div className="absolute left-4 right-4 z-50 mt-2 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-lg shadow-black/20">
                    <div className="py-1">
                        {tenants.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => handleSelect(t)}
                                className={cn(
                                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition hover:bg-accent",
                                    tenantName === t.name ? "text-primary font-bold bg-primary/10" : "text-popover-foreground font-medium"
                                )}
                            >
                                <Building2 className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                                <span className="flex-1 truncate">{t.name}</span>
                                {tenantName === t.name && <Check className="h-4 w-4" />}
                            </button>
                        ))}
                    </div>
                    {isAdmin && (
                        <div className="mt-1 border-t border-border p-1">
                            <button
                                onClick={() => {
                                    setIsOpen(false);
                                    router.push("/dashboard/settings");
                                }}
                                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-black text-primary transition hover:bg-primary/10"
                            >
                                <Plus className="h-3.5 w-3.5" />
                                Agregar nuevo cliente
                            </button>
                        </div>
                    )}
                    {tenants.length === 0 && !loading && (
                        <div className="px-3 py-2 text-xs text-muted-foreground italic font-medium">No hay clientes configurados</div>
                    )}
                </div>
            )}
        </div>
    );
}

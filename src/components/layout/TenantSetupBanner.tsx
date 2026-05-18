"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTenantStore } from "@/store/tenant";
import { Settings, AlertTriangle } from "lucide-react";

export function TenantSetupBanner() {
    const isConfigured = useTenantStore((s) => s.isConfigured);

    const pathname = usePathname() || "";
    const configHref = pathname.startsWith("/dashboardadmin") ? "/dashboardadmin/settings" : "/dashboard/settings";

    if (isConfigured) return null;

    return (
        <div className="flex items-start gap-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-5 py-4 mb-6">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-700">
                    Conexión de datos no configurada
                </p>
                <p className="mt-0.5 text-xs text-amber-900/70 leading-relaxed">
                    Para visualizar tus datos necesitás ingresar las credenciales de tu proyecto Supabase.
                    Hacé clic en &quot;Configurar ahora&quot; para completar la configuración.
                </p>
            </div>
            <Link
                href={configHref}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs font-bold text-amber-700 transition-all hover:bg-amber-500/20 hover:text-amber-800"
            >
                <Settings className="h-3.5 w-3.5" />
                Configurar ahora
            </Link>
        </div>
    );
}

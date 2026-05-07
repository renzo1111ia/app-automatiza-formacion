import { fetchCalls } from "@/lib/actions/calls";
import { HistorialTable } from "@/components/historial/HistorialTable";
import { parseFilters } from "@/lib/utils/date-filters";
import { getActiveTenantConfig } from "@/lib/actions/tenant";
import { getAdminStatus } from "@/lib/actions/auth";
import { Settings, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HistorialPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
    const params = await searchParams;
    const { from, to, filters } = parseFilters(params);
    const tenant = await getActiveTenantConfig();
    const columns = (tenant?.config as { historial_columns?: { key: string; label: string; }[] })?.historial_columns;
    const isAdmin = await getAdminStatus();

    const initialData = await fetchCalls({
        page: 1,
        pageSize: 50,
        fromDate: from,
        toDate: to,
        search: filters.search,
        pais: filters.pais,
        origen: filters.origen,
        campana: filters.campana,
        tipoLead: filters.tipoLead,
        cualificacion: filters.cualificacion,
    });

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-4 mb-6">
                <div className="bg-blue-500/10 p-3 rounded-[20px] border border-blue-500/20">
                    <ClipboardList className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                    <h1 className="text-[32px] font-bold text-foreground tracking-tight leading-tight">
                        Historial de <span className="text-blue-600 dark:text-blue-400">Llamadas</span>
                    </h1>
                    <p className="text-muted-foreground font-medium text-[15px]">
                        {initialData.count.toLocaleString()} registros · Paginación servidor
                    </p>
                </div>
            </div>

            <HistorialTable 
                initialData={initialData} 
                fromDate={from} 
                toDate={to} 
                columns={columns}
            />

            {isAdmin && (
                <div className="mt-12 pt-12 border-t border-border">
                    <AdminConfigSection />
                </div>
            )}
        </div>
    );
}

async function AdminConfigSection() {
    const tenant = await getActiveTenantConfig();
    if (!tenant) return null;

    // Fetch one lead to get available field keys
    const { fetchCalls } = await import("@/lib/actions/calls");
    const sample = await fetchCalls({ page: 1, pageSize: 1 });
    const sampleKeys = sample.data.length > 0 ? Object.keys(sample.data[0]) : [];

    const { HistorialColumnManager } = await import("@/components/dashboard/HistorialColumnManager");

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <div className="bg-amber-500/10 p-3 rounded-[20px] border border-amber-500/20">
                    <Settings className="h-8 w-8 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                    <h1 className="text-[32px] font-bold text-foreground tracking-tight leading-tight">
                        Configuración <span className="text-amber-600 dark:text-amber-400">Avanzada</span>
                    </h1>
                    <p className="text-muted-foreground font-medium text-[15px]">
                        Ajustes exclusivos para administradores del sistema
                    </p>
                </div>
            </div>

            <HistorialColumnManager tenant={tenant} sampleKeys={sampleKeys} />
        </div>
    );
}

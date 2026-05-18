"use client";

import { useState } from "react";
import { Plus, User, Phone, Globe, Megaphone } from "lucide-react";
import { CreateLeadDialog } from "@/components/historial/CreateLeadDialog";
import { formatDate } from "@/lib/utils";
import type { HistorialRow } from "@/types/database";
import { useRouter } from "next/navigation";

interface Props {
    data: HistorialRow[];
    total: number;
}

export function CampaignLeadsTable({ data, total }: Props) {
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const router = useRouter();

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Prospectos Recientes
                    </h2>
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-widest mt-1">
                        {total.toLocaleString()} leads totales encontrados
                    </p>
                </div>
                <button 
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-sm font-black transition-all shadow-xl shadow-blue-500/20 active:scale-95"
                >
                    <Plus className="h-4 w-4" /> Nuevo Lead
                </button>
            </div>

            <div className="bg-card border border-border rounded-[32px] overflow-hidden shadow-xl shadow-black/5">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead>
                            <tr className="bg-muted/50 border-b border-border">
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Nombre</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Apellido</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Teléfono</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Curso de Formación</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Origen</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Campaña</th>
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground text-right">Fecha</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {data.length > 0 ? data.map((row) => (
                                <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                                <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                            </div>
                                            <span className="font-bold text-slate-900 dark:text-slate-100">{row.nombre || "—"}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-600 dark:text-slate-400">
                                        {row.apellido || "—"}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900 dark:text-slate-100">
                                        <div className="flex items-center gap-2">
                                            <Phone className="h-3 w-3 text-slate-400" />
                                            {row.telefono || "—"}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        {row.programa_nombre ? (
                                            <span className="px-3 py-1 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs font-bold border border-amber-200/50 dark:border-amber-900/50">
                                                {row.programa_nombre}
                                            </span>
                                        ) : (
                                            <span className="text-slate-400 text-xs">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Globe className="h-3 w-3 text-slate-400" />
                                            <span className="font-semibold text-slate-600 dark:text-slate-400 capitalize">{row.origen || "directo"}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <Megaphone className="h-3 w-3 text-slate-400" />
                                            <span className="font-bold text-slate-900 dark:text-slate-100">{row.campana || "—"}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-xs font-bold text-slate-400">
                                        {formatDate(row.fecha_ingreso_crm)}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-medium">
                                        No se encontraron prospectos para el período seleccionado
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isCreateDialogOpen && (
                <CreateLeadDialog 
                    onClose={() => setIsCreateDialogOpen(false)}
                    onSuccess={() => {
                        router.refresh();
                    }}
                />
            )}
        </div>
    );
}

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
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Prospectos Recientes
          </h2>
          <p className="mt-1 text-xs font-medium tracking-widest text-slate-500 uppercase">
            {total.toLocaleString()} leads totales encontrados
          </p>
        </div>
        <button
          onClick={() => setIsCreateDialogOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-black text-white shadow-xl shadow-blue-500/20 transition-all hover:bg-blue-700 active:scale-95"
        >
          <Plus className="h-4 w-4" /> Nuevo Lead
        </button>
      </div>

      <div className="bg-card border-border overflow-hidden rounded-[32px] border shadow-xl shadow-black/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-muted/50 border-border border-b">
                <th className="text-muted-foreground px-6 py-4 text-[10px] font-black tracking-widest uppercase">
                  Nombre
                </th>
                <th className="text-muted-foreground px-6 py-4 text-[10px] font-black tracking-widest uppercase">
                  Apellido
                </th>
                <th className="text-muted-foreground px-6 py-4 text-[10px] font-black tracking-widest uppercase">
                  Teléfono
                </th>
                <th className="text-muted-foreground px-6 py-4 text-[10px] font-black tracking-widest uppercase">
                  Curso de Formación
                </th>
                <th className="text-muted-foreground px-6 py-4 text-[10px] font-black tracking-widest uppercase">
                  Origen
                </th>
                <th className="text-muted-foreground px-6 py-4 text-[10px] font-black tracking-widest uppercase">
                  Campaña
                </th>
                <th className="text-muted-foreground px-6 py-4 text-right text-[10px] font-black tracking-widest uppercase">
                  Fecha
                </th>
              </tr>
            </thead>
            <tbody className="divide-border/50 divide-y">
              {data.length > 0 ? (
                data.map((row) => (
                  <tr key={row.id} className="hover:bg-muted/30 group transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
                          <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {row.nombre || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {row.apellido || "—"}
                    </td>
                    <td className="px-6 py-4 font-bold whitespace-nowrap text-slate-900 dark:text-slate-100">
                      <div className="flex items-center gap-2">
                        <Phone className="h-3 w-3 text-slate-400" />
                        {row.telefono || "—"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {row.programa_nombre ? (
                        <span className="rounded-lg border border-amber-200/50 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-600 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-400">
                          {row.programa_nombre}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3 w-3 text-slate-400" />
                        <span className="font-semibold text-slate-600 capitalize dark:text-slate-400">
                          {row.origen || "directo"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Megaphone className="h-3 w-3 text-slate-400" />
                        <span className="font-bold text-slate-900 dark:text-slate-100">
                          {row.campana || "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right text-xs font-bold whitespace-nowrap text-slate-400">
                      {formatDate(row.fecha_ingreso_crm)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center font-medium text-slate-400">
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

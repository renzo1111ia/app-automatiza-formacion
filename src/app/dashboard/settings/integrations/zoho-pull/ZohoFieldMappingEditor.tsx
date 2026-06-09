"use client";

// Sprint 5 - Editor de field_mapping Zoho → AF.
//
// Cada fila = { zoho_field, target, writeback? }. El tenant puede añadir, editar
// y eliminar filas. onChange propaga al padre para guardar con saveZohoSyncConfigAction.
// Patrón de SheetMappingEditor.tsx.

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ZohoFieldMapping, ZohoFieldMappingEntry } from "@/lib/integrations/zoho-pull/types";

// Types disponibles por campo (opcional — ayuda al procesador).
const FIELD_TYPES: string[] = ["string", "email", "phone", "number", "boolean", "datetime", "text"];

// Targets AF disponibles (subconjunto relevante para Zoho Leads).
const TARGET_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "lead.nombre", value: "lead.nombre" },
  { label: "lead.apellido", value: "lead.apellido" },
  { label: "lead.email", value: "lead.email" },
  { label: "lead.telefono", value: "lead.telefono" },
  { label: "lead.pais", value: "lead.pais" },
  { label: "lead.origen", value: "lead.origen" },
  { label: "lead.campana", value: "lead.campana" },
  { label: "lead.current_stage", value: "lead.current_stage" },
  { label: "lead.id_lead_externo", value: "lead.id_lead_externo" },
  { label: "lead_cualificacion.cualificacion", value: "lead_cualificacion.cualificacion" },
  { label: "lead_cualificacion.motivo_anulacion", value: "lead_cualificacion.motivo_anulacion" },
  { label: "metadata.empresa", value: "metadata.empresa" },
  { label: "metadata.cargo", value: "metadata.cargo" },
  { label: "metadata.user_age", value: "metadata.user_age" },
  { label: "metadata.user_profession", value: "metadata.user_profession" },
  { label: "metadata.year_experience", value: "metadata.year_experience" },
  { label: "metadata.user_studies", value: "metadata.user_studies" },
  { label: "metadata.nivel_estudios", value: "metadata.nivel_estudios" },
  { label: "metadata.user_motivations", value: "metadata.user_motivations" },
  { label: "metadata.curse_name", value: "metadata.curse_name" },
  { label: "metadata.ok_whatsapp", value: "metadata.ok_whatsapp" },
  { label: "metadata.notas", value: "metadata.notas" },
  { label: "metadata.fecha_agenda", value: "metadata.fecha_agenda" },
  { label: "metadata.zoho_lead_status", value: "metadata.zoho_lead_status" },
  { label: "metadata.zoho_lead_source", value: "metadata.zoho_lead_source" },
];

interface Props {
  mapping: ZohoFieldMapping;
  onChange: (updated: ZohoFieldMapping) => void;
  disabled?: boolean;
}

export function ZohoFieldMappingEditor({ mapping, onChange, disabled }: Props) {
  const updateRow = (idx: number, patch: Partial<ZohoFieldMappingEntry>) => {
    const next = mapping.map((row, i) => (i === idx ? { ...row, ...patch } : row));
    onChange(next);
  };

  const removeRow = (idx: number) => {
    onChange(mapping.filter((_, i) => i !== idx));
  };

  const addRow = () => {
    onChange([...mapping, { zoho_field: "", target: "metadata.notas" }]);
  };

  return (
    <div className="space-y-3" role="table" aria-label="Mapeo de campos Zoho a campos AF">
      {/* Header */}
      <div
        className="text-muted-foreground hidden grid-cols-12 gap-2 px-1 text-xs font-medium sm:grid"
        role="row"
      >
        <div className="col-span-4" role="columnheader">
          Campo Zoho (raw)
        </div>
        <div className="col-span-5" role="columnheader">
          Campo destino AF
        </div>
        <div className="col-span-2" role="columnheader">
          Tipo
        </div>
        <div className="col-span-1" role="columnheader" aria-label="Eliminar" />
      </div>

      {/* Rows */}
      {mapping.length === 0 && (
        <p className="text-muted-foreground py-2 text-center text-sm">
          Sin filas. Añade una o usa &quot;Sugerir mapeo&quot;.
        </p>
      )}

      {mapping.map((row, idx) => (
        <div key={idx} className="grid grid-cols-12 items-center gap-2" role="row">
          <Input
            value={row.zoho_field}
            onChange={(e) => updateRow(idx, { zoho_field: e.target.value })}
            placeholder="First_Name"
            className="col-span-4 h-8 text-sm"
            disabled={disabled}
            aria-label={`Campo Zoho fila ${idx + 1}`}
          />
          <div className="col-span-5">
            <label className="sr-only" htmlFor={`zoho-target-${idx}`}>
              Campo destino AF fila {idx + 1}
            </label>
            <select
              id={`zoho-target-${idx}`}
              value={row.target}
              onChange={(e) => updateRow(idx, { target: e.target.value })}
              className="bg-background focus-visible:ring-ring h-8 w-full rounded border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              disabled={disabled}
            >
              {TARGET_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className="sr-only" htmlFor={`zoho-type-${idx}`}>
              Tipo fila {idx + 1}
            </label>
            <select
              id={`zoho-type-${idx}`}
              value={row.type ?? "string"}
              onChange={(e) => updateRow(idx, { type: e.target.value })}
              className="bg-background focus-visible:ring-ring h-8 w-full rounded border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              disabled={disabled}
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => removeRow(idx)}
            disabled={disabled}
            className="text-destructive col-span-1"
            aria-label={`Eliminar fila ${idx + 1}`}
          >
            <Trash2 className="size-3" />
          </Button>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={addRow} disabled={disabled} type="button">
        <Plus className="mr-1 size-3" />
        Añadir campo
      </Button>
    </div>
  );
}

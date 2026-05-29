"use client";

// Sprint 4 - Editor de column_mapping para una SheetConnection.
//
// Permite al tenant ajustar el mapeo auto-sugerido (Picker -> suggestMapping):
// cambiar target por columna, cambiar tipo, marcar/desmarcar writeback, anadir
// o eliminar filas. No carga el Google Picker (eso es Step 3).

import { useState, useTransition } from "react";
import { Plus, Trash2, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toast";
import { updateSheetMappingAction } from "@/lib/integrations/sheets/actions";
import type {
  ColumnMapping,
  ColumnMappingEntry,
  ColumnType,
  SheetConnection,
  SheetPurpose,
} from "@/lib/integrations/sheets/types";
import {
  LEAD_TOP_LEVEL_FIELDS,
  LEAD_CUALIFICACION_FIELDS,
  METADATA_RECOMMENDED_FIELDS,
} from "@/lib/integrations/sheets/types";

const COLUMN_TYPES: ColumnType[] = [
  "string",
  "text",
  "email",
  "phone",
  "url",
  "number",
  "boolean",
  "datetime",
  "date",
  "json",
  "enum:lead_stage",
  "enum:qualified",
  "enum:estado",
  "enum:motivo_descarte",
  "enum:nivel_estudios",
];

const TARGET_OPTIONS: Array<{ label: string; value: string }> = [
  ...LEAD_TOP_LEVEL_FIELDS.map((f) => ({ label: f, value: f })),
  ...LEAD_CUALIFICACION_FIELDS.map((f) => ({ label: f, value: f })),
  ...METADATA_RECOMMENDED_FIELDS.map((f) => ({ label: f, value: f })),
];

const PURPOSES: SheetPurpose[] = ["leads_inbound", "leads_export", "reporting", "custom"];

export function SheetMappingEditor({ sheet }: { sheet: SheetConnection }) {
  const [mapping, setMapping] = useState<ColumnMapping>(sheet.column_mapping);
  const [purpose, setPurpose] = useState<SheetPurpose>(sheet.purpose);
  const [writebackEnabled, setWritebackEnabled] = useState(sheet.writeback_enabled);
  const [sheetTabName, setSheetTabName] = useState(sheet.sheet_tab_name);
  const [pending, startTransition] = useTransition();

  const updateColumn = (idx: number, patch: Partial<ColumnMappingEntry>) => {
    setMapping((m) => ({
      ...m,
      columns: m.columns.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }));
  };

  const removeColumn = (idx: number) => {
    setMapping((m) => ({
      ...m,
      columns: m.columns.filter((_, i) => i !== idx),
    }));
  };

  const addColumn = () => {
    const usedLetters = new Set(mapping.columns.map((c) => c.letter));
    let next = "A";
    while (usedLetters.has(next)) next = nextLetter(next);
    setMapping((m) => ({
      ...m,
      columns: [
        ...m.columns,
        { letter: next, header: "", target: "metadata.notas", type: "string", writeback: false },
      ],
    }));
  };

  const save = () => {
    startTransition(async () => {
      const res = await updateSheetMappingAction({
        sheetConnectionId: sheet.id,
        columnMapping: mapping,
        purpose,
        writebackEnabled,
        sheetTabName,
      });
      if (res.ok) {
        toast({ variant: "success", description: "Mapeo guardado" });
      } else {
        toast({ variant: "error", description: res.error });
      }
    });
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Pestaña</Label>
          <Input
            value={sheetTabName}
            onChange={(e) => setSheetTabName(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs">Propósito</Label>
          <select
            value={purpose}
            onChange={(e) => setPurpose(e.target.value as SheetPurpose)}
            className="bg-background h-8 w-full rounded border px-2 text-sm"
          >
            {PURPOSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={writebackEnabled}
              onChange={(e) => setWritebackEnabled(e.target.checked)}
            />
            Write-back activo
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-muted-foreground grid grid-cols-12 gap-2 px-1 text-xs font-medium">
          <div className="col-span-1">Col</div>
          <div className="col-span-3">Cabecera</div>
          <div className="col-span-4">Campo destino</div>
          <div className="col-span-2">Tipo</div>
          <div className="col-span-1 text-center">WB</div>
          <div className="col-span-1"></div>
        </div>
        {mapping.columns.map((col, idx) => (
          <div key={idx} className="grid grid-cols-12 items-center gap-2">
            <Input
              value={col.letter}
              onChange={(e) => updateColumn(idx, { letter: e.target.value.toUpperCase() })}
              className="col-span-1 h-8 text-sm"
            />
            <Input
              value={col.header ?? ""}
              onChange={(e) => updateColumn(idx, { header: e.target.value })}
              className="col-span-3 h-8 text-sm"
              placeholder="Cabecera Sheet"
            />
            <select
              value={col.target}
              onChange={(e) => updateColumn(idx, { target: e.target.value })}
              className="bg-background col-span-4 h-8 rounded border px-2 text-sm"
            >
              {TARGET_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={col.type}
              onChange={(e) => updateColumn(idx, { type: e.target.value as ColumnType })}
              className="bg-background col-span-2 h-8 rounded border px-2 text-sm"
            >
              {COLUMN_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.replace("enum:", "")}
                </option>
              ))}
            </select>
            <div className="col-span-1 text-center">
              <input
                type="checkbox"
                checked={col.writeback ?? false}
                onChange={(e) => updateColumn(idx, { writeback: e.target.checked })}
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => removeColumn(idx)}
              className="text-destructive col-span-1"
            >
              <Trash2 className="size-3" />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={addColumn}>
          <Plus className="mr-1 size-3" />
          Añadir columna
        </Button>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? (
            <Loader2 className="mr-1 size-3 animate-spin" />
          ) : (
            <Save className="mr-1 size-3" />
          )}
          Guardar mapeo
        </Button>
      </div>
    </div>
  );
}

function nextLetter(letter: string): string {
  let carry = 1;
  let result = "";
  for (let i = letter.length - 1; i >= 0; i--) {
    const code = letter.charCodeAt(i) - 65 + carry;
    if (code >= 26) {
      result = "A" + result;
      carry = 1;
    } else {
      result = String.fromCharCode(65 + code) + result;
      carry = 0;
    }
  }
  if (carry > 0) result = "A" + result;
  return result;
}

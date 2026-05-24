"use client";

import React, { useState } from "react";
import {
  X,
  User,
  Mail,
  Phone,
  Globe,
  Calendar,
  Save,
  Loader2,
  Trash2,
  Plus,
  AlertCircle,
  MapPin,
  Target,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { InboxLead } from "@/lib/actions/inbox";
import { updateLeadInfo } from "@/lib/actions/inbox";
import type { LucideIcon } from "lucide-react";
import { resolveCountryFromPhone } from "@/lib/utils/location-client";
import { toast } from "@/components/ui/toast";

interface LeadProfileModalProps {
  lead: InboxLead;
  onClose: () => void;
  onUpdate: (updatedLead: InboxLead) => void;
}

export function LeadProfileModal({ lead, onClose, onUpdate }: LeadProfileModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [editedLead, setEditedLead] = useState<InboxLead>({ ...lead });
  const [metadata, setMetadata] = useState<Record<string, unknown>>(() => {
    const normalizedMeta: Record<string, unknown> = {};
    Object.entries(lead.metadata || {}).forEach(([k, v]) => {
      let unifiedKey = k;
      const norm = k.toUpperCase().replace(/\s+/g, "").replace(/_/g, "");
      if (norm === "YEARSEXPERIENCIE" || norm === "YEARSEXPERIENCE") {
        unifiedKey = "YEARS_EXPERIENCE";
      } else if (norm === "FECHAAGENDA") {
        unifiedKey = "FECHA_AGENDA";
      } else if (norm === "USERESTUDIES") {
        unifiedKey = "USER_ESTUDIES";
      } else if (norm === "USERSTUDIES") {
        unifiedKey = "USER_STUDIES";
      }

      const existingKey = Object.keys(normalizedMeta).find(
        (mk) =>
          mk.toLowerCase().replace(/\s+/g, "").replace(/_/g, "") ===
          unifiedKey.toLowerCase().replace(/\s+/g, "").replace(/_/g, "")
      );
      if (existingKey) {
        if (!normalizedMeta[existingKey] && v) normalizedMeta[existingKey] = v;
      } else {
        normalizedMeta[unifiedKey] = v;
      }
    });
    return normalizedMeta;
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Normalize metadata before saving: merge duplicates and legacy keys
      const normalizedMeta: Record<string, unknown> = {};
      Object.entries(metadata).forEach(([k, v]) => {
        let unifiedKey = k;
        const norm = k.toUpperCase().replace(/\s+/g, "").replace(/_/g, "");
        if (norm === "YEARSEXPERIENCIE" || norm === "YEARSEXPERIENCE") {
          unifiedKey = "YEARS_EXPERIENCE";
        } else if (norm === "FECHAAGENDA") {
          unifiedKey = "FECHA_AGENDA";
        } else if (norm === "USERESTUDIES") {
          unifiedKey = "USER_ESTUDIES";
        } else if (norm === "USERSTUDIES") {
          unifiedKey = "USER_STUDIES";
        }

        const existingKey = Object.keys(normalizedMeta).find(
          (mk) =>
            mk.toLowerCase().replace(/\s+/g, "").replace(/_/g, "") ===
            unifiedKey.toLowerCase().replace(/\s+/g, "").replace(/_/g, "")
        );
        if (existingKey) {
          if (!normalizedMeta[existingKey] && v) normalizedMeta[existingKey] = v;
        } else {
          normalizedMeta[unifiedKey] = v;
        }
      });

      const updates = {
        nombre: editedLead.nombre,
        apellido: editedLead.apellido,
        email: editedLead.email,
        telefono: editedLead.telefono,
        pais: editedLead.pais,
        metadata: normalizedMeta,
      };

      const res = await updateLeadInfo(lead.id, updates);
      if (res.success) {
        onUpdate({ ...editedLead, metadata: normalizedMeta });
        onClose();
      } else {
        toast({ variant: "error", title: "Error al guardar", description: res.error });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateMetadataKey = (key: string, value: unknown) => {
    setMetadata((prev) => ({ ...prev, [key]: value }));
  };

  const removeMetadataKey = (key: string) => {
    const newMeta = { ...metadata };
    delete newMeta[key];
    setMetadata(newMeta);
  };

  const addMetadataKey = () => {
    const key = prompt("Nombre del nuevo campo (ej: empresa, cargo, etc)");
    if (key && !metadata[key]) {
      setMetadata((prev) => ({ ...prev, [key]: "" }));
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-card border-border relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[40px] border shadow-2xl"
      >
        {/* Header */}
        <div className="border-border bg-card/20 flex items-center justify-between border-b p-8 md:p-10">
          <div className="flex items-center gap-6">
            <div className="bg-primary/20 border-primary/20 flex h-16 w-16 items-center justify-center rounded-2xl border">
              <User className="text-primary h-8 w-8" />
            </div>
            <div>
              <h2 className="text-foreground text-2xl font-black tracking-tight uppercase">
                Perfil del Lead
              </h2>
              <p className="text-foreground/50 mt-1 text-[11px] font-bold tracking-[0.3em] uppercase">
                Gestión y Datos Capturados
              </p>
            </div>
          </div>
          <button
            title="Cerrar"
            onClick={onClose}
            className="hover:bg-card flex h-12 w-12 items-center justify-center rounded-2xl transition-all"
          >
            <X className="text-muted-foreground/40 h-6 w-6" />
          </button>
        </div>

        <div className="custom-scrollbar bg-background flex-1 overflow-y-auto p-8 md:p-10">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
            {/* Basic Information */}
            <div className="space-y-8">
              <SectionHeader icon={User} title="Información Básica" />

              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label="Nombre"
                  value={editedLead.nombre || ""}
                  onChange={(val) => setEditedLead((prev) => ({ ...prev, nombre: val }))}
                />
                <InputField
                  label="Apellido"
                  value={editedLead.apellido || ""}
                  onChange={(val) => setEditedLead((prev) => ({ ...prev, apellido: val }))}
                />
              </div>

              <InputField
                label="Email"
                icon={Mail}
                value={editedLead.email || ""}
                onChange={(val) => setEditedLead((prev) => ({ ...prev, email: val }))}
              />

              <InputField
                label="Teléfono"
                icon={Phone}
                value={editedLead.telefono || ""}
                onChange={(val) => setEditedLead((prev) => ({ ...prev, telefono: val }))}
              />

              <InputField
                label="País"
                icon={Globe}
                value={editedLead.pais || resolveCountryFromPhone(editedLead.telefono) || ""}
                onChange={(val) => setEditedLead((prev) => ({ ...prev, pais: val }))}
              />
            </div>

            {/* Captured Data (Metadata) */}
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <SectionHeader icon={Target} title="Datos Capturados (IA / Sistema)" />
                <div className="flex items-center gap-2">
                  <button
                    onClick={addMetadataKey}
                    className="bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 flex h-8 items-center gap-2 rounded-lg border px-3 text-[10px] font-black tracking-widest uppercase transition-all"
                  >
                    <Plus className="h-3 w-3" /> Añadir Campo
                  </button>
                </div>
              </div>

              <div className="bg-card border-border space-y-6 rounded-3xl border p-6">
                {Object.keys(metadata).filter(
                  (k) => !["last_fact_update", "meta_id", "raw", "media_url"].includes(k)
                ).length === 0 ? (
                  <div className="text-muted-foreground/20 space-y-3 py-10 text-center">
                    <AlertCircle className="mx-auto h-8 w-8" />
                    <p className="text-[10px] font-black tracking-widest uppercase">
                      No hay datos adicionales capturados
                    </p>
                  </div>
                ) : (
                  Object.entries(metadata)
                    .filter(
                      ([key]) => !["last_fact_update", "meta_id", "raw", "media_url"].includes(key)
                    )
                    .map(([key, value]) => (
                      <div key={key} className="group relative">
                        <div className="mb-2 flex items-center justify-between px-1">
                          <label className="text-muted-foreground/40 text-[10px] font-black tracking-widest uppercase">
                            {key.replace(/^\{\{|\}\}$/g, "").replace(/_/g, " ")}
                          </label>
                          <button
                            onClick={() => removeMetadataKey(key)}
                            title={`Eliminar campo ${key}`}
                            className="flex h-5 w-5 items-center justify-center rounded bg-red-500/10 text-red-500 opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <input
                          value={String(value)}
                          onChange={(e) => updateMetadataKey(key, e.target.value)}
                          title={`Valor para ${key}`}
                          className="bg-background border-border text-foreground focus:ring-primary/20 w-full rounded-xl border px-4 py-3 text-sm font-bold transition-all focus:ring-2 focus:outline-none"
                        />
                      </div>
                    ))
                )}
              </div>

              {/* Additional Info (ReadOnly for now) */}
              <div className="space-y-4 pt-4">
                <SectionHeader icon={Calendar} title="Metadatos de Registro" />
                <div className="grid grid-cols-2 gap-4">
                  <ReadOnlyField
                    label="Origen"
                    value={editedLead.origen || "Desconocido"}
                    icon={MapPin}
                  />
                  <ReadOnlyField
                    label="Campaña"
                    value={editedLead.campana || "Ninguna"}
                    icon={Target}
                  />
                  <ReadOnlyField
                    label="Fecha Ingreso"
                    value={
                      editedLead.created_at
                        ? new Date(editedLead.created_at).toLocaleDateString()
                        : "---"
                    }
                    icon={Calendar}
                  />
                  <ReadOnlyField
                    label="Segmentación"
                    value={editedLead.segmentacion || "SIN ASIGNAR"}
                    icon={User}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-border bg-card/20 flex items-center justify-end gap-4 border-t p-8 md:p-10">
          <button
            onClick={onClose}
            className="bg-card border-border text-muted-foreground/60 hover:bg-card/60 h-14 rounded-2xl border px-8 text-[11px] font-black tracking-widest uppercase transition-all"
          >
            Cancelar
          </button>
          <button
            disabled={isSaving}
            onClick={handleSave}
            className="bg-primary shadow-primary/20 text-primary-foreground flex h-14 items-center gap-3 rounded-2xl px-10 text-[11px] font-black tracking-widest uppercase shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
            <span>Guardar Cambios</span>
          </button>
        </div>
      </motion.div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.2);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: LucideIcon | React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="text-primary h-4 w-4" />
      <h3 className="text-muted-foreground/40 text-[12px] font-black tracking-[0.2em] uppercase">
        {title}
      </h3>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
  icon: Icon,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  icon?: LucideIcon | React.ElementType;
}) {
  return (
    <div className="space-y-2">
      <label className="text-muted-foreground/40 px-1 text-[10px] font-black tracking-widest uppercase">
        {label}
      </label>
      <div className="group relative">
        {Icon && (
          <Icon className="text-muted-foreground/20 group-focus-within:text-primary absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 transition-colors" />
        )}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          title={label}
          className={cn(
            "bg-background border-border text-foreground focus:ring-primary/20 w-full rounded-2xl border py-4 text-sm font-bold transition-all focus:ring-2 focus:outline-none",
            Icon ? "pr-4 pl-12" : "px-6"
          )}
        />
      </div>
    </div>
  );
}

function ReadOnlyField({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon | React.ElementType;
}) {
  return (
    <div className="bg-card border-border flex flex-col gap-1 rounded-2xl border p-4">
      <span className="text-muted-foreground/40 text-[8px] font-black tracking-widest uppercase">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <Icon className="text-primary/40 h-3 w-3" />
        <span className="text-foreground/60 truncate text-[11px] font-bold">{value}</span>
      </div>
    </div>
  );
}

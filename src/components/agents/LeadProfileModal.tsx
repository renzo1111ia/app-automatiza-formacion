"use client";

import React, { useState } from "react";
import { 
    X, User, Mail, Phone, Globe, 
    Calendar, Save, Loader2, Trash2,
    Plus, AlertCircle, MapPin, Target
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { InboxLead } from "@/lib/actions/inbox";
import { updateLeadInfo } from "@/lib/actions/inbox";
import type { LucideIcon } from "lucide-react";
import { resolveCountryFromPhone } from "@/lib/utils/location-client";

interface LeadProfileModalProps {
    lead: InboxLead;
    onClose: () => void;
    onUpdate: (updatedLead: InboxLead) => void;
}

export function LeadProfileModal({ lead, onClose, onUpdate }: LeadProfileModalProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [editedLead, setEditedLead] = useState<InboxLead>({ ...lead });
    const [metadata, setMetadata] = useState<Record<string, unknown>>(lead.metadata || {});

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const updates = {
                nombre: editedLead.nombre,
                apellido: editedLead.apellido,
                email: editedLead.email,
                telefono: editedLead.telefono,
                pais: editedLead.pais,
                metadata: metadata
            };

            const res = await updateLeadInfo(lead.id, updates);
            if (res.success) {
                onUpdate({ ...editedLead, metadata });
                onClose();
            } else {
                alert("Error al guardar: " + res.error);
            }
        } finally {
            setIsSaving(false);
        }
    };

    const updateMetadataKey = (key: string, value: unknown) => {
        setMetadata(prev => ({ ...prev, [key]: value }));
    };

    const removeMetadataKey = (key: string) => {
        const newMeta = { ...metadata };
        delete newMeta[key];
        setMetadata(newMeta);
    };

    const addMetadataKey = () => {
        const key = prompt("Nombre del nuevo campo (ej: empresa, cargo, etc)");
        if (key && !metadata[key]) {
            setMetadata(prev => ({ ...prev, [key]: "" }));
        }
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 md:p-6">
            <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                onClick={onClose}
            />
            
            <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                animate={{ opacity: 1, scale: 1, y: 0 }} 
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-[#0b0e14] border border-slate-200 dark:border-white/10 rounded-[40px] shadow-2xl overflow-hidden flex flex-col"
            >
                {/* Header */}
                <div className="p-8 md:p-10 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-black/20">
                    <div className="flex items-center gap-6">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                            <User className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Perfil del Lead</h2>
                            <p className="text-[11px] font-bold text-slate-400 dark:text-white/20 uppercase tracking-[0.3em] mt-1">Gestión y Datos Capturados</p>
                        </div>
                    </div>
                    <button 
                        title="Cerrar"
                        onClick={onClose} 
                        className="h-12 w-12 flex items-center justify-center rounded-2xl hover:bg-slate-100 dark:hover:bg-white/5 transition-all"
                    >
                        <X className="h-6 w-6 text-slate-400 dark:text-white/40" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-8 md:p-10">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Basic Information */}
                        <div className="space-y-8">
                            <SectionHeader icon={User} title="Información Básica" />
                            
                            <div className="grid grid-cols-2 gap-4">
                                <InputField 
                                    label="Nombre" 
                                    value={editedLead.nombre || ""} 
                                    onChange={(val) => setEditedLead(prev => ({ ...prev, nombre: val }))} 
                                />
                                <InputField 
                                    label="Apellido" 
                                    value={editedLead.apellido || ""} 
                                    onChange={(val) => setEditedLead(prev => ({ ...prev, apellido: val }))} 
                                />
                            </div>

                            <InputField 
                                label="Email" 
                                icon={Mail}
                                value={editedLead.email || ""} 
                                onChange={(val) => setEditedLead(prev => ({ ...prev, email: val }))} 
                            />

                            <InputField 
                                label="Teléfono" 
                                icon={Phone}
                                value={editedLead.telefono || ""} 
                                onChange={(val) => setEditedLead(prev => ({ ...prev, telefono: val }))} 
                            />

                            <InputField 
                                label="País" 
                                icon={Globe}
                                value={editedLead.pais || resolveCountryFromPhone(editedLead.telefono) || ""} 
                                onChange={(val) => setEditedLead(prev => ({ ...prev, pais: val }))} 
                            />
                        </div>

                        {/* Captured Data (Metadata) */}
                        <div className="space-y-8">
                            <div className="flex items-center justify-between">
                                <SectionHeader icon={Target} title="Datos Capturados (IA / Sistema)" />
                                <button 
                                    onClick={addMetadataKey}
                                    className="h-8 px-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all flex items-center gap-2"
                                >
                                    <Plus className="h-3 w-3" /> Añadir Campo
                                </button>
                            </div>

                            <div className="bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-3xl p-6 space-y-6">
                                {Object.keys(metadata).length === 0 ? (
                                    <div className="py-10 text-center space-y-3 opacity-20">
                                        <AlertCircle className="h-8 w-8 mx-auto" />
                                        <p className="text-[10px] font-black uppercase tracking-widest">No hay datos adicionales capturados</p>
                                    </div>
                                ) : (
                                    Object.entries(metadata).map(([key, value]) => (
                                        <div key={key} className="relative group">
                                            <div className="flex items-center justify-between mb-2 px-1">
                                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/30">{key.replace(/_/g, ' ')}</label>
                                                <button 
                                                    onClick={() => removeMetadataKey(key)}
                                                    title={`Eliminar campo ${key}`}
                                                    className="h-5 w-5 rounded bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center hover:bg-red-500/20"
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </button>
                                            </div>
                                            <input 
                                                value={String(value)}
                                                onChange={(e) => updateMetadataKey(key, e.target.value)}
                                                title={`Valor para ${key}`}
                                                className="w-full bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                            />
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Additional Info (ReadOnly for now) */}
                            <div className="pt-4 space-y-4">
                                <SectionHeader icon={Calendar} title="Metadatos de Registro" />
                                <div className="grid grid-cols-2 gap-4">
                                    <ReadOnlyField label="Origen" value={editedLead.origen || "Desconocido"} icon={MapPin} />
                                    <ReadOnlyField label="Campaña" value={editedLead.campana || "Ninguna"} icon={Target} />
                                    <ReadOnlyField label="Fecha Ingreso" value={editedLead.created_at ? new Date(editedLead.created_at).toLocaleDateString() : "---"} icon={Calendar} />
                                    <ReadOnlyField label="Segmentación" value={editedLead.segmentacion || "SIN ASIGNAR"} icon={User} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 md:p-10 border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/40 flex items-center justify-end gap-4">
                    <button 
                        onClick={onClose}
                        className="h-14 px-8 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/5 text-[11px] font-black uppercase tracking-widest text-slate-500 dark:text-white/40 hover:bg-slate-200 dark:hover:bg-white/10 transition-all"
                    >
                        Cancelar
                    </button>
                    <button 
                        disabled={isSaving}
                        onClick={handleSave}
                        className="h-14 px-10 rounded-2xl bg-primary shadow-lg shadow-primary/20 text-[11px] font-black uppercase tracking-widest text-white flex items-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        <span>Guardar Cambios</span>
                    </button>
                </div>
            </motion.div>

            <style jsx>{`
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.2); }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
            `}</style>
        </div>
    );
}

function SectionHeader({ icon: Icon, title }: { icon: LucideIcon | React.ElementType, title: string }) {
    return (
        <div className="flex items-center gap-3">
            <Icon className="h-4 w-4 text-primary" />
            <h3 className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-white/40">{title}</h3>
        </div>
    );
}

function InputField({ label, value, onChange, icon: Icon }: { label: string, value: string, onChange: (val: string) => void, icon?: LucideIcon | React.ElementType }) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20 px-1">{label}</label>
            <div className="relative group">
                {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 dark:text-white/10 group-focus-within:text-primary transition-colors" />}
                <input 
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    title={label}
                    className={cn(
                        "w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl py-4 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all",
                        Icon ? "pl-12 pr-4" : "px-6"
                    )}
                />
            </div>
        </div>
    );
}

function ReadOnlyField({ label, value, icon: Icon }: { label: string, value: string, icon: LucideIcon | React.ElementType }) {
    return (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 flex flex-col gap-1">
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-white/20">{label}</span>
            <div className="flex items-center gap-2">
                <Icon className="h-3 w-3 text-primary/40" />
                <span className="text-[11px] font-bold text-slate-900 dark:text-white/60 truncate">{value}</span>
            </div>
        </div>
    );
}

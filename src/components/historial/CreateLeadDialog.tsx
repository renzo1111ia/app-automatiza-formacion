import { useState, useEffect } from "react";
import { X, User, Phone, Mail, Globe, Save, Loader2, Target, Megaphone } from "lucide-react";
import { createLead, getPrograms } from "@/lib/actions/calls";
import { getCampaigns } from "@/lib/actions/campanas";
import type { Programa, Campana } from "@/types/database";

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateLeadDialog({ onClose, onSuccess }: Props) {
    const [loading, setLoading] = useState(false);
    const [programs, setPrograms] = useState<Programa[]>([]);
    const [campaigns, setCampaigns] = useState<Campana[]>([]);
    const [formData, setFormData] = useState({
        nombre: "",
        apellido: "",
        telefono: "",
        email: "",
        pais: "",
        tipo_lead: "nuevo",
        origen: "",
        campana: "",
        id_programa: "",
    });

    useEffect(() => {
        Promise.all([
            getPrograms(),
            getCampaigns()
        ]).then(([progs, camps]) => {
            setPrograms(progs);
            setCampaigns(camps);
        });
    }, []);

    // ... (rest of handleSubmit remains same)
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.nombre || !formData.telefono) {
            alert("Nombre y Teléfono son obligatorios");
            return;
        }

        setLoading(true);
        try {
            const res = await createLead(formData);
            if (res.success) {
                onSuccess();
                onClose();
            } else {
                alert("Error al crear lead: " + res.error);
            }
        } catch (error) {
            console.error(error);
            alert("Error inesperado");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative bg-card border border-border w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex justify-between items-center p-8 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground shadow-lg shadow-primary/20">
                            <User className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Agregar Nuevo Lead</h2>
                            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
                                Ingresa los datos del prospecto manualmente
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        title="Cerrar"
                        aria-label="Cerrar modal"
                        className="p-3 hover:bg-destructive/10 hover:text-destructive rounded-2xl transition-all border border-transparent hover:border-destructive/20"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                    
                    {/* Sección: Información Personal */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-1">
                             <User className="h-3 w-3" /> Información Personal
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Nombre *</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input 
                                        required
                                        type="text" 
                                        value={formData.nombre} 
                                        onChange={e => setFormData({...formData, nombre: e.target.value})}
                                        className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none"
                                        placeholder="Ej: Juan"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Apellido</label>
                                <input 
                                    type="text" 
                                    value={formData.apellido} 
                                    onChange={e => setFormData({...formData, apellido: e.target.value})}
                                    className="w-full bg-muted/30 border border-border rounded-xl py-3 px-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none"
                                    placeholder="Ej: Pérez"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Teléfono *</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input 
                                        required
                                        type="tel" 
                                        value={formData.telefono} 
                                        onChange={e => setFormData({...formData, telefono: e.target.value})}
                                        className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none"
                                        placeholder="+34 600 000 000"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Email</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input 
                                        type="email" 
                                        value={formData.email} 
                                        onChange={e => setFormData({...formData, email: e.target.value})}
                                        className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none"
                                        placeholder="juan@ejemplo.com"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección: Clasificación y Origen */}
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-1">
                             <Globe className="h-3 w-3" /> Clasificación y Origen
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">País</label>
                                <input 
                                    type="text" 
                                    value={formData.pais} 
                                    onChange={e => setFormData({...formData, pais: e.target.value})}
                                    className="w-full bg-muted/30 border border-border rounded-xl py-3 px-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none lowercase"
                                    placeholder="Ej: españa"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Tipo de Lead</label>
                                <select 
                                    value={formData.tipo_lead} 
                                    onChange={e => setFormData({...formData, tipo_lead: e.target.value})}
                                    title="Seleccionar tipo de lead"
                                    className="w-full bg-muted/30 border border-border rounded-xl py-3 px-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none cursor-pointer"
                                >
                                    <option value="nuevo">Nuevo</option>
                                    <option value="localizable">Localizable</option>
                                    <option value="ilocalizable">Ilocalizable</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Origen (Source)</label>
                                <input 
                                    type="text" 
                                    value={formData.origen} 
                                    onChange={e => setFormData({...formData, origen: e.target.value})}
                                    className="w-full bg-muted/30 border border-border rounded-xl py-3 px-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none"
                                    placeholder="Ej: facebook"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Campaña (Campaign)</label>
                                <div className="relative">
                                    <Megaphone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <select 
                                        value={formData.campana} 
                                        onChange={e => setFormData({...formData, campana: e.target.value})}
                                        title="Seleccionar campaña"
                                        className="w-full bg-muted/30 border border-border rounded-xl py-3 pl-10 pr-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none cursor-pointer"
                                    >
                                        <option value="">Sin campaña asignada</option>
                                        {campaigns.map(c => (
                                            <option key={c.id} value={c.nombre}>{c.nombre}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sección: Programa Académico */}
                    <div className="space-y-4 pb-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 px-1">
                             <Target className="h-3 w-3" /> Programa de Interés
                        </h3>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Seleccionar Programa</label>
                            <select 
                                value={formData.id_programa} 
                                onChange={e => setFormData({...formData, id_programa: e.target.value})}
                                title="Seleccionar programa"
                                className="w-full bg-muted/30 border border-border rounded-xl py-3 px-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none cursor-pointer"
                            >
                                <option value="">Sin programa asignado</option>
                                {programs.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="p-8 border-t border-border bg-muted/30 flex justify-end gap-3">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 rounded-2xl bg-card border border-border text-sm font-black text-muted-foreground hover:bg-muted hover:text-card-foreground transition-all"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-2 px-10 py-3 rounded-2xl bg-primary text-sm font-black text-white hover:bg-primary/90 shadow-xl shadow-primary/20 transition-all disabled:opacity-50"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="h-4 w-4" />
                                Guardar Lead
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

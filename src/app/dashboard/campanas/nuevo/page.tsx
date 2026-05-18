"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
    Megaphone, ArrowLeft, Save, Loader2, 
    Calendar, FileText, Activity, CheckCircle2,
    MessageSquare, Phone, Bot, Sparkles
} from "lucide-react";
import Link from "next/link";
import { createCampaign } from "@/lib/actions/campanas";
import { getAIAgents } from "@/lib/actions/agents";
import { AIAgent } from "@/types/database";
import { cn } from "@/lib/utils";

export default function CreateCampaignPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);
    const [agents, setAgents] = useState<AIAgent[]>([]);
    const [formData, setFormData] = useState({
        nombre: "",
        descripcion: "",
        estado: "ACTIVA",
        fecha_inicio: new Date().toISOString().split('T')[0],
        agente_texto_id: "",
        agente_llamada_id: "",
    });

    useEffect(() => {
        async function loadAgents() {
            const res = await getAIAgents();
            if (res.success && res.data) {
                setAgents(res.data);
            }
        }
        loadAgents();
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formData.nombre) {
            alert("El nombre de la campaña es obligatorio");
            return;
        }

        setLoading(true);
        try {
            const res = await createCampaign(formData);
            if (res.success) {
                setSuccess(true);
                setTimeout(() => {
                    router.push("/dashboard/campanas");
                }, 2000);
            } else {
                alert("Error al crear campaña: " + res.error);
            }
        } catch (error) {
            console.error(error);
            alert("Error inesperado");
        } finally {
            setLoading(false);
        }
    }

    if (success) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="h-24 w-24 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 border border-green-500/30 shadow-2xl shadow-green-500/20">
                    <CheckCircle2 className="h-12 w-12" />
                </div>
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-black text-foreground uppercase tracking-tighter">¡Campaña Creada!</h1>
                    <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">Redirigiendo al panel de campañas...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link 
                        href="/dashboard/campanas"
                        className="h-10 w-10 rounded-xl border border-border flex items-center justify-center hover:bg-muted transition-all"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-black text-foreground uppercase tracking-tighter flex items-center gap-3">
                            <Megaphone className="h-8 w-8 text-primary" />
                            Crear Nueva Campaña
                        </h1>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mt-1 ml-1">
                            Configura los parámetros de tu nueva campaña de marketing
                        </p>
                    </div>
                </div>
            </div>

            {/* Form Card */}
            <div className="bg-card border border-border rounded-[32px] shadow-xl overflow-hidden">
                <form onSubmit={handleSubmit} className="p-8 md:p-12 space-y-10">
                    
                    {/* Sección: Identificación */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 px-1">
                            <FileText className="h-4 w-4 text-primary" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Información General</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label 
                                    htmlFor="campaign-name"
                                    className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1"
                                >
                                    Nombre de la Campaña *
                                </label>
                                <input 
                                    required
                                    id="campaign-name"
                                    type="text" 
                                    value={formData.nombre} 
                                    onChange={e => setFormData({...formData, nombre: e.target.value})}
                                    className="w-full bg-muted/30 border border-border rounded-2xl py-4 px-6 text-base font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none"
                                    placeholder="Ej: Black Friday 2024"
                                    title="Nombre de la campaña"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1">Estado Inicial</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['ACTIVA', 'PAUSADA', 'FINALIZADA'].map((status) => (
                                        <button
                                            key={status}
                                            type="button"
                                            onClick={() => setFormData({...formData, estado: status})}
                                            className={cn(
                                                "py-3 rounded-xl text-[10px] font-black tracking-tighter transition-all border",
                                                formData.estado === status 
                                                    ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                                                    : "bg-muted/30 border-border text-muted-foreground hover:bg-muted"
                                            )}
                                        >
                                            {status}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <label 
                                htmlFor="campaign-description"
                                className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1"
                            >
                                Descripción
                            </label>
                            <textarea 
                                id="campaign-description"
                                value={formData.descripcion} 
                                onChange={e => setFormData({...formData, descripcion: e.target.value})}
                                rows={3}
                                className="w-full bg-muted/30 border border-border rounded-2xl py-4 px-6 text-base font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none resize-none"
                                placeholder="Breve descripción del objetivo de la campaña..."
                                title="Descripción de la campaña"
                            />
                        </div>
                    </div>

                    {/* Sección: Configuración de Agentes */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 px-1">
                            <Bot className="h-4 w-4 text-primary" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Inteligencia y Automatización</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 rounded-3xl bg-primary/5 border border-primary/10">
                            <div className="space-y-3">
                                <label 
                                    htmlFor="text-agent"
                                    className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2"
                                >
                                    <MessageSquare className="h-3 w-3 text-primary" />
                                    Agente de Chat (WhatsApp)
                                </label>
                                <select 
                                    id="text-agent"
                                    value={formData.agente_texto_id}
                                    onChange={e => setFormData({...formData, agente_texto_id: e.target.value})}
                                    className="w-full bg-background border border-border rounded-2xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none appearance-none cursor-pointer"
                                    title="Seleccionar agente de texto"
                                >
                                    <option value="">Sin Agente de Texto</option>
                                    {agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-3">
                                <label 
                                    htmlFor="call-agent"
                                    className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1 flex items-center gap-2"
                                >
                                    <Phone className="h-3 w-3 text-primary" />
                                    Agente de Voz (Llamadas)
                                </label>
                                <select 
                                    id="call-agent"
                                    value={formData.agente_llamada_id}
                                    onChange={e => setFormData({...formData, agente_llamada_id: e.target.value})}
                                    className="w-full bg-background border border-border rounded-2xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none appearance-none cursor-pointer"
                                    title="Seleccionar agente de voz"
                                >
                                    <option value="">Sin Agente de Voz</option>
                                    {agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="col-span-full flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 mt-2">
                                <Sparkles className="h-4 w-4 text-yellow-500" />
                                <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                                    Los agentes seleccionados se encargarán de procesar las interacciones de los leads que ingresen a través de esta campaña.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Sección: Programación */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 px-1">
                            <Calendar className="h-4 w-4 text-primary" />
                            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Programación</h3>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label 
                                    htmlFor="campaign-start-date"
                                    className="text-[11px] font-black text-muted-foreground uppercase tracking-widest ml-1"
                                >
                                    Fecha de Inicio
                                </label>
                                <input 
                                    id="campaign-start-date"
                                    type="date" 
                                    value={formData.fecha_inicio} 
                                    onChange={e => setFormData({...formData, fecha_inicio: e.target.value})}
                                    className="w-full bg-muted/30 border border-border rounded-2xl py-4 px-6 text-base font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all outline-none col-span-1"
                                    title="Fecha de inicio"
                                    placeholder="Selecciona una fecha"
                                />
                            </div>
                            
                            <div className="flex items-center gap-4 p-6 rounded-2xl bg-muted/20 border border-dashed border-border mt-1">
                                <Activity className="h-8 w-8 text-muted-foreground" />
                                <p className="text-[10px] font-bold text-muted-foreground leading-relaxed">
                                    Al crear la campaña, podrás empezar a asociar leads y realizar seguimientos en tiempo real desde el panel de informes.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-6 border-t border-border flex flex-col md:flex-row justify-end gap-4">
                        <Link 
                            href="/dashboard/campanas"
                            className="px-8 py-4 rounded-2xl bg-muted/30 text-sm font-black text-muted-foreground hover:bg-muted hover:text-foreground transition-all text-center"
                        >
                            CANCELAR
                        </Link>
                        <button 
                            type="submit"
                            disabled={loading}
                            className="flex items-center justify-center gap-2 px-12 py-4 rounded-2xl bg-primary text-sm font-black text-white hover:bg-primary/90 shadow-2xl shadow-primary/20 transition-all disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                    CREANDO CAMPAÑA...
                                </>
                            ) : (
                                <>
                                    <Save className="h-5 w-5" />
                                    GUARDAR CAMPAÑA
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

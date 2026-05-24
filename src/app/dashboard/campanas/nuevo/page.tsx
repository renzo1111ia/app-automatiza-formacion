"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  ArrowLeft,
  Save,
  Loader2,
  Calendar,
  FileText,
  Activity,
  CheckCircle2,
  MessageSquare,
  Phone,
  Bot,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { createCampaign } from "@/lib/actions/campanas";
import { getAIAgents } from "@/lib/actions/agents";
import { AIAgent } from "@/types/database";
import { cn } from "@/lib/utils";
import { toast } from "@/components/ui/toast";

export default function CreateCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    estado: "ACTIVA",
    fecha_inicio: new Date().toISOString().split("T")[0],
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
      toast({
        variant: "warning",
        title: "Campo obligatorio",
        description: "El nombre de la campaña es obligatorio",
      });
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
        toast({ variant: "error", title: "Error al crear campaña", description: res.error });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "error", title: "Error inesperado" });
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="animate-in fade-in zoom-in flex min-h-[60vh] flex-col items-center justify-center space-y-6 duration-500">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-green-500/30 bg-green-500/20 text-green-500 shadow-2xl shadow-green-500/20">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-foreground text-3xl font-black tracking-tighter uppercase">
            ¡Campaña Creada!
          </h1>
          <p className="text-muted-foreground text-xs font-bold tracking-widest uppercase">
            Redirigiendo al panel de campañas...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/campanas"
            className="border-border hover:bg-muted flex h-10 w-10 items-center justify-center rounded-xl border transition-all"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-foreground flex items-center gap-3 text-3xl font-black tracking-tighter uppercase">
              <Megaphone className="text-primary h-8 w-8" />
              Crear Nueva Campaña
            </h1>
            <p className="text-muted-foreground mt-1 ml-1 text-xs font-bold tracking-[0.2em] uppercase">
              Configura los parámetros de tu nueva campaña de marketing
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-card border-border overflow-hidden rounded-[32px] border shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-10 p-8 md:p-12">
          {/* Sección: Identificación */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-1">
              <FileText className="text-primary h-4 w-4" />
              <h3 className="text-primary text-[10px] font-black tracking-[0.3em] uppercase">
                Información General
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="space-y-3">
                <label
                  htmlFor="campaign-name"
                  className="text-muted-foreground ml-1 text-[11px] font-black tracking-widest uppercase"
                >
                  Nombre de la Campaña *
                </label>
                <input
                  required
                  id="campaign-name"
                  type="text"
                  value={formData.nombre}
                  onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                  className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full rounded-2xl border px-6 py-4 text-base font-bold transition-all outline-none focus:ring-4"
                  placeholder="Ej: Black Friday 2024"
                  title="Nombre de la campaña"
                />
              </div>

              <div className="space-y-3">
                <label className="text-muted-foreground ml-1 text-[11px] font-black tracking-widest uppercase">
                  Estado Inicial
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {["ACTIVA", "PAUSADA", "FINALIZADA"].map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setFormData({ ...formData, estado: status })}
                      className={cn(
                        "rounded-xl border py-3 text-[10px] font-black tracking-tighter transition-all",
                        formData.estado === status
                          ? "bg-primary text-primary-foreground border-primary shadow-primary/20 shadow-lg"
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
                className="text-muted-foreground ml-1 text-[11px] font-black tracking-widest uppercase"
              >
                Descripción
              </label>
              <textarea
                id="campaign-description"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                rows={3}
                className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full resize-none rounded-2xl border px-6 py-4 text-base font-bold transition-all outline-none focus:ring-4"
                placeholder="Breve descripción del objetivo de la campaña..."
                title="Descripción de la campaña"
              />
            </div>
          </div>

          {/* Sección: Configuración de Agentes */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-1">
              <Bot className="text-primary h-4 w-4" />
              <h3 className="text-primary text-[10px] font-black tracking-[0.3em] uppercase">
                Inteligencia y Automatización
              </h3>
            </div>

            <div className="bg-primary/5 border-primary/10 grid grid-cols-1 gap-8 rounded-3xl border p-8 md:grid-cols-2">
              <div className="space-y-3">
                <label
                  htmlFor="text-agent"
                  className="text-muted-foreground ml-1 flex items-center gap-2 text-[11px] font-black tracking-widest uppercase"
                >
                  <MessageSquare className="text-primary h-3 w-3" />
                  Agente de Chat (WhatsApp)
                </label>
                <select
                  id="text-agent"
                  value={formData.agente_texto_id}
                  onChange={(e) => setFormData({ ...formData, agente_texto_id: e.target.value })}
                  className="bg-background border-border focus:ring-primary/10 focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-6 py-4 text-sm font-bold transition-all outline-none focus:ring-4"
                  title="Seleccionar agente de texto"
                >
                  <option value="">Sin Agente de Texto</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label
                  htmlFor="call-agent"
                  className="text-muted-foreground ml-1 flex items-center gap-2 text-[11px] font-black tracking-widest uppercase"
                >
                  <Phone className="text-primary h-3 w-3" />
                  Agente de Voz (Llamadas)
                </label>
                <select
                  id="call-agent"
                  value={formData.agente_llamada_id}
                  onChange={(e) => setFormData({ ...formData, agente_llamada_id: e.target.value })}
                  className="bg-background border-border focus:ring-primary/10 focus:border-primary w-full cursor-pointer appearance-none rounded-2xl border px-6 py-4 text-sm font-bold transition-all outline-none focus:ring-4"
                  title="Seleccionar agente de voz"
                >
                  <option value="">Sin Agente de Voz</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-full mt-2 flex items-center gap-3 rounded-2xl border border-white/5 bg-white/5 p-4">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                <p className="text-muted-foreground text-[10px] leading-relaxed font-medium">
                  Los agentes seleccionados se encargarán de procesar las interacciones de los leads
                  que ingresen a través de esta campaña.
                </p>
              </div>
            </div>
          </div>

          {/* Sección: Programación */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-1">
              <Calendar className="text-primary h-4 w-4" />
              <h3 className="text-primary text-[10px] font-black tracking-[0.3em] uppercase">
                Programación
              </h3>
            </div>

            <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
              <div className="space-y-3">
                <label
                  htmlFor="campaign-start-date"
                  className="text-muted-foreground ml-1 text-[11px] font-black tracking-widest uppercase"
                >
                  Fecha de Inicio
                </label>
                <input
                  id="campaign-start-date"
                  type="date"
                  value={formData.fecha_inicio}
                  onChange={(e) => setFormData({ ...formData, fecha_inicio: e.target.value })}
                  className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary col-span-1 w-full rounded-2xl border px-6 py-4 text-base font-bold transition-all outline-none focus:ring-4"
                  title="Fecha de inicio"
                  placeholder="Selecciona una fecha"
                />
              </div>

              <div className="bg-muted/20 border-border mt-1 flex items-center gap-4 rounded-2xl border border-dashed p-6">
                <Activity className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground text-[10px] leading-relaxed font-bold">
                  Al crear la campaña, podrás empezar a asociar leads y realizar seguimientos en
                  tiempo real desde el panel de informes.
                </p>
              </div>
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="border-border flex flex-col justify-end gap-4 border-t pt-6 md:flex-row">
            <Link
              href="/dashboard/campanas"
              className="bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground rounded-2xl px-8 py-4 text-center text-sm font-black transition-all"
            >
              CANCELAR
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="bg-primary hover:bg-primary/90 shadow-primary/20 flex items-center justify-center gap-2 rounded-2xl px-12 py-4 text-sm font-black text-white shadow-2xl transition-all disabled:opacity-50"
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

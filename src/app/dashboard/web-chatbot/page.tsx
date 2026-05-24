"use client";

import Link from "next/link";
import React, { useState, useEffect, useCallback } from "react";
import {
  Save,
  PlusCircle,
  Trash2,
  Code,
  Globe,
  Bot,
  CheckCircle2,
  Palette,
  Settings2,
  Copy,
  LucideIcon,
  AlertCircle,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import { motion, AnimatePresence } from "framer-motion";
import { getWebWidgets, saveWebWidget, deleteWebWidget } from "@/lib/actions/web-widgets";
import { getAIAgents } from "@/lib/actions/agents";
import { WebWidget, AIAgent } from "@/types/database";
import { toast } from "@/components/ui/toast";

export default function WebChatbotPage() {
  const [widgets, setWidgets] = useState<WebWidget[]>([]);
  const [agents, setAgents] = useState<AIAgent[]>([]);
  const [selectedWidget, setSelectedWidget] = useState<WebWidget | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Partial<WebWidget>>({
    name: "",
    agent_id: null,
    welcome_message: "¡Hola! ¿En qué puedo ayudarte hoy?",
    bubble_color: "#25D366",
    bubble_icon: "message-circle",
    status: "ACTIVE",
  });

  const loadData = useCallback(
    async (isInitial = false) => {
      const [widgetsRes, agentsRes] = await Promise.all([getWebWidgets(), getAIAgents()]);

      if (widgetsRes.success && widgetsRes.data) {
        setWidgets(widgetsRes.data);
        if (isInitial && widgetsRes.data.length > 0 && !selectedWidget) {
          const first = widgetsRes.data[0];
          setSelectedWidget(first);
          setFormData(first);
        }
      } else if (!widgetsRes.success) {
        setError(
          widgetsRes.error ||
            "Error al cargar widgets. Verifique que la tabla 'web_widgets' exista."
        );
      }

      if (agentsRes.success && agentsRes.data) {
        setAgents(agentsRes.data);
      }
    },
    [selectedWidget]
  );

  useEffect(() => {
    loadData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectWidget = (w: WebWidget) => {
    setSelectedWidget(w);
    setFormData(w);
    setError(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const res = await saveWebWidget(formData);
    if (res.success && res.data) {
      await loadData();
      setSelectedWidget(res.data);
      setFormData(res.data);
      toast({
        variant: "success",
        title: "Configuración guardada",
        description: "Configuración de conexión guardada con éxito.",
      });
    } else {
      toast({ variant: "error", title: "Error al guardar", description: res.error });
    }
    setIsSaving(false);
  };

  const handleCreate = async () => {
    setIsSaving(true);
    const res = await saveWebWidget({
      ...formData,
      id: undefined,
    });
    if (res.success && res.data) {
      await loadData();
      setSelectedWidget(res.data);
      setFormData(res.data);
      setIsCreateModalOpen(false);
    } else {
      toast({ variant: "error", title: "Error al crear", description: res.error });
    }
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("¿Estás seguro de eliminar esta configuración de widget?")) return;
    const res = await deleteWebWidget(id);
    if (res.success) {
      await loadData();
      setSelectedWidget(null);
      setFormData({
        name: "",
        agent_id: null,
        welcome_message: "¡Hola! ¿En qué puedo ayudarte hoy?",
        bubble_color: "#25D366",
        bubble_icon: "message-circle",
        status: "ACTIVE",
      });
    }
  };

  const copyEmbedCode = (id: string) => {
    const code = `<script src="${window.location.origin}/api/widget/embed.js?id=${id}" async></script>`;
    navigator.clipboard.writeText(code);
    toast({
      variant: "info",
      title: "Código copiado",
      description: "Código de inserción copiado al portapapeles.",
    });
  };

  return (
    <div className="bg-background text-foreground flex h-[calc(100vh-80px)] flex-col overflow-hidden transition-colors duration-500">
      <div className="bg-card/20 border-border flex items-center justify-between border-b px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 border-primary/20 flex h-12 w-12 items-center justify-center rounded-2xl border">
            <Globe className="text-primary h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Conector Web</h1>
            <p className="text-muted-foreground mt-1 text-xs leading-none font-bold tracking-widest uppercase">
              Conecta tus agentes de IA a burbujas de chat web.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isSaving || !selectedWidget}
            title="Guardar cambios"
            className="bg-primary text-primary-foreground shadow-primary/20 flex h-11 items-center gap-2 rounded-xl px-6 text-[11px] font-black tracking-widest uppercase shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {isSaving ? "Guardando..." : "Guardar Configuración"}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="border-border bg-card/40 flex w-80 flex-col border-r">
          <div className="p-6">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              title="Nueva burbuja de chat"
              className="border-primary/40 text-primary hover:bg-primary/5 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed text-[10px] font-black tracking-widest uppercase transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              Nueva Conexión Web
            </button>
          </div>

          {error && (
            <div className="mx-6 mb-4 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
              <AlertCircle className="mt-0.5 h-4 w-4 text-red-500" />
              <div>
                <p className="text-[10px] font-black tracking-widest text-red-500 uppercase">
                  Error de Conexión
                </p>
                <p className="text-[9px] leading-relaxed font-medium text-red-500/60">{error}</p>
              </div>
            </div>
          )}

          <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-4">
            {widgets.length === 0 && !error && (
              <EmptyState
                size="sm"
                icon={<Globe className="h-10 w-10" />}
                title="Sin conexiones web"
                description="Crea tu primera burbuja de chat para conectar un agente a tu sitio web."
                className="mx-2 mt-2"
              />
            )}
            {widgets.map((w) => (
              <div
                key={w.id}
                onClick={() => handleSelectWidget(w)}
                className={cn(
                  "group cursor-pointer rounded-2xl border p-4 transition-all",
                  selectedWidget?.id === w.id
                    ? "bg-primary/10 border-primary/20"
                    : "bg-card/40 border-border hover:bg-card/60"
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-primary text-[8px] font-black tracking-widest uppercase">
                    {w.status}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(w.id);
                    }}
                    title="Eliminar"
                    className="p-1 opacity-0 transition-all group-hover:opacity-100 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
                <h3 className="text-sm font-bold">{w.name}</h3>
                <p className="text-muted-foreground truncate text-[10px]">
                  {agents.find((a) => a.id === w.agent_id)?.name || "Sin agente vinculado"}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto p-10">
          {selectedWidget ? (
            <div className="mx-auto max-w-4xl space-y-12">
              <div className="grid grid-cols-2 gap-10">
                <div className="space-y-8">
                  <SectionHeader icon={Settings2} title="1. Vincular Agente" />
                  <p className="text-muted-foreground text-[10px] leading-relaxed font-bold tracking-widest uppercase">
                    Selecciona un agente de IA para que atienda esta burbuja web. La IA usará
                    automáticamente las variables que configuraste en el agente.
                  </p>

                  <div className="grid grid-cols-1 gap-3">
                    {agents.length > 0 ? (
                      agents.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => setFormData({ ...formData, agent_id: a.id })}
                          className={cn(
                            "group relative flex cursor-pointer items-center gap-4 overflow-hidden rounded-2xl border p-4 transition-all",
                            formData.agent_id === a.id
                              ? "bg-primary/10 border-primary/40 ring-primary/20 ring-1"
                              : "bg-card/40 border-border hover:border-primary/20"
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-10 w-10 items-center justify-center rounded-xl border transition-all",
                              formData.agent_id === a.id
                                ? "bg-primary border-primary text-white"
                                : "bg-card/40 border-border text-muted-foreground"
                            )}
                          >
                            <Bot className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="truncate text-sm font-bold">{a.name}</h4>
                            <p className="text-muted-foreground truncate text-[10px] font-medium">
                              {a.description || "Sin descripción"}
                            </p>
                          </div>
                          {formData.agent_id === a.id && (
                            <motion.div layoutId="active-check" className="text-primary">
                              <CheckCircle2 className="h-5 w-5" />
                            </motion.div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="space-y-3 rounded-2xl border border-dashed border-white/5 p-8 text-center">
                        <p className="text-[10px] font-bold tracking-widest text-white/20 uppercase">
                          No hay agentes para vincular
                        </p>
                        <Link
                          href="/dashboard/agents"
                          className="text-primary mt-2 block text-[10px] font-black tracking-widest uppercase hover:underline"
                        >
                          Ir a crear un agente primero
                        </Link>
                      </div>
                    )}
                  </div>

                  <SectionHeader icon={Palette} title="2. Apariencia" />
                  <div className="flex items-center gap-6">
                    <div className="flex-1 space-y-2">
                      <label className="text-[10px] font-black tracking-widest text-white/20 uppercase">
                        Color de la Burbuja (Estilo WhatsApp)
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={formData.bubble_color || "#25D366"}
                          onChange={(e) =>
                            setFormData({ ...formData, bubble_color: e.target.value })
                          }
                          title="Color"
                          className="h-10 w-10 cursor-pointer overflow-hidden rounded-lg border-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={formData.bubble_color || ""}
                          onChange={(e) =>
                            setFormData({ ...formData, bubble_color: e.target.value })
                          }
                          title="Hex"
                          className="bg-card/40 border-border text-muted-foreground h-10 flex-1 rounded-lg border px-3 font-mono text-[10px]"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <SectionHeader icon={Smartphone} title="3. Integración Meta (WhatsApp)" />
                  <p className="text-[10px] leading-relaxed font-bold tracking-widest text-white/30 uppercase">
                    Cuando el usuario deje su teléfono, se iniciará una conversación automática vía
                    Meta API.
                  </p>
                  <div className="bg-card/20 border-border space-y-4 rounded-2xl border p-6">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-[10px] font-black tracking-tight uppercase">
                        Estado de Conexión Meta
                      </span>
                      <span className="flex items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-black text-emerald-500 uppercase">
                        <CheckCircle2 className="h-3 w-3" /> Conectado
                      </span>
                    </div>
                    <div className="space-y-2">
                      <label className="text-muted-foreground/40 text-[9px] font-black tracking-widest uppercase">
                        Plantilla de Handover
                      </label>
                      <select
                        title="Plantilla"
                        className="bg-card/40 border-border text-muted-foreground/60 h-10 w-full rounded-lg border px-3 text-[10px] font-bold"
                      >
                        <option>bienvenida_web_widget</option>
                        <option>seguimiento_prospecto</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-muted-foreground/40 text-[10px] font-black tracking-widest uppercase">
                      Mensaje de Bienvenida
                    </label>
                    <textarea
                      value={formData.welcome_message || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, welcome_message: e.target.value })
                      }
                      title="Bienvenida"
                      className="bg-card/40 border-border text-foreground focus:ring-primary/20 h-32 w-full resize-none rounded-2xl border p-4 text-sm font-medium transition-all focus:ring-2 focus:outline-none"
                    />
                  </div>

                  <SectionHeader icon={Code} title="4. Código de Inserción" />
                  <div className="bg-card/40 border-border space-y-4 rounded-[32px] border p-8">
                    <p className="text-muted-foreground text-[10px] leading-relaxed font-bold tracking-widest uppercase">
                      Copia este script antes de la etiqueta &lt;/body&gt; de tu sitio web.
                    </p>
                    <div className="group relative">
                      <pre className="bg-card/20 border-border text-primary/60 overflow-x-auto rounded-2xl border p-5 font-mono text-[10px] whitespace-pre-wrap">
                        {`<script src="${typeof window !== "undefined" ? window.location.origin : ""}/api/widget/embed.js?id=${selectedWidget.id}" async></script>`}
                      </pre>
                      <button
                        onClick={() => copyEmbedCode(selectedWidget.id)}
                        title="Copiar"
                        className="bg-card/40 hover:bg-card/60 absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-xl transition-all"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center p-10">
              <EmptyState
                size="lg"
                icon={<Globe className="h-12 w-12" />}
                title="Sin widgets configurados"
                description="Crea una nueva conexión web para vincular un agente de IA a la burbuja de chat de tu sitio."
              />
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-background/90 absolute inset-0 backdrop-blur-xl"
              onClick={() => setIsCreateModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border-border relative w-full max-w-md space-y-8 rounded-[40px] border p-10"
            >
              <h2 className="text-2xl font-black tracking-tight uppercase">Nueva Burbuja</h2>
              <InputField
                label="Nombre Identificador (ej: Landing Web)"
                value={formData.name || ""}
                onChange={(v) => setFormData({ ...formData, name: v })}
              />
              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="bg-card/40 h-14 flex-1 rounded-2xl text-[11px] font-black tracking-widest uppercase"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreate}
                  className="bg-primary h-14 flex-1 rounded-2xl text-[11px] font-black tracking-widest text-white uppercase"
                >
                  Crear Conexión
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
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
      <h3 className="text-muted-foreground/60 text-[12px] font-black tracking-[0.2em] uppercase">
        {title}
      </h3>
    </div>
  );
}

function InputField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-muted-foreground/40 text-[10px] font-black tracking-widest uppercase">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={label}
        className="bg-card/40 border-border text-foreground focus:ring-primary/20 h-12 w-full rounded-xl border px-4 text-sm font-bold transition-all focus:ring-2 focus:outline-none"
      />
    </div>
  );
}

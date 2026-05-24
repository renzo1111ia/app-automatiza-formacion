import { useState, useEffect } from "react";
import { X, User, Phone, Mail, Globe, Save, Loader2, Target, Megaphone } from "lucide-react";
import { createLead, getPrograms } from "@/lib/actions/calls";
import { getCampaigns } from "@/lib/actions/campanas";
import type { Programa, Campana } from "@/types/database";
import { toast } from "@/components/ui/toast";

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
    Promise.all([getPrograms(), getCampaigns()]).then(([progs, camps]) => {
      setPrograms(progs);
      setCampaigns(camps);
    });
  }, []);

  // ... (rest of handleSubmit remains same)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.nombre || !formData.telefono) {
      toast({
        variant: "warning",
        title: "Campos obligatorios",
        description: "Nombre y Teléfono son obligatorios",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await createLead(formData);
      if (res.success) {
        onSuccess();
        onClose();
      } else {
        toast({ variant: "error", title: "Error al crear lead", description: res.error });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: "error", title: "Error inesperado" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-md duration-300">
      <div className="bg-card border-border animate-in zoom-in-95 relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-[32px] border shadow-2xl duration-300">
        {/* Header */}
        <div className="border-border bg-muted/30 flex items-center justify-between border-b p-8">
          <div className="flex items-center gap-4">
            <div className="bg-primary text-primary-foreground shadow-primary/20 flex h-12 w-12 items-center justify-center rounded-2xl shadow-lg">
              <User className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-foreground text-xl font-black tracking-tight uppercase">
                Agregar Nuevo Lead
              </h2>
              <p className="text-muted-foreground mt-1 text-xs font-bold tracking-wider uppercase">
                Ingresa los datos del prospecto manualmente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar modal"
            className="hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 rounded-2xl border border-transparent p-3 transition-all"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={handleSubmit}
          className="custom-scrollbar flex-1 space-y-8 overflow-y-auto p-8"
        >
          {/* Sección: Información Personal */}
          <div className="space-y-4">
            <h3 className="text-primary flex items-center gap-2 px-1 text-[10px] font-black tracking-[0.2em] uppercase">
              <User className="h-3 w-3" /> Información Personal
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase">
                  Nombre *
                </label>
                <div className="relative">
                  <User className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <input
                    required
                    type="text"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full rounded-xl border py-3 pr-4 pl-10 text-sm font-bold transition-all outline-none focus:ring-4"
                    placeholder="Ej: Juan"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase">
                  Apellido
                </label>
                <input
                  type="text"
                  value={formData.apellido}
                  onChange={(e) => setFormData({ ...formData, apellido: e.target.value })}
                  className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full rounded-xl border px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-4"
                  placeholder="Ej: Pérez"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase">
                  Teléfono *
                </label>
                <div className="relative">
                  <Phone className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <input
                    required
                    type="tel"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full rounded-xl border py-3 pr-4 pl-10 text-sm font-bold transition-all outline-none focus:ring-4"
                    placeholder="+34 600 000 000"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase">
                  Email
                </label>
                <div className="relative">
                  <Mail className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full rounded-xl border py-3 pr-4 pl-10 text-sm font-bold transition-all outline-none focus:ring-4"
                    placeholder="juan@ejemplo.com"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sección: Clasificación y Origen */}
          <div className="space-y-4">
            <h3 className="text-primary flex items-center gap-2 px-1 text-[10px] font-black tracking-[0.2em] uppercase">
              <Globe className="h-3 w-3" /> Clasificación y Origen
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase">
                  País
                </label>
                <input
                  type="text"
                  value={formData.pais}
                  onChange={(e) => setFormData({ ...formData, pais: e.target.value })}
                  className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full rounded-xl border px-4 py-3 text-sm font-bold lowercase transition-all outline-none focus:ring-4"
                  placeholder="Ej: españa"
                />
              </div>
              <div className="space-y-2">
                <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase">
                  Tipo de Lead
                </label>
                <select
                  value={formData.tipo_lead}
                  onChange={(e) => setFormData({ ...formData, tipo_lead: e.target.value })}
                  title="Seleccionar tipo de lead"
                  className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-4"
                >
                  <option value="nuevo">Nuevo</option>
                  <option value="localizable">Localizable</option>
                  <option value="ilocalizable">Ilocalizable</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase">
                  Origen (Source)
                </label>
                <input
                  type="text"
                  value={formData.origen}
                  onChange={(e) => setFormData({ ...formData, origen: e.target.value })}
                  className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full rounded-xl border px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-4"
                  placeholder="Ej: facebook"
                />
              </div>
              <div className="space-y-2">
                <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase">
                  Campaña (Campaign)
                </label>
                <div className="relative">
                  <Megaphone className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                  <select
                    value={formData.campana}
                    onChange={(e) => setFormData({ ...formData, campana: e.target.value })}
                    title="Seleccionar campaña"
                    className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full cursor-pointer rounded-xl border py-3 pr-4 pl-10 text-sm font-bold transition-all outline-none focus:ring-4"
                  >
                    <option value="">Sin campaña asignada</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.nombre}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Sección: Programa Académico */}
          <div className="space-y-4 pb-4">
            <h3 className="text-primary flex items-center gap-2 px-1 text-[10px] font-black tracking-[0.2em] uppercase">
              <Target className="h-3 w-3" /> Programa de Interés
            </h3>
            <div className="space-y-2">
              <label className="text-muted-foreground ml-1 text-[10px] font-black tracking-widest uppercase">
                Seleccionar Programa
              </label>
              <select
                value={formData.id_programa}
                onChange={(e) => setFormData({ ...formData, id_programa: e.target.value })}
                title="Seleccionar programa"
                className="bg-muted/30 border-border focus:ring-primary/10 focus:border-primary w-full cursor-pointer rounded-xl border px-4 py-3 text-sm font-bold transition-all outline-none focus:ring-4"
              >
                <option value="">Sin programa asignado</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="border-border bg-muted/30 flex justify-end gap-3 border-t p-8">
          <button
            type="button"
            onClick={onClose}
            className="bg-card border-border text-muted-foreground hover:bg-muted hover:text-card-foreground rounded-2xl border px-6 py-3 text-sm font-black transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="bg-primary hover:bg-primary/90 shadow-primary/20 flex items-center gap-2 rounded-2xl px-10 py-3 text-sm font-black text-white shadow-xl transition-all disabled:opacity-50"
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

"use client";

import React, { useState, useEffect } from "react";
import {
  Database,
  Upload,
  FileText,
  Trash2,
  Search,
  Plus,
  FileUp,
  ShieldCheck,
  Cloud,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  getKnowledgeBase,
  uploadKnowledgeDocument,
  deleteKnowledgeDocument,
} from "@/lib/actions/knowledge";
import type { KnowledgeItem } from "@/types/database";
import { toast } from "@/components/ui/toast";

export default function KnowledgeBasePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form state for multiple files
  const [files, setFiles] = useState<File[]>([]);
  const [kbName, setKbName] = useState("");
  const [description, setDescription] = useState("");
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  const loadItems = async () => {
    setLoading(true);
    const res = await getKnowledgeBase();
    if (res.success && res.data) {
      setItems(res.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      const res = await getKnowledgeBase();
      if (mounted && res.success && res.data) {
        setItems(res.data);
      }
      if (mounted) setLoading(false);
    };
    init();
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    let successCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });

      const formData = new FormData();
      formData.append("file", file);

      // If bulk uploading (more than 1 file), append filename to custom name to avoid confusion
      const finalName =
        files.length > 1 && kbName ? `${kbName} (${file.name})` : kbName || file.name;

      formData.append("name", finalName);
      formData.append("description", description);

      const res = await uploadKnowledgeDocument(formData);
      if (res.success) {
        successCount++;
      } else {
        errors.push(`${file.name}: ${res.error}`);
      }
    }

    if (successCount > 0) {
      await loadItems();
      if (errors.length === 0) {
        setIsUploadModalOpen(false);
        setFiles([]);
        setKbName("");
        setDescription("");
      } else {
        toast({
          variant: "warning",
          title: "Subida parcial",
          description: `Se subieron ${successCount} archivos, pero hubo errores en algunos: ${errors.join(", ")}`,
        });
      }
    } else {
      toast({
        variant: "error",
        title: "Error al subir documentos",
        description: errors.join(", "),
      });
    }
    setUploading(false);
  };

  const handleDelete = async (id: string, fileName: string) => {
    if (!confirm(`¿Estás seguro de eliminar "${fileName}" de la base de conocimiento?`)) return;

    const res = await deleteKnowledgeDocument(id);
    if (res.success) {
      await loadItems();
    } else {
      toast({ variant: "error", title: "Error al eliminar", description: res.error });
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Group items by name for the UI
  const groupedItems = items.reduce(
    (acc, item) => {
      if (!acc[item.name]) {
        acc[item.name] = {
          name: item.name,
          description: item.description,
          ids: [item.id],
          count: 1,
          created_at: item.created_at,
          file_keys: [item.file_key],
        };
      } else {
        acc[item.name].ids.push(item.id);
        acc[item.name].file_keys.push(item.file_key);
        acc[item.name].count += 1;
        // Keep the newest description and date
        if (new Date(item.created_at) > new Date(acc[item.name].created_at)) {
          acc[item.name].description = item.description;
          acc[item.name].created_at = item.created_at;
        }
      }
      return acc;
    },
    {} as Record<
      string,
      {
        name: string;
        description: string | null;
        ids: string[];
        count: number;
        created_at: string;
        file_keys: string[];
      }
    >
  );

  const displayGroups = Object.values(groupedItems)
    .filter(
      (group) =>
        group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        group.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="bg-background text-foreground selection:bg-primary/30 flex h-[calc(100vh-80px)] flex-col overflow-hidden transition-colors duration-500">
      {/* Header Area */}
      <div className="bg-card/20 border-border flex items-center justify-between border-b px-8 py-6">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
            <Database className="h-6 w-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">Base de Conocimiento</h1>
            <p className="text-muted-foreground mt-1 text-xs leading-none font-bold tracking-widest uppercase">
              Gestiona los documentos PDF que entrenan a tus agentes.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="group relative">
            <Search className="text-muted-foreground/40 group-focus-within:text-primary absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 transition-colors" />
            <input
              type="text"
              placeholder="Buscar documentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-card/40 border-border focus:border-primary/40 focus:ring-primary/10 text-foreground h-11 w-64 rounded-xl border pr-6 pl-12 text-sm transition-all outline-none focus:ring-4"
            />
          </div>
          <button
            onClick={() => {
              setFiles([]);
              setIsUploadModalOpen(true);
            }}
            className="flex h-11 items-center gap-2 rounded-xl bg-emerald-500 px-6 text-[11px] font-black tracking-widest text-white uppercase shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Añadir PDF
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center space-y-4 opacity-50">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-[10px] font-black tracking-tighter uppercase">
              Cargando biblioteca...
            </p>
          </div>
        ) : displayGroups.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            {searchQuery ? (
              <EmptyState
                size="lg"
                icon={<Search className="h-12 w-12" />}
                title="Sin coincidencias"
                description="No encontramos documentos que coincidan con tu búsqueda. Prueba con otro término."
              />
            ) : (
              <EmptyState
                size="lg"
                icon={<Database className="h-12 w-12" />}
                title="Sin documentos cargados"
                description="Sube PDF, DOCX o TXT para alimentar la base de conocimiento de tu agente."
                action={
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="flex h-10 items-center gap-2 rounded-xl bg-emerald-500 px-5 text-xs font-black tracking-widest text-white uppercase shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
                  >
                    <Plus className="h-4 w-4" /> Añadir primer documento
                  </button>
                }
              />
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {displayGroups.map((group) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={group.name}
                className="group bg-card/40 border-border hover:bg-card/60 relative rounded-[32px] border p-6 transition-all hover:border-emerald-500/20"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                    <Database className="h-6 w-6" />
                  </div>
                  <div className="flex gap-2 opacity-0 transition-all group-hover:opacity-100">
                    <button
                      onClick={async () => {
                        if (
                          confirm(
                            `¿Eliminar la base "${group.name}" y sus ${group.count} archivos?`
                          )
                        ) {
                          setLoading(true);
                          for (const id of group.ids) {
                            await deleteKnowledgeDocument(id);
                          }
                          await loadItems();
                        }
                      }}
                      className="text-muted-foreground/40 rounded-xl p-2 transition-all hover:bg-red-500/10 hover:text-red-400"
                      title={`Eliminar toda la base ${group.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-foreground/90 group-hover:text-foreground line-clamp-1 text-base font-bold transition-colors">
                    {group.name}
                  </h3>
                  <p className="text-muted-foreground line-clamp-2 h-8 text-xs leading-snug">
                    {group.description || "Sin descripción proporcionada."}
                  </p>
                </div>
                <div className="border-border mt-6 flex items-center justify-between border-t pt-6">
                  <span className="rounded-full border border-emerald-500/10 bg-emerald-500/5 px-3 py-1 text-[10px] font-black tracking-widest text-emerald-500/60 uppercase">
                    {group.count} {group.count === 1 ? "Archivo" : "Archivos"}
                  </span>
                  <span className="text-muted-foreground/20 flex items-center gap-1.5 text-[10px] font-bold">
                    <ShieldCheck className="h-3 w-3" />
                    Indexado
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── UPLOAD MODAL ── */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="bg-background/80 absolute inset-0 backdrop-blur-sm"
              onClick={() => !uploading && setIsUploadModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border-border relative max-h-[90vh] w-full max-w-lg space-y-8 overflow-y-auto rounded-[40px] border p-10 shadow-2xl"
            >
              <div className="space-y-4 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-500/20 bg-emerald-500/10">
                  <FileUp className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-3xl font-black tracking-tight uppercase">
                  Sincronizar Conocimiento
                </h3>
                <p className="text-muted-foreground px-4 text-sm leading-relaxed font-medium">
                  Selecciona varios PDFs. Se guardarán en MinIO y se indexarán automáticamente.
                </p>
              </div>

              <form onSubmit={handleUpload} className="space-y-6">
                <div className="space-y-3">
                  <label className="text-muted-foreground/40 ml-4 text-[10px] font-black tracking-widest uppercase">
                    Archivos PDF
                  </label>
                  <div
                    className={cn(
                      "relative flex h-32 flex-col items-center justify-center gap-2 overflow-hidden rounded-[24px] border-2 border-dashed transition-all",
                      files.length > 0
                        ? "border-emerald-500/50 bg-emerald-500/5"
                        : "border-border hover:border-primary/20 bg-card/40"
                    )}
                  >
                    <input
                      type="file"
                      multiple
                      accept=".pdf"
                      title="Subir archivos PDF"
                      disabled={uploading}
                      className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                      onChange={(e) => {
                        if (e.target.files) {
                          setFiles(Array.from(e.target.files));
                        }
                      }}
                    />
                    <Upload
                      className={cn(
                        "mb-1 h-8 w-8",
                        files.length > 0 ? "text-emerald-400" : "text-muted-foreground/20"
                      )}
                    />
                    <p className="text-muted-foreground text-[10px] font-bold tracking-tight uppercase">
                      {files.length > 0
                        ? `${files.length} archivos seleccionados`
                        : "Click o arrastra varios archivos (PDF máx 10MB)"}
                    </p>
                  </div>

                  {/* Selected Files List */}
                  {files.length > 0 && (
                    <div className="custom-scrollbar mt-4 max-h-32 space-y-2 overflow-y-auto px-2">
                      {files.map((f, i) => (
                        <div
                          key={i}
                          className="bg-card/40 border-border flex items-center justify-between rounded-xl border p-3"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <FileText className="h-4 w-4 flex-shrink-0 text-emerald-500" />
                            <span className="text-foreground/80 truncate text-xs font-bold">
                              {f.name}
                            </span>
                          </div>
                          {!uploading && (
                            <button
                              type="button"
                              title={`Eliminar ${f.name}`}
                              onClick={() => removeFile(i)}
                              className="text-white/20 transition-colors hover:text-red-400"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="text-muted-foreground/40 ml-4 text-[10px] font-black tracking-widest uppercase">
                    Nombre de la Base (Opcional)
                  </label>
                  <input
                    type="text"
                    value={kbName}
                    disabled={uploading}
                    onChange={(e) => setKbName(e.target.value)}
                    className="bg-card/40 border-border text-foreground h-12 w-full rounded-2xl border px-4 text-sm font-medium transition-all outline-none focus:border-emerald-500/40 disabled:opacity-50"
                    placeholder="Ej: Manual de Ventas 2025..."
                  />
                  <p className="text-muted-foreground/40 ml-4 text-[8px] italic">
                    Si se deja vacío, se usará el nombre del archivo PDF.
                  </p>
                </div>

                <div className="space-y-3">
                  <label className="text-muted-foreground/40 ml-4 text-[10px] font-black tracking-widest uppercase">
                    Descripción General (Opcional)
                  </label>
                  <textarea
                    value={description}
                    disabled={uploading}
                    onChange={(e) => setDescription(e.target.value)}
                    className="bg-card/40 border-border text-foreground h-20 w-full resize-none rounded-2xl border p-4 text-sm font-medium transition-all outline-none focus:border-emerald-500/40 disabled:opacity-50"
                    placeholder="Descripción común para este lote de documentos..."
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => setIsUploadModalOpen(false)}
                    className="bg-card/40 border-border hover:bg-card/60 text-foreground h-14 flex-1 rounded-2xl border text-[10px] font-black font-bold tracking-widest uppercase transition-all disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || files.length === 0}
                    className="flex h-14 flex-1 flex-col items-center justify-center rounded-2xl bg-emerald-500 text-[10px] font-black tracking-widest text-white uppercase shadow-xl shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                  >
                    {uploading ? (
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          <span>Subiendo...</span>
                        </div>
                        <span className="mt-1 text-[8px] opacity-60">
                          {uploadProgress.current} de {uploadProgress.total}
                        </span>
                      </div>
                    ) : (
                      "Completar Carga"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

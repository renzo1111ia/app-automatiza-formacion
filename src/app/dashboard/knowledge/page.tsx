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
    X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { getKnowledgeBase, uploadKnowledgeDocument, deleteKnowledgeDocument, KnowledgeItem } from "@/lib/actions/knowledge";

export default function KnowledgeBasePage() {
    const [itmes, setItems] = useState<KnowledgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Form state for multiple files
    const [files, setFiles] = useState<File[]>([]);
    const [description, setDescription] = useState("");
    const [uploadProgress, setUploadProgress] = useState<{current: number, total: number}>({current: 0, total: 0});

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
        return () => { mounted = false; };
    }, []);

    const handleUpload = async (e: React.FormEvent) => {
        e.preventDefault();
        if (files.length === 0) return;

        setUploading(true);
        setUploadProgress({ current: 0, total: files.length });

        let successCount = 0;
        let errors: string[] = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            setUploadProgress({ current: i + 1, total: files.length });

            const formData = new FormData();
            formData.append("file", file);
            formData.append("name", file.name); // Using filename as default name
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
                setDescription("");
            } else {
                alert(`Se subieron ${successCount} archivos, pero hubo errores en algunos:\n${errors.join('\n')}`);
            }
        } else {
            alert("Error al subir los documentos:\n" + errors.join('\n'));
        }
        setUploading(false);
    };

    const handleDelete = async (id: string, fileName: string) => {
        if (!confirm(`¿Estás seguro de eliminar "${fileName}" de la base de conocimiento?`)) return;
        
        const res = await deleteKnowledgeDocument(id);
        if (res.success) {
            await loadItems();
        } else {
            alert("Error al eliminar: " + res.error);
        }
    };

    const removeFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const filteredItems = itmes.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-slate-950 text-white selection:bg-primary/30">
            {/* Header Area */}
            <div className="flex items-center justify-between px-8 py-6 bg-white/[0.02] border-b border-white/5">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                        <Database className="h-6 w-6 text-emerald-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black uppercase tracking-tight">Base de Conocimiento</h1>
                        <p className="text-xs text-white/40 font-bold uppercase tracking-widest leading-none mt-1">
                            Gestiona los documentos PDF que entrenan a tus agentes.
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 group-focus-within:text-primary transition-colors" />
                        <input 
                            type="text"
                            placeholder="Buscar documentos..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl pl-12 pr-6 h-11 text-sm outline-none focus:border-primary/40 focus:ring-4 focus:ring-primary/10 transition-all w-64"
                        />
                    </div>
                    <button 
                        onClick={() => {
                            setFiles([]);
                            setIsUploadModalOpen(true);
                        }}
                        className="flex items-center gap-2 h-11 px-6 bg-emerald-500 text-white font-black uppercase tracking-widest text-[11px] rounded-xl shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        <Plus className="h-4 w-4" />
                        Añadir PDF
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                        <Loader2 className="h-8 w-8 animate-spin" />
                        <p className="text-[10px] font-black uppercase tracking-tighter">Cargando biblioteca...</p>
                    </div>
                ) : filteredItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full space-y-6">
                        <div className="h-24 w-24 bg-white/5 rounded-[40px] flex items-center justify-center border border-dashed border-white/10">
                            <Cloud className="h-10 w-10 text-white/10" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-bold uppercase tracking-tight">Tu biblioteca está vacía</h3>
                            <p className="text-sm text-white/30 max-w-xs mx-auto mt-2 font-medium">Sube los PDFs detallados de tus cursos para que la IA pueda responder con precisión.</p>
                        </div>
                        <button 
                            onClick={() => setIsUploadModalOpen(true)}
                            className="h-12 px-8 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all font-bold"
                        >
                            Subir mi primer archivo
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6">
                        {filteredItems.map((item) => (
                            <motion.div 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                key={item.id}
                                className="group relative bg-white/[0.02] border border-white/5 rounded-[32px] p-6 hover:bg-white/[0.04] hover:border-emerald-500/20 transition-all"
                            >
                                <div className="flex items-start justify-between mb-4">
                                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                                        <FileText className="h-6 w-6" />
                                    </div>
                                    <button 
                                        onClick={() => handleDelete(item.id, item.name)}
                                        className="p-2 rounded-xl text-white/10 hover:text-red-400 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                                        title={`Eliminar ${item.name}`}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="font-bold text-base text-white/90 group-hover:text-white transition-colors line-clamp-1">{item.name}</h3>
                                    <p className="text-xs text-white/30 line-clamp-2 h-8 leading-snug">
                                        {item.description || "Sin descripción proporcionada."}
                                    </p>
                                </div>
                                <div className="mt-6 pt-6 border-t border-white/5 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-white/10">ID: {item.id.split('-')[0].toUpperCase()}</span>
                                    <span className="text-[10px] font-bold text-emerald-400/60 flex items-center gap-1.5">
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
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                            onClick={() => !uploading && setIsUploadModalOpen(false)}
                        />
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-[40px] p-10 shadow-2xl space-y-8 max-h-[90vh] overflow-y-auto"
                        >
                            <div className="text-center space-y-4">
                                <div className="h-16 w-16 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
                                    <FileUp className="h-8 w-8 text-emerald-500" />
                                </div>
                                <h3 className="text-3xl font-black uppercase tracking-tight">Sincronizar Conocimiento</h3>
                                <p className="text-white/40 text-sm font-medium leading-relaxed px-4">
                                    Selecciona varios PDFs. Se guardarán en MinIO y se indexarán automáticamente.
                                </p>
                            </div>

                            <form onSubmit={handleUpload} className="space-y-6">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-4">Archivos PDF</label>
                                    <div className={cn(
                                        "relative h-32 border-2 border-dashed rounded-[24px] transition-all flex flex-col items-center justify-center gap-2 overflow-hidden",
                                        files.length > 0 ? "border-emerald-500/50 bg-emerald-500/5" : "border-white/10 hover:border-white/20 bg-white/[0.02]"
                                    )}>
                                        <input 
                                            type="file"
                                            multiple
                                            accept=".pdf"
                                            title="Subir archivos PDF"
                                            disabled={uploading}
                                            className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                            onChange={(e) => {
                                                if (e.target.files) {
                                                    setFiles(Array.from(e.target.files));
                                                }
                                            }}
                                        />
                                        <Upload className={cn("h-8 w-8 mb-1", files.length > 0 ? "text-emerald-400" : "text-white/10")} />
                                        <p className="text-[10px] font-bold uppercase tracking-tight">
                                            {files.length > 0 ? `${files.length} archivos seleccionados` : "Click o arrastra varios archivos (PDF máx 10MB)"}
                                        </p>
                                    </div>
                                    
                                    {/* Selected Files List */}
                                    {files.length > 0 && (
                                        <div className="max-h-32 overflow-y-auto space-y-2 mt-4 px-2 custom-scrollbar">
                                            {files.map((f, i) => (
                                                <div key={i} className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-3 overflow-hidden">
                                                        <FileText className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                        <span className="text-xs font-bold truncate opacity-80">{f.name}</span>
                                                    </div>
                                                    {!uploading && (
                                                        <button 
                                                            type="button"
                                                            title={`Eliminar ${f.name}`}
                                                            onClick={() => removeFile(i)}
                                                            className="text-white/20 hover:text-red-400 transition-colors"
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
                                    <label className="text-[10px] font-black uppercase tracking-widest text-white/30 ml-4">Descripción General (Opcional)</label>
                                    <textarea 
                                        value={description}
                                        disabled={uploading}
                                        onChange={(e) => setDescription(e.target.value)}
                                        className="w-full h-20 bg-white/5 border border-white/10 rounded-2xl p-4 text-sm font-medium focus:border-emerald-500/40 outline-none transition-all resize-none disabled:opacity-50"
                                        placeholder="Descripción común para este lote de documentos..."
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button 
                                        type="button"
                                        disabled={uploading}
                                        onClick={() => setIsUploadModalOpen(false)}
                                        className="flex-1 h-14 rounded-2xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest hover:bg-white/10 transition-all font-bold disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={uploading || files.length === 0}
                                        className="flex-1 h-14 rounded-2xl bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex flex-col items-center justify-center"
                                    >
                                        {uploading ? (
                                            <div className="flex flex-col items-center">
                                                <div className="flex items-center gap-2">
                                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                                    <span>Subiendo...</span>
                                                </div>
                                                <span className="text-[8px] mt-1 opacity-60">{uploadProgress.current} de {uploadProgress.total}</span>
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


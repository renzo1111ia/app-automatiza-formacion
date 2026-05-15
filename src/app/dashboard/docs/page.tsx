"use client";

import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
    Book, ChevronRight, Home, Terminal, Layers, 
    ShieldCheck, Zap, BookOpen, Search,
    Cpu, MessageSquare, Database, Activity,
    Scale, UserCheck, Layout, GitBranch,
    ArrowUpRight, Info, Brain
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

// Fases y Tomos mapeados exactamente del Dossier Maestro v5.0 (26 Tomos)
const DOC_STRUCTURE = [
    {
        phase: "FASE I: Cimientos y Estrategia",
        color: "from-blue-600 to-indigo-600",
        items: [
            { id: "1", title: "Visión Técnica", icon: <Layout className="h-4 w-4" /> },
            { id: "2", title: "Arquitectura Backend", icon: <Database className="h-4 w-4" /> },
            { id: "3", title: "Ingeniería de Resiliencia", icon: <ShieldCheck className="h-4 w-4" /> },
            { id: "4", title: "Centro de Comando (UI)", icon: <Cpu className="h-4 w-4" /> },
            { id: "5", title: "Referencia Técnica", icon: <Terminal className="h-4 w-4" /> },
        ]
    },
    {
        phase: "FASE II: Operación y Seguridad",
        color: "from-emerald-500 to-teal-600",
        items: [
            { id: "6", title: "Seguridad y Soberanía", icon: <ShieldCheck className="h-4 w-4" /> },
            { id: "7", title: "Estrategias de Conversión", icon: <Zap className="h-4 w-4" /> },
            { id: "8", title: "Manual de Supervivencia", icon: <Activity className="h-4 w-4" /> },
            { id: "9", title: "Roadmap y Handover", icon: <GitBranch className="h-4 w-4" /> },
            { id: "10", title: "Anexos de Onboarding", icon: <Layers className="h-4 w-4" /> },
        ]
    },
    {
        phase: "FASE III: Inteligencia y Cualificación",
        color: "from-purple-500 to-pink-600",
        items: [
            { id: "11", title: "Motor de Cualificación", icon: <Brain className="h-4 w-4" /> },
            { id: "12", title: "Contratos de API", icon: <Terminal className="h-4 w-4" /> },
            { id: "13", title: "Plan de Contingencia", icon: <Activity className="h-4 w-4" /> },
            { id: "14", title: "Worker Engine (BullMQ)", icon: <Cpu className="h-4 w-4" /> },
            { id: "15", title: "Gobernanza de IA", icon: <MessageSquare className="h-4 w-4" /> },
        ]
    },
    {
        phase: "FASE IV: Excelencia y Entrega",
        color: "from-orange-500 to-amber-600",
        items: [
            { id: "16", title: "GDPR & Compliance", icon: <Scale className="h-4 w-4" /> },
            { id: "17", title: "Baja Latencia (<800ms)", icon: <Zap className="h-4 w-4" /> },
            { id: "18", title: "Diccionario de Variables", icon: <BookOpen className="h-4 w-4" /> },
            { id: "19", title: "Anatomía del Agente", icon: <UserCheck className="h-4 w-4" /> },
            { id: "20", title: "Enciclopedia de Nodos", icon: <Layout className="h-4 w-4" /> },
            { id: "21", title: "Glosario de Módulos", icon: <Info className="h-4 w-4" /> },
            { id: "22", title: "Guía Command Center", icon: <Layout className="h-4 w-4" /> },
            { id: "23", title: "Ciclo de Vida del Dato", icon: <Database className="h-4 w-4" /> },
            { id: "24", title: "Optimización de Costes", icon: <Activity className="h-4 w-4" /> },
            { id: "25", title: "Handover Humano", icon: <UserCheck className="h-4 w-4" /> },
            { id: "26", title: "Blueprint Maestro", icon: <Layers className="h-4 w-4" /> },
        ]
    }
];

export default function DocsPage() {
    const [content, setContent] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeSection, setActiveSection] = useState("1");
    const [isLoading, setIsLoading] = useState(true);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    useEffect(() => {
        const fetchContent = async () => {
            try {
                const response = await fetch('/api/docs/content');
                const data = await response.json();
                setContent(data.content);
            } catch (error) {
                console.error("Error loading docs:", error);
                setContent("# Error\nNo se pudo cargar la documentación maestra.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchContent();
    }, []);

    // Filtrar contenido por la sección activa (buscando el heading ## SECCIÓN X.)
    const displayedContent = useMemo(() => {
        if (!content) return "";
        
        // 1. Intentar por separadores ---
        const sections = content.split(/\n---\n/);
        const sectionPattern = new RegExp(`## (SECCIÓN )?${activeSection}\\.`, 'i');
        
        let targetSection = sections.find(s => sectionPattern.test(s));

        // 2. Si no se encuentra por separadores, buscar en todo el texto (Fallback)
        if (!targetSection) {
            const allLines = content.split('\n');
            const startIndex = allLines.findIndex(line => sectionPattern.test(line));
            
            if (startIndex !== -1) {
                // Buscamos hasta el siguiente encabezado o el final
                const nextSectionIndex = allLines.findIndex((line, idx) => idx > startIndex && line.startsWith('## SECCIÓN'));
                targetSection = allLines.slice(startIndex, nextSectionIndex !== -1 ? nextSectionIndex : undefined).join('\n');
            }
        }

        // Si estamos en la sección "1" y no hay match (ej. el intro), mostramos el bloque 0 (Intro)
        return targetSection || sections[0];
    }, [content, activeSection]);

    // Encontrar el título actual para el breadcrumb
    const currentItem = useMemo(() => {
        for (const phase of DOC_STRUCTURE) {
            const item = phase.items.find(i => i.id === activeSection);
            if (item) return { phase: phase.phase, title: item.title };
        }
        return { phase: "Documentación", title: "Introducción" };
    }, [activeSection]);

    const scrollToTop = () => {
        const container = document.getElementById('docs-content-area');
        if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#020617] text-slate-900 dark:text-slate-100 selection:bg-indigo-500/30">
            {/* Nav Superior Glassmorphism */}
            <div className="sticky top-0 z-[60] bg-white/80 dark:bg-slate-950/80 backdrop-blur-2xl border-b border-slate-200 dark:border-slate-800 px-6 py-4">
                <div className="max-w-[1500px] mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="h-12 w-12 bg-grad-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-primary/40 group cursor-pointer overflow-hidden relative">
                            <motion.div 
                                className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-500"
                            />
                            <Book className="h-6 w-6 text-white relative z-10" />
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                                <h1 className="text-[10px] font-black tracking-[0.3em] uppercase text-indigo-500 dark:text-indigo-400">Knowledge Base v5.0</h1>
                                <span className="h-1 w-1 rounded-full bg-slate-300" />
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Enterprise Edition</span>
                            </div>
                            <p className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                                {currentItem.title}
                                <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                                    Certificado
                                </span>
                            </p>
                        </div>
                    </div>

                    <div className="hidden md:flex items-center gap-6">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Status</span>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-xs font-bold">Sincronizado</span>
                            </div>
                        </div>
                        <div className="h-10 w-[1px] bg-slate-200 dark:border-slate-800" />
                        <Link 
                            href="/dashboard"
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-xl font-bold text-sm transition-all border border-slate-200 dark:border-slate-800"
                        >
                            <Home className="h-4 w-4 text-slate-500" />
                            Dashboard
                        </Link>
                    </div>
                </div>
            </div>

            <div className="max-w-[1500px] mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-10">
                
                {/* SIDEBAR DE FASES Y TOMOS (MÁS ORDENADO) */}
                <aside className="space-y-8 sticky top-32 h-fit max-h-[calc(100vh-160px)] overflow-y-auto pr-2 custom-scrollbar pb-10">
                    <div className="relative mb-8">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar en el Dossier..."
                            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-medium focus:ring-2 ring-indigo-500/20 transition-all shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {DOC_STRUCTURE.map((phase) => (
                        <div key={phase.phase} className="bg-white/40 dark:bg-slate-900/40 rounded-[2rem] p-5 border border-slate-200/60 dark:border-slate-800/60 space-y-4">
                            <div className="flex items-center gap-3 px-1">
                                <div className={`w-1.5 h-5 rounded-full bg-gradient-to-b ${phase.color} shadow-lg`} />
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 leading-tight">
                                    {phase.phase}
                                </h3>
                            </div>
                            <nav className="space-y-1">
                                {phase.items.map((item) => (
                                    <button 
                                        key={item.id} 
                                        onClick={() => {
                                            setActiveSection(item.id);
                                            scrollToTop();
                                        }}
                                        className={`w-full flex items-center gap-3 px-4 py-3.5 text-[13px] font-bold rounded-2xl transition-all text-left group relative overflow-hidden
                                            ${activeSection === item.id 
                                                ? "bg-grad-primary text-white shadow-xl shadow-indigo-500/25 border-none" 
                                                : "text-slate-500 hover:text-indigo-600 hover:bg-indigo-500/5"
                                            }`}
                                    >
                                        <span className={`${activeSection === item.id ? "text-white" : "text-slate-400 group-hover:text-indigo-500"} transition-colors relative z-10`}>
                                            {item.icon}
                                        </span>
                                        <span className="flex-1 truncate relative z-10">{item.title}</span>
                                        <span className={`text-[9px] font-black opacity-40 uppercase relative z-10 ${activeSection === item.id ? "text-white" : ""}`}>
                                            Tomo {item.id}
                                        </span>
                                        {activeSection === item.id && (
                                            <motion.div 
                                                layoutId="active-bg" 
                                                className="absolute inset-0 bg-grad-primary" 
                                                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                            />
                                        )}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    ))}

                    <div className="p-6 rounded-[2rem] bg-grad-primary text-white overflow-hidden relative group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                            <ShieldCheck className="h-20 w-20" />
                        </div>
                        <h4 className="text-xs font-black uppercase tracking-widest mb-2 opacity-80 text-white/70">Certificación Técnica</h4>
                        <p className="text-sm font-bold leading-relaxed relative z-10">
                            Este dossier representa la propiedad intelectual íntegra del sistema v5.0.
                        </p>
                        <button 
                            onClick={() => window.print()}
                            className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase bg-white/20 px-3 py-1.5 rounded-full hover:bg-white/30 transition-all"
                        >
                            Descargar PDF <ArrowUpRight className="h-3 w-3" />
                        </button>
                    </div>

                    <style jsx global>{`
                        @media print {
                            body * {
                                visibility: hidden;
                            }
                            main, main * {
                                visibility: visible;
                            }
                            main {
                                position: absolute;
                                left: 0;
                                top: 0;
                                width: 100%;
                            }
                            aside, nav, .sticky {
                                display: none !important;
                            }
                            .prose {
                                max-width: none !important;
                                color: black !important;
                            }
                        }
                    `}</style>
                </aside>

                {/* VISOR DE CONTENIDO MAESTRO */}
                <main className="relative">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            className="bg-white dark:bg-slate-900/40 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 p-8 md:p-16 shadow-xl shadow-slate-200/50 dark:shadow-none min-h-[800px]"
                        >
                            {/* Banner de Info */}
                            <div className="mb-12 p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-4">
                                <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-indigo-900/60 dark:text-indigo-300/60 font-medium leading-relaxed">
                                    Estás visualizando el <span className="font-bold text-indigo-500">Tomo {activeSection}</span> del manual de ingeniería. Toda la información aquí contenida es confidencial y estratégica para la operación del sistema.
                                </p>
                            </div>

                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-64 gap-4">
                                    <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                                    <p className="text-sm font-bold text-slate-400">Sincronizando Dossier...</p>
                                </div>
                            ) : (
                                <article className="prose prose-slate dark:prose-invert max-w-none 
                                    prose-headings:font-black prose-headings:tracking-tight
                                    prose-h1:text-5xl prose-h1:mb-8 prose-h1:text-indigo-500
                                    prose-h2:text-4xl prose-h2:mt-16 prose-h2:mb-8 prose-h2:pb-4 prose-h2:border-b prose-h2:border-slate-100 dark:prose-h2:border-slate-800
                                    prose-h3:text-2xl prose-h3:mt-12 prose-h3:text-slate-800 dark:prose-h3:text-slate-200
                                    prose-p:text-lg prose-p:leading-relaxed prose-p:text-slate-600 dark:prose-p:text-slate-400
                                    prose-strong:text-slate-900 dark:prose-strong:text-white prose-strong:font-black
                                    prose-code:bg-indigo-500/5 dark:prose-code:bg-indigo-500/10 prose-code:text-indigo-600 dark:prose-code:text-indigo-400 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-lg prose-code:before:content-none prose-code:after:content-none prose-code:font-bold
                                    prose-pre:bg-[#0f172a] prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-[2rem] prose-pre:shadow-2xl prose-pre:p-8
                                    prose-li:text-lg prose-li:text-slate-600 dark:prose-li:text-slate-400
                                    prose-table:border prose-table:border-slate-200 dark:prose-table:border-slate-800 prose-table:rounded-xl prose-table:overflow-hidden
                                    prose-th:bg-slate-50 dark:prose-th:bg-slate-800/50 prose-th:p-4 prose-th:text-sm prose-th:font-black
                                    prose-td:p-4 prose-td:text-sm prose-td:border-t prose-td:border-slate-100 dark:prose-td:border-slate-800
                                    print:prose-h1:text-4xl print:prose-h2:text-2xl print:prose-p:text-sm print:prose-li:text-sm print:prose-pre:bg-white print:prose-pre:text-black print:prose-pre:border-slate-200
                                    ">
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) {
                                                const match = /language-(\w+)/.exec(className || '');
                                                const content = String(children).replace(/\n$/, '');
                                                
                                                if (!match) {
                                                    return (
                                                        <code className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-indigo-500 font-mono text-[0.9em]" {...props}>
                                                            {children}
                                                        </code>
                                                    );
                                                }

                                                return (
                                                    <div className="relative group/code my-6 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
                                                        <button 
                                                            onClick={() => copyToClipboard(content)}
                                                            className="absolute right-3 top-3 z-10 p-2 bg-slate-900/50 hover:bg-slate-900 rounded-lg opacity-0 group-hover/code:opacity-100 transition-all text-[10px] font-black uppercase text-white"
                                                        >
                                                            Copiar
                                                        </button>
                                                        <pre className="p-4 bg-slate-950 overflow-x-auto">
                                                            <code className={className} {...props}>
                                                                {children}
                                                            </code>
                                                        </pre>
                                                    </div>
                                                );
                                            }
                                        }}
                                    >
                                        {displayedContent}
                                    </ReactMarkdown>
                                </article>
                            )}
                        </motion.div>
                    </AnimatePresence>

                    {/* Footer de Navegación de Página */}
                    <div className="mt-12 flex items-center justify-between px-4">
                        <button 
                            className="flex flex-col items-start gap-1 group"
                            onClick={() => {
                                const prevId = (parseInt(activeSection) - 1).toString();
                                if (parseInt(prevId) > 0) setActiveSection(prevId);
                                scrollToTop();
                            }}
                        >
                            <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-indigo-500 transition-colors">Anterior</span>
                            <span className="text-sm font-bold flex items-center gap-1">
                                <ChevronRight className="h-4 w-4 rotate-180" /> Tomo {parseInt(activeSection) - 1}
                            </span>
                        </button>
                        
                        <button 
                            className="flex flex-col items-end gap-1 group text-right"
                            onClick={() => {
                                const nextId = (parseInt(activeSection) + 1).toString();
                                if (parseInt(nextId) <= 26) setActiveSection(nextId);
                                scrollToTop();
                            }}
                        >
                            <span className="text-[10px] font-black uppercase text-slate-400 group-hover:text-indigo-500 transition-colors">Siguiente</span>
                            <span className="text-sm font-bold flex items-center gap-1">
                                Tomo {parseInt(activeSection) + 1} <ChevronRight className="h-4 w-4" />
                            </span>
                        </button>
                    </div>
                </main>
            </div>
        </div>
    );
}

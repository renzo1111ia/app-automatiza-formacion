"use client";

import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
    Book, ChevronRight, Home, Terminal, Layers, 
    ShieldCheck, Zap, BookOpen, Search,
    Cpu, MessageSquare, Database, Activity,
    Scale, UserCheck, Layout,
    ArrowUpRight, Info, Brain
} from 'lucide-react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';

const MermaidDiagram = dynamic(() => import('@/components/docs/MermaidDiagram'), { ssr: false });


// Fases y Tomos — Lenguaje de negocio para el cliente
const DOC_STRUCTURE = [
    {
        phase: "🚀 INICIO: Guía del Propietario",
        color: "from-indigo-600 to-violet-600",
        items: [
            { id: "0", title: "¿Qué hace el sistema?", icon: <BookOpen className="h-4 w-4" /> },
        ]
    },
    {
        phase: "FASE I: El Sistema y sus Partes",
        color: "from-blue-600 to-indigo-600",
        items: [
            { id: "1", title: "Cómo funciona todo junto", icon: <Layout className="h-4 w-4" /> },
            { id: "2", title: "Dónde viven tus datos", icon: <Database className="h-4 w-4" /> },
            { id: "3", title: "Por qué nunca se cae", icon: <ShieldCheck className="h-4 w-4" /> },
            { id: "4", title: "Tu panel de control", icon: <Cpu className="h-4 w-4" /> },
            { id: "5", title: "Todos los módulos del sistema", icon: <Terminal className="h-4 w-4" /> },
        ]
    },
    {
        phase: "FASE II: Seguridad y Resultados",
        color: "from-emerald-500 to-teal-600",
        items: [
            { id: "6", title: "Tus datos son 100% tuyos", icon: <ShieldCheck className="h-4 w-4" /> },
            { id: "7", title: "Cómo el sistema convierte leads", icon: <Zap className="h-4 w-4" /> },
            { id: "8", title: "Qué hacer si algo falla", icon: <Activity className="h-4 w-4" /> },
            { id: "10", title: "Cómo activar un nuevo cliente", icon: <Layers className="h-4 w-4" /> },
        ]
    },
    {
        phase: "FASE III: La Inteligencia Artificial",
        color: "from-purple-500 to-pink-600",
        items: [
            { id: "11", title: "Cómo califica a tus leads", icon: <Brain className="h-4 w-4" /> },
            { id: "12", title: "Cómo se conecta con otros sistemas", icon: <Database className="h-4 w-4" /> },
            { id: "13", title: "Plan ante cualquier emergencia", icon: <Activity className="h-4 w-4" /> },
            { id: "14", title: "El motor que nunca descansa", icon: <Cpu className="h-4 w-4" /> },
            { id: "15", title: "Cómo se controla el agente IA", icon: <MessageSquare className="h-4 w-4" /> },
        ]
    },
    {
        phase: "FASE IV: Detalles y Referencia",
        color: "from-orange-500 to-amber-600",
        items: [
            { id: "16", title: "Privacidad y cumplimiento legal", icon: <Scale className="h-4 w-4" /> },
            { id: "17", title: "Por qué suena tan humano", icon: <Zap className="h-4 w-4" /> },
            { id: "18", title: "Variables que usa el sistema", icon: <BookOpen className="h-4 w-4" /> },
            { id: "19", title: "Cómo funciona el agente por dentro", icon: <UserCheck className="h-4 w-4" /> },
            { id: "20", title: "Guía de todos los módulos", icon: <Layout className="h-4 w-4" /> },
            { id: "21", title: "Glosario de términos", icon: <Info className="h-4 w-4" /> },
            { id: "22", title: "Cómo usar el panel de control", icon: <Layout className="h-4 w-4" /> },
            { id: "23", title: "Qué pasa con tus datos", icon: <Database className="h-4 w-4" /> },
            { id: "24", title: "Cuánto cuesta operar", icon: <Activity className="h-4 w-4" /> },
            { id: "25", title: "Cuándo entra un humano", icon: <UserCheck className="h-4 w-4" /> },
            { id: "26", title: "El mapa completo del sistema", icon: <Layers className="h-4 w-4" /> },
        ]
    }
];

export default function DocsPage() {
    const [content, setContent] = useState<string>("");
    const [searchQuery, setSearchQuery] = useState("");
    const [activeSection, setActiveSection] = useState("0");
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
                            className="bg-white dark:bg-slate-950 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-2xl shadow-slate-200/50 dark:shadow-none p-8 md:p-16 min-h-[800px] relative overflow-hidden"
                        >
                            {/* Decoración de Fondo Premium */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
                            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />

                            {/* Cabecera de Sección Centralizada */}
                            <div className="mb-20 space-y-6 relative z-10 text-center flex flex-col items-center">
                                <div className="flex items-center gap-3 justify-center">
                                    <span className="h-[1px] w-12 bg-indigo-500/30" />
                                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">
                                        {currentItem.phase}
                                    </span>
                                    <span className="h-[1px] w-12 bg-indigo-500/30" />
                                </div>
                                <h2 className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.1] max-w-3xl mx-auto">
                                    {currentItem.title}
                                </h2>
                                <div className="flex items-center gap-4 pt-4 justify-center">
                                    <div className="flex -space-x-2">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="h-6 w-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                                                <UserCheck className="h-3 w-3 text-slate-500" />
                                            </div>
                                        ))}
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Revisado por Ingeniería</span>
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="flex flex-col items-center justify-center h-64 gap-4">
                                    <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                                    <p className="text-sm font-bold text-slate-400">Sincronizando Dossier...</p>
                                </div>
                            ) : (
                                <article className="max-w-4xl mx-auto text-slate-700 dark:text-slate-300">
                                    <ReactMarkdown 
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            h2: ({children}) => (
                                                <h2 className="relative text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight mt-16 mb-6 pb-4 border-b-2 border-slate-100 dark:border-slate-800 flex items-center gap-3 justify-center">
                                                    <span className="w-1 h-7 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-full shrink-0" />
                                                    {children}
                                                </h2>
                                            ),
                                            h3: ({children}) => (
                                                <h3 className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-10 mb-4 flex items-center gap-2 justify-center">
                                                    <span className="text-indigo-300 dark:text-indigo-600 font-mono text-sm">▸</span>
                                                    {children}
                                                </h3>
                                            ),
                                            h4: ({children}) => (
                                                <h4 className="text-base font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider mt-8 mb-3">
                                                    {children}
                                                </h4>
                                            ),
                                            p: ({children}) => (
                                                <p className="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-[1.9] mb-6">
                                                    {children}
                                                </p>
                                            ),
                                            ul: ({children}) => (
                                                <ul className="my-8 space-y-4 pl-6 list-disc marker:text-indigo-500">
                                                    {children}
                                                </ul>
                                            ),
                                            ol: ({children}) => (
                                                <ol className="my-8 space-y-4 pl-6 list-decimal marker:text-indigo-500 marker:font-black">
                                                    {children}
                                                </ol>
                                            ),
                                            li: ({children}) => (
                                                <li className="text-base md:text-lg text-slate-600 dark:text-slate-400 leading-[1.8] pl-2">
                                                    {children}
                                                </li>
                                            ),
                                            blockquote: ({children}) => (
                                                <blockquote className="my-8 pl-6 border-l-4 border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-r-2xl py-5 pr-6">
                                                    <div className="text-base md:text-lg text-indigo-700 dark:text-indigo-300 font-medium leading-[1.8] italic">
                                                        {children}
                                                    </div>
                                                </blockquote>
                                            ),
                                            hr: () => (
                                                <div className="my-12 flex items-center gap-4">
                                                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                                    <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-slate-700 to-transparent" />
                                                </div>
                                            ),
                                            strong: ({children}) => (
                                                <strong className="font-black text-slate-900 dark:text-white">
                                                    {children}
                                                </strong>
                                            ),
                                            table: ({children}) => (
                                                <div className="my-10 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg">
                                                    <table className="w-full border-collapse">
                                                        {children}
                                                    </table>
                                                </div>
                                            ),
                                            thead: ({children}) => (
                                                <thead className="bg-slate-50 dark:bg-slate-900/60">
                                                    {children}
                                                </thead>
                                            ),
                                            th: ({children}) => (
                                                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                                    {children}
                                                </th>
                                            ),
                                            td: ({children}) => (
                                                <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                                                    {children}
                                                </td>
                                            ),
                                            code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) {
                                                const match = /language-(\w+)/.exec(className || '');
                                                const content = String(children).replace(/\n$/, '');
                                                if (!match) {
                                                    return (
                                                        <code className="bg-indigo-500/5 text-indigo-500 dark:text-indigo-400 px-1.5 py-0.5 rounded-md font-mono text-[0.9em]" {...props}>
                                                            {children}
                                                        </code>
                                                    );
                                                }


                                                // RENDERIZADO DE MERMAID (Visual Premium)
                                                if (match && match[1] === 'mermaid') {
                                                    return <MermaidDiagram chart={content} />;
                                                }

                                                return (
                                                    <div className="relative group/code my-10 rounded-[2rem] overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xl">
                                                        <div className="bg-slate-900 px-6 py-3 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="flex gap-1.5">
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50" />
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50" />
                                                                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
                                                                </div>
                                                                <span className="ml-4 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                                                    {match[1]}
                                                                </span>
                                                            </div>
                                                            <button 
                                                                onClick={() => copyToClipboard(content)}
                                                                className="flex items-center gap-2 px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-[9px] font-black uppercase text-white/50 hover:text-white"
                                                            >
                                                                <ArrowUpRight className="h-3 w-3" />
                                                                Copiar
                                                            </button>
                                                        </div>
                                                        <pre className="p-8 bg-slate-950 overflow-x-auto custom-scrollbar font-mono text-sm leading-relaxed text-indigo-300">
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

                            {/* Footer de Sección */}
                            <div className="mt-24 pt-10 border-t border-slate-100 dark:border-slate-900 flex flex-col md:flex-row items-center justify-between gap-6">
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                                        <Info className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <p className="text-xs font-medium text-slate-400 max-w-xs leading-relaxed">
                                        Este documento es propiedad intelectual del cliente. Prohibida su reproducción sin autorización técnica.
                                    </p>
                                </div>
                                <button 
                                    onClick={() => window.print()}
                                    className="px-6 py-3 bg-slate-900 dark:bg-white dark:text-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-slate-900/20 dark:shadow-none"
                                >
                                    Exportar a PDF Profesional
                                </button>
                            </div>
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

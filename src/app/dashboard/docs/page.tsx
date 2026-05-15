import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import fs from 'fs';
import path from 'path';
import { Book, ChevronRight, Home, Terminal, Share2, Layers, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function DocsPage() {
    // Read the DOCUMENTATION.md file from the root
    let content = "";
    try {
        const filePath = path.join(process.cwd(), 'DOCUMENTATION.md');
        content = fs.readFileSync(filePath, 'utf8');
    } catch {
        content = "# Error\nNo se pudo cargar la documentación.";
    }

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 pb-20">
            {/* Header / Breadcrumbs */}
            <div className="sticky top-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/10 rounded-lg">
                            <Book className="h-5 w-5 text-indigo-500" />
                        </div>
                        <div className="flex items-center gap-2 text-sm font-medium opacity-60">
                            <Link href="/dashboard" className="hover:text-indigo-500 transition-colors">Dashboard</Link>
                            <ChevronRight className="h-4 w-4" />
                            <span className="text-slate-900 dark:text-white font-bold">Documentación</span>
                        </div>
                    </div>
                    <Link 
                        href="/dashboard"
                        className="text-xs font-bold px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-all flex items-center gap-2"
                    >
                        <Home className="h-3.5 w-3.5" />
                        Volver
                    </Link>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 mt-12 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-12">
                {/* Sidebar Navigation */}
                <aside className="hidden lg:block space-y-8 sticky top-32 h-fit">
                    <div>
                        <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4">Secciones</h3>
                        <nav className="space-y-1">
                            {[
                                { label: "1. Introducción", icon: <Layers className="h-4 w-4" /> },
                                { label: "2. Sección de Usuario", icon: <Home className="h-4 w-4" /> },
                                { label: "3. Sección de Admin", icon: <Terminal className="h-4 w-4" /> },
                                { label: "4. Variables", icon: <Share2 className="h-4 w-4" /> },
                                { label: "5. Infraestructura", icon: <ShieldCheck className="h-4 w-4" /> },
                            ].map((item) => (
                                <button key={item.label} className="w-full flex items-center gap-3 px-3 py-2 text-sm font-bold text-slate-500 hover:text-indigo-500 hover:bg-indigo-500/5 rounded-xl transition-all text-left">
                                    {item.icon}
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                        <p className="text-[10px] font-bold text-indigo-500 uppercase mb-2">Ayuda</p>
                        <p className="text-xs text-slate-500 leading-relaxed">¿Necesitas soporte adicional? Contacta con el equipo de IA.</p>
                    </div>
                </aside>

                {/* Main Content Render */}
                <main className="prose prose-slate dark:prose-invert max-w-none 
                    prose-headings:font-black prose-headings:tracking-tight
                    prose-h1:text-5xl prose-h1:mb-8
                    prose-h2:text-3xl prose-h2:mt-12 prose-h2:border-b prose-h2:pb-4 prose-h2:border-slate-200 dark:prose-h2:border-slate-800
                    prose-p:text-lg prose-p:leading-relaxed prose-p:text-slate-600 dark:prose-p:text-slate-400
                    prose-code:bg-indigo-500/10 prose-code:text-indigo-500 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
                    prose-pre:bg-slate-900 prose-pre:border prose-pre:border-slate-800 prose-pre:rounded-2xl prose-pre:shadow-2xl
                    prose-li:text-lg
                    ">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                    </ReactMarkdown>
                </main>
            </div>
        </div>
    );
}

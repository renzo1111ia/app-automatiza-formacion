"use client";

import { useEffect, useRef, useState } from 'react';
import { GitBranch, ZoomIn, ZoomOut } from 'lucide-react';

interface MermaidDiagramProps {
    chart: string;
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
    const ref = useRef<HTMLDivElement>(null);
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [zoom, setZoom] = useState(1);

    useEffect(() => {
        let isMounted = true;

        const renderDiagram = async () => {
            try {
                const mermaid = (await import('mermaid')).default;

                mermaid.initialize({
                    startOnLoad: false,
                    theme: 'base',
                    themeVariables: {
                        primaryColor: '#6366f1',
                        primaryTextColor: '#ffffff',
                        primaryBorderColor: '#4338ca',
                        lineColor: '#94a3b8',
                        secondaryColor: '#8b5cf6',
                        tertiaryColor: '#f1f5f9',
                        background: '#ffffff',
                        mainBkg: '#6366f1',
                        nodeBorder: '#4338ca',
                        clusterBkg: '#f8fafc',
                        titleColor: '#1e293b',
                        edgeLabelBackground: '#f8fafc',
                        fontSize: '14px',
                    },
                    flowchart: {
                        htmlLabels: true,
                        curve: 'basis',
                        padding: 20,
                    },
                    securityLevel: 'loose',
                });

                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                const { svg: renderedSvg } = await mermaid.render(id, chart);

                if (isMounted) {
                    setSvg(renderedSvg);
                    setError(null);
                }
            } catch (e) {
                console.error('Mermaid render error:', e);
                if (isMounted) {
                    setError('No se pudo renderizar el diagrama.');
                }
            }
        };

        renderDiagram();
        return () => { isMounted = false; };
    }, [chart]);

    return (
        <div className="my-12 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
                        <GitBranch className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Diagrama de Ingeniería</p>
                        <p className="text-xs font-bold text-white">Flujo de Orquestación v5.0</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white"
                        title="Reducir"
                    >
                        <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="text-[10px] font-black text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
                    <button
                        onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                        className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-white"
                        title="Ampliar"
                    >
                        <ZoomIn className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Diagram Area */}
            <div className="bg-white dark:bg-slate-950 p-8 overflow-auto" style={{ minHeight: '400px' }}>
                {error ? (
                    <div className="flex flex-col items-center justify-center h-64 gap-4 text-slate-400">
                        <GitBranch className="h-10 w-10 opacity-20" />
                        <p className="text-sm font-medium">{error}</p>
                    </div>
                ) : svg ? (
                    <div
                        ref={ref}
                        style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease' }}
                        dangerouslySetInnerHTML={{ __html: svg }}
                        className="flex justify-center"
                    />
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                        <p className="text-sm font-bold text-slate-400">Renderizando diagrama...</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 dark:bg-slate-900 px-6 py-3 flex items-center justify-between border-t border-slate-200 dark:border-slate-800">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AI CRM & Workflow Orchestrator v5.0</p>
                <div className="flex gap-2 text-[9px] text-slate-500 font-black uppercase">
                    <span className="px-2 py-1 bg-indigo-500/10 text-indigo-500 rounded-full">Propiedad del Cliente</span>
                </div>
            </div>
        </div>
    );
}

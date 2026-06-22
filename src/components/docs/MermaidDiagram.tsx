"use client";

import { useEffect, useRef, useState } from "react";
import { GitBranch, ZoomIn, ZoomOut } from "lucide-react";

interface MermaidDiagramProps {
  chart: string;
}

export default function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      try {
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            primaryColor: "#6366f1",
            primaryTextColor: "#ffffff",
            primaryBorderColor: "#4338ca",
            lineColor: "#64748b",
            secondaryColor: "#8b5cf6",
            tertiaryColor: "#f8fafc",
            background: "#ffffff",
            mainBkg: "#6366f1",
            nodeBorder: "#4338ca",
            clusterBkg: "#f8fafc",
            titleColor: "#1e293b",
            edgeLabelBackground: "#ffffff",
            labelTextColor: "#1e293b",
            labelBackground: "#ffffff",
            fontSize: "14px",
            fontFamily: "Outfit, sans-serif",
          },
          flowchart: {
            htmlLabels: true,
            curve: "basis",
            padding: 30,
            useMaxWidth: false,
          },
          securityLevel: "loose",
        });

        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg: renderedSvg } = await mermaid.render(id, chart);

        if (isMounted) {
          setSvg(renderedSvg);
          setError(null);
        }
      } catch (e) {
        console.error("Mermaid render error:", e);
        if (isMounted) {
          setError("No se pudo renderizar el diagrama.");
        }
      }
    };

    renderDiagram();
    return () => {
      isMounted = false;
    };
  }, [chart]);

  return (
    <div className="my-12 overflow-hidden rounded-[2rem] border border-slate-200 shadow-xl dark:border-slate-800">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/20">
            <GitBranch className="h-4 w-4 text-indigo-400" />
          </div>
          <div>
            <p className="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase">
              Diagrama de Ingeniería
            </p>
            <p className="text-xs font-bold text-white">Flujo de Orquestación v5.0</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            className="rounded-lg bg-white/5 p-2 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
            title="Reducir"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-[10px] font-black text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="rounded-lg bg-white/5 p-2 text-slate-400 transition-all hover:bg-white/10 hover:text-white"
            title="Ampliar"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Diagram Area */}
      <div className="min-h-[400px] overflow-auto bg-white p-8 dark:bg-slate-950">
        {error ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4 text-slate-400">
            <GitBranch className="h-10 w-10 opacity-20" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        ) : svg ? (
          <>
            <style>{`
                            .mermaid-zoom-container {
                                transform: scale(${zoom});
                                transform-origin: top center;
                                transition: transform 0.2s ease;
                            }
                        `}</style>
            <div
              ref={ref}
              dangerouslySetInnerHTML={{ __html: svg }}
              className="mermaid-zoom-container flex justify-center"
            />
          </>
        ) : (
          <div className="flex h-64 flex-col items-center justify-center gap-4">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500/30 border-t-indigo-500" />
            <p className="text-sm font-bold text-slate-400">Renderizando diagrama...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
          AI CRM & Workflow Orchestrator v5.0
        </p>
        <div className="flex gap-2 text-[9px] font-black text-slate-500 uppercase">
          <span className="rounded-full bg-indigo-500/10 px-2 py-1 text-indigo-500">
            Propiedad del Cliente
          </span>
        </div>
      </div>
    </div>
  );
}

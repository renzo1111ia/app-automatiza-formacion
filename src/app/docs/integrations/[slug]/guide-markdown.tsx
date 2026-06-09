// Sprint 5 (08-06-2026) — Componentes de renderizado para las guías .md de
// docs/integrations. Mapea cada elemento markdown a estilos de marca (tokens de
// globals.css). Importado por [slug]/page.tsx. Mantiene la página principal
// ligera y este archivo enfocado solo en presentación.

import type { Components } from "react-markdown";
import type { ReactNode } from "react";

// Extrae el texto plano de los children (para detectar el prefijo de un callout).
function childrenToText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (Array.isArray(children)) return children.map(childrenToText).join("");
  if (children && typeof children === "object" && "props" in children) {
    return childrenToText((children as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export const GuideMarkdown: Components = {
  h1: ({ children }) => (
    <h1 className="text-card-foreground mt-2 mb-4 text-2xl font-bold tracking-tight">{children}</h1>
  ),

  // H2 = sección principal. Barra lateral de color de marca + buen espaciado.
  h2: ({ children }) => (
    <h2 className="border-border text-card-foreground mt-10 mb-4 flex items-center gap-3 border-b pb-2 text-xl font-bold tracking-tight first:mt-0">
      <span className="bg-grad-primary h-5 w-1.5 shrink-0 rounded-full" aria-hidden />
      {children}
    </h2>
  ),

  h3: ({ children }) => (
    <h3 className="text-card-foreground mt-7 mb-3 text-base font-semibold">{children}</h3>
  ),

  p: ({ children }) => <p className="text-card-foreground/90 my-4 leading-relaxed">{children}</p>,

  a: ({ href, children }) => (
    <a
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noopener noreferrer" : undefined}
      className="text-primary decoration-primary/30 hover:decoration-primary font-medium underline underline-offset-2 transition"
    >
      {children}
    </a>
  ),

  strong: ({ children }) => (
    <strong className="text-card-foreground font-semibold">{children}</strong>
  ),

  ul: ({ children }) => (
    <ul className="marker:text-primary my-4 list-disc space-y-2 pl-6">{children}</ul>
  ),

  ol: ({ children }) => (
    <ol className="marker:text-primary my-4 list-decimal space-y-2 pl-6 marker:font-semibold">
      {children}
    </ol>
  ),

  li: ({ children }) => (
    <li className="text-card-foreground/90 pl-1 leading-relaxed">{children}</li>
  ),

  // Blockquote = callout. Detecta el tono por el prefijo en negrita del texto.
  blockquote: ({ children }) => {
    const text = childrenToText(children).toLowerCase();
    const isWarning =
      text.includes("aviso") ||
      text.includes("⚠") ||
      text.includes("no compartas") ||
      text.includes("cuidado") ||
      text.includes("importante");
    const isNote =
      text.includes("nota") || text.includes("antes de empezar") || text.includes("recomend");

    const tone = isWarning
      ? {
          ring: "ring-amber-200 dark:ring-amber-900/50",
          bg: "bg-amber-50 dark:bg-amber-950/30",
          icon: "text-amber-500",
          path: "M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z",
        }
      : isNote
        ? {
            ring: "ring-sky-200 dark:ring-sky-900/50",
            bg: "bg-sky-50 dark:bg-sky-950/30",
            icon: "text-sky-500",
            path: "M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
          }
        : {
            ring: "ring-border",
            bg: "bg-accent",
            icon: "text-accent-foreground",
            path: "M12 16v-4m0-4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
          };

    return (
      <div className={`my-5 flex gap-3 rounded-xl ${tone.bg} p-4 ring-1 ring-inset ${tone.ring}`}>
        <svg
          className={`mt-0.5 h-5 w-5 shrink-0 ${tone.icon}`}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path
            d={tone.path}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="text-card-foreground/90 text-sm leading-relaxed [&>p]:my-0 [&>p+p]:mt-2">
          {children}
        </div>
      </div>
    );
  },

  code: ({ className, children }) => {
    const isBlock = (className ?? "").includes("language-");
    if (isBlock) {
      return (
        <code className="text-card-foreground block font-mono text-sm break-words whitespace-pre-wrap">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted text-accent-foreground rounded-md px-1.5 py-0.5 font-mono text-[0.85em] font-medium">
        {children}
      </code>
    );
  },

  pre: ({ children }) => (
    <pre className="border-border bg-muted/60 my-5 overflow-x-auto rounded-xl border p-4">
      {children}
    </pre>
  ),

  hr: () => <hr className="border-border my-10 border-t" />,

  // Tablas: contenedor con scroll horizontal, cabecera de marca, filas zebra.
  table: ({ children }) => (
    <div className="border-border my-6 overflow-x-auto rounded-xl border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-secondary text-left">{children}</thead>,
  th: ({ children }) => (
    <th className="border-border text-muted-foreground border-b px-4 py-2.5 text-xs font-semibold tracking-wide uppercase">
      {children}
    </th>
  ),
  tbody: ({ children }) => <tbody className="[&>tr:nth-child(even)]:bg-muted/40">{children}</tbody>,
  td: ({ children }) => (
    <td className="border-border text-card-foreground/90 border-b px-4 py-2.5 align-top">
      {children}
    </td>
  ),
};

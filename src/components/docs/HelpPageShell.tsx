"use client";

import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";
import { BookOpen, Search, ChevronRight, Loader2, Sparkles, type LucideIcon } from "lucide-react";
import * as Lucide from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";

// ─── Types ────────────────────────────────────────────────────────

export type HelpScope = "admin" | "clientes";

export interface HelpSectionRow {
  id: string;
  scope: HelpScope;
  slug: string;
  title: string;
  route_in_app: string | null;
  status: "provisional" | "completada";
  brief: string | null;
  content_markdown: string | null;
  screenshots: { url: string; caption?: string; order?: number }[];
  fields_table: { name: string; type?: string; description?: string; valid_values?: string }[];
  steps: { order: number; description: string; screenshot_url?: string }[];
  common_cases: { title: string; description: string }[];
  display_order: number;
  icon: string | null;
  last_reviewed_at: string | null;
  last_reviewed_by: string | null;
  updated_at: string | null;
}

export interface HelpPageShellProps {
  scope: HelpScope;
  heading: string;
  subheading: string;
  accentClass?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────

function resolveIcon(name: string | null | undefined): LucideIcon {
  if (!name) return BookOpen;
  const lookup = Lucide as unknown as Record<string, LucideIcon>;
  return lookup[name] ?? BookOpen;
}

function renderIcon(name: string | null | undefined, className: string) {
  return React.createElement(resolveIcon(name), {
    className,
    "aria-hidden": "true",
  });
}

const STATUS_BADGES: Record<HelpSectionRow["status"], { label: string; cls: string }> = {
  provisional: {
    label: "Provisional",
    cls: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/40",
  },
  completada: {
    label: "Completada",
    cls: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/40",
  },
};

// ─── Component ────────────────────────────────────────────────────

export function HelpPageShell({ scope, heading, subheading, accentClass }: HelpPageShellProps) {
  const [sections, setSections] = useState<HelpSectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(`/api/help-sections/${scope}`);
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${r.status}`);
        }
        const data = await r.json();
        if (cancelled) return;
        const list: HelpSectionRow[] = data.sections ?? [];
        setSections(list);
        setActiveSlug((prev) => prev ?? list[0]?.slug ?? null);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [scope]);

  const filtered = useMemo(() => {
    if (!search.trim()) return sections;
    const q = search.toLowerCase();
    return sections.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        (s.brief ?? "").toLowerCase().includes(q) ||
        (s.content_markdown ?? "").toLowerCase().includes(q)
    );
  }, [sections, search]);

  const active = useMemo(
    () => sections.find((s) => s.slug === activeSlug) ?? null,
    [sections, activeSlug]
  );

  const accent = accentClass ?? "from-indigo-500 to-violet-500";

  if (loading) {
    return (
      <div className="flex h-full min-h-[400px] flex-col items-center justify-center gap-3 text-slate-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-xs font-bold tracking-widest uppercase">Cargando documentación…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<Sparkles className="h-12 w-12" />}
          title="No se pudo cargar la documentación"
          description={error}
        />
      </div>
    );
  }

  if (sections.length === 0) {
    return (
      <div className="p-8">
        <EmptyState
          icon={<BookOpen className="h-12 w-12" />}
          title="Aún no hay secciones publicadas"
          description="El agente help-docs-keeper publicará contenido en cuanto detecte cambios en la UI."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[600px] w-full overflow-hidden">
      {/* ── TOC sidebar ────────────────────────────────────────── */}
      <aside
        className="hidden w-72 flex-shrink-0 border-r border-slate-200 bg-white/60 md:flex md:flex-col dark:border-slate-800 dark:bg-slate-950/40"
        aria-label="Índice de documentación"
      >
        <div className={cn("border-b border-slate-100 px-5 py-5 dark:border-slate-800")}>
          <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
            {scope === "admin" ? "Doc Admin" : "Docs Clientes"}
          </p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-white">
            {heading}
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{subheading}</p>
        </div>
        <div className="border-b border-slate-100 px-3 py-3 dark:border-slate-800">
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label className="sr-only" htmlFor={`help-search-${scope}`}>
              Buscar sección
            </label>
            <input
              id={`help-search-${scope}`}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar…"
              className="w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-300 focus:ring-2 focus:ring-indigo-300/30 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-2 py-3" aria-label="Secciones">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-xs text-slate-400">Sin coincidencias.</p>
          ) : (
            <ul className="space-y-1">
              {filtered.map((s) => {
                const isActive = s.slug === activeSlug;
                return (
                  <li key={s.slug}>
                    <button
                      type="button"
                      onClick={() => setActiveSlug(s.slug)}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-semibold transition-all focus-visible:ring-2 focus-visible:ring-indigo-300/40 focus-visible:outline-none",
                        isActive
                          ? `bg-gradient-to-r ${accent} text-white shadow`
                          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                      )}
                    >
                      {renderIcon(s.icon, "h-4 w-4 shrink-0")}
                      <span className="flex-1 truncate">{s.title}</span>
                      {s.status === "provisional" && !isActive && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400"
                          aria-label="Provisional"
                        />
                      )}
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 opacity-40 transition-transform",
                          isActive && "translate-x-0.5"
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      </aside>

      {/* ── Content ────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        {active ? (
          <SectionContent section={active} accent={accent} />
        ) : (
          <div className="p-8">
            <EmptyState
              icon={<BookOpen className="h-12 w-12" />}
              title="Selecciona una sección"
              description="Elige una sección del índice para ver su contenido."
            />
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Section content renderer ─────────────────────────────────────

function SectionContent({ section, accent }: { section: HelpSectionRow; accent: string }) {
  const badge = STATUS_BADGES[section.status];

  return (
    <article className="mx-auto max-w-4xl px-6 py-10 md:px-10">
      {/* Header */}
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase">
          <span>{section.scope === "admin" ? "Doc Admin" : "Docs Clientes"}</span>
          <span aria-hidden="true">›</span>
          <span>{section.slug}</span>
        </div>
        <div className="flex flex-wrap items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow",
              accent
            )}
            aria-hidden="true"
          >
            {renderIcon(section.icon, "h-6 w-6")}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl dark:text-white">
              {section.title}
            </h1>
            {section.brief && (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{section.brief}</p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 tracking-widest uppercase",
                  badge.cls
                )}
              >
                {badge.label}
              </span>
              {section.route_in_app && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                  {section.route_in_app}
                </span>
              )}
              {section.last_reviewed_at && (
                <span className="text-slate-400">
                  Revisado{" "}
                  {new Date(section.last_reviewed_at).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })}
                  {section.last_reviewed_by ? ` · ${section.last_reviewed_by}` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Markdown content */}
      {section.content_markdown && (
        <section
          aria-labelledby={`md-${section.slug}`}
          className="prose prose-slate dark:prose-invert max-w-none rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm dark:border-slate-800 dark:bg-slate-950/60"
        >
          <h2 id={`md-${section.slug}`} className="sr-only">
            Descripción
          </h2>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{section.content_markdown}</ReactMarkdown>
        </section>
      )}

      {/* Steps */}
      {section.steps?.length > 0 && (
        <section className="mt-8" aria-labelledby={`steps-${section.slug}`}>
          <h2
            id={`steps-${section.slug}`}
            className="mb-3 text-sm font-black tracking-widest text-slate-500 uppercase"
          >
            Pasos
          </h2>
          <ol className="space-y-3">
            {[...section.steps]
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((step, idx) => (
                <li
                  key={`${section.slug}-step-${idx}`}
                  className="flex gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-200"
                >
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-xs font-black text-white",
                      accent
                    )}
                    aria-hidden="true"
                  >
                    {step.order ?? idx + 1}
                  </span>
                  <div className="flex-1">
                    <p>{step.description}</p>
                    {step.screenshot_url && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                        <Image
                          src={step.screenshot_url}
                          alt={`Paso ${step.order ?? idx + 1}: ${step.description.slice(0, 80)}`}
                          width={1200}
                          height={700}
                          className="h-auto w-full"
                          unoptimized
                        />
                      </div>
                    )}
                  </div>
                </li>
              ))}
          </ol>
        </section>
      )}

      {/* Fields table */}
      {section.fields_table?.length > 0 && (
        <section className="mt-8" aria-labelledby={`fields-${section.slug}`}>
          <h2
            id={`fields-${section.slug}`}
            className="mb-3 text-sm font-black tracking-widest text-slate-500 uppercase"
          >
            Campos
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60">
                <tr>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-xs font-black tracking-widest text-slate-500 uppercase"
                  >
                    Campo
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-xs font-black tracking-widest text-slate-500 uppercase"
                  >
                    Tipo
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-xs font-black tracking-widest text-slate-500 uppercase"
                  >
                    Descripción
                  </th>
                  <th
                    scope="col"
                    className="px-4 py-2 text-left text-xs font-black tracking-widest text-slate-500 uppercase"
                  >
                    Valores válidos
                  </th>
                </tr>
              </thead>
              <tbody>
                {section.fields_table.map((f, i) => (
                  <tr
                    key={`${section.slug}-field-${i}`}
                    className="border-t border-slate-100 dark:border-slate-800"
                  >
                    <td className="px-4 py-2 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {f.name}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {f.type ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-600 dark:text-slate-300">
                      {f.description ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {f.valid_values ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Common cases */}
      {section.common_cases?.length > 0 && (
        <section className="mt-8" aria-labelledby={`cases-${section.slug}`}>
          <h2
            id={`cases-${section.slug}`}
            className="mb-3 text-sm font-black tracking-widest text-slate-500 uppercase"
          >
            Casos comunes
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {section.common_cases.map((c, i) => (
              <li
                key={`${section.slug}-case-${i}`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/60"
              >
                <p className="font-bold text-slate-800 dark:text-slate-100">{c.title}</p>
                <p className="mt-1 text-slate-600 dark:text-slate-300">{c.description}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Screenshots gallery */}
      {section.screenshots?.length > 0 && (
        <section className="mt-8" aria-labelledby={`shots-${section.slug}`}>
          <h2
            id={`shots-${section.slug}`}
            className="mb-3 text-sm font-black tracking-widest text-slate-500 uppercase"
          >
            Capturas
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {[...section.screenshots]
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((shot, i) => (
                <figure
                  key={`${section.slug}-shot-${i}`}
                  className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950/60"
                >
                  <Image
                    src={shot.url}
                    alt={shot.caption ?? `Captura ${i + 1} de ${section.title}`}
                    width={1600}
                    height={900}
                    className="h-auto w-full"
                    unoptimized
                  />
                  {shot.caption && (
                    <figcaption className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                      {shot.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
          </div>
        </section>
      )}
    </article>
  );
}

// Sprint 4 (BUG-4-07) — Renderiza las guías de integración en markdown
// (docs/integrations/<slug>.md) como páginas públicas /docs/integrations/<slug>.
//
// El wizard de Google Sheets enlaza aquí ("Ver guía paso a paso"). Antes el
// link daba 404 porque no existía ninguna ruta /docs/*. Esta ruta es generica:
// sirve cualquier .md de docs/integrations sin tener que crear una pagina por guia.

import fs from "fs";
import path from "path";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// El contenido vive en el repo; revalidar no aplica (estatico por build/dev).
export const dynamic = "force-static";

function resolveGuidePath(slug: string): string | null {
  // Anti path-traversal: solo kebab-case + dígitos.
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  const filePath = path.join(process.cwd(), "docs", "integrations", `${slug}.md`);
  return fs.existsSync(filePath) ? filePath : null;
}

export default async function IntegrationGuidePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const filePath = resolveGuidePath(slug);
  if (!filePath) notFound();

  const content = fs.readFileSync(filePath, "utf8");

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <article className="prose prose-slate dark:prose-invert max-w-none">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </article>
    </main>
  );
}

"""
Build script: convierte docs/ a un bundle HTML portable para entregar al cliente.

- Convierte todos los .md relevantes a .html con CSS coherente con PRESENTATION.html.
- Sanitiza 05-tokens-exposed.md: trunca JWT/secret values a su fingerprint (últimos 14 chars).
- Embebe Chart.js inline en PRESENTATION.html para funcionar 100% offline.
- Reescribe los enlaces .md -> .html en TODOS los archivos.
- Genera dist/audit-bundle/ con estructura navegable + index.html redirect.
- Hace ZIP con zipfile.

Uso: python docs/audit/_build/build_bundle.py
"""
from __future__ import annotations
import re, shutil, zipfile, datetime
from pathlib import Path
import markdown

ROOT = Path(__file__).resolve().parents[3]  # automatiza-formacion-dashboard/ (renombrado desde dashboard-af-main el 2026-05-20)
DOCS = ROOT / "docs"
BUILD_DIR = DOCS / "audit" / "_build"
OUT = ROOT / "docs" / "auditoria"
ZIP_OUT = ROOT / "docs" / "auditoria.zip"
CHARTJS = BUILD_DIR / "chart.umd.min.js"

# Archivos a incluir (relativos a docs/)
INCLUDE = [
    "README.md",
    "audit/findings-summary.md",
    "audit/gap-analysis-spec-vs-code.md",
    "audit/COMPARATIVA-INFORME-PROGRAMADOR-V3.5.md",
    "audit/STACK-DECISION-DRIZZLE-MIGRATION.md",
    "audit/PREGUNTAS-PARA-LA-CLIENTE.md",
    "audit/RESPUESTAS-CLIENTA-JAVIER-HP.md",
    "audit/DECISIONES-AUDITOR-JAVIER-HP.md",
    "audit/STACK-TECNOLOGICO.md",
    "audit/RESEARCH-CRM-SECTOR-FORMACION-ES-LATAM.md",
    "audit/00-client-spec-extraction.md",
    "audit/00-known-divergences.md",
    "audit/01-structure-findings.md",
    "audit/02-orchestrator-findings.md",
    "audit/03-llm-findings.md",
    "audit/04-data-findings.md",
    "audit/05-browser-verification.md",
    "audit/05-tokens-exposed.md",  # sanitized
    "audit/deep/DEEP-FINDINGS-SUMMARY.md",
    "audit/deep/EXECUTIVE-SUMMARY-FOR-CLIENT.md",
    "audit/deep/DA-1-concurrency-orchestrator.md",
    "audit/deep/DA-2-auth-rls-deep.md",
    "audit/deep/DA-3-security-deep.md",
    "audit/deep/DA-4-llm-voice-deep.md",
    "audit/deep/DA-5-accessibility.md",
    "architecture/overview.md",
    "architecture/layers-and-structure.md",
    "architecture/orchestrator-and-worker.md",
    "architecture/llm-stack.md",
    "architecture/data-layer.md",
    "security/secrets-and-env.md",
    "security/owasp-quick-check.md",
    "security/auth-and-rls.md",
    "dependencies/stack-versions.md",
    "dependencies/outdated.md",
    "dependencies/risk-matrix.md",
    "timeline/sprints-done.md",
    "timeline/feature-inventory.md",
    "roadmap/improvement-backlog.md",
    "roadmap/deep-improvement-backlog.md",
]

# --- CSS coherente con PRESENTATION.html (dark theme GitHub-like) ---
DOC_CSS = """
:root{--bg-0:#0a0e14;--bg-1:#0f1419;--bg-2:#161b22;--bg-3:#1f262d;
  --border:#30363d;--border-hi:#444c56;--text-0:#e6edf3;--text-1:#8b949e;--text-2:#6e7681;
  --accent:#58a6ff;--accent-2:#79c0ff;
  --critical:#f85149;--critical-bg:rgba(248,81,73,.12);
  --high:#ec8e2c;--high-bg:rgba(236,142,44,.12);
  --medium:#d4a72c;--medium-bg:rgba(212,167,44,.12);
  --low:#3fb950;--low-bg:rgba(63,185,80,.12);
  --info-bg:rgba(88,166,255,.12);}
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;
  background:var(--bg-0);color:var(--text-0);min-height:100vh;
  display:grid;grid-template-columns:240px 1fr}
::selection{background:var(--accent);color:#fff}
aside{position:sticky;top:0;height:100vh;background:var(--bg-1);
  border-right:1px solid var(--border);padding:24px 16px;overflow-y:auto;font-size:13px}
aside h3{font-size:11px;letter-spacing:.5px;text-transform:uppercase;color:var(--text-2);
  margin:18px 0 8px;padding-top:14px;border-top:1px solid var(--border)}
aside h3:first-of-type{border-top:none;padding-top:0;margin-top:0}
aside ul{list-style:none}
aside a{display:block;padding:5px 10px;border-radius:4px;color:var(--text-1);
  text-decoration:none;font-size:12px;line-height:1.4;transition:all .15s}
aside a:hover{background:var(--bg-2);color:var(--text-0)}
aside a.current{background:var(--info-bg);color:var(--accent-2);font-weight:500}
aside .home{display:block;margin-bottom:16px;font-weight:600;font-size:13px;color:var(--accent-2)}
main{padding:40px 56px;max-width:920px;line-height:1.65}
main h1{font-size:32px;letter-spacing:-.02em;margin-bottom:8px;line-height:1.15}
main h2{font-size:24px;letter-spacing:-.01em;margin:36px 0 12px;padding-bottom:8px;
  border-bottom:1px solid var(--border)}
main h3{font-size:18px;margin:28px 0 10px}
main h4{font-size:15px;margin:20px 0 8px;color:var(--text-1)}
main p,main li{margin-bottom:8px;color:var(--text-0)}
main ul,main ol{margin:8px 0 14px 24px}
main strong{color:var(--text-0);font-weight:600}
main em{color:var(--accent-2);font-style:normal}
main a{color:var(--accent);text-decoration:none}
main a:hover{text-decoration:underline}
main code{font:11.5px/1.4 'SF Mono','Consolas',Monaco,monospace;background:var(--bg-2);
  padding:2px 6px;border-radius:4px;color:var(--accent-2);border:1px solid var(--border)}
main pre{background:var(--bg-1);border:1px solid var(--border);border-radius:8px;
  padding:14px 16px;overflow-x:auto;margin:12px 0;font-size:12px;line-height:1.5}
main pre code{background:transparent;border:none;padding:0;color:var(--text-0)}
main blockquote{border-left:3px solid var(--accent);background:var(--info-bg);
  padding:10px 14px;margin:12px 0;color:var(--text-1);border-radius:0 6px 6px 0}
main blockquote p{margin-bottom:0}
main table{width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;
  background:var(--bg-2);border-radius:6px;overflow:hidden;border:1px solid var(--border)}
main th{background:var(--bg-1);text-align:left;padding:10px 12px;font-weight:600;font-size:11px;
  letter-spacing:.5px;text-transform:uppercase;color:var(--text-2);border-bottom:1px solid var(--border)}
main td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:top}
main tr:last-child td{border-bottom:none}
main tr:hover td{background:var(--bg-3)}
main hr{border:none;border-top:1px solid var(--border);margin:24px 0}
.frontmatter{background:var(--bg-2);border:1px solid var(--border);border-radius:8px;
  padding:14px 18px;margin-bottom:24px;font-size:12px;color:var(--text-1)}
.frontmatter strong{color:var(--text-0)}
.crumb{font-size:12px;color:var(--text-2);margin-bottom:16px}
.crumb a{color:var(--accent);text-decoration:none}
.crumb a:hover{text-decoration:underline}
.sev-critical{color:var(--critical);font-weight:600}
.sev-high{color:var(--high);font-weight:600}
.sev-medium{color:var(--medium);font-weight:600}
.sev-low{color:var(--low);font-weight:600}
@media (max-width:1024px){
  body{grid-template-columns:1fr}
  aside{position:relative;height:auto;border-right:none;border-bottom:1px solid var(--border)}
  main{padding:24px 20px}
}
"""

# Mapeo de rutas para la sidebar de cada doc-page
SIDEBAR_GROUPS = [
    ("Inicio", [
        ("Presentación visual", "PRESENTATION.html"),
        ("Índice navegable", "README.html"),
    ]),
    ("Resumen (técnico)", [
        ("Deep findings summary", "audit/deep/DEEP-FINDINGS-SUMMARY.html"),
        ("Findings summary (quick)", "audit/findings-summary.html"),
        ("Gap spec cliente vs código", "audit/gap-analysis-spec-vs-code.html"),
        ("⚖️ Comparativa vs informe programador", "audit/COMPARATIVA-INFORME-PROGRAMADOR-V3.5.html"),
        ("🛠️ Stack decision — Drizzle ORM", "audit/STACK-DECISION-DRIZZLE-MIGRATION.html"),
    ]),
    ("Para la cliente", [
        ("Resumen ejecutivo", "audit/deep/EXECUTIVE-SUMMARY-FOR-CLIENT.html"),
        ("❓ Preguntas pendientes", "audit/PREGUNTAS-PARA-LA-CLIENTE.html"),
        ("📝 Respuestas Auditor JaviHP", "audit/RESPUESTAS-CLIENTA-JAVIER-HP.html"),
        ("✍️ Decisiones del Auditor JaviHP", "audit/DECISIONES-AUDITOR-JAVIER-HP.html"),
        ("🧱 Stack tecnológico (HTML+PDF)", "audit/STACK-TECNOLOGICO.html"),
        ("🔎 Research — CRMs sector formación ES+Latam", "audit/RESEARCH-CRM-SECTOR-FORMACION-ES-LATAM.html"),
    ]),
    ("Quick scan (Fase 0-5)", [
        ("Spec cliente extraída", "audit/00-client-spec-extraction.html"),
        ("Divergencias conocidas", "audit/00-known-divergences.html"),
        ("Estructura del código", "audit/01-structure-findings.html"),
        ("Orchestrator + worker", "audit/02-orchestrator-findings.html"),
        ("Stack LLM", "audit/03-llm-findings.html"),
        ("Data layer + multi-tenant", "audit/04-data-findings.html"),
        ("Verificación navegador", "audit/05-browser-verification.html"),
        ("Tokens expuestos (sanitizado)", "audit/05-tokens-exposed.html"),
    ]),
    ("Deep audit (Fase deep)", [
        ("DA-1 Concurrencia/Orch", "audit/deep/DA-1-concurrency-orchestrator.html"),
        ("DA-2 Auth & RLS", "audit/deep/DA-2-auth-rls-deep.html"),
        ("DA-3 Security deep", "audit/deep/DA-3-security-deep.html"),
        ("DA-4 LLM + voice", "audit/deep/DA-4-llm-voice-deep.html"),
        ("DA-5 Accesibilidad WCAG", "audit/deep/DA-5-accessibility.html"),
    ]),
    ("Arquitectura", [
        ("Overview", "architecture/overview.html"),
        ("Capas y estructura", "architecture/layers-and-structure.html"),
        ("Orchestrator + worker", "architecture/orchestrator-and-worker.html"),
        ("Stack LLM", "architecture/llm-stack.html"),
        ("Data layer", "architecture/data-layer.html"),
    ]),
    ("Seguridad / Deps / Timeline", [
        ("Secretos y env", "security/secrets-and-env.html"),
        ("OWASP quick check", "security/owasp-quick-check.html"),
        ("Auth & RLS", "security/auth-and-rls.html"),
        ("Versiones del stack", "dependencies/stack-versions.html"),
        ("Outdated", "dependencies/outdated.html"),
        ("Risk matrix", "dependencies/risk-matrix.html"),
        ("Sprints históricos", "timeline/sprints-done.html"),
        ("Inventario features", "timeline/feature-inventory.html"),
    ]),
    ("Roadmap", [
        ("Backlog quick", "roadmap/improvement-backlog.html"),
        ("Backlog deep (129 items)", "roadmap/deep-improvement-backlog.html"),
    ]),
]


def relpath_from(file_rel: str, target: str) -> str:
    """Calcula ruta relativa desde file_rel (dentro del bundle) hasta target (también dentro)."""
    depth = file_rel.count("/")
    prefix = "../" * depth if depth else ""
    return prefix + target


def render_sidebar(file_rel: str, current_target: str) -> str:
    out = ['<aside>']
    out.append(f'<a href="{relpath_from(file_rel, "PRESENTATION.html")}" class="home">📊 Presentación visual</a>')
    for group_name, links in SIDEBAR_GROUPS[1:]:
        out.append(f'<h3>{group_name}</h3><ul>')
        for label, target in links:
            href = relpath_from(file_rel, target)
            cls = ' class="current"' if target == current_target else ''
            out.append(f'<li><a href="{href}"{cls}>{label}</a></li>')
        out.append('</ul>')
    out.append('</aside>')
    return "\n".join(out)


# YAML frontmatter parser simple
FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)


def extract_frontmatter(text: str):
    m = FRONTMATTER_RE.match(text)
    if not m:
        return {}, text
    body = text[m.end():]
    fm = {}
    for line in m.group(1).splitlines():
        line = line.rstrip()
        if not line or line.startswith("#") or line.startswith(" "):
            continue
        if ":" in line:
            k, _, v = line.partition(":")
            fm[k.strip()] = v.strip().strip('"').strip("'")
    return fm, body


def render_frontmatter(fm: dict) -> str:
    if not fm:
        return ""
    items = []
    keys_order = ["title", "date", "agent", "phase", "status", "audience",
                  "classification", "standard", "related_findings", "sources"]
    seen = set()
    for k in keys_order:
        if k in fm:
            items.append(f"<strong>{k}:</strong> {fm[k]}")
            seen.add(k)
    for k, v in fm.items():
        if k not in seen and k != "title":
            items.append(f"<strong>{k}:</strong> {v}")
    if not items:
        return ""
    return f'<div class="frontmatter">{" · ".join(items)}</div>'


# --- Sanitización de 05-tokens-exposed.md ---
JWT_RE = re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")
PASSWORD_PATTERNS = [
    (re.compile(r"postgres://postgres:[^@\s]+@"), "postgres://postgres:***REDACTED***@"),
    (re.compile(r"postgresql://postgres:[^@\s]+@"), "postgresql://postgres:***REDACTED***@"),
    (re.compile(r"automatiza_for_2025"), "automatiza_for_****"),
]


def sanitize_tokens_doc(text: str) -> str:
    # JWTs: dejar solo los últimos 14 chars
    def jwt_repl(m):
        full = m.group(0)
        return f"eyJ…[REDACTED]…{full[-14:]}"
    text = JWT_RE.sub(jwt_repl, text)
    # Passwords / tokens
    for pat, repl in PASSWORD_PATTERNS:
        text = pat.sub(repl, text)
    # Disclaimer al principio
    disclaimer = (
        "\n> ⚠️ **VERSIÓN SANITIZADA PARA ENTREGA AL CLIENTE.** Los valores completos "
        "de JWTs y secretos están truncados a sus últimos 14 caracteres (fingerprint). "
        "Los valores reales NO viajan en este ZIP — están solo en el repositorio de "
        "auditoría privado del equipo de desarrollo, separado del repo del cliente. "
        "Esta vista es suficiente para entender QUÉ está expuesto, dónde y cómo rotarlo.\n\n"
    )
    # Insertar después del frontmatter
    if text.startswith("---"):
        parts = text.split("---", 2)
        if len(parts) >= 3:
            return "---" + parts[1] + "---\n" + disclaimer + parts[2]
    return disclaimer + text


# --- Conversión markdown -> HTML ---
md = markdown.Markdown(extensions=["tables", "fenced_code", "toc"])


def md_to_html_body(md_text: str) -> str:
    md.reset()
    return md.convert(md_text)


def rewrite_links(html: str) -> str:
    """Cambia href="...md" -> href="...html". También href con anclas. Mantiene URLs externas intactas."""
    def repl(m):
        url = m.group(1)
        if url.startswith(("http://", "https://", "mailto:", "#")):
            return m.group(0)
        # Quitar query/anchor
        anchor = ""
        if "#" in url:
            url, _, anchor = url.partition("#")
            anchor = "#" + anchor
        if url.endswith(".md"):
            url = url[:-3] + ".html"
        return f'href="{url}{anchor}"'
    return re.sub(r'href="([^"]+)"', repl, html)


# --- PDF post-step: STACK-TECNOLOGICO.pdf ---
PRINT_CSS = """
@page { size: A4; margin: 14mm 12mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font: 10.5pt/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;
  color: #1a1f2c; background: #fff; padding: 0; }
h1 { font-size: 22pt; letter-spacing: -.02em; color: #0a3d62; margin-bottom: 4px;
  padding-bottom: 12px; border-bottom: 3px solid #0a3d62; }
h2 { font-size: 14pt; color: #0a3d62; margin: 22px 0 10px;
  padding-bottom: 6px; border-bottom: 2px solid #0a3d62; page-break-after: avoid; }
h3 { font-size: 11.5pt; color: #1a4e7a; margin: 16px 0 6px; page-break-after: avoid; }
h4 { font-size: 10.5pt; color: #1a4e7a; margin: 12px 0 4px; page-break-after: avoid; }
p, li { margin-bottom: 6px; font-size: 10pt; }
ul, ol { margin: 6px 0 10px 20px; }
strong { color: #1a1f2c; font-weight: 600; }
em { color: #1a4e7a; font-style: italic; }
a { color: #1a4e7a; text-decoration: none; }
code { font: 9pt/1.3 'Consolas',Monaco,monospace; background: #f0f3f7;
  padding: 1px 5px; border-radius: 3px; color: #0a3d62; border: 1px solid #d8dee6; }
pre { background: #f0f3f7; border: 1px solid #d8dee6; border-radius: 4px;
  padding: 8px 10px; margin: 8px 0; font-size: 9pt; overflow-x: auto; }
pre code { background: transparent; border: none; padding: 0; }
blockquote { border-left: 4px solid #0a3d62; background: #f0f6fc;
  padding: 8px 12px; margin: 10px 0; font-size: 10pt; }
blockquote p { margin-bottom: 4px; }
table { width: 100%; border-collapse: collapse; margin: 6px 0 14px;
  font-size: 9.5pt; page-break-inside: avoid; }
th { background: #0a3d62; color: #fff; text-align: left; padding: 6px 8px;
  font-weight: 600; font-size: 8.5pt; letter-spacing: .3px; text-transform: uppercase; }
td { padding: 5px 8px; border-bottom: 1px solid #e5e9ef; vertical-align: top; }
tr:last-child td { border-bottom: none; }
hr { border: none; border-top: 1px solid #d8dee6; margin: 16px 0; }
.frontmatter { background: #f0f6fc; border-left: 4px solid #0a3d62;
  padding: 10px 14px; margin: 12px 0 20px; font-size: 9.5pt; color: #4a5563; }
.frontmatter strong { color: #0a3d62; }
"""


def _find_chrome():
    """Localiza Chrome o Edge en Windows/macOS/Linux. Devuelve la ruta o None."""
    import os, platform
    candidates = []
    sys = platform.system()
    if sys == "Windows":
        candidates = [
            r"C:\Program Files\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
            r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        ]
    elif sys == "Darwin":
        candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
    else:  # Linux
        candidates = ["/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
                      "/usr/bin/microsoft-edge"]
    for c in candidates:
        if os.path.exists(c):
            return c
    return None


def build_stack_pdf():
    """Genera audit/STACK-TECNOLOGICO.pdf desde el MD fuente, con CSS print-friendly.
    Requiere Chrome o Edge instalado. Si no hay, lanza excepción (capturada por el caller)."""
    import subprocess, tempfile, os
    src = DOCS / "audit" / "STACK-TECNOLOGICO.md"
    if not src.exists():
        raise FileNotFoundError(f"No existe {src}")
    chrome = _find_chrome()
    if not chrome:
        raise RuntimeError("No se encontró Chrome ni Edge en rutas estándar")

    text = src.read_text(encoding="utf-8")
    fm, body = extract_frontmatter(text)
    title = fm.get("title", "Stack tecnológico")
    body_html = md_to_html_body(body)
    body_html = rewrite_links(body_html)
    fm_html = render_frontmatter(fm)

    print_html = f"""<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><title>{title}</title>
<style>{PRINT_CSS}</style></head>
<body><h1>{title}</h1>{fm_html}{body_html}</body></html>"""

    # Escribir HTML temporal junto al PDF para que las rutas relativas (si hubiera imgs) funcionen
    tmp_html = OUT / "audit" / "STACK-TECNOLOGICO-print.tmp.html"
    pdf_out = OUT / "audit" / "STACK-TECNOLOGICO.pdf"
    tmp_html.write_text(print_html, encoding="utf-8")

    src_uri = "file:///" + str(tmp_html).replace("\\", "/").replace(" ", "%20")
    cmd = [
        chrome, "--headless", "--disable-gpu", "--no-sandbox",
        f"--print-to-pdf={pdf_out}",
        "--no-pdf-header-footer",
        src_uri,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    # Limpiar temp HTML
    try:
        tmp_html.unlink()
    except Exception:
        pass

    if not pdf_out.exists() or pdf_out.stat().st_size < 1024:
        raise RuntimeError(f"Chrome no generó PDF válido. stderr: {result.stderr[:200]}")
    print(f"[ok]   STACK-TECNOLOGICO.pdf ({pdf_out.stat().st_size:,} bytes) via {os.path.basename(chrome)}")


# --- Build ---
def build():
    print(f"[build] Root: {ROOT}")
    print(f"[build] Out:  {OUT}")
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)

    converted = []
    for rel in INCLUDE:
        src = DOCS / rel
        if not src.exists():
            print(f"[skip] {rel} (no existe)")
            continue
        text = src.read_text(encoding="utf-8")
        # Sanitiza tokens si aplica
        if rel.endswith("05-tokens-exposed.md"):
            text = sanitize_tokens_doc(text)
        fm, body = extract_frontmatter(text)
        title = fm.get("title", src.stem.replace("-", " ").title())
        # Convertir markdown
        body_html = md_to_html_body(body)
        body_html = rewrite_links(body_html)
        # Path de salida
        out_rel = rel[:-3] + ".html"  # .md -> .html
        out_path = OUT / out_rel
        out_path.parent.mkdir(parents=True, exist_ok=True)
        # Sidebar relativa al archivo actual
        sidebar = render_sidebar(out_rel, out_rel)
        fm_html = render_frontmatter(fm)
        # Breadcrumb: link a presentación principal
        crumb_href = relpath_from(out_rel, "PRESENTATION.html")
        readme_href = relpath_from(out_rel, "README.html")
        page = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Audit Automatiza Formación Dashboard</title>
<style>{DOC_CSS}</style>
</head>
<body>
{sidebar}
<main>
<div class="crumb"><a href="{crumb_href}">← Presentación</a> · <a href="{readme_href}">Índice</a> · {rel}</div>
<h1>{title}</h1>
{fm_html}
{body_html}
</main>
</body>
</html>
"""
        out_path.write_text(page, encoding="utf-8")
        converted.append(out_rel)
        print(f"[ok]   {rel} -> {out_rel} ({out_path.stat().st_size:,} bytes)")

    # --- PRESENTATION.html con Chart.js inline ---
    print("\n[build] Procesando PRESENTATION.html con Chart.js inline...")
    pres_src = DOCS / "audit" / "PRESENTATION.html"
    pres_text = pres_src.read_text(encoding="utf-8")
    chartjs = CHARTJS.read_text(encoding="utf-8")
    # Reemplazar script src CDN por script inline
    replacement = f'<script>\n/* Chart.js v4.4.1 - embedded for offline use */\n{chartjs}\n</script>'
    pres_text = re.sub(
        r'<script src="https://cdn\.jsdelivr\.net/npm/chart\.js[^"]*"></script>',
        lambda m: replacement,
        pres_text
    )
    # Reescribir enlaces .md -> .html (cualquier referencia a docs)
    # Los hrefs en presentation apuntan a "deep/...html" y "...html" pero también algunos a .md indirectos
    pres_text = rewrite_links(pres_text)
    # Mover presentación a raíz del bundle (no en audit/)
    pres_text = pres_text.replace(
        'href="deep/', 'href="audit/deep/'
    ).replace(
        'href="findings-summary.html"', 'href="audit/findings-summary.html"'
    ).replace(
        'href="gap-analysis-spec-vs-code.html"', 'href="audit/gap-analysis-spec-vs-code.html"'
    ).replace(
        'href="05-tokens-exposed.html"', 'href="audit/05-tokens-exposed.html"'
    ).replace(
        'href="05-browser-verification.html"', 'href="audit/05-browser-verification.html"'
    ).replace(
        'href="../roadmap/', 'href="roadmap/'
    )
    (OUT / "PRESENTATION.html").write_text(pres_text, encoding="utf-8")
    print(f"[ok]   PRESENTATION.html ({(OUT / 'PRESENTATION.html').stat().st_size:,} bytes)")

    # --- index.html: redirect a presentación ---
    (OUT / "index.html").write_text(
        '<!DOCTYPE html><html><head><meta charset="UTF-8">'
        '<meta http-equiv="refresh" content="0; url=PRESENTATION.html">'
        '<title>Audit Automatiza Formación Dashboard</title></head>'
        '<body><p>Cargando presentación... <a href="PRESENTATION.html">Si no carga, haz click aquí</a></p>'
        '</body></html>',
        encoding="utf-8"
    )

    # --- LEEME.txt (texto plano para quien descomprima el ZIP) ---
    (OUT / "LEEME.txt").write_text(
        "AUDITORIA DASHBOARD-ESDEN\n"
        "==========================\n\n"
        "Para empezar: haz DOBLE CLICK en 'index.html' o en 'PRESENTATION.html'.\n"
        "Se abrirá en tu navegador (Chrome, Edge, Firefox, Safari).\n\n"
        "Funciona OFFLINE: no necesita conexión a internet ni servidor.\n"
        "Funciona desde cualquier carpeta donde lo descomprimas.\n\n"
        "Por dónde empezar:\n"
        " - Resumen para no-técnicos: audit/deep/EXECUTIVE-SUMMARY-FOR-CLIENT.html\n"
        " - Resumen técnico:          audit/deep/DEEP-FINDINGS-SUMMARY.html\n"
        " - Backlog ejecutable:       roadmap/deep-improvement-backlog.html\n\n"
        "Generado: " + datetime.date.today().isoformat() + "\n",
        encoding="utf-8"
    )

    # --- STACK-TECNOLOGICO.pdf (post-step opcional con Chrome headless) ---
    print("\n[build] Generando STACK-TECNOLOGICO.pdf (Chrome headless si disponible)...")
    try:
        build_stack_pdf()
    except Exception as e:
        print(f"[warn] No se pudo generar STACK-TECNOLOGICO.pdf: {e}")
        print("[warn] El HTML sigue disponible. El PDF es opcional.")

    # --- ZIP ---
    print(f"\n[build] Creando ZIP en {ZIP_OUT}...")
    ZIP_OUT.parent.mkdir(parents=True, exist_ok=True)
    if ZIP_OUT.exists():
        ZIP_OUT.unlink()
    with zipfile.ZipFile(ZIP_OUT, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for path in OUT.rglob("*"):
            if path.is_file():
                arc = path.relative_to(OUT.parent)  # incluye "audit-bundle/" como carpeta raíz
                zf.write(path, arc)
    print(f"[ok]   ZIP creado: {ZIP_OUT.stat().st_size:,} bytes")

    # Resumen
    total_files = sum(1 for _ in OUT.rglob("*") if _.is_file())
    total_size = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print(f"\n[done] Bundle: {total_files} archivos · {total_size:,} bytes")
    print(f"[done] ZIP:    {ZIP_OUT}")
    print(f"[done] Abre:   {OUT / 'PRESENTATION.html'}")


if __name__ == "__main__":
    build()

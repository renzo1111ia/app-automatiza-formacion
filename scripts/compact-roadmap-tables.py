"""
Compact wide markdown tables in plans/RoadMap.md.

Approach (validated 25-05-2026 sesion piloto, mitigado bug 26-05-2026):
- Detect markdown tables (header + separator + data rows).
- For each cell exceeding MAX_ANY_CELL chars: split into:
    head (<= MAX_NOTES_CELL chars, cut on punto/coma + "Ver nota fila <ID> ↓")
    tail (full original) → moved to footnote block AFTER the table
- Footnotes formatted as:
    > **Nota fila <ID>**: <tail>
- Skip tables marked with HTML comment `<!-- compacted-manually -->` on
  the line immediately before the header (mitigation: see memory file
  project-task-compactar-roadmap-pendiente.md).

Usage:
    python scripts/compact-roadmap-tables.py [--dry-run] [path/to/RoadMap.md]

Defaults to plans/RoadMap.md. Run from repo root.
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

# Tunables (validados en sesion piloto)
MAX_NOTES_CELL = 60      # head soft cap (cell content kept inline + "Ver nota↓")
MAX_ANY_CELL = 70        # hard cap: overflow → notas-pie
MAX_COL_PAD = 60         # max column width for header padding (recalibrado tras compactacion)
SKIP_MARKER = "<!-- compacted-manually -->"

# Columns that hold "ID" of the row (for nota-pie reference)
ID_COL_CANDIDATES = ("ID", "id", "Tarea", "Fase", "Sprint", "Bloque", "Phase")


def find_tables(lines: list[str]) -> list[tuple[int, int]]:
    """Return list of (header_idx, last_data_idx_inclusive) ranges."""
    tables: list[tuple[int, int]] = []
    i = 0
    n = len(lines)
    while i < n - 1:
        line = lines[i]
        nxt = lines[i + 1]
        # header row: starts and contains |, next is separator (|---|---|)
        if (
            line.lstrip().startswith("|")
            and "|" in line[1:]
            and re.match(r"^\s*\|[\s:|\-]+\|\s*$", nxt)
            and re.search(r"-", nxt)
        ):
            header_idx = i
            # find end of table (consecutive lines starting with |)
            j = i + 2
            while j < n and lines[j].lstrip().startswith("|"):
                j += 1
            if j - 1 > header_idx + 1:  # at least 1 data row
                tables.append((header_idx, j - 1))
            i = j
        else:
            i += 1
    return tables


def is_skipped(lines: list[str], header_idx: int) -> bool:
    """Check if table is marked to skip."""
    for k in range(max(0, header_idx - 3), header_idx):
        if SKIP_MARKER in lines[k]:
            return True
    return False


def split_row(row: str) -> list[str]:
    """Parse a markdown table row into cells (no leading/trailing empty)."""
    # strip outer | and split
    s = row.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.strip() for c in s.split("|")]


def rebuild_row(cells: list[str]) -> str:
    """Rebuild markdown table row from cells."""
    return "| " + " | ".join(cells) + " |"


def find_id_col(headers: list[str]) -> int:
    """Pick best column to use as row ID."""
    for i, h in enumerate(headers):
        hclean = re.sub(r"[*_`]", "", h).strip()
        for cand in ID_COL_CANDIDATES:
            if cand.lower() in hclean.lower():
                return i
    return 0  # fallback first column


def compact_cell(text: str) -> str:
    """Truncate cell content to MAX_NOTES_CELL, cut on punctuation."""
    if len(text) <= MAX_NOTES_CELL:
        return text
    # find last sentence boundary <= MAX_NOTES_CELL
    cut_pts = [m.end() for m in re.finditer(r"[.,;·]\s", text[:MAX_NOTES_CELL])]
    if cut_pts:
        return text[: cut_pts[-1]].rstrip() + " …"
    return text[: MAX_NOTES_CELL - 2].rstrip() + " …"


def slugify_id(id_text: str) -> str:
    """Clean id text for nota-pie display."""
    s = re.sub(r"[*_`]", "", id_text).strip()
    # keep first ~40 chars
    return s[:40] if len(s) > 40 else s


def process_table(
    lines: list[str], header_idx: int, last_idx: int
) -> tuple[list[str], list[str]] | None:
    """Return (new_table_lines, notes_lines) or None if nothing to compact."""
    header_row = lines[header_idx]
    data_rows = lines[header_idx + 2 : last_idx + 1]

    headers = split_row(header_row)
    id_col = find_id_col(headers)
    n_cols = len(headers)

    notes: list[str] = []
    new_data: list[str] = []
    any_change = False

    for row in data_rows:
        cells = split_row(row)
        # pad/truncate to header width
        if len(cells) < n_cols:
            cells = cells + [""] * (n_cols - len(cells))
        elif len(cells) > n_cols:
            # merge extras into last
            cells = cells[: n_cols - 1] + ["|".join(cells[n_cols - 1 :])]

        # IDs y subtotales: NO tocar filas de subtotal/separadores
        first_cell = re.sub(r"[*_`\s]", "", cells[0]).lower()
        is_subtotal = "subtotal" in first_cell or "total" in first_cell

        if is_subtotal:
            # subtotal row: kept as-is
            new_data.append(rebuild_row(cells))
            continue

        row_id_raw = cells[id_col] if id_col < len(cells) else ""
        row_id = slugify_id(row_id_raw) if row_id_raw else f"L{header_idx}"

        new_cells: list[str] = []
        for ci, cell in enumerate(cells):
            if ci == id_col:
                # never compact ID col
                new_cells.append(cell)
                continue
            if len(cell) <= MAX_ANY_CELL:
                new_cells.append(cell)
                continue
            # cell too long → compact + push to notes
            head = compact_cell(cell)
            new_cells.append(f"{head} _ver nota↓_")
            col_name = re.sub(r"[*_`]", "", headers[ci]).strip()
            notes.append(
                f"> **Nota fila `{row_id}` · {col_name}**: {cell}"
            )
            any_change = True

        new_data.append(rebuild_row(new_cells))

    if not any_change:
        return None

    # Re-align table: compute new column widths based on compacted content
    # so the header doesn't keep huge padding from the old wide cells.
    all_rows = [headers] + [split_row(r) for r in new_data]
    col_widths = [0] * n_cols
    for r in all_rows:
        for ci, c in enumerate(r):
            if ci < n_cols and len(c) > col_widths[ci]:
                col_widths[ci] = min(len(c), MAX_COL_PAD)

    def fmt_row(cells: list[str]) -> str:
        padded = []
        for ci, c in enumerate(cells):
            if ci >= n_cols:
                continue
            padded.append(c + " " * max(0, col_widths[ci] - len(c)))
        return "| " + " | ".join(padded) + " |"

    new_header = fmt_row(headers)
    new_sep = "| " + " | ".join("-" * col_widths[ci] for ci in range(n_cols)) + " |"
    new_data_aligned = [fmt_row(split_row(r)) for r in new_data]
    new_table = [new_header, new_sep] + new_data_aligned
    # ensure trailing newline-consistent: blocks of `>` joined with `>\n>\n>`
    note_block: list[str] = []
    if notes:
        note_block.append("")  # blank line before notes
        for idx, n in enumerate(notes):
            note_block.append(n)
            if idx < len(notes) - 1:
                note_block.append(">")  # separator inside blockquote (no MD028)
        note_block.append("")  # blank line after notes

    return new_table, note_block


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path", nargs="?", default="plans/RoadMap.md")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    path = Path(args.path)
    if not path.exists():
        print(f"ERROR: {path} no existe", file=sys.stderr)
        return 2

    raw = path.read_text(encoding="utf-8")
    lines = raw.splitlines()
    tables = find_tables(lines)
    print(f"Tables encontradas: {len(tables)}")

    # Process in REVERSE so earlier indices don't shift
    changes_applied = 0
    skipped = 0
    for header_idx, last_idx in reversed(tables):
        if is_skipped(lines, header_idx):
            skipped += 1
            continue
        result = process_table(lines, header_idx, last_idx)
        if result is None:
            continue
        new_table, note_block = result
        # Replace lines[header_idx:last_idx+1] with new_table, then insert
        # note_block right after.
        lines[header_idx : last_idx + 1] = new_table + note_block
        changes_applied += 1

    print(f"Tables modificadas: {changes_applied}")
    print(f"Tables omitidas por marker: {skipped}")

    if args.dry_run:
        print("(dry-run: no se escribe el fichero)")
        # Mostrar verificación de filas anchas residuales
        new_text = "\n".join(lines) + ("\n" if raw.endswith("\n") else "")
        check_wide_rows(new_text)
        return 0

    out = "\n".join(lines) + ("\n" if raw.endswith("\n") else "")
    path.write_text(out, encoding="utf-8")
    print(f"Escrito: {path}")

    # Verificación final
    check_wide_rows(out)
    return 0


def check_wide_rows(text: str) -> None:
    """Print rows still wider than thresholds for review."""
    wide_500 = 0
    wide_250 = 0
    max_width = 0
    max_line = 0
    for lineno, line in enumerate(text.splitlines(), 1):
        if not line.lstrip().startswith("|"):
            continue
        # find largest cell in this row
        cells = split_row(line)
        for c in cells:
            w = len(c)
            if w > max_width:
                max_width = w
                max_line = lineno
            if w > 500:
                wide_500 += 1
            if w > 250:
                wide_250 += 1
    print(f"Verificación: filas con celda >250 chars: {wide_250}")
    print(f"               filas con celda >500 chars: {wide_500}")
    print(f"               celda max width: {max_width} (línea {max_line})")


if __name__ == "__main__":
    sys.exit(main())

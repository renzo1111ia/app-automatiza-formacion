"""
Genera onboarding-team-YYYY-MM-DD.zip con todos los archivos NO trackeados
en git que el equipo necesita para replicar el proyecto en local y verificar
contra VPS como lo hace el orquestador.

Contenido:
- .env.local, .env.production-readonly  (secretos local + readonly VPS)
- infra/supabase-vps/.vault/  (SSH keys, Dokploy panel, dev-dash-envs, secrets, migrations)
- docs/Docs-entrega-clienta/  (spec autoritaria de la cliente)

El ZIP respeta la estructura relativa al root del proyecto, asi que descomprimirlo
sobre la raiz del clone reconstruye los paths originales.
"""

from __future__ import annotations
import sys
import zipfile
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

# Lista de paths (relativos a PROJECT_ROOT) a incluir. Las carpetas se anaden recursivas.
ITEMS = [
    ".env.local",
    ".env.production-readonly",
    "infra/supabase-vps/.vault",
    "docs/Docs-entrega-clienta",
]


def iter_files(root: Path) -> list[Path]:
    """Devuelve todos los ficheros bajo root (recursivo). Si root es fichero, [root]."""
    if root.is_file():
        return [root]
    if root.is_dir():
        return [p for p in root.rglob("*") if p.is_file()]
    return []


def main() -> int:
    today = datetime.now().strftime("%Y-%m-%d")
    out_name = f"onboarding-team-{today}.zip"
    out_path = PROJECT_ROOT / out_name

    if out_path.exists():
        print(f"[INFO] Sobrescribiendo {out_name}")
        out_path.unlink()

    missing: list[str] = []
    added: list[tuple[str, int]] = []
    total_bytes = 0

    with zipfile.ZipFile(out_path, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as zf:
        for item_rel in ITEMS:
            src = PROJECT_ROOT / item_rel
            files = iter_files(src)
            if not files:
                missing.append(item_rel)
                continue
            for fpath in files:
                arcname = fpath.relative_to(PROJECT_ROOT).as_posix()
                zf.write(fpath, arcname)
                size = fpath.stat().st_size
                added.append((arcname, size))
                total_bytes += size

    print(f"\n[OK] Generado: {out_path}")
    print(f"     Archivos: {len(added)}")
    print(f"     Tamano original: {total_bytes / 1024:.1f} KB")
    print(f"     Tamano comprimido: {out_path.stat().st_size / 1024:.1f} KB")

    if missing:
        print(f"\n[WARN] No encontrados (se omiten):")
        for m in missing:
            print(f"       - {m}")

    print("\n[CONTENIDO]")
    for arc, sz in added:
        print(f"  {sz:>10} bytes  {arc}")

    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())

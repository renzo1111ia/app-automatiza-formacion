import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3] / "docs" / "auditoria"
broken = []
total = 0
files_with_broken = set()

for html_file in ROOT.rglob("*.html"):
    text = html_file.read_text(encoding="utf-8")
    for m in re.finditer(r'href="([^"]+)"', text):
        url = m.group(1)
        if url.startswith(("http://", "https://", "mailto:", "#", "javascript:")):
            continue
        target = url.split("#")[0]
        if not target:
            continue
        total += 1
        resolved = (html_file.parent / target).resolve()
        if not resolved.exists():
            rel_src = html_file.relative_to(ROOT).as_posix()
            broken.append((rel_src, url))
            files_with_broken.add(rel_src)

print(f"Total internal links: {total}")
print(f"Broken: {len(broken)} (in {len(files_with_broken)} files)")
for src, url in broken[:25]:
    print(f"  [{src}] -> {url}")

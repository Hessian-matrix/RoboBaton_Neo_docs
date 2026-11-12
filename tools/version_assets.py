"""Refresh first-party CSS/JS content hashes without changing the page design."""
import hashlib
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / 'site'
for name in sorted(p.name for p in ROOT.glob('*.html')):
    path = ROOT / name
    def update(match):
        filename = match.group(1)
        digest = hashlib.sha256((ROOT / filename).read_bytes()).hexdigest()[:12]
        return filename + '?v=' + digest
    text = re.sub(r'([a-zA-Z0-9_.-]+[.](?:css|js))[?]v=[a-zA-Z0-9_-]+', update, path.read_text())
    path.write_text(text, encoding='utf-8')

# Embedded tutorials are HTML documents too: give each its own content version.
for path in ROOT.glob('*.html'):
    def version_frame(match):
        name = match.group(1)
        digest = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()[:12]
        return 'src="' + name + '?embedded=1&v=' + digest + '"'
    text = re.sub(r'src="([a-zA-Z0-9_.-]+\.html)\?embedded=1(?:&v=[a-zA-Z0-9_-]+)?"', version_frame, path.read_text())
    path.write_text(text, encoding='utf-8')

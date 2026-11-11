"""Refresh first-party CSS/JS content hashes without changing the page design."""
import hashlib
import re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / 'site'
for name in ['index.html', 'quick-start.html']:
    path = ROOT / name
    def update(match):
        filename = match.group(1)
        digest = hashlib.sha256((ROOT / filename).read_bytes()).hexdigest()[:12]
        return filename + '?v=' + digest
    text = re.sub(r'([a-zA-Z0-9_.-]+[.](?:css|js))[?]v=[a-f0-9]+', update, path.read_text())
    path.write_text(text, encoding='utf-8')

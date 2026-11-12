"""Check the original site assets, navigation and Sphinx synchronization."""
import hashlib
import json
import re
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'tmp/site'
DOCS = SITE / 'docs'
DOCS_URL = 'docs/'

class Page(HTMLParser):
    def __init__(self, text):
        super().__init__()
        self.links = []
        self.text = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        self.links.extend(value for key, value in attrs if key in ('href', 'src') and value)

    def handle_data(self, data):
        self.text.append(data)

names = json.loads((ROOT / 'site-manifest.json').read_text())
assert {p.name for p in SITE.iterdir()} == set(names) | {'.nojekyll', 'docs'}
assert (DOCS / 'searchindex.js').is_file()
assert (DOCS / 'search.html').is_file()
assert not (DOCS / '.doctrees').exists()
assert not (DOCS / '_sources').exists()
for name in names:
    data = (SITE / name).read_bytes()
    assert data == (ROOT / 'site' / name).read_bytes(), name
    if name.endswith('.glb'):
        assert data[:4] == b'glTF', name
        continue
    if name.endswith('.png'):
        assert data[:8] == bytes([137,80,78,71,13,10,26,10]), name
        continue
    text = data.decode('utf-8-sig')
    links = Page(text).links if name.endswith('.html') else []
    if name.endswith('.js'):
        links += re.findall(r'''(?m)^import\b[^;]*?from[ ]*['"]([^'"]+)['"]''', text)
    if name.endswith('.css'):
        links += re.findall(r'''url[(]['"]?([^)'"]+)''', text)
    for link in links:
        parsed = urlsplit(link)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        assert Path(parsed.path).as_posix() in names or parsed.path == 'docs/' or (parsed.path.startswith('docs/') and (SITE / parsed.path).exists()), (name, link)
        if parsed.query.startswith('v='):
            digest = hashlib.sha256((SITE / parsed.path).read_bytes()).hexdigest()[:12]
            assert digest == parsed.query[2:], (name, 'stale cache hash', link)
for filename in ['index.html', 'quick-start.html']:
    page = Page((SITE / filename).read_text())
    assert DOCS_URL in page.links
    assert 'docs.html' not in page.links
    assert '127.0.0.1' not in (SITE / filename).read_text()
for filename, phrases in {
    'product.html': ['小巧轻量', '193.8', '历史算法基准'],
    'quick-start.html': ['连接电脑', '出厂已标定', '无需重新标定'],
}.items():
    text = ''.join(Page((DOCS / filename).read_text()).text)
    for phrase in phrases:
        assert phrase in text, (filename, phrase)
print('PASS: original assets, relative dependencies, cache hashes, documentation links and synchronized text')

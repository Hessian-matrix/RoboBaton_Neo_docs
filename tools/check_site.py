"""Verify shared content, relative assets and the deployment boundary."""
import json
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'tmp/site'
DOCS = ROOT / 'tmp/docs'

class Page(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.links = []
        self.text = []
        self.feed(path.read_text(encoding='utf-8'))

    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src'):
                self.links.append(value)

    def handle_data(self, data):
        self.text.append(data)

content = json.loads((ROOT / 'source/product.json').read_text(encoding='utf-8'))
assert {p.name for p in SITE.iterdir()} == {'index.html', 'quick-start.html', 'style.css', '.nojekyll'}
for website, document, key in [('index.html', 'product.html', 'features'), ('quick-start.html', 'quick-start.html', 'steps')]:
    page = Page(SITE / website)
    doc = Page(DOCS / document)
    assert 'https://neo-docs.readthedocs.io/zh-cn/latest/' in page.links
    for item in content[key]:
        for field in ('title', 'text'):
            assert item[field] in ''.join(page.text), (website, field)
            assert item[field] in ''.join(doc.text), (document, field)
    for link in page.links:
        parsed = urlsplit(link)
        if not parsed.scheme and parsed.path:
            assert (SITE / parsed.path).is_file(), link
print('Shared content, website links and public artifact boundary: PASS')

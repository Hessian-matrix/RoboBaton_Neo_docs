"""Check both locale trees and language-switch targets before publishing."""
from pathlib import Path
from urllib.parse import urlsplit, unquote
from bs4 import BeautifulSoup

root = Path(__file__).resolve().parents[1] / 'tmp/site'
count = 0
for prefix, language in [('', 'en'), ('zh', 'zh-CN')]:
    directory = root / prefix
    for page in [*directory.glob('*.html'), *(directory/'docs').glob('*.html')]:
        soup = BeautifulSoup(page.read_text(encoding='utf8'), 'html.parser')
        if not soup.body: continue
        assert soup.html['lang'] == language, page
        switch = soup.select_one('.locale-switch')
        assert switch is not None, page
        assert len(switch.select('a')) == 2, page
        for anchor in switch.select('a'):
            target = (page.parent / unquote(urlsplit(anchor['href']).path)).resolve()
            assert target.is_file(), (page, target)
        if language == 'en':
            switch.decompose()
            for node in soup.select('script, style'): node.decompose()
            assert not any(0x3400 <= ord(c) <= 0x9fff for c in soup.get_text()), page
        count += 1
assert count >= 70, count
print(f'PASS: {count} localized pages, language switches and English page text')

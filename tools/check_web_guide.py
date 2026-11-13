import sys
from pathlib import Path

from bs4 import BeautifulSoup

root = Path(__file__).resolve().parents[1]
build = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'tmp/docs'
soup = BeautifulSoup((build / 'web-guide.html').read_text(encoding='utf-8'), 'html.parser')
article = soup.select_one('article')
assert article is not None
assert article.h1.get_text().startswith('网页总览')
headings = [heading.get_text(' ', strip=True).removesuffix(' #') for heading in article.select('h2')]
assert headings[:2] == ['1. 打开设备网页', '2. 认识功能页面']
assert article.find('a', href='http://192.168.11.1/') is not None
page_index = article.select_one('table.web-page-index')
assert page_index is not None and len(page_index.select('tbody tr')) == 8
for target in ['positioning', 'flight-page', 'device-settings', 'mount-settings',
               'recording', 'calibration', 'maintenance', 'api-examples']:
    assert page_index.find('a', href=target + '.html') is not None, target
figure = article.select_one('.web-overview-figure')
assert figure is not None and figure.img['src'].endswith('web-overview.png')
assert len(article.select('.web-overview-keys > div')) == 4
assert article.find(id='tutorial-first-run') is None
sections = [node.get('id') for node in article.select('section')]
assert 'tutorial-first-run' not in sections
assert article.find(id='tutorial-navigation').find_parent('details') is not None
assert article.find(id='tutorial-examples').find_parent('details') is not None
assert all(not node.has_attr('open') for node in article.select('details'))
assert not article.select('#tutorial-first-run video')
index = BeautifulSoup((build / 'index.html').read_text(encoding='utf-8'), 'html.parser')
chapter = index.select_one('nav[aria-label="Neo 网页的使用"]')
assert chapter is not None
assert chapter.find('a', href='web-guide.html') is not None
assert chapter.find('a', href='quick-start.html') is None
assert not soup.select('nav.bd-links a[href="quick-start.html"]')
legacy = BeautifulSoup((build / 'quick-start.html').read_text(encoding='utf-8'), 'html.parser')
assert legacy.find('meta', attrs={'http-equiv': 'refresh'})['content'].endswith('web-guide.html')
assert not legacy.select('article video')
print('PASS: overview first, four UI regions, no first-run section, optional common lessons and legacy redirect')

for name in ['web-guide', 'positioning', 'imaging', 'mount-settings', 'flight-page',
             'recording', 'calibration', 'device-settings', 'maintenance']:
    content = BeautifulSoup((build / (name + '.html')).read_text(encoding='utf-8'), 'html.parser').select_one('article')
    assert not content.select('.doc-lead, .admonition.note'), name
    assert '一次只学一个操作' not in content.get_text(), name
    assert '视频使用当前公开网页界面和本机演示数据' not in content.get_text(), name
    assert content.select_one('.product-footnote').get_text(strip=True) == '* 截图与视频为演示数据。', name

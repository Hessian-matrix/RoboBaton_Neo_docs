import ast
import struct
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
page_index = article.select_one('.web-page-grid')
assert page_index is not None and len(page_index.select('.web-page-card')) == 7
for target in ['positioning', 'flight-page', 'device-settings', 'mount-settings',
               'recording', 'calibration', 'maintenance']:
    assert page_index.find('a', href=target + '.html') is not None, target
assert not article.select('.web-overview-figure, .web-overview-details')
assert len(page_index.select('a.page-preview img')) == 7
overview = page_index.select_one('a.page-preview img')
assert overview['src'].endswith('page-vioTab-annotated.png')
assert all(label in overview['alt'] for label in ['启停定位', '运动轨迹', '相机图像', '位姿读数'])
assert overview.parent['href'] == overview['src']
assert page_index.find('a', href='api-examples.html') is None
for image in page_index.select('a.page-preview img'):
    assert (build / image['src']).is_file()
    assert image['src'].endswith('-annotated.png')
    assert image.parent['href'] == image['src']
annotation_source = ast.parse((root / 'tools/annotate_web_page.py').read_text(encoding='utf-8'))
annotation_map = next(ast.literal_eval(node.value) for node in annotation_source.body
                      if isinstance(node, ast.Assign) and any(isinstance(target, ast.Name) and target.id == 'annotations' for target in node.targets))
assert len(annotation_map) == 8
for name, labels in annotation_map.items():
    assert 3 <= len(labels) <= 4
    for title, bounds, points in labels:
        left, top, right, bottom = bounds
        assert 0 <= left < right <= 1280 and 0 <= top < bottom <= 800
        assert all(0 <= point[0] <= 1280 and 0 <= point[1] <= 800 for point in points)
    filename = 'page-' + name + '-annotated.png'
    if name == 'imaging':
        imaging_page = BeautifulSoup((build / 'imaging.html').read_text(encoding='utf-8'), 'html.parser')
        image = imaging_page.select_one('figure.web-page-overview img')
    else:
        image = page_index.find('img', src='_static/manual/' + filename)
    assert image is not None and all(label[0] in image['alt'] for label in labels), name
    original = (root / 'source/_static/manual' / ('page-' + name + '.png')).read_bytes()
    annotated = (root / 'source/_static/manual' / filename).read_bytes()
    assert struct.unpack('>II', annotated[16:24]) == struct.unpack('>II', original[16:24]) == (1280, 800)
    assert annotated != original
    assert (build / image['src']).read_bytes() == annotated
for card in page_index.select('.web-page-card'):
    assert card.h3.a is not None and card.p is not None
assert soup.find('script', src=lambda src: src and 'docs-image-viewer.js' in src) is not None
assert article.find(id='tutorial-first-run') is None
sections = [node.get('id') for node in article.select('section')]
assert 'tutorial-first-run' not in sections
assert not article.select('details, video, .doc-next, .product-footnote')
assert '操作演示' not in article.get_text()
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
positioning = BeautifulSoup((build / 'positioning.html').read_text(encoding='utf-8'), 'html.parser').select_one('article')
overview = positioning.select_one('figure.web-page-overview')
assert overview is not None and overview.img['src'].endswith('page-vioTab-annotated.png')
assert overview.select_one('a.image-reference')['href'].endswith('page-vioTab-annotated.png')
tutorial = positioning.find(id='tutorial-positioning')
assert tutorial.h2.get_text(strip=True).rstrip('#') == '功能演示'
assert len(tutorial.select('video')) == 3
imaging = BeautifulSoup((build / 'imaging.html').read_text(encoding='utf-8'), 'html.parser').select_one('article')
assert imaging.find_all(['figure', 'video'])[0].img['src'].endswith('page-imaging-annotated.png')
assert len(imaging.select('video')) == 3
assert [node['id'] for node in imaging.select('.web-lesson')] == ['preview-toggle', 'monitor-panel', 'depth-control']
assert imaging.select_one('#tutorial-imaging h2').get_text(strip=True).rstrip('#') == '功能演示'
assert [node['id'] for node in tutorial.select('.web-lesson')] == ['vio-control', 'trajectory-views', 'pose-readout']
assert positioning.find_all(['figure', 'video'])[0] == overview
assert not any(heading.get_text(strip=True).rstrip('#') == '实时视图' for heading in positioning.select('h2'))
print('PASS: seven annotated page images, original resolution and matching enlarged views; no examples card; legacy redirect retained')

for name in ['web-guide', 'positioning', 'imaging', 'mount-settings', 'flight-page',
             'recording', 'calibration', 'device-settings', 'maintenance']:
    page = BeautifulSoup((build / (name + '.html')).read_text(encoding='utf-8'), 'html.parser')
    content = page.select_one('article')
    assert not page.select('.bd-sidebar-secondary'), name
    directory = page.select_one('.docs-toc-rail > details.docs-page-toc')
    assert directory is not None and 'open' not in directory.attrs, name
    assert directory.select_one('nav a[href]') is not None, name
    assert not content.select('.doc-lead, .admonition.note'), name
    assert '一次只学一个操作' not in content.get_text(), name
    assert '视频使用当前公开网页界面和本机演示数据' not in content.get_text(), name
    if name != 'web-guide':
        assert content.select('.product-footnote')[-1].get_text(strip=True) == '* 截图与视频为演示数据。', name
    if name in ['mount-settings', 'flight-page', 'recording', 'calibration', 'device-settings', 'maintenance']:
        assert content.find_all(['figure', 'video'])[0].select_one('img[src$="-annotated.png"]'), name
        assert len(content.select('video')) == 3, name
        assert content.select_one('h2').get_text(strip=True).rstrip('#') == '功能演示', name
        assert content.select_one('.tutorial-notes') is not None, name
        assert len(content.select('.tutorial-notes p')) == 3, name
        assert '注意：' not in content.get_text(), name

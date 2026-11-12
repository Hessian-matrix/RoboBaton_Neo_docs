import sys
from pathlib import Path

from bs4 import BeautifulSoup


root = Path(__file__).resolve().parents[1]
build = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'tmp/docs'
soup = BeautifulSoup((build / 'product.html').read_text(encoding='utf-8'), 'html.parser')
article = soup.select_one('article')
assert article is not None


def heading_text(heading):
    return heading.get_text(' ', strip=True).removesuffix(' #')


assert [heading_text(heading) for heading in article.select('h2')] == [
    '硬件参数', '定位性能', '数据输出能力', '使用边界与下一步',
]
sections = {heading_text(section.find('h2')): section
            for section in article.select('section') if section.find('h2', recursive=False)}
assert [heading_text(heading) for heading in sections['硬件参数'].select('h3')] == [
    '外形尺寸与重量', '相机：分辨率、视场与快门', '惯性传感器与时间关联', '连接、供电与存储',
]
overview = article.select_one('.product-summary')
assert overview is not None
assert len(overview.select('p')) == 1
assert 'product-photos' in overview.find_previous_sibling().get('class', [])
assert '惯性传感器（IMU）' in overview.get_text()
assert '设备在哪里' in overview.get_text() and '设备朝向哪里' in overview.get_text()
assert not overview.select('h2, h3, table, ol, ul')
output = sections['数据输出能力']
boundaries = sections['使用边界与下一步'].find('ul', recursive=False)
assert boundaries is not None and len(boundaries.find_all('li', recursive=False)) == 3
assert 'GPS 经纬度' in boundaries.get_text() and '定位有效' in boundaries.get_text()
assert len(output.select('li')) == 3
assert not output.select('h3, table')
assert [link['href'] for link in output.select('a.reference.internal')] == [
    'imaging.html', 'api-guide.html', 'serial-pose.html',
]
footnotes = article.select('.product-footnote')
assert len(footnotes) == 1
assert len(footnotes[0].select('p:not(.rubric)')) == 13
assert all(note.get_text(strip=True).startswith('* ')
           for note in footnotes[0].select('p:not(.rubric)'))
assert 'doc-next' in footnotes[0].find_previous_sibling().get('class', [])
assert not sections['定位性能'].find_all('p', recursive=False)
assert any('采集规格不等于外发速率' in note.get_text() for note in footnotes)
assert not article.select('.product-flow')
image_sources = [item.get('src', '') for item in article.select('img')]
for filename in ['neo-bare-render.png', 'neo-enclosed-photo.webp', 'neo-size-comparison.webp']:
    assert any(source.endswith(filename) for source in image_sources), filename
assert len(article.select('.product-photos figure')) == 2
assert not article.select('.product-photos figcaption')
assert 'product-photos' in article.h1.find_next_sibling().get('class', [])
assert len(article.select('figure.product-scale-photo')) == 1
assert article.select_one('figure.product-scale-photo').find_parent('section').h3 is not None
assert not any(source.endswith(('vio-flow.svg', 'neo-product-side.svg', 'neo-bare-top.png',
                               'neo-bare-side.png', 'neo-enclosed.png', 'neo-shell-upper.png',
                               'neo-shell-bottom.png'))
               for source in image_sources)
details = article.select('details')
assert len(details) == 2
for detail, dataset, count in zip(details, ['EuRoC', 'UZH-FPV'], [11, 16]):
    assert not detail.has_attr('open')
    assert dataset in detail.summary.get_text()
    assert len(detail.select('table tbody tr')) == count
    assert not detail.select('h2, h3, details')
    assert detail.find_parent('section') == next(
        heading.parent for heading in sections['定位性能'].select('h3')
        if heading_text(heading) == dataset)

text = article.get_text(' ', strip=True)
for required in ['2026-10-17', 'QR-plain-20261017-full', '0.195%', '0.483%',
                 '不是当前固件', 'IMU 原点', '安装补偿', '3.3–5 V', '1.8 V']:
    assert required in text, required
assert [link['href'] for link in article.select('.doc-next a')] == [
    'installation.html', 'web-guide.html', 'api-examples.html',
]
print('PASS: product chapter order, parameter summary, 27 retained benchmark rows, closed details and next links')

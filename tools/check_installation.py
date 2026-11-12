import sys
from pathlib import Path

from bs4 import BeautifulSoup


root = Path(__file__).resolve().parents[1]
build = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'tmp/docs'
soup = BeautifulSoup((build / 'installation.html').read_text(encoding='utf-8'), 'html.parser')
article = soup.select_one('article')
assert article is not None
headings = [heading.get_text(' ', strip=True).removesuffix(' #')
            for heading in article.select('h2')]
assert headings == [
    '结构与尺寸', '连接总览', '选择供电方式',
]
structure = article.select_one('h2').parent
for filename in ['neo-bare-top.png', 'neo-bare-bottom.png', 'neo-bare-side.png',
                 'neo-shell-upper.png', 'neo-shell-bottom.png']:
    assert any(image.get('src', '').endswith(filename) for image in structure.select('img'))
assert len(structure.select('.installation-shells figure')) == 2
assert len(structure.select('table')) == 2
assert sum(link.get('href', '').endswith('.stl') for link in structure.select('a')) == 2
assert '18.1 mm' in structure.get_text() and '19.5 mm' in structure.get_text()
diagram = article.select_one('.installation-map')
assert diagram is not None
assert len(diagram.select('.installation-path')) == 2
targets = ['connect-computer.html', 'connect-phone.html',
           'connect-serial.html', 'mounting-flight-controller.html']
assert [link['href'] for link in diagram.select('.installation-targets a')] == [
    target for target in targets]
for target in targets:
    assert (build / target).is_file(), target
for card in diagram.select('.installation-targets a'):
    assert len(card.select('span')) == 2
    assert card.find('strong') is not None and card.find('b') is not None
assert article.find('a', href='mount-settings.html') is not None
assert article.find('a', href='serial-pose.html') is not None
assert soup.find(id='windows-usb-driver') is None
assert not any(image.get('src', '').endswith(('usb-path.svg', 'serial-wires.svg'))
               for image in article.select('img'))
text = article.get_text(' ', strip=True)
for required in ['3.3–5 V', '3.3 V LVTTL', 'RS-232', '共地', 'USB 转 TTL', 'OTG']:
    assert required in text, required
assert not any(image.get('src', '').endswith(('neo-product-side.svg', 'tf-steps.svg'))
               for image in article.select('img'))
assert 'ready' not in text and 'FLU' not in text and 'FRD' not in text
print('PASS: dimensions, four purpose/accessory/guide cards, wiring safety; no duplicate TF or coordinate tutorial')

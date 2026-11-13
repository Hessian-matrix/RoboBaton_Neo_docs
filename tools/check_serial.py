import sys
from pathlib import Path
from xml.etree import ElementTree

from bs4 import BeautifulSoup

root = Path(__file__).resolve().parents[1]
build = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'tmp/docs'
article = BeautifulSoup((build / 'connect-serial.html').read_text(encoding='utf-8'), 'html.parser').select_one('article')
assert article is not None
pin_image = article.find('img', alt='Neo背视图，TF卡槽在左、6pin接口在右；从上到下为1曝光同步、2触发、3TX、4RX、5GND、6VIN')
assert pin_image is not None and pin_image['src'].endswith('serial-pin-order.png')
figure = article.select_one('.serial-connection-figure')
assert figure is not None
assert figure.img['src'].endswith('serial-connection.svg')
assert '不代表插头朝向' in figure.get_text()
steps = article.select('.computer-step')
assert len(steps) == 3
assert [step.select_one('.rubric').get_text()[:2] for step in steps] == ['01', '02', '03']
assert len(article.select('details')) == 2
assert all(not detail.has_attr('open') for detail in article.select('details'))
assert len(article.select('details table')) == 2
text = article.get_text(' ', strip=True)
for required in ['3.3 V LVTTL', 'RS-232', '5 V 串口', 'VCC', '共地', '1.8 V', '3.3–5 V', '初始化']:
    assert required in text, required
for target in ['serial-pose.html', 'mounting-flight-controller.html']:
    assert article.select_one('.doc-next').find('a', href=target) is not None
svg = ElementTree.parse(root / 'source/_static/manual/serial-connection.svg')
assert 'VCC 不接' in ''.join(svg.getroot().itertext())
assert not article.select('iframe, script')
print('PASS: serial wiring image, three steps, optional RX, power safety and closed help sections')

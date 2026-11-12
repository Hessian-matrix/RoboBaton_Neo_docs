import sys
from pathlib import Path

from bs4 import BeautifulSoup


root = Path(__file__).resolve().parents[1]
build = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'tmp/docs'
soup = BeautifulSoup((build / 'connect-computer.html').read_text(encoding='utf-8'), 'html.parser')
article = soup.select_one('article')
assert article is not None
diagram = article.select_one('.computer-connection')
assert diagram is not None and diagram.get('aria-label')
assert diagram.select_one('svg') is not None
assert '192.168.11.1' in diagram.get_text()
assert diagram.select_one('img')['src'].endswith('neo-enclosed-photo.webp')
steps = article.select('.computer-step')
assert len(steps) == 3
assert [step.select_one('.rubric').get_text()[:2] for step in steps] == ['01', '02', '03']
details = article.select('details')
assert len(details) == 3
assert all(not detail.has_attr('open') for detail in details)
driver = article.select_one('details.computer-driver')
assert driver is not None and 'Windows 10' in driver.summary.get_text()
assert 'CDC NCM' in driver.get_text() and 'UsbNcm Host Device' in driver.get_text()
assert len(driver.select('.computer-driver-stages .rubric')) == 3
assert soup.find(id='computer-windows-usb-driver') is not None
assert not any('UsbNcm Host Device' in step.get_text() for step in steps)
assert article.select_one('.computer-success') is not None
for target in ['web-guide.html', 'api-examples.html']:
    assert article.select_one('.doc-next').find('a', href=target) is not None
assert not article.select('iframe, script')
print('PASS: connection diagram, three steps, collapsed optional drivers and troubleshooting, next-page links')

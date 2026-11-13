import sys
from pathlib import Path

from bs4 import BeautifulSoup

root = Path(__file__).resolve().parents[1]
build = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'tmp/docs'
article = BeautifulSoup((build / 'install-tf.html').read_text(encoding='utf-8'), 'html.parser').select_one('article')
assert article is not None
figure = article.select_one('.tf-insertion-figure')
assert figure is not None and figure.img['src'].endswith('tf-insertion.png')
model_source = (root / 'tools/tf-model.html').read_text(encoding='utf-8')
assert "from '../site/enclosure-model.js'" in model_source
assert 'const shell=createEnclosure();' in model_source
assert 'contactCount:8' in model_source
assert '金手指' in figure.get_text()
assert '金手指朝上' in figure.get_text()
assert '8个金手指朝上' in figure.img['alt']
assert (build / figure.img['src']).is_file()
steps = article.select('.computer-step')
assert len(steps) == 3
assert [step.select_one('.rubric').get_text()[:2] for step in steps] == ['01', '02', '03']
assert len(article.select('details')) == 2
assert all(not detail.has_attr('open') for detail in article.select('details'))
text = article.get_text(' ', strip=True)
assert '不表示金手指朝向' not in text
assert '不是金手指朝向图' not in text
for required in ['FAT32', 'exFAT', 'missing', 'unmounted', 'ready', '备份', '断电', '不会自动格式化', '不要在录制或写入时拔卡']:
    assert required in text, required
assert article.select_one('.doc-next').find('a', href='recording.html') is not None
assert not article.select('iframe, script')
print('PASS: TF position/direction illustration, three steps, closed format/status help and safe removal')

"""Build only the independent public product website."""
import html
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'tmp' / 'site'
DOCS = 'https://neo-docs.readthedocs.io/zh-cn/latest/'

def main():
    product = json.loads((ROOT / 'source/product.json').read_text(encoding='utf-8'))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    esc = html.escape
    nav = '<a href="index.html">产品介绍</a><a href="quick-start.html">快速开始</a><a href="' + DOCS + '">文档 ↗</a>'
    def cards(items, numbered=False):
        return ''.join('<article><span class="eyebrow">' + (f'{i:02d}' if numbered else 'ROBOBATON NEO') + '</span><h2>' + esc(item['title']) + '</h2><p>' + esc(item['text']) + '</p></article>' for i, item in enumerate(items, 1))
    pages = {
        'index.html': ('产品介绍', '<section class="hero"><span class="eyebrow">视觉 · 惯性 · 定位</span><h1>' + esc(product['tagline']) + '</h1><p>' + esc(product['description']) + '</p><a class="button" href="quick-start.html">开始使用 →</a></section><section class="cards">' + cards(product['features']) + '</section>'),
        'quick-start.html': ('快速开始', '<section class="hero"><span class="eyebrow">GET STARTED</span><h1>从连接到第一段轨迹</h1><p>准备设备，确认连接，然后开始实时定位。</p></section><section class="steps">' + cards(product['steps'], True) + '</section><p class="more"><a href="' + DOCS + 'quick-start.html">在文档中阅读快速开始 ↗</a></p>'),
    }
    for filename, (title, body) in pages.items():
        page = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="' + esc(product['description'], quote=True) + '"><title>' + title + ' · RoboBaton Neo</title><link rel="stylesheet" href="style.css"></head><body><header><a class="brand" href="index.html">RoboBaton <strong>Neo</strong></a><nav aria-label="主导航">' + nav + '</nav></header><main>' + body + '</main><footer>RoboBaton Neo · <a href="' + DOCS + '">产品文档</a></footer></body></html>'
        (OUTPUT / filename).write_text(page, encoding='utf-8')
    shutil.copyfile(ROOT / 'site/style.css', OUTPUT / 'style.css')
    (OUTPUT / '.nojekyll').touch()
    print(f'Product website: {OUTPUT}')

if __name__ == '__main__':
    main()

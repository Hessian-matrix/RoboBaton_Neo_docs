project = 'RoboBaton Neo 文档'
author = 'Baton'
copyright = '2026, Baton'
version = '0.1'
release = '0.1.0'
language = 'zh_CN'
extensions = []
source_suffix = {'.rst': 'restructuredtext'}
exclude_patterns = ['_build', 'Thumbs.db', '.DS_Store']
html_theme = 'sphinx_book_theme'
templates_path = ['_templates']
html_title = 'RoboBaton Neo 文档'
html_static_path = ['_static']
html_css_files = ['custom.css']
html_show_sourcelink = False
html_copy_source = False
html_theme_options = {
    'use_download_button': False,
    'repository_url': '',
    'use_repository_button': False,
    'use_issues_button': False,
    'use_edit_page_button': False,
    'home_page_in_toc': True,
    'show_navbar_depth': 1,
    'navbar_persistent': ['search-button-field'],
}

from pathlib import Path
from urllib.parse import urljoin
from bs4 import BeautifulSoup
from docutils import nodes
from docutils.parsers.rst import Directive

SITE_URL = 'https://hessian-matrix.github.io/RoboBaton_Neo_docs/'

class ProductContent(Directive):
    """Read documentation text from the same HTML that Pages publishes."""
    required_arguments = 1

    def run(self):
        filename = {'features': 'index.html', 'steps': 'quick-start.html'}[self.arguments[0]]
        path = Path(__file__).resolve().parents[1] / 'site' / filename
        self.state.document.settings.env.note_dependency(str(path))
        soup = BeautifulSoup(path.read_text(encoding='utf-8-sig'), 'html.parser')
        result = []
        # Document prose, specifications and benchmark tables; interactive canvas
        # and device probing remain on the independent website.
        for scope in soup.select('main, .spec-notes'):
            for tag in scope.select('h1, h2, h3, h4, p, dt, dd, table, .product-metrics, .sensor-big-number'):
                if tag.find_parent(['svg', 'table']) or tag.get('id') == 'check-result':
                    continue
                if tag.has_attr('hidden'):
                    continue
                text = tag.get_text(' ', strip=True)
                if not text:
                    continue
                if tag.name == 'table':
                    rows = [row.find_all(['th', 'td'], recursive=False) for row in tag.select('tr')]
                    rows = [row for row in rows if row]
                    if not rows:
                        continue
                    table = nodes.table()
                    group = nodes.tgroup(cols=max(map(len, rows)))
                    table += group
                    for _ in range(max(map(len, rows))):
                        group += nodes.colspec(colwidth=1)
                    body = nodes.tbody()
                    group += body
                    for cells in rows:
                        row = nodes.row()
                        for cell in cells:
                            entry = nodes.entry()
                            entry += nodes.paragraph(text=cell.get_text(' ', strip=True))
                            row += entry
                        body += row
                    result.append(table)
                elif tag.name.startswith('h'):
                    result.append(nodes.rubric(text=text))
                else:
                    paragraph = nodes.paragraph(text=text)
                    result.append(paragraph)
                    for link in tag.select('a[href]'):
                        href = link['href']
                        if href.startswith('#'):
                            continue
                        p = nodes.paragraph()
                        p += nodes.reference(text=link.get_text(' ', strip=True), refuri=urljoin(SITE_URL, href))
                        result.append(p)
        return result

def setup(app):
    app.add_directive('product-content', ProductContent)
    return {'parallel_read_safe': True, 'parallel_write_safe': True}

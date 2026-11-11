project = "RoboBaton Neo 文档"
author = "Baton"
copyright = "2026, Baton"
version = "0.1"
release = "0.1.0"
language = "zh_CN"

extensions = []
source_suffix = {
    ".rst": "restructuredtext",
}
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

html_theme = "sphinx_book_theme"
html_title = "RoboBaton Neo 文档"
html_static_path = ["_static"]
html_css_files = ["custom.css"]

# Shared source for GitHub Pages and Read the Docs.
import json
from pathlib import Path
from docutils import nodes
from docutils.parsers.rst import Directive

class ProductContent(Directive):
    required_arguments = 1

    def run(self):
        content_path = Path(__file__).with_name('product.json')
        self.state.document.settings.env.note_dependency(str(content_path))
        product = json.loads(content_path.read_text(encoding='utf-8'))
        key = self.arguments[0]
        result = []
        if key == 'features':
            result.append(nodes.paragraph(text=product['description']))
        for index, item in enumerate(product[key], 1):
            section = nodes.section(ids=[f'{key}-{index}'])
            section += nodes.title(text=item['title'])
            section += nodes.paragraph(text=item['text'])
            result.append(section)
        return result

def setup(app):
    app.add_directive('product-content', ProductContent)
    return {'parallel_read_safe': True, 'parallel_write_safe': True}

html_show_sourcelink = False
html_theme_options = {
    "repository_url": "",
    "use_repository_button": False,
    "use_issues_button": False,
    "use_edit_page_button": False,
    "home_page_in_toc": True,
    "show_navbar_depth": 1,
    "navbar_persistent": ["search-button-field"],
}


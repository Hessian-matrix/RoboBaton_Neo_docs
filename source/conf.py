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


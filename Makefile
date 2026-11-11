PYTHON      ?= $(if $(wildcard .venv/bin/python),.venv/bin/python,python3)
PIP         ?= $(PYTHON) -m pip
SPHINXBUILD ?= $(PYTHON) -m sphinx
SOURCEDIR   = source
BUILDDIR    = build

.DEFAULT_GOAL := help

help:
	@echo "Usage:"
	@echo "  make deps   Install documentation dependencies"
	@echo "  make html   Build HTML into build/html"
	@echo "  make serve  Serve build/html on port 8000"
	@echo "  make clean  Remove build outputs"

deps:
	@$(PIP) install -r "$(SOURCEDIR)/requirements.txt"

html:
	@$(SPHINXBUILD) -M html "$(SOURCEDIR)" "$(BUILDDIR)" -W --keep-going

serve:
	@$(PYTHON) -m http.server 8000 --directory "$(BUILDDIR)/html"

clean:
	@$(SPHINXBUILD) -M clean "$(SOURCEDIR)" "$(BUILDDIR)"

.PHONY: help deps html serve clean


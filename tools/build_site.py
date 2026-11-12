"""Publish the reviewed original website using an explicit asset manifest."""
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'tmp/site'

def main():
    names = json.loads((ROOT / 'site-manifest.json').read_text())
    source = (ROOT / 'site').resolve()
    documentation = ROOT / 'tmp/docs'
    for required in ['index.html', 'search.html', 'searchindex.js']:
        if not (documentation / required).is_file():
            raise ValueError('Build Sphinx documentation first: missing ' + required)
    for name in names:
        path = (source / name).resolve()
        if path.parent != source or not path.is_file():
            raise ValueError(f'Invalid public asset: {name}')
    if OUTPUT.exists():
        if OUTPUT.is_symlink() or OUTPUT.resolve() != ROOT / 'tmp/site':
            raise ValueError('Unexpected output directory')
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)
    for name in names:
        shutil.copyfile(source / name, OUTPUT / name)
    shutil.copytree(documentation, OUTPUT / 'docs',
                    ignore=shutil.ignore_patterns('.doctrees', '.buildinfo', '_sources', '*.map'))
    (OUTPUT / '.nojekyll').touch()
    print(f'Published {len(names)} reviewed assets to {OUTPUT}')

if __name__ == '__main__':
    main()

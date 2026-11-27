"""Deterministic offline locale generation; translations are reviewed repository data."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HAN = re.compile(r'[\u3400-\u9fff]')
PHRASE = re.compile(r'[\u3400-\u9fff][\u3400-\u9fff\u3000-\u303f\uff00-\uffef“”‘’…· \t]*')
TEXT_SUFFIXES = {'.html', '.js', '.json', '.rst', '.py', '.css', '.svg', '.vtt', '.md', '.txt', '.hpp', '.cpp', '.h', '.c'}

def phrases(text):
    return {m.group().strip() for m in PHRASE.finditer(text)}

def translate(text, catalogue, *, filename=''):
    for original, english in json.loads((ROOT/'locales/en-firmware.json').read_text(encoding='utf8')).items():
        text = text.replace(original, english)
    def replace(match):
        original = match.group(); key = original.strip()
        if key not in catalogue:
            raise ValueError('Missing English translation in %s: %s' % (filename, key))
        value = catalogue[key].replace('▁', ' ').strip().replace('"', '”').replace("'", '’').replace('\\', '/')
        # Keep technical identifiers beside translated words readable.
        before = text[match.start()-1:match.start()]
        after = text[match.end():match.end()+1]
        if before and re.match(r'[A-Za-z0-9]', before): value = ' ' + value
        if after and re.match(r'[A-Za-z0-9]', after): value += ' '
        if original.endswith((' ', '\t')): value += ' '
        return value
    return PHRASE.sub(replace, text)

def load_catalogue():
    return json.loads((ROOT/'locales/en.json').read_text(encoding='utf-8'))

def source_files():
    for directory in ('site', 'source'):
        for path in (ROOT/directory).rglob('*'):
            if path.is_file() and path.suffix in TEXT_SUFFIXES and '__pycache__' not in path.parts:
                yield path

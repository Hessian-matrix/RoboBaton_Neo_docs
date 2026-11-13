"""Reject native programs and unsafe links in the public Pages artifact."""
import argparse
from html.parser import HTMLParser
import io
import json
from pathlib import Path, PurePosixPath
import zipfile
from urllib.parse import unquote, urlsplit


BLOCKED_SUFFIXES = {'.exe', '.dll', '.com', '.scr', '.pif', '.msi', '.msix', '.msixbundle', '.appx', '.bat', '.cmd', '.ps1', '.vbs', '.vbe', '.wsf', '.hta', '.lnk', '.dmg', '.pkg', '.deb', '.rpm'}
NATIVE_HEADERS = (b'MZ', b'\x7fELF', b'\xfe\xed\xfa\xce', b'\xce\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xcf\xfa\xed\xfe')
MAX_ARCHIVE_BYTES = 64 * 1024 * 1024


class UnsafeArtifact(ValueError):
    pass


def check_name(name):
    path = PurePosixPath(unquote(name).replace('\\', '/'))
    if path.is_absolute() or '..' in path.parts or ':' in path.parts[0]:
        raise UnsafeArtifact('Unsafe archive path: ' + name)
    if path.suffix.lower() in BLOCKED_SUFFIXES:
        raise UnsafeArtifact('Executable download: ' + name)


class Page(HTMLParser):
    def __init__(self, name):
        super().__init__(convert_charrefs=True)
        self.name = name
        self.external_scripts = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        for attribute in ('href', 'src', 'action', 'data'):
            value = attrs.get(attribute, '')
            if not value:
                continue
            normalized = ''.join(character for character in value if ord(character) > 32)
            parsed = urlsplit(normalized)
            if parsed.scheme.lower() in {'javascript', 'vbscript'}:
                raise UnsafeArtifact('Executable URL in ' + self.name)
            if parsed.scheme.lower() == 'data' and normalized.lower().startswith(('data:text/html', 'data:application/javascript')):
                raise UnsafeArtifact('Active data URL in ' + self.name)
            if PurePosixPath(unquote(parsed.path)).suffix.lower() in BLOCKED_SUFFIXES:
                raise UnsafeArtifact('Executable link in ' + self.name + ': ' + value)
        if tag == 'script' and attrs.get('src'):
            parsed = urlsplit(attrs['src'])
            if parsed.netloc:
                if parsed.scheme != 'https':
                    raise UnsafeArtifact('Insecure external script in ' + self.name)
                self.external_scripts.add(attrs['src'])


def check_content(name, content, counts, depth=0):
    check_name(name)
    if content.startswith(NATIVE_HEADERS):
        raise UnsafeArtifact('Native program content: ' + name)
    suffix = PurePosixPath(name).suffix.lower()
    if suffix in {'.html', '.htm'}:
        page = Page(name)
        page.feed(content.decode('utf-8-sig'))
        counts['html_pages'] += 1
        counts['external_scripts'].update(page.external_scripts)
    if suffix == '.zip' or content.startswith((b'PK\x03\x04', b'PK\x05\x06')):
        if depth >= 3:
            raise UnsafeArtifact('Archive nesting exceeds review limit: ' + name)
        try:
            with zipfile.ZipFile(io.BytesIO(content)) as archive:
                if sum(member.file_size for member in archive.infolist()) > MAX_ARCHIVE_BYTES:
                    raise UnsafeArtifact('Archive exceeds review size: ' + name)
                for member in archive.infolist():
                    check_name(member.filename)
                    if member.is_dir():
                        continue
                    counts['archive_members'] += 1
                    check_content(member.filename, archive.read(member), counts, depth + 1)
        except (zipfile.BadZipFile, RuntimeError) as error:
            raise UnsafeArtifact('Unreadable archive: ' + name) from error


def inspect(directory):
    directory = Path(directory)
    if not (directory / 'index.html').is_file():
        raise UnsafeArtifact('Missing built website index.html')
    counts = {'files': 0, 'html_pages': 0, 'archive_members': 0, 'external_scripts': set()}
    for path in sorted(directory.rglob('*')):
        if path.is_symlink():
            raise UnsafeArtifact('Symbolic link in publication: ' + str(path))
        if path.is_file():
            counts['files'] += 1
            check_content(path.relative_to(directory).as_posix(), path.read_bytes(), counts)
    counts['external_scripts'] = sorted(counts['external_scripts'])
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', nargs='?', default=str(Path(__file__).resolve().parents[1] / 'tmp/site'))
    parser.add_argument('--report', type=Path)
    args = parser.parse_args()
    report = inspect(args.directory)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('PASS: publication security checks; ' + json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()

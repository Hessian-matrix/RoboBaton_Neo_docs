"""Validate every published tutorial asset and its searchable HTML transcript."""
import hashlib
import json
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

from bs4 import BeautifulSoup


root = Path(__file__).resolve().parents[1]
source = root / 'source/_static/web-tutorials'
build = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'tmp/docs'
groups = json.loads((source / 'catalog.json').read_text(encoding='utf-8'))
pages = {
    'navigation': 'web-guide', 'examples': 'web-guide', 'first-run': 'web-guide',
    'positioning': 'positioning', 'imaging': 'imaging', 'mount': 'mount-settings',
    'flight': 'flight-page', 'recording': 'recording', 'calibration': 'calibration',
    'settings': 'device-settings', 'update': 'maintenance',
}
seen = set()
total_bytes = 0
hashes = {}
unlisted = {'first-run', 'navigation', 'examples'}
published_lessons = 0
for group in groups:
    page = None if group['id'] in unlisted else BeautifulSoup(
        (build / (pages[group['id']] + '.html')).read_text(encoding='utf-8'), 'html.parser')
    for lesson in group['lessons']:
        identity = lesson['id']
        assert identity not in seen, identity
        seen.add(identity)
        is_published = identity in group.get('publishedLessons', [item['id'] for item in group['lessons']])
        if page is not None and not is_published:
            assert page.find(id=identity) is None, identity
        if page is not None and is_published:
            published_lessons += 1
            section = page.find(id=identity)
            assert section is not None, identity
            video = section.find('video')
            assert video is not None and 'controls' in video.attrs and 'playsinline' in video.attrs
            assert 'muted' in video.attrs
            assert video.get('preload') == 'none' and not any(key in video.attrs for key in ['autoplay', 'loop'])
            buttons = section.select('[data-tutorial-time]')
            assert len(buttons) == len(lesson['steps']) == 3
            assert [float(button['data-tutorial-time']) for button in buttons] == [step['time'] for step in lesson['steps']]
            for button, step in zip(buttons, lesson['steps']):
                assert step['text'] in button.get_text(), identity
            assert lesson['result'] in section.get_text() and lesson['caution'] in page.get_text()
            for attribute, element in [('src', video.source), ('poster', video), ('src', video.track)]:
                media_url = urlsplit(element[attribute])
                media_path = source / Path(media_url.path).name
                assert parse_qs(media_url.query)['v'] == [hashlib.sha256(media_path.read_bytes()).hexdigest()[:12]]
            assert '演示数据，不连接设备' in section.get_text()
        for suffix in ['webm', 'jpg', 'vtt']:
            filename = identity + '.' + suffix
            data = (source / filename).read_bytes()
            assert data == (build / '_static/web-tutorials' / filename).read_bytes(), filename
            if suffix == 'webm':
                assert data[:4] == bytes([26, 69, 223, 163]) and len(data) > 1000, filename
                total_bytes += len(data)
            elif suffix == 'jpg':
                assert data[:3] == bytes([255, 216, 255]), filename
            else:
                text = data.decode('utf-8')
                assert text.startswith('WEBVTT') and text.count('-->') == 3, filename
                assert all(step['text'] in text for step in lesson['steps']), filename
            hashes[filename] = hashlib.sha256(data).hexdigest()
assert len(seen) == 78
published = build / '_static/web-tutorials'
assert {file.name for file in published.iterdir()} == set(hashes) | {'catalog.json'}
assert not any(build.rglob('*fixture*'))
report = {'passed': True, 'realDevice': False, 'groups': len(groups) - len(unlisted), 'lessons': published_lessons,
          'validatedMediaSets': len(seen), 'unlistedGroups': sorted(unlisted),
          'steps': published_lessons * 3, 'videoBytes': total_bytes, 'sha256': hashes}
output = root / 'release/web-tutorials'
output.mkdir(parents=True, exist_ok=True)
(output / 'asset-report.json').write_text(json.dumps(report, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
print(f'PASS: {published_lessons} published lessons, {len(seen)} media sets validated, captions, posters and fallback text; {total_bytes / 1048576:.2f} MiB video')

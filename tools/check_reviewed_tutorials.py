import hashlib
import json
from pathlib import Path

from PIL import Image


root = Path(__file__).resolve().parents[1]
assets = root / 'source/_static/web-tutorials'
catalog = json.loads((assets / 'catalog.json').read_text(encoding='utf-8'))
lessons = {lesson['id']: lesson for group in catalog for lesson in group['lessons']}
published = [identity for group in catalog if group['id'] not in ['navigation', 'first-run', 'examples'] for identity in group['publishedLessons']]
report = json.loads((root / 'release/video-review/render-report.json').read_text(encoding='utf-8'))
videos = {video['id']: video for video in report['videos']}
assert report['passed'] and not report['realDevice']
assert set(videos) == set(published)
for identity in published:
    lesson = lessons[identity]
    video = videos[identity]
    assert video['passed'] and not video['realDevice'], identity
    assert video['duration'] == lesson['duration'], identity
    assert video['frames'] == lesson['duration'] * 25, identity
    assert video['mediaSha256'] == hashlib.sha256((assets / (identity + '.webm')).read_bytes()).hexdigest(), identity
    assert video['captionTop'] == 48 and video['sceneTop'] >= 110 and video['sceneBottom'] <= 680, identity
    assert [source['id'] for source in video['captureSources']] == lesson.get('sourceLessons', [identity]), identity
    for source in video['captureSources']:
        capture_path = root / 'tmp/reviewed-tutorials' / source['id'] / 'capture.json'
        assert source['captureSha256'] == hashlib.sha256(capture_path.read_bytes()).hexdigest(), source['id']
        capture = json.loads(capture_path.read_text(encoding='utf-8'))
        assert capture['passed'] and not capture['realDevice'] and capture['scale'] == 2, source['id']
        assert len(capture['frames']) == 72 and len(capture['actions']) == 3, source['id']
        with Image.open(capture_path.parent / capture['frames'][0]['filename']) as picture:
            assert picture.size == (2560, 2000), source['id']
        for stage in range(3):
            frames = [frame for frame in capture['frames'] if frame['stage'] == stage]
            assert len(frames) == 24, source['id']
            assert {frame['afterAction'] for frame in frames} == {False, True}, source['id']
            checks = [check for check in video['checks'] if check['source'] == source['id'] and check['stage'] == stage]
            assert {check['afterAction'] for check in checks} == {False, True}, source['id']
            assert all(check['targetContained'] for check in checks), source['id']
    assert (root / 'release/video-review' / video['storyboard']).is_file(), identity
print('PASS: all 24 published videos use current 2x captures, before/after frames, complete focus regions and safe captions')

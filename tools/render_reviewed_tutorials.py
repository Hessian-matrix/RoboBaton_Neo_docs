import concurrent.futures
import hashlib
import io
import json
import math
import os
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


root = Path(__file__).resolve().parents[1]
assets = root / 'source/_static/web-tutorials'
scratch = root / 'tmp/reviewed-tutorials'
output = root / 'release/video-review'
output.mkdir(parents=True, exist_ok=True)
catalog = json.loads((assets / 'catalog.json').read_text(encoding='utf-8'))
lessons = {lesson['id']: lesson for group in catalog for lesson in group['lessons']}
published = [(group, lessons[identity]) for group in catalog if group['id'] not in ['navigation', 'first-run', 'examples'] for identity in group['publishedLessons']]
ffmpeg = os.environ.get('FFMPEG_PATH', str(root / 'tmp/web-tutorials/browsers/ffmpeg-1011/ffmpeg-win64.exe'))
font_path = os.environ.get('TUTORIAL_FONT', 'C:/Windows/Fonts/msyh.ttc')
scene_top = 116
scene_height = 562
background = '#f6f7f8'


def fitted(region):
    width = max(360, region['width'], region['height'] * 1000 / scene_height)
    height = width * scene_height / 1000
    center_x = region['x'] + region['width'] / 2
    center_y = region['y'] + region['height'] / 2
    if width <= 1280:
        center_x = min(1280 - width / 2, max(width / 2, center_x))
    if height <= 1000:
        center_y = min(1000 - height / 2, max(height / 2, center_y))
    return center_x - width / 2, center_y - height / 2, center_x + width / 2, center_y + height / 2


def text_lines(text, draw, font, limit):
    lines = ['']
    for character in text:
        if draw.textlength(lines[-1] + character, font=font) > limit:
            lines.append(character)
        else:
            lines[-1] += character
    return lines


def region_image(source, region, camera):
    left, top, right, bottom = camera
    scale = 1000 / (right - left)
    canvas = Image.new('RGB', (1000, scene_height), background)
    box = (max(0, left), max(0, top), min(source.width / 2, right), min(source.height / 2, bottom))
    pixels = tuple(value * 2 for value in box)
    detail = source.crop(pixels)
    width = max(1, round((box[2] - box[0]) * scale))
    height = max(1, round((box[3] - box[1]) * scale))
    detail = detail.resize((width, height), Image.Resampling.LANCZOS)
    canvas.paste(detail, (round((box[0] - left) * scale), round((box[1] - top) * scale)))
    return canvas, scale


def render(item):
    group, lesson = item
    identity = lesson['id']
    directory = scratch / ('render-' + identity)
    directory.mkdir(exist_ok=True)
    command = [ffmpeg, '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg', '-r', '25', '-i', 'pipe:0',
               '-an', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-crf', '12', '-b:v', '1800k', str(directory / 'reviewed.webm')]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    heading = ImageFont.truetype(font_path, 19)
    disclosure = ImageFont.truetype(font_path, 16)
    caption_font = ImageFont.truetype(font_path, 28)
    small = ImageFont.truetype(font_path, 18)
    checks = []
    captures = []
    story = []
    encoded_frames = 0
    try:
        for segment, source_id in enumerate(lesson.get('sourceLessons', [identity])):
            capture_path = scratch / source_id / 'capture.json'
            capture = json.loads(capture_path.read_text(encoding='utf-8'))
            if not capture['passed'] or len(capture['frames']) != 72 or capture['scale'] != 2:
                raise RuntimeError('Incomplete high-resolution capture: ' + source_id)
            captures.append({'id': source_id, 'captureSha256': hashlib.sha256(capture_path.read_bytes()).hexdigest()})
            previous_key = None
            current_camera = None
            previous_scene = None
            transition_scene = None
            transition_start = 0
            for frame in range(225):
                time = frame / 25
                input_frame = capture['frames'][min(71, int(time * 8))]
                region = input_frame['region']
                target = fitted(region)
                key = (input_frame['stage'], input_frame['afterAction'])
                if key != previous_key:
                    start_camera = current_camera or target
                    transition_scene = previous_scene
                    transition_start = time
                    previous_key = key
                progress = min(1, (time - transition_start) / .6)
                eased = progress * progress * (3 - 2 * progress)
                current_camera = tuple(first + (second - first) * eased for first, second in zip(start_camera, target))
                crossfade = input_frame['afterAction'] and input_frame.get('operation') != 'focus'
                if crossfade and transition_scene is not None:
                    current_camera = target
                with Image.open(scratch / source_id / input_frame['filename']) as source:
                    scene, zoom = region_image(source, region, current_camera)
                if crossfade and transition_scene is not None and progress < .45:
                    scene = Image.blend(transition_scene, scene, progress / .45)
                previous_scene = scene.copy()
                canvas = Image.new('RGB', (1000, 750), background)
                canvas.paste(scene, (0, scene_top))
                draw = ImageDraw.Draw(canvas)
                title = group['title'].replace('页面', '')
                draw.text((24, 13), title, font=heading, fill='#293039')
                draw.text((976, 15), '演示数据 · 未连接设备', font=disclosure, fill='#66707a', anchor='ra')
                label = lessons[source_id]['steps'][input_frame['stage']]['text']
                lines = text_lines(label, draw, caption_font, 900)
                if len(lines) > 2:
                    raise RuntimeError('Caption is too long: ' + identity)
                for line_index, line in enumerate(lines):
                    draw.text((24, 48 + line_index * 31), line, font=caption_font, fill='#293039')
                target_box = region['target']
                if input_frame.get('operation') != 'focus' and target_box['width'] < 700 and target_box['height'] < 200:
                    pointer_x = (target_box['x'] + target_box['width'] / 2 - current_camera[0]) * zoom
                    pointer_y = scene_top + (target_box['y'] + target_box['height'] / 2 - current_camera[1]) * zoom
                    if 12 < pointer_x < 988 and scene_top + 12 < pointer_y < scene_top + scene_height - 12:
                        draw.ellipse((pointer_x - 12, pointer_y - 12, pointer_x + 12, pointer_y + 12), outline='#397d63', width=3)
                stage = input_frame['stage']
                draw.line((24, 705, 976, 705), fill='#e0e3e7', width=2)
                draw.text((24, 718), str(stage + 1).zfill(2) + ' / 03', font=small, fill='#66707a')
                if frame in [20, 58, 95, 133, 170, 208]:
                    filename = source_id + '-' + str(stage) + ('-after' if input_frame['afterAction'] else '-before') + '.jpg'
                    canvas.save(directory / filename, quality=94)
                    story.append({'filename': str(directory / filename), 'time': segment * 9 + time, 'label': label})
                    left, top, right, bottom = target
                    contained = region['x'] >= left - 1 and region['y'] >= top - 1 and region['x'] + region['width'] <= right + 1 and region['y'] + region['height'] <= bottom + 1
                    if not contained:
                        raise RuntimeError('Focus cropped a target: ' + source_id)
                    checks.append({'source': source_id, 'stage': stage, 'afterAction': input_frame['afterAction'], 'time': segment * 9 + time, 'zoom': 1000 / (right - left), 'targetContained': contained, 'selector': region['selector']})
                if segment == 0 and frame == 58:
                    canvas.save(assets / (identity + '.jpg'), quality=94)
                encoded = io.BytesIO()
                canvas.save(encoded, format='JPEG', quality=94)
                encoder.stdin.write(encoded.getvalue())
                encoded_frames += 1
    finally:
        encoder.stdin.close()
    if encoder.wait() != 0:
        raise RuntimeError('Encoding failed: ' + identity)
    (directory / 'reviewed.webm').replace(assets / (identity + '.webm'))
    columns = 3
    rows = math.ceil(len(story) / columns)
    sheet = Image.new('RGB', (1200, rows * 330 + 50), 'white')
    sheet_draw = ImageDraw.Draw(sheet)
    sheet_draw.text((16, 12), lesson['title'] + ' · 操作前 / 操作后', font=heading, fill='#293039')
    for index, shot in enumerate(story):
        with Image.open(shot['filename']) as picture:
            sheet.paste(picture.resize((400, 300), Image.Resampling.LANCZOS), ((index % 3) * 400, 50 + (index // 3) * 330))
        sheet_draw.text(((index % 3) * 400 + 10, 352 + (index // 3) * 330), str(round(shot['time'], 2)) + ' s', font=small, fill='#66707a')
    sheet.save(output / (identity + '-storyboard.jpg'), quality=92)
    print('PASS render ' + identity, flush=True)
    return {'id': identity, 'title': lesson['title'], 'passed': True, 'realDevice': False, 'duration': lesson['duration'], 'frames': encoded_frames, 'mediaSha256': hashlib.sha256((assets / (identity + '.webm')).read_bytes()).hexdigest(), 'captionTop': 48, 'sceneTop': scene_top, 'sceneBottom': scene_top + scene_height, 'captureSources': captures, 'checks': checks, 'storyboard': identity + '-storyboard.jpg'}


if __name__ == '__main__':
    wanted = os.environ.get('TUTORIAL_ONLY')
    selected = [item for item in published if not wanted or item[1]['id'] in wanted.split(',')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as workers:
        results = list(workers.map(render, selected))
    report_path = output / 'render-report.json'
    previous = json.loads(report_path.read_text(encoding='utf-8'))['videos'] if report_path.is_file() else []
    merged = {item['id']: item for item in previous}
    merged.update({item['id']: item for item in results})
    report_path.write_text(json.dumps({'passed': True, 'realDevice': False, 'videos': list(merged.values())}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

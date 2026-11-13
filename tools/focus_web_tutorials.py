import concurrent.futures
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


root = Path(__file__).resolve().parents[1]
assets = root / 'source/_static/web-tutorials'
scratch = root / 'tmp/focused-tutorials'
scratch.mkdir(parents=True, exist_ok=True)
ffmpeg = os.environ.get('FFMPEG_PATH', str(root / 'tmp/web-tutorials/browsers/ffmpeg-1011/ffmpeg-win64.exe'))
font_path = os.environ.get('TUTORIAL_FONT', 'C:/Windows/Fonts/msyh.ttc')
catalog = json.loads((assets / 'catalog.json').read_text(encoding='utf-8'))
cameras = {
    'mount-platform': [(0, 70, 1000, 600), (0, 410, 650, 250), (0, 410, 650, 250)],
    'mount-coordinates': [(0, 80, 650, 500)] * 3,
    'mount-orientation': [(0, 120, 650, 450)] * 3,
    'mount-position': [(0, 200, 650, 430)] * 3,
    'mount-simulation': [(0, 70, 1000, 600), (100, 120, 800, 450), (0, 280, 900, 350)],
    'mount-matrix': [(120, 70, 760, 580)] * 3,
    'mount-save': [(0, 300, 650, 330), (480, 300, 510, 330), (480, 300, 510, 330)],
    'flight-scan': [(190, 95, 800, 530)] * 3,
    'flight-manual': [(200, 100, 790, 540)] * 3,
    'flight-parameters': [(210, 100, 780, 540)] * 3,
    'flight-apply': [(210, 100, 780, 540)] * 3,
    'flight-verify': [(220, 90, 770, 550)] * 3,
    'record-destination': [(0, 530, 340, 200)] * 3,
    'record-channels': [(0, 530, 340, 200)] * 3,
    'record-preflight': [(0, 420, 340, 280)] * 3,
    'record-tf': [(0, 530, 340, 200), (0, 520, 340, 200), (0, 530, 340, 200)],
    'record-browser': [(0, 530, 340, 200), (0, 530, 340, 200), (0, 100, 990, 540)],
    'record-catalog': [(0, 100, 990, 530), (0, 100, 990, 530), (120, 100, 760, 530)],
    'record-download-delete': [(110, 90, 780, 550), (350, 280, 640, 370), (350, 280, 640, 370)],
    'calibration-board': [(180, 210, 750, 440), (180, 170, 750, 470), (20, 160, 800, 490)],
    'calibration-measure-tag': [(0, 170, 700, 480)] * 3,
    'calibration-settings': [(120, 90, 760, 550)] * 3,
    'calibration-motion': [(30, 70, 940, 560), (30, 70, 940, 560), (0, 250, 800, 400)],
    'calibration-finish': [(0, 200, 900, 450)] * 3,
    'calibration-solve': [(0, 220, 900, 430)] * 3,
    'calibration-results': [(30, 70, 940, 580), (20, 170, 900, 460), (20, 170, 900, 460)],
    'calibration-filter': [(40, 100, 920, 550)] * 3,
    'calibration-save': [(0, 260, 950, 390)] * 3,
    'network-read': [(30, 200, 750, 430)] * 3,
    'network-change': [(40, 230, 740, 410)] * 3,
    'button-actions': [(0, 130, 640, 510)] * 3,
    'button-channels': [(0, 200, 640, 440)] * 3,
    'boot-start': [(0, 170, 500, 330)] * 3,
    'update-version': [(0, 80, 990, 550)] * 3,
    'update-upload': [(0, 210, 850, 430)] * 3,
    'update-install': [(0, 240, 990, 400), (150, 120, 700, 500), (150, 120, 700, 500)],
    'update-reboot': [(0, 300, 990, 350), (150, 120, 700, 500), (0, 300, 990, 350)],
}


def bounds(camera):
    left, top, width, height = camera
    width = min(1000, max(width, height * 1000 / 640))
    height = width * 640 / 1000
    left = max(0, min(left + camera[2] / 2 - width / 2, 1000 - width))
    bottom_limit = 740 if camera[0] == 0 and camera[1] >= 400 and camera[2] <= 550 else 655
    top = max(0, min(top + camera[3] / 2 - height / 2, bottom_limit - height))
    return left, top, left + width, top + height


def render(lesson):
    identity = lesson['id']
    directory = scratch / identity
    directory.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype(font_path, 26)
    small = ImageFont.truetype(font_path, 18)
    staged = directory / 'focused.webm'
    command = [ffmpeg, '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg',
               '-r', '25', '-i', 'pipe:0', '-an', '-c:v', 'libvpx', '-deadline', 'realtime',
               '-cpu-used', '8', '-crf', '16', '-b:v', '1200k', str(staged)]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE)
    frames = 0
    sources = []
    try:
        previous = bounds((0, 50, 1000, 600))
        for segment, source_id in enumerate(lesson['sourceLessons']):
            source = assets / (source_id + '.webm')
            decoded = directory / source_id
            decoded.mkdir(exist_ok=True)
            subprocess.run([ffmpeg, '-y', '-loglevel', 'error', '-i', str(source), '-r', '10',
                            '-t', '9', '-c:v', 'png', '-f', 'image2', str(decoded / 'frame-%03d.png')], check=True)
            images = sorted(decoded.glob('frame-*.png'))
            if len(images) < 88:
                raise RuntimeError('Incomplete source clip: ' + source_id)
            sources.append({'id': source_id, 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
            for frame in range(225):
                time = frame / 25
                stage = min(2, int(time / 3))
                target = bounds(cameras[source_id][stage])
                start = previous if stage == 0 else bounds(cameras[source_id][stage - 1])
                progress = min(1, (time - stage * 3) / .8)
                progress = progress * progress * (3 - 2 * progress)
                camera = tuple(first + (second - first) * progress for first, second in zip(start, target))
                with Image.open(images[min(len(images) - 1, int(time * 10))]) as source_image:
                    focus = source_image.crop(camera).resize((1000, 640), Image.Resampling.LANCZOS)
                canvas = Image.new('RGB', (1000, 750), '#f6f7f8')
                canvas.paste(focus, (0, 48))
                draw = ImageDraw.Draw(canvas)
                draw.text((24, 13), '真实界面 · 演示数据，不连接设备', font=small, fill='#66707a')
                draw.rectangle((0, 688, 1000, 750), fill='white')
                absolute_time = segment * 9 + time
                label = next(step['text'] for step in reversed(lesson['steps']) if step['time'] <= absolute_time)
                draw.text((500, 718), label, font=font, fill='#293039', anchor='mm')
                if frame == 50:
                    canvas.save(directory / ('segment-' + str(segment) + '.png'))
                if frames == 50:
                    canvas.save(assets / (identity + '.jpg'), quality=92)
                encoded = io.BytesIO()
                canvas.save(encoded, format='JPEG', quality=92)
                encoder.stdin.write(encoded.getvalue())
                frames += 1
            previous = target
    finally:
        encoder.stdin.close()
    if encoder.wait() != 0:
        raise RuntimeError('Focused encoding failed: ' + identity)
    staged.replace(assets / (identity + '.webm'))
    timestamp = lambda seconds: '00:00:' + str(seconds).zfill(2) + '.000'
    captions = 'WEBVTT\n\n' + '\n'.join(
        timestamp(step['time']) + ' --> ' + timestamp(lesson['steps'][index + 1]['time'] if index < 2 else lesson['duration'])
        + '\n' + step['text'] + '\n' for index, step in enumerate(lesson['steps']))
    (assets / (identity + '.vtt')).write_text(captions, encoding='utf-8')
    print('PASS: ' + identity + ', ' + str(lesson['duration']) + ' seconds, moving focus', flush=True)
    return {'id': identity, 'passed': True, 'frames': frames, 'duration': lesson['duration'], 'sources': sources}


if __name__ == '__main__':
    lessons = [lesson for group in catalog for lesson in group['lessons'] if lesson.get('sourceLessons')]
    wanted = os.environ.get('TUTORIAL_ONLY')
    if wanted:
        lessons = [lesson for lesson in lessons if lesson['id'] in wanted.split(',')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as workers:
        report = list(workers.map(render, lessons))
    output = root / 'release/web-tutorials'
    output.mkdir(parents=True, exist_ok=True)
    report_path = output / 'focused-pages-report.json'
    previous = json.loads(report_path.read_text(encoding='utf-8'))['lessons'] if report_path.is_file() else []
    merged = {item['id']: item for item in previous}
    merged.update({item['id']: item for item in report})
    report_path.write_text(json.dumps({'passed': True, 'realDevice': False, 'lessons': list(merged.values())}, indent=2) + '\n', encoding='utf-8')

import io
import json
import os
from pathlib import Path
import subprocess

from PIL import Image, ImageDraw, ImageFont


root = Path(__file__).resolve().parents[1]
scratch = root / 'tmp/web-tutorials/monitor-focused'
assets = root / 'source/_static/web-tutorials'
capture = json.loads((scratch / 'capture.json').read_text(encoding='utf-8'))
font_path = os.environ.get('TUTORIAL_FONT', 'C:/Windows/Fonts/msyh.ttc')
font = ImageFont.truetype(font_path, 26)
small = ImageFont.truetype(font_path, 19)
ffmpeg = os.environ.get('FFMPEG_PATH', str(root / 'tmp/web-tutorials/browsers/ffmpeg-1011/ffmpeg-win64.exe'))


def fitted(camera):
    width = max(camera['width'], camera['height'] * 1000 / 640)
    height = width * 640 / 1000
    center_x = camera['x'] + camera['width'] / 2
    center_y = camera['y'] + camera['height'] / 2
    left = max(0, min(center_x - width / 2, capture['width'] - width))
    top = max(0, min(center_y - height / 2, capture['height'] - height))
    return (left, top, left + width, top + height)


readouts, charts, controls = map(fitted, capture['cameras'])
overview = (0, 0, 1280, 819.2)
command = [ffmpeg, '-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'mjpeg',
           '-r', '25', '-i', 'pipe:0', '-an', '-c:v', 'libvpx', '-deadline', 'realtime',
           '-cpu-used', '8', '-crf', '16', '-b:v', '1200k', str(assets / 'monitor-panel.webm')]
process = subprocess.Popen(command, stdin=subprocess.PIPE)
frames = []
try:
    for index in range(225):
        time = index / 25
        if time < 1:
            start, end, progress = overview, readouts, time
        elif time < 3:
            start, end, progress = readouts, readouts, 1
        elif time < 4:
            start, end, progress = readouts, charts, time - 3
        else:
            start, end, progress = charts, controls, min(1, (time - 6) / 0.8) if time >= 6 else 0
        progress = progress * progress * (3 - 2 * progress)
        bounds = tuple(first + (second - first) * progress for first, second in zip(start, end))
        source_index = min(89, int(time * 10))
        with Image.open(scratch / capture['frames'][source_index]) as source:
            scale = source.width / capture['width']
            if time >= 1:
                panel_left = capture['cameras'][0]['x'] * scale
                panel_right = (capture['cameras'][0]['x'] + capture['cameras'][0]['width']) * scale
                mask = ImageDraw.Draw(source)
                mask.rectangle((0, 0, panel_left, source.height), fill='#f6f7f8')
                mask.rectangle((panel_right, 0, source.width, source.height), fill='#f6f7f8')
            focus = source.crop(tuple(value * scale for value in bounds)).resize((1000, 640), Image.Resampling.LANCZOS)
        canvas = Image.new('RGB', (1000, 750), '#f6f7f8')
        canvas.paste(focus, (0, 48))
        draw = ImageDraw.Draw(canvas)
        draw.text((24, 12), 'IMU 数据 · 模拟数据演示，不连接设备', font=small, fill='#66707a')
        draw.rectangle((0, 688, 1000, 750), fill='#ffffff')
        draw.text((500, 718), capture['labels'][min(2, int(time / 3))], font=font, fill='#293039', anchor='mm')
        if index in (50, 125, 185):
            canvas.save(scratch / ('focused-' + str(index) + '.png'))
        if index == 125:
            canvas.save(assets / 'monitor-panel.jpg', quality=90)
        encoded = io.BytesIO()
        canvas.save(encoded, format='JPEG', quality=92)
        process.stdin.write(encoded.getvalue())
        frames.append({'time': time, 'bounds': bounds})
finally:
    process.stdin.close()
if process.wait() != 0:
    raise RuntimeError('Focused IMU encoding failed')
output = root / 'release/web-tutorials'
output.mkdir(parents=True, exist_ok=True)
(output / 'imu-focus-report.json').write_text(json.dumps({
    'passed': True, 'realDevice': False, 'resolution': [1000, 750], 'duration': 9,
    'frames': len(frames), 'readouts': capture['readout'],
    'readoutCamera': readouts, 'chartCamera': charts,
    'minimumChartZoom': 1000 / (charts[2] - charts[0]),
}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('PASS: 225 focused frames, 9 seconds, 1000 x 750; demo label remains visible')

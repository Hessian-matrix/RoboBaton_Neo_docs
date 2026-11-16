from pathlib import Path
import argparse

from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description='Render the device back-view pin order, top to bottom 6 through 1')
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
source = Image.open(root / 'source/_static/manual/neo-bare-bottom.png').convert('RGB')
canvas = Image.new('RGB', (850, 430), 'white')
canvas.paste(source.crop((35, 26, 463, 239)), (20, 100))
draw = ImageDraw.Draw(canvas)
font_path = Path('C:/Windows/Fonts/msyh.ttc')
if not font_path.is_file():
    font_path = Path('/mnt/c/Windows/Fonts/msyh.ttc')
font = ImageFont.truetype(str(font_path), 18)
small = ImageFont.truetype(str(font_path), 15)
title = ImageFont.truetype(str(font_path), 23)
draw.text((26, 15), '设备背视图 · 从上到下 6 → 1', font=title, fill='#243b33')
draw.rounded_rectangle((384, 161, 445, 257), radius=5, outline='#397d63', width=3)
pins = [
    ('6  VIN', '#c33e3e'),
    ('5  GND', '#4b5563'),
    ('4  UART_RX', '#087f83'),
    ('3  UART_TX', '#2563b5'),
    ('2  TRIGGER_IN', '#8058a4'),
    ('1  EXPOSURE_OUT', '#956b19'),
]
for index, (label, color) in enumerate(pins):
    pin_y = 179 + index * 11
    label_y = 112 + index * 38
    draw.line([(396, pin_y), (458 + index * 14, pin_y), (600, label_y + 12), (625, label_y + 12)], fill=color, width=3)
    draw.ellipse((392, pin_y - 4, 400, pin_y + 4), fill=color)
    draw.text((638, label_y), label, font=font, fill=color)
draw.text((27, 357), '观察方向：TF 卡槽在左，6pin 接口在右。', font=font, fill='#243b33')
draw.text((27, 391), '设备端背视图；不是线束插头的线端视图。', font=small, fill='#62766a')
output = root / 'source/_static/manual/serial-pin-order.png'
if args.check:
    existing = Image.open(output).convert('RGB')
    assert existing.size == canvas.size and existing.tobytes() == canvas.tobytes()
    for index, (label, color) in enumerate(pins):
        expected = tuple(bytes.fromhex(color[1:]))
        assert existing.getpixel((396, 179 + index * 11)) == expected
        assert existing.getpixel((610, 124 + index * 38)) == expected
    print('PASS: device back-view pins, labels and leader colors ordered 6 through 1')
else:
    canvas.save(output)

#!/usr/bin/env python3
"""While an answer is typed in the interview, the composer dock vanishes for single frames (a
layout-animation hiccup of the app under the virtual clock; the Ask composer never does it).
This finds those frames in a take by the brightness of the dock's region and replaces each with
the frame before it. Originals go to frames/<scene>-blank/.
   python3 -I patch-blank-frames.py <scene> <x0> <y0> <x1> <y1> [from-mark] [to-mark]
Coordinates are in the 2x frame (2560x1600)."""
import json, os, shutil, statistics, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
scene = sys.argv[1]
box = tuple(int(v) for v in sys.argv[2:6])
marks = json.load(open(os.path.join(HERE, 'frames', f'{scene}.json')))['marks']
first = marks[sys.argv[6]] if len(sys.argv) > 6 else 0
last = marks[sys.argv[7]] if len(sys.argv) > 7 else len([f for f in os.listdir(os.path.join(HERE, 'frames', scene)) if f.startswith('f')])
d = os.path.join(HERE, 'frames', scene)
backup = os.path.join(HERE, 'frames', f'{scene}-blank')
os.makedirs(backup, exist_ok=True)

def lum(n):
    im = Image.open(os.path.join(d, f'f{n:05d}.jpg')); im.draft('L', (1280, 800)); im = im.convert('L')
    s = im.width / 2560
    return statistics.fmean(im.crop(tuple(int(v * s) for v in box)).get_flattened_data() if hasattr(im, 'get_flattened_data') else im.crop(tuple(int(v * s) for v in box)).getdata())

# two tells: the whole dock region dark (the dock gone), or its left border missing (the dock
# drawn shifted to the right, with the typed text out of its box)
strip = (box[0] - 10, box[1] + 10, box[0] + 30, box[3] - 10)
def lum_strip(n):
    im = Image.open(os.path.join(d, f'f{n:05d}.jpg')).convert('L')
    return statistics.fmean(im.crop(strip).getdata())
vals = {n: lum(n) for n in range(first, last)}
strips = {n: lum_strip(n) for n in range(first, last)}
med = statistics.median(vals.values())
med_strip = statistics.median(strips.values())
blank = sorted(n for n in vals if vals[n] < med * 0.6 or strips[n] < med_strip * 0.75)
replaced = 0
for n in blank:
    src = n - 1
    while src in blank and src > first: src -= 1
    if src < first: continue
    shutil.move(os.path.join(d, f'f{n:05d}.jpg'), os.path.join(backup, f'f{n:05d}.jpg'))
    shutil.copyfile(os.path.join(d, f'f{src:05d}.jpg'), os.path.join(d, f'f{n:05d}.jpg'))
    replaced += 1
print(f'{scene}: {len(vals)} frames checked, medians {med:.1f}/{med_strip:.1f}, {replaced} frames replaced: {blank}')

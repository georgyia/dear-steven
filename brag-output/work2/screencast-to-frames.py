#!/usr/bin/env python3
"""Turns the real-time screencast (frames/play/c*.jpg + screencast.json) into a 60 fps clip the
composition can use like any other (frames/play/f*.jpg + frames/play.json), each output frame the
latest screencast frame at that instant. Also fits the player's clock to the wall clock, so the
video's audio can be laid under it: videoTime(frame k) = cur0 + k / 60.
   python3 -I screencast-to-frames.py [fps]"""
import json, os, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(HERE, 'frames', 'play')
FPS = int(sys.argv[1]) if len(sys.argv) > 1 else 60
meta = json.load(open(os.path.join(DIR, 'screencast.json')))
frames = meta['frames']
if not frames:
    sys.exit('no screencast frames')
t0 = frames[0]['at']
t_end = frames[-1]['at']
n_out = int((t_end - t0) / 1000 * FPS) + 1

for name in os.listdir(DIR):
    if name.startswith('f') and name.endswith('.jpg'):
        os.remove(os.path.join(DIR, name))
j = 0
for k in range(n_out):
    at = t0 + k * 1000 / FPS
    while j + 1 < len(frames) and frames[j + 1]['at'] <= at:
        j += 1
    src = os.path.join(DIR, f"c{frames[j]['n']:05d}.jpg")
    dst = os.path.join(DIR, f'f{k:05d}.jpg')
    os.link(src, dst)

marks = {name: max(0, round((ms - t0) / 1000 * FPS)) for name, ms in meta['marks'].items()}
playing_at = meta['marks'].get('playing', t0)
samples = [s for s in meta['samples'] if s.get('state') == 1 and s['at'] >= playing_at]
if len(samples) >= 2:
    offsets = [s['cur'] - s['at'] / 1000 for s in samples]
    offset = statistics.median(offsets)
    spread = max(offsets) - min(offsets)
else:
    offset, spread = None, None
cur0 = (t0 / 1000 + offset) if offset is not None else None
out = {
    'scene': 'play', 'fps': FPS, 'frames': n_out,
    'width': frames[0].get('w'), 'height': frames[0].get('h'),
    'marks': marks,
    'cur0': cur0,
    'fit': {'samples': len(samples), 'spread': spread},
    'source': {'frames': len(frames), 'fps': round(len(frames) / ((t_end - t0) / 1000), 1)},
}
json.dump(out, open(os.path.join(HERE, 'frames', 'play.json'), 'w'), indent=2)
print(json.dumps(out, indent=1))

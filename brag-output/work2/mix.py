#!/usr/bin/env python3
"""Mixes the promo's sound: the music bed (trimmed, faded) and the sound effects at their cue times.
   python3 -I mix.py <audio.json> <out.wav> [assets-dir]"""
import json, subprocess, sys

spec = json.load(open(sys.argv[1]))
out = sys.argv[2]
A = sys.argv[3] if len(sys.argv) > 3 else '/Users/georgychomakhashvili/dear-steven/brag-output/composition-v3/assets'
dur = spec['duration']
fade_from = spec['fadeOutFrom']
inputs = ['-i', f"{A}/music/{spec['music']}"]
# the music ducks under any sound that must be heard (the YouTube player): a smooth dip per entry
duck = ''
for d in spec.get('duck', []):
    F, T, g, R = d['from'], d['to'], d['gain'], d.get('ramp', 0.3)
    duck += f",volume='1-(1-{g:.3f})*min(1,max(0,(t-{F:.3f})/{R:.3f}))*min(1,max(0,({T:.3f}-t)/{R:.3f}))':eval=frame"
chains = [f"[0:a]atrim=0:{dur:.3f},asetpts=PTS-STARTPTS,aformat=sample_rates=48000:channel_layouts=stereo,volume=0.82{duck},afade=t=out:st={fade_from:.3f}:d={dur - fade_from:.3f}[m]"]
labels = ['[m]']
i = 0
for s in spec['sfx']:
    i += 1
    inputs += ['-i', f"{A}/sfx/{s['file']}"]
    ms = max(0, int(round(s['t'] * 1000)))
    chains.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={s['gain']:.3f},adelay={ms}|{ms}[s{i}]")
    labels.append(f'[s{i}]')
# longer sounds with their own timing: a slice of a file, placed at t
for e in spec.get('extra', []):
    i += 1
    inputs += ['-ss', f"{e['from']:.3f}", '-t', f"{e['duration']:.3f}", '-i', e['file']]
    ms = max(0, int(round(e['t'] * 1000)))
    fi, fo = e.get('fadeIn', 0.1), e.get('fadeOut', 0.3)
    chains.append(f"[{i}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={e['gain']:.3f},afade=t=in:st=0:d={fi:.3f},afade=t=out:st={max(0, e['duration'] - fo):.3f}:d={fo:.3f},adelay={ms}|{ms}[s{i}]")
    labels.append(f'[s{i}]')
chains.append(f"{''.join(labels)}amix=inputs={len(labels)}:normalize=0:dropout_transition=0,atrim=0:{dur:.3f},alimiter=limit=0.89[out]")
cmd = ['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(chains), '-map', '[out]', '-ar', '48000', out]
subprocess.run(cmd, check=True)
print(f'mixed {len(spec["sfx"])} effects, {len(spec.get("extra", []))} extra, {len(spec.get("duck", []))} ducks over {dur:.2f}s -> {out}')

#!/bin/zsh
# finish2.sh <frames-dir> <soundtrack.wav> <poster-seconds>
# Bakes the poster as frame 0, then encodes once for X: 1080p60 H.264 High, AAC, -14 LUFS.
set -e
FRAMES="$1"; AUDIO="$2"; POSTER_AT="${3:-24.5}"
OUT=/Users/georgychomakhashvili/dear-steven/brag-output
N=$(printf "%05d" $(python3 -c "print(round($POSTER_AT*60))"))
ffmpeg -y -loglevel error -i "$FRAMES/f$N.jpg" -q:v 2 "$OUT/dear-steven-promo.jpg"
[ -f "$FRAMES/f00000.orig.jpg" ] || cp "$FRAMES/f00000.jpg" "$FRAMES/f00000.orig.jpg"
cp "$FRAMES/f$N.jpg" "$FRAMES/f00000.jpg"
ffmpeg -y -loglevel error -framerate 60 -i "$FRAMES/f%05d.jpg" -i "$AUDIO" \
  -filter_complex "[0:v]format=yuv420p[v];[1:a]loudnorm=I=-14:TP=-1.5:LRA=11,aresample=48000[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -profile:v high -level 4.2 -crf 18 -preset slow -g 120 -bf 2 \
  -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT/dear-steven-promo.mp4"
ffprobe -v error -show_entries format=duration,bit_rate:stream=codec_name,width,height,r_frame_rate -of default=nw=1 "$OUT/dear-steven-promo.mp4"
ls -la "$OUT/dear-steven-promo.mp4" "$OUT/dear-steven-promo.jpg" | awk '{print $5, $9}'

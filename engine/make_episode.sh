#!/usr/bin/env bash
# One command: episode file -> finished, mixed, compressed MP4.
#   bash engine/make_episode.sh engine/episodes/part3B.json
set -euo pipefail
cd "$(dirname "$0")/.."
SPEC="$1"; NAME="$(basename "$SPEC" .json)"
R=$(find /root/.claude/plugins -name render.mjs -path "*motion-reel*" | head -1); P=$(dirname "$R")
python3 engine/build_ep.py "$SPEC"
node "$R" --film engine --contact --every 2 --format 9x16 > /dev/null
node "$R" --film engine --video-only --format 9x16 --fps 30 --workers 6
node "$P/sfx.mjs" engine
python3 - <<'PY'
import json, subprocess, numpy as np
tl = json.load(open('engine/timeline.json')); a, b = tl['silence']
info = subprocess.run(['ffprobe','-v','error','-show_entries','stream=channels,sample_rate','-of','csv=p=0','engine/audio/sfx.wav'],capture_output=True,text=True).stdout.strip().split(',')
sr, ch = int(info[0]), int(info[1])
raw = subprocess.run(['ffmpeg','-v','error','-i','engine/audio/sfx.wav','-f','f32le','-'],capture_output=True,check=True).stdout
x = np.frombuffer(raw, np.float32).copy().reshape(-1, ch); x[int(a*sr):int(b*sr)] = 0
for e in tl['events']:
    if e['kind'] == 'deadair': x[int(e['t']*sr):int((e['t']+1.0)*sr)] = 0
subprocess.run(['ffmpeg','-v','error','-y','-f','f32le','-ac',str(ch),'-ar',str(sr),'-i','-','-c:a','pcm_f32le','engine/audio/sfx.wav'],input=x.tobytes(),check=True)
PY
node "$P/mix.mjs" engine --vo-db -60
mkdir -p out/episodes
ffmpeg -v error -y -i out/engine/final.mp4 -c:v libx264 -preset veryfast -crf 24 -pix_fmt yuv420p -c:a copy -movflags +faststart "out/episodes/KamuPilih_${NAME}.mp4"
cp out/engine/contact_9x16_p1.png "out/episodes/${NAME}_contact.png"
ls -la "out/episodes/KamuPilih_${NAME}.mp4"

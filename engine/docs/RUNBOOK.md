# KAMU PILIH daily runbook (fully automatic; the user only optionally sends comment screenshots)

Fired every day at 18:00 WIB by a scheduled message in this session (a one-shot that each run re-schedules for the next day). Posting at 21:00 WIB. The user has
given standing approval (2026-11-10) for automatic production and posting, offline narrator (engine/tts), auto-pick when
there is no screenshot, and GitHub hosting. Use SendUserMessage only for: the posted link, and blockers.

## 0. Workspace
- Project: `/home/claude/kamupilih` (engine in `engine/`). If it is missing: clone the GitHub repo
  (`git clone https://github.com/auv-onemanstartup/kamupilih /home/claude/kamupilih`), else ask the user to upload
  `kamupilih_toolkit.zip` + `kamupilih_aset.zip`.
- Read `engine/docs/STORY_BIBLE.md` (rules, arc, facts, episode log) and `EPISODE_FORMAT.md`.
- Narrator engine (not in git, too big). If `engine/tts/sherpa-onnx-offline-tts` or `engine/tts/voice/` is
  missing, re-download (approved by the user 2026-11-10) into a scratch folder and copy in:
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/v1.13.8/sherpa-onnx-v1.13.8-linux-x64-static.tar.bz2`
  (take only `bin/sherpa-onnx-offline-tts`) and
  `https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-piper-id_ID-news_tts-medium.tar.bz2`
  (unpack as `engine/tts/voice/`).

## 1. Decide the winner (18:00)
- Latest part's permalink: episode log in the story bible. Stats: `vidiq_instagram_owner_insights`
  (platformAccountId `28952213387720590`), free.
- Look in this conversation for a comment screenshot the user sent after the latest post. If found, count
  A vs B (one vote per account, first answer counts), `vote.mode = "vote"` with percentages
  (if the margin < 10 %, add a beat "tipis banget bedanya." right after the hook).
- If none: `vote.mode = "auto"`; pick the branch that escalates the arc best (story bible table), and say
  which and why in the run summary.

## 2. Produce (18:05–18:40)
- The episode files for this part (`engine/episodes/partN{A,B}.json`) were written the day before.
  Set `vote` in the winning one. Sanity-check it against the bible (facts, rules).
- `bash engine/make_episode.sh engine/episodes/partNX.json` (≈15 min). Look at
  `out/episodes/partNX_contact.png`: text readable, no overlaps, one text at a time, shots varied.
  Fix the JSON and re-run if anything is wrong (max 2 re-runs).
- Check audio: silence window ≤ −80 dB, overall −14 LUFS (mix.mjs prints it).

## 3. Host + post (21:00)
- Commit the MP4 to the GitHub repo under `videos/` and push (`git -C /home/claude/kamupilih push origin main`; verified working 2026-11-10). Public URL:
  `https://raw.githubusercontent.com/auv-onemanstartup/kamupilih/main/videos/KamuPilih_partNX.mp4`.
  (No GitHub yet → send the MP4 with SendUserFile and ask for a Google Drive link; then use
  `https://drive.google.com/uc?export=download&id=<id>`.)
- `vidiq_video_upload` with that URL → `videoUrl`.
- Wait until 21:00 WIB, then `vidiq_instagram_publish_reel` (platformAccountId above, `isAiGenerated: true`,
  regular Reel, caption below), poll the containerId until PUBLISHED. Stop on errors, never re-create.
- Caption template:
  ```
  <one-line recap of what the viewers chose and what happened> <emoji>

  <the twist in one or two short lines>

  A: <choice a>
  B: <choice b>

  komen A atau B. pilihan terbanyak = part <N+1> besok jam 21.00 👀

  #kamupilih #ceritahoror #horor #hororindonesia #ceritaseram #kosangker #misteri #animasihoror #fyp #reelsindonesia
  ```
- SendUserMessage: permalink + the comment to pin: `🅰️ <short a> atau 🅱️ <short b>?`

## 4. Prepare tomorrow (after posting)
- Update the story bible: facts on screen, episode log row.
- Write `engine/episodes/part<N+1>A.json` and `part<N+1>B.json` following the bible's writing rules.
  Run `python3 engine/build_ep.py` on each to check duration (60–90 s) and render one contact sheet each.
- Commit + push everything (episodes, bible, contact sheets).
- Schedule tomorrow's run: `send_later` at <tomorrow> 18:00 [Asia/Jakarta] with the message
  "KAMU PILIH harian: jalankan engine/docs/RUNBOOK.md untuk Part <N+1>." (initiation human_schedule).
  This chain is the schedule: never skip this step, even after an error.

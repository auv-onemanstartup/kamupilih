# KAMU PILIH: motion playbook

Everything learned on Part 1 (v1 → v4) so every next part starts at v4 quality, not v1.

## 1. Format and series rules
- 9:16 only, 1080x1920, 30 fps, 75–90 s. Language: natural Indonesian social media ("kamu", "nggak", lowercase supers).
- Faceless: white stick figures, shadows, objects. Never draw feet or faces: imply them (gap shadows, silhouettes).
- Part 1 opens straight on the hook "cerita ini belum punya ending. kamu yang bakal nentuin." Part 2+ opens on the vote result ("MAYORITAS KALIAN PILIH A", `HX.voteBar`) within the first 2 s.
- Every part ends: freeze → VHS PAUSE → A/B cards → "KOMEN A atau B" → "follow buat part N+1". The A/B choice must be about consequences, not trivia.
- AI label on when posting. Voting happens in the comments, not a poll.

## 2. Picture rules (from the user's feedback)
1. **Never empty.** At least 2 moving layers per shot besides the camera: dust, fog, embers, rain, flicker, swinging lamp, branch sway, typing dots, passing shadow.
2. **One text at a time.** A title and a super never share a frame. Supers sit at y≈1390 (above the IG caption zone, below y 1500).
3. **Supers follow the voice.** One VO phrase per super, typed on, keywords in red (`KEY` regex). Timings come from measured phrase onsets, not guesses.
4. **Titles only on 3–4 key beats** (hook, the number/fact, the scare line). Display face, glyphs spring up, auto-fit to width.
5. **The scare = silence + darkness.** Light under the door cuts out, frame freezes, audio gated to true zero (-240 dB) for ~1.8 s.
6. Camera: slow log push-ins on painted plates (`HX.plate`/`cam`, clamped so the plate always covers). Hard cuts on the voice, no cross-fades on everything.
7. Grade: vignette 0.6, overlay grain 0.09, breathing darkness flicker (`HX.grade`).
8. Banned: corner labels, everything fading in, generic particles everywhere, text over text, cartoon feet.

## 3. Sound rules
- VO: narrator = vidIQ voice Callum (N2lVS1w4EtoT3dr4eOWO), ibu = Sarah (EXAVITQu4vr4xnSDxMaL) with the room reverb in `build_audio.py`.
- Knocks: `thud+click`, pitch 150→70, len 0.14, verb 0.35 (hard = gain 1.0, soft = 0.5, 0.42 s / 0.55 s apart). A real phone recording of knocks beats any synth: ask the user for one.
- Score: low drone (43.65/46.2/87.3/130.8 Hz) + filtered air, swell into the climax, dissonant sting that stops dead on the silence, heartbeat from the choice to the end.
- Gate sfx.wav to zero in the silence window after `sfx.mjs` runs (reverb tails leak otherwise).
- Mix: -14 LUFS, VO ducks the bed.

## 4. Pipeline (sandbox-proof: no pip, no model downloads)
1. Script → user approves → vidIQ voiceover (narrator + ibu lines), user uploads the MP3s if they don't attach.
2. `audio/build_audio.py`: RMS phrase segmentation (20 ms windows, -35 dB, 150 ms min gap; the phrase count must equal the script's), story inserts after phrase indices, writes vo.wav, music.wav, beats.json (60 bpm so u == t), timeline.json (shots, events, phrases), film.json.
3. Images: user's Canva/Gemini plates 944x1680 into `assets/art/`. Crop/paint derived plates in Python (PIL).
4. `film.js` reads timeline.json; shots are functions `sN(ctx, u, IMG)`; kit in `lib/horror.js`.
5. Render loop: `node render.mjs --film kpN --contact --every 2 --format 9x16` → look → critique (hook/read/motion/variety/brand/sync ≥ 8, three rounds) → `--strip a:b:n` on fixes → full render → `sfx.mjs` → gate → `mix.mjs`.
6. Encode CRF ~24 (grain explodes file size at CRF 19). Target < 60 MB.
7. Post: Drive link (`uc?export=download`) → vidIQ video_upload → instagram_publish_reel at 21:00 WIB, AI label on; pin the A/B comment.

## 5. Kit: lib/horror.js
| function | use |
|---|---|
| `setup(M, fonts)` | once at top level |
| `cam`, `plate`, `logZoom` | camera over a painted plate, source-pixel overlays, breathe |
| `glow`, `darken`, `flicker`, `beam`, `passShadow` | light: candles, lamps, moonbeams, failing bulbs, a body passing a door gap |
| `dust`, `fog`, `embers`, `rain` | living layers (seeded, pure) |
| `stick` | faceless stick figure with idle sway and breathing, standing or sitting |
| `chat` | dark-mode phone chat: bubbles spring in, top-down then scroll, typing dots, "sedang mengetik...", read ticks turning blue |
| `voteBar` | Part 2+ hook: A/B percentages count up, winner in red |
| `vhsPause`, `glitch` | tape pause, slice glitch on a scare |
| `title`, `superText` | display titles; per-phrase supers with red keywords |
| `grade` | vignette + grain + breathing darkness, call in post() |
| `fogDeep` | volumetric 2-D fog: 3 parallax fBm sheets, soft-masked band (replaces three.js fog) |
| `rays` | god rays fanning from a light source line (lamp, window, door gap) |
| `handheld`, `applyHandheld` | nervous handheld camera; k 0.3 calm, 1 scared, 2 panic |
| `chroma`, `flash`, `lightning`, `blackout` | scare tools: RGB split, frame burst, double-flash lightning, hard cut to black |
| `inkWipe`, `irisClose` | organic dark transition, old-film iris ending |
| `callScreen` | ringing call (pulse rings) -> picked up (timer) -> ended (red) for "telepon ibu" branches |
| `notif` | lock-screen notification sliding from the top |

Tested in `lab/` (lab renders at ~4 fps on the software GPU: a 85 s part ≈ 11 min video-only).

## 6. Biggest upgrades still open
- **AI image-to-video clips** (Kling / Hailuo / vidIQ generate_video) for 3–4 key shots, used as plates under the kit layers. Prompt pack doc already written.
- A real recording of knocks and breathing.
- Downloads are impossible in this sandbox (npm registry, CDNs and font hosts all return 403 through the proxy, Nov 2026). Fonts must come from the user (upload .ttf/.otf, e.g. Special Elite for supers) or from system fonts (`fc-list`). three.js is replaced by `fogDeep` + `rays`.

"""KAMU PILIH episode builder (no narrator): episode.json -> timeline.json, audio/music.wav, beats.json, film.json.

    python3 engine/build_ep.py engine/episodes/part3B.json

The story is told by on-screen text (one beat = one line), so timing comes from reading time.
Story sounds (ringtone, dial tone, phone buzz) are synthesized here into the score; short hits
(knocks, clicks, pops, typing) come from film.js HITS via the motion-reel sfx.mjs.
See docs/EPISODE_FORMAT.md for the episode file."""
import json, shutil, subprocess, sys
sys.path.insert(0, str(__import__("pathlib").Path(__file__).resolve().parent))
from tts.say import say
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parent
SR = 48000
rng = np.random.default_rng(7)
bp = lambda x, lo, hi: sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)
lp = lambda x, f: sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)


def save(path, x):
    x = np.vstack([x, x]) if x.ndim == 1 else x
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", "-", "-c:a", "pcm_f32le", str(path)],
                   input=x.T.astype(np.float32).tobytes(), check=True)


def room(x, wet=0.4, tail=0.9):
    ir = np.zeros(int(tail * SR)); ir[0] = 1
    for d, g in ((0.031, .5), (0.047, .42), (0.073, .33), (0.11, .25), (0.17, .18)): ir[int(d * SR)] += g
    t = np.arange(len(ir)) / SR; ir += lp(rng.standard_normal(len(ir)), 2500) * np.exp(-t / 0.35) * 0.08
    xx = np.concatenate([x, np.zeros(len(ir))]); return lp(np.convolve(xx, ir)[: len(xx)] * wet + xx * (1 - wet), 4200)


def ringtone(dur):          # original 6-note melody (not a real brand tone)
    notes = [76, 79, 83, 81, 79, 74]; step = 0.18; out = np.zeros(int(dur * SR) + SR)
    k = 0
    while k * step * 8 < dur:
        for j, m in enumerate(notes):
            t0 = int((k * step * 8 + j * step) * SR); n = int(step * 0.9 * SR); tt = np.arange(n) / SR
            f = 440 * 2 ** ((m - 69) / 12)
            seg = out[t0: t0 + n]; seg += ((np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt / 0.12))[: len(seg)]
        k += 1
    return out[: int(dur * SR)] * 0.5


def dialtone(dur):
    cyc = 2.2; out = np.zeros(int(dur * SR)); t = np.arange(int(1.0 * SR)) / SR
    tone = np.sin(2 * np.pi * 425 * t) * np.minimum(1, np.minimum(t, 1 - t) / 0.02) * 0.25
    k = 0
    while k * cyc < dur:
        a = int(k * cyc * SR); seg = out[a: a + len(tone)]; seg += tone[: len(seg)]; k += 1
    return bp(out, 300, 3400)


def buzz(dur=1.1):
    t = np.arange(int(dur * SR)) / SR
    return (np.sin(2 * np.pi * 155 * t) * 0.6 + bp(rng.standard_normal(len(t)), 120, 400) * 0.4) * ((t % 0.55) < 0.38) * 0.5


def read_time(text):
    return float(np.clip(len(text) / 12.5 + 0.85, 1.5, 5.2))


def main(spec_path):
    ep = json.loads(Path(spec_path).read_text())
    part = ep["part"]; nxt = part + 1
    beats = [dict(b) for b in ep["beats"]]
    ch = ep["choice"]
    # standard tail: pause, choice, call to action
    tail = [
        {"text": "stop.", "shot": {"type": "pause"}, "hold": 0.2},
        {"text": "kelanjutannya...", "hold": 0.1},
        {"text": "kalian lagi yang nentuin." if ep["vote"]["mode"] == "vote" else "kali ini, kalian yang nentuin.", "hold": 0.3},
        {"text": "A: " + ch["a"], "shot": {"type": "choice"}, "nosuper": True, "card": "A"},
        {"text": "B: " + ch["b"], "nosuper": True, "card": "B", "hold": 0.6},
        {"text": "tulis A atau B di komentar.", "shot": {"type": "end"}},
        {"text": f"follow biar kamu tau nasib kamu di part {nxt}.", "follow": True, "hold": 1.4},
    ]
    story_n = len(beats)
    VOICES = {}
    beats += tail
    head = 3.6 if ep["vote"]["mode"] == "vote" else 3.4
    t = head
    shots = [{"t": 0.0, "type": "vote"}]
    events, silence = [], None
    for i, b in enumerate(beats):
        b["i"] = i
        voice = None
        if b.get("text") and not b.get("novoice") and ep.get("voice", True):
            style = "entity" if (b.get("red") and b["text"].lstrip().startswith("“")) else "narrator"
            voice = say(b["text"], style); b["vo"] = round(len(voice) / SR, 3)
        dur = b.get("dur") or read_time(b["text"])
        if voice is not None: dur = max(dur, len(voice) / SR + 0.35)
        VOICES[i] = voice
        if b.get("shot"):
            shots.append({**b["shot"], "t": round(max(0.0, t - 0.12), 3), "beat": i})
        b["t0"] = round(t, 3); b["t1"] = round(t + dur, 3)
        for e in b.get("events", []):
            name, _, off = e.partition("@")
            at = b["t1"] if off == "end" else b["t0"] + (float(off) if off else 0.0)
            events.append({"t": round(at, 3), "kind": name, "beat": i})
        t = b["t1"] + 0.3 + b.get("hold", 0.0)
        if "silence" in b.get("events", []) or "silence@end" in b.get("events", []):
            silence = [round(b["t1"] + 0.05, 3), round(b["t1"] + 1.7, 3)]
            t = silence[1] + 0.2
    if silence is None:                      # every episode needs its dead-silence beat before the pause
        b = beats[story_n - 1]; silence = [round(b["t1"] + 0.05, 3), round(b["t1"] + 1.7, 3)]
        events.append({"t": silence[0], "kind": "silence", "beat": story_n - 1})
        shift = silence[1] + 0.2 - beats[story_n]["t0"]
        for b2 in beats[story_n:]: b2["t0"] = round(b2["t0"] + shift, 3); b2["t1"] = round(b2["t1"] + shift, 3)
        for s in shots:
            if s.get("beat", -1) >= story_n: s["t"] = round(s["t"] + shift, 3)
        for e in events:
            if e["beat"] >= story_n: e["t"] = round(e["t"] + shift, 3)
    total = round(beats[-1]["t1"] + beats[-1].get("hold", 0) + 0.6, 2)
    # windows for long story sounds
    def window(start_kind, stop_kinds):
        out, cur = [], None
        for e in sorted(events, key=lambda e: e["t"]):
            if e["kind"] == start_kind and cur is None: cur = e["t"]
            elif e["kind"] in stop_kinds and cur is not None: out.append([cur, e["t"]]); cur = None
        if cur is not None: out.append([cur, silence[0]])
        return out
    rings = window("ring", {"ringStop", "pickup", "silence"})
    dials = window("dial", {"dialStop", "pickup", "silence"})
    pause_t = next(s["t"] for s in shots if s["type"] == "pause")
    choice_t = next(s["t"] for s in shots if s["type"] == "choice")
    end_t = next(s["t"] for s in shots if s["type"] == "end")

    # ---------------- score + story sounds
    n = int(total * SR) + SR; tt = np.arange(n) / SR
    drone = (np.sin(2 * np.pi * 43.65 * tt) + 0.7 * np.sin(2 * np.pi * 46.2 * tt) + 0.35 * np.sin(2 * np.pi * 87.3 * tt)
             + 0.12 * np.sin(2 * np.pi * 130.8 * tt + 0.4 * np.sin(2 * np.pi * 0.11 * tt)))
    air = bp(rng.standard_normal(n), 120, 900) * 0.5 + bp(rng.standard_normal(n), 3500, 8000) * 0.05
    c0 = max(head, silence[0] - 14)
    swell = 1 + 1.8 * np.clip((tt - c0) / max(1, silence[0] - c0), 0, 1) ** 2
    music = (drone * 0.11 + air * 0.09) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.06 * tt)) * swell * np.clip(tt / 0.3, 0, 1)
    st0 = silence[0] - 0.32; m = (tt >= st0) & (tt < silence[0]); s_ = tt[m] - st0
    music[m] += sum(np.sin(2 * np.pi * f * s_) for f in (110, 116.5, 155.6, 233.1, 466.2)) * np.exp(-s_ / 0.5) * 0.11 + bp(rng.standard_normal(m.sum()), 500, 6000) * np.exp(-s_ / 0.15) * 0.25
    music[tt >= silence[1]] *= 0.35
    music = music / np.max(np.abs(music)) * 0.5
    fx = np.zeros(n)
    def put(sig, at, g=1.0):
        a = int(at * SR); seg = fx[a: a + len(sig)]; seg += sig[: len(seg)] * g
    for a, b in rings:
        rt = room(lp(ringtone(b - a), 900) * 1.6, 0.5)[: int((b - a) * SR)]
        put(rt * np.linspace(0.4, 1.0, len(rt)), a, 0.9)
    for a, b in dials: put(dialtone(b - a), a, 0.8)
    for e in events:
        if e["kind"] == "buzz": put(buzz(), e["t"], 0.9); put(buzz(), e["t"] + 1.4, 0.6)
    hb = np.zeros(n); thump_n = int(0.16 * SR); s_ = np.arange(thump_n) / SR
    thump = np.sin(2 * np.pi * (60 * np.exp(-s_ * 9) + 42) * s_) * np.exp(-s_ / 0.05)
    k = choice_t
    while k < total - 1.5:
        for off, g in ((0, 1.0), (0.24, 0.65)): a = int((k + off) * SR); hb[a: a + thump_n] += thump * g
        k += 0.82
    music = music + fx * 0.6 + hb * 0.3
    for e in events:                          # freeze / dead-air beats inside the story
        if e["kind"] == "deadair": music[int(e["t"] * SR): int((e["t"] + 1.0) * SR)] = 0
    music[int(silence[0] * SR): int(silence[1] * SR)] = 0
    music[int((total - 1.0) * SR):] *= np.linspace(1, 0, n - int((total - 1.0) * SR))
    save(ROOT / "audio/music.wav", music[: int(total * SR)])
    # narrator stem (offline voice), placed on each beat; dead silence stays dead
    vo = np.zeros(n)
    for b in beats:
        v = VOICES.get(b["i"])
        if v is None: continue
        a = int((b["t0"] + 0.05) * SR); seg = vo[a: a + len(v)]; seg += v[: len(seg)]
    for e in events:
        if e["kind"] == "deadair": vo[int(e["t"] * SR): int((e["t"] + 1.0) * SR)] = 0
    vo[int(silence[0] * SR): int(silence[1] * SR)] = 0
    save(ROOT / "audio/vo.wav", vo[: int(total * SR)])

    tl = {"part": part, "branch": ep.get("branch", ""), "total": total, "vote": ep["vote"], "clock": ep.get("clock", "02.14"),
          "winnerLabel": ep["winnerLabel"], "choice": ch, "beats": beats, "shots": shots, "events": sorted(events, key=lambda e: e["t"]),
          "silence": silence, "rings": rings, "dials": dials, "pauseStart": pause_t, "choiceStart": choice_t, "endStart": end_t,
          "storyBeats": story_n}
    (ROOT / "timeline.json").write_text(json.dumps(tl, indent=1, ensure_ascii=False))
    (ROOT / "beats.json").write_text(json.dumps({"bpm": 60, "period": 1.0, "offset": 0.0, "n_beats": int(total),
        "beats": [float(i) for i in range(int(total) + 1)], "sections": [{"name": "story", "start": 0, "end": int(pause_t)}, {"name": "choice", "start": int(pause_t), "end": int(total)}]}))
    (ROOT / "film.json").write_text(json.dumps({"title": f"KAMU PILIH Part {part}{ep.get('branch', '')}", "duration": total,
                                                 "formats": ["9x16"], "poster": 0.5}, indent=1))
    print(f"part {part}{ep.get('branch','')}: {total}s, {len(beats)} beats, {len(shots)} shots, silence {silence}, rings {rings}, dials {dials}")


if __name__ == "__main__":
    main(sys.argv[1])

"""KAMU PILIH Part 1 audio: places the supplied VO phrase by phrase with the story inserts,
writes the dark score, and exports the timeline the film reads.

    python3 kp1/audio/build_audio.py           (run from the project folder)

Writes kp1/audio/vo.wav, kp1/audio/music.wav, kp1/beats.json (60 bpm: 1 beat = 1 s),
kp1/timeline.json (phrase onsets + texts, shot cuts, event times), kp1/film.json duration.
Uses the system numpy/scipy only (the uv deps can't be fetched in this sandbox)."""
import json, math, subprocess, sys
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
rng = np.random.default_rng(13)

PHRASES = [
    "cerita ini belum punya ending.", "kamu yang bakal nentuin.", "bayangin", "kamu baru pindah kos.",
    "malam pertama.", "kamarnya di ujung lorong.", "kamar nomor 13.", "kata ibu kos,",
    "penghuni sebelumnya pindah mendadak.", "jam 02.13.", "kamu kebangun.", "ada yang ngetuk pintu.",
    "tiga kali.", "terus ada suara.", "itu suara ibu kamu.", "persis.", "masalahnya...",
    "ibu kamu di kampung.", "300 kilo dari sini.", "kamu cek hp.", "chat terakhir dari ibu, jam 22.00:",
    "“ibu tidur duluan ya nak.", "jangan begadang.”", "ketukan lagi.", "lebih pelan.",
    "kamu lihat ke celah bawah pintu.", "ada bayangan kaki.", "tapi...", "kakinya nggak napak.",
    "stop.", "dari sini, aku nggak tau kelanjutannya.", "karena yang nulis kelanjutannya...", "itu kamu.",
    "A:", "buka pintunya.", "B:", "telepon ibu kamu sekarang.", "tulis A atau B di komentar.",
    "pilihan terbanyak,", "itu yang bakal terjadi.", "apa pun akibatnya.", "follow,",
    "biar kamu tau nasib kamu sendiri di part 2.",
]


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def save(path, x):
    x = np.atleast_2d(x)
    if x.shape[0] == 1:
        x = np.vstack([x, x])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", "-",
                    "-c:a", "pcm_f32le", str(path)], input=x.T.astype(np.float32).tobytes(), check=True)


def segments(x, db=-35, min_gap=0.15):
    win = int(0.02 * SR); n = len(x) // win
    rms = np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, 1) + 1e-12)
    quiet = 20 * np.log10(rms) < db
    segs, i, start = [], 0, None
    while i < n:
        if not quiet[i]:
            if start is None: start = i
            i += 1; continue
        j = i
        while j < n and quiet[j]: j += 1
        if start is not None and (j - i) * 0.02 >= min_gap:
            segs.append([start * 0.02, i * 0.02]); start = None
        i = j
    if start is not None: segs.append([start * 0.02, n * 0.02])
    return [s for s in segs if s[1] - s[0] > 0.12]


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], "band", fs=SR, output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)


def room(x, wet=0.35):
    """Small dark room for the whisper: sparse early reflections + a lowpassed noise tail."""
    n = len(x) + int(1.2 * SR)
    ir = np.zeros(int(1.2 * SR)); ir[0] = 1
    for d, g in ((0.031, .5), (0.047, .42), (0.073, .33), (0.11, .25), (0.17, .18)):
        ir[int(d * SR)] += g
    t = np.arange(len(ir)) / SR
    ir += lp(rng.standard_normal(len(ir)), 2500) * np.exp(-t / 0.35) * 0.08
    y = np.convolve(np.concatenate([x, np.zeros(n - len(x))]), ir)[:n]
    return lp(y * wet + np.concatenate([x, np.zeros(n - len(x))]) * (1 - wet), 4200)


def main():
    narr = load(ROOT / "audio/vo/narator.mp3")
    segs = segments(narr)
    assert len(segs) == len(PHRASES), f"{len(segs)} phrases measured, {len(PHRASES)} in the script"
    ibu = load(ROOT / "audio/vo/ibu.mp3")
    isegs = segments(ibu, -38, 0.5)
    gaps = [(isegs[k + 1][0] - isegs[k][1], (isegs[k][1] + isegs[k + 1][0]) / 2) for k in range(len(isegs) - 1)]
    cut = max(gaps)[1] if gaps else len(ibu) / SR / 2
    ibu1 = room(ibu[: int(cut * SR)] * 0.9); ibu2 = room(ibu[int(cut * SR):] * 0.85)
    ibu1, ibu2 = ibu1 / np.max(np.abs(ibu1)) * 0.7, ibu2 / np.max(np.abs(ibu2)) * 0.62

    # inserts after a phrase: (seconds added, what happens there)
    pad = {12: 1.7, 13: len(ibu1) / SR - 0.2, 24: 1.9 + len(ibu2) / SR - 0.2, 28: 1.9}
    shift, onsets, ends, ev = 0.0, [], [], {}
    for i, (a, b) in enumerate(segs):
        onsets.append(round(a + shift, 3)); ends.append(round(b + shift, 3))
        if i == 12: ev["knocks"] = [round(b + shift + 0.3 + k * 0.42, 3) for k in range(3)]
        if i == 13: ev["ibu1"] = [round(b + shift + 0.25, 3), round(len(ibu1) / SR, 3)]
        if i == 24:
            ev["soft_knocks"] = [round(b + shift + 0.25 + k * 0.55, 3) for k in range(3)]
            ev["ibu2"] = [round(b + shift + 2.0, 3), round(len(ibu2) / SR, 3)]
        if i == 28: ev["silence"] = [round(b + shift + 0.05, 3), round(b + shift + 1.85, 3)]
        shift += pad.get(i, 0.0)
    total = round(ends[-1] + 2.0, 2)

    # ---- VO stem: original audio between gap midpoints, moved by the shifts
    n = int(total * SR) + SR
    vo = np.zeros(n)
    bounds = [0.0] + [(segs[i][1] + segs[i + 1][0]) / 2 for i in range(len(segs) - 1)] + [len(narr) / SR]
    for i in range(len(segs)):
        a, b = bounds[i], bounds[i + 1]
        piece = narr[int(a * SR): int(b * SR)].copy()
        f = int(0.01 * SR); piece[:f] *= np.linspace(0, 1, f); piece[-f:] *= np.linspace(1, 0, f)
        at = int((a + (onsets[i] - segs[i][0])) * SR)
        vo[at: at + len(piece)] += piece
    for key, sig in (("ibu1", ibu1), ("ibu2", ibu2)):
        at = int(ev[key][0] * SR); vo[at: at + len(sig)] += sig
    s0, s1 = (int(v * SR) for v in ev["silence"]); vo[s0:s1] = 0
    save(ROOT / "audio/vo.wav", vo[: int(total * SR)])

    # ---- shot cuts (seconds)
    P = lambda i, lead=0.18: round(onsets[i] - lead, 3)
    shots = [0.0, P(2), P(5), P(9), P(13), P(14), P(19), P(23), P(25), ev["silence"][1], P(33, 0.3), P(37), total]

    # ---- score: low drone bed, swells into the climax, dead silence, heartbeat to the end
    t = np.arange(n) / SR
    drone = (np.sin(2 * np.pi * 43.65 * t) + 0.7 * np.sin(2 * np.pi * 46.2 * t) + 0.35 * np.sin(2 * np.pi * 87.3 * t)
             + 0.12 * np.sin(2 * np.pi * 130.8 * t + 0.4 * np.sin(2 * np.pi * 0.11 * t)))
    air = bp(rng.standard_normal(n), 120, 900) * 0.5 + bp(rng.standard_normal(n), 3500, 8000) * 0.05
    lfo = 0.75 + 0.25 * np.sin(2 * np.pi * 0.06 * t)
    swell = 1 + 1.6 * np.clip((t - shots[7]) / max(0.1, ev["silence"][0] - shots[7]), 0, 1) ** 2
    music = (drone * 0.11 + air * 0.09) * lfo * swell
    music *= np.clip(t / 0.4, 0, 1)                      # tiny fade-in, frame 0 still has sound
    # dissonant sting that stops dead at the silence
    st0 = ev["silence"][0] - 0.32
    m = (t >= st0) & (t < ev["silence"][0])
    tt = t[m] - st0
    sting = sum(np.sin(2 * np.pi * f * tt) for f in (110, 116.5, 155.6, 233.1, 466.2)) * np.exp(-tt / 0.5) * 0.11
    sting += bp(rng.standard_normal(m.sum()), 500, 6000) * np.exp(-tt / 0.15) * 0.25
    music[m] += sting
    music[int(ev["silence"][0] * SR): int(ev["silence"][1] * SR)] = 0
    # after the silence: thin hum under the pause, heartbeat from the choice to the last line
    post = t >= ev["silence"][1]
    music[post] *= 0.35
    hb = np.zeros(n); thump_n = int(0.16 * SR); tt = np.arange(thump_n) / SR
    thump = np.sin(2 * np.pi * (60 * np.exp(-tt * 9) + 42) * tt) * np.exp(-tt / 0.05)
    k = shots[10]
    while k < ends[-1] - 0.2:
        for off, g in ((0, 1.0), (0.24, 0.65)):
            at = int((k + off) * SR); hb[at: at + thump_n] += thump * g
        k += 0.82
    music += hb * 0.55
    music[int(ends[-1] * SR):] *= np.linspace(1, 0, n - int(ends[-1] * SR))
    save(ROOT / "audio/music.wav", music[: int(total * SR)] / np.max(np.abs(music)) * 0.5)

    # ---- grid, timeline, film.json
    beats = {"bpm": 60, "period": 1.0, "offset": 0.0, "n_beats": int(total),
             "beats": [float(i) for i in range(int(total) + 1)],
             "sections": [{"name": "story", "start": 0, "end": int(shots[9])}, {"name": "choice", "start": int(shots[9]), "end": int(total)}]}
    (ROOT / "beats.json").write_text(json.dumps(beats, indent=1))
    tl = {"total": total, "shots": shots, "events": ev,
          "phrases": [{"i": i, "text": PHRASES[i], "t0": onsets[i], "t1": ends[i]} for i in range(len(PHRASES))]}
    (ROOT / "timeline.json").write_text(json.dumps(tl, indent=1, ensure_ascii=False))
    cfg = json.loads((ROOT / "film.json").read_text())
    cfg["duration"] = total; cfg["poster"] = round(shots[11] + 1.0, 2)
    (ROOT / "film.json").write_text(json.dumps(cfg, indent=1))
    print("total", total, "\nshots", shots, "\nevents", json.dumps(ev))


if __name__ == "__main__":
    main()

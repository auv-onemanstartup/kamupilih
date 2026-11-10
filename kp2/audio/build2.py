"""KAMU PILIH Part 2 audio + timeline, both branches.

    python3 kp2/audio/build2.py A draft     # estimated timing, no VO yet (picture drafts)
    python3 kp2/audio/build2.py A real      # measure kp2/audio/vo/narator_A.mp3 (+ ibu_B.mp3 for B)

Phrase lists below must match the VO script line for line (one measured segment per phrase).
Writes kp2/audio/vo.wav, music.wav, kp2/beats.json, timeline.json, film.json (branch, duration)."""
import json, subprocess, sys
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt

ROOT = Path(__file__).resolve().parents[1]
SR = 48000
rng = np.random.default_rng(22)
BR, MODE = (sys.argv[1].upper() if len(sys.argv) > 1 else "A"), (sys.argv[2] if len(sys.argv) > 2 else "draft")

COMMON_HEAD = ["mayoritas kalian pilih...", None, "kalian yang milih ini.", "jadi apa pun yang terjadi sekarang...", "tanggung jawab kalian."]
COMMON_TAIL = ["stop.", "kelanjutannya...", "kalian lagi yang nentuin.", "A:", None, "B:", None,
               "tulis A atau B di komentar.", "follow,", "biar kamu tau nasib kamu di part 3."]
SCRIPT = {
 "A": dict(win="buka pintu.", a="video call ibu sekarang.", b="matikan hp, tutup pintu, pura-pura nggak tahu.", body=[
   "kamu buka pelan-pelan.", "lorongnya kosong.", "nggak ada siapa-siapa.",          # 5 6 7
   "terus hp kamu bergetar.",                                                        # 8
   "pesan dari ibu.", "yang tadi “sedang mengetik”...", "akhirnya masuk.",            # 9 10 11
   "“nak, jangan buka pintu ya.", "ibu mimpi buruk soal kamu.”",                      # 12 13
   "dikirim jam 02.14.", "satu menit setelah kamu buka pintu.",                       # 14 15
   "kamu bales.", "“bu... aku udah buka.”",                                           # 16 17
   "ibu langsung baca.", "sedang mengetik...",                                        # 18 19
   "“nak, kamu sekarang di mana?”",                                                   # 20
   "kamu jawab:", "“di kos, bu. di kamar.”",                                          # 21 22
   "“terus...", "yang lagi berdiri di depan rumah ibu sekarang...", "siapa?”"]),      # 23 24 25
 "B": dict(win="telepon ibu.", a="bilang ke ibu, “bu, ada yang di depan pintu.”", b="tutup telepon, diam, pura-pura tidur.", body=[
   "nada sambung.", "sekali.", "dua kali.",                                           # 5 6 7
   "terus kamu dengar sesuatu.", "nada dering hp ibu kamu.", "lagu yang sama yang dia pakai bertahun-tahun.",  # 8 9 10
   "bunyinya...", "dari balik pintu.",                                                # 11 12
   "telepon diangkat.",                                                               # 13
   "lega.", "ibu kamu aman di rumah.",                                                # 14 15
   "tapi..."]),                                                                       # 16
}
S = SCRIPT[BR]
head = COMMON_HEAD.copy(); head[1] = S["win"]
tail = COMMON_TAIL.copy(); tail[4] = S["a"]; tail[6] = S["b"]
PHRASES = head + S["body"] + tail
NB = len(head) + len(S["body"])          # index of "stop."
IDX = {"stop": NB, "A": NB + 3, "Aline": NB + 4, "B": NB + 5, "Bline": NB + 6, "cta": NB + 7, "follow": NB + 8, "last": NB + 9}


def load(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(SR), "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).astype(np.float64)


def save(path, x):
    x = np.atleast_2d(x)
    if x.shape[0] == 1: x = np.vstack([x, x])
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-i", "-", "-c:a", "pcm_f32le", str(path)],
                   input=x.T.astype(np.float32).tobytes(), check=True)


def segments(x, db=-35, min_gap=0.15):
    win = int(0.02 * SR); n = len(x) // win
    quiet = 20 * np.log10(np.sqrt(np.mean(x[: n * win].reshape(n, win) ** 2, 1) + 1e-12)) < db
    segs, i, start = [], 0, None
    while i < n:
        if not quiet[i]:
            if start is None: start = i
            i += 1; continue
        j = i
        while j < n and quiet[j]: j += 1
        if start is not None and (j - i) * 0.02 >= min_gap: segs.append([start * 0.02, i * 0.02]); start = None
        i = j
    if start is not None: segs.append([start * 0.02, n * 0.02])
    return [s for s in segs if s[1] - s[0] > 0.12]


def group(segs, phrases):
    """DP: merge consecutive measured segments into len(phrases) groups whose durations best match
    each phrase's share of the text (TTS often pauses inside "..." or quotes)."""
    n, m = len(segs), len(phrases)
    w = np.array([max(4, len(p)) for p in phrases], float)
    speech = sum(b - a for a, b in segs); exp = w / w.sum() * speech
    INF = 1e18; D = np.full((n + 1, m + 1), INF); B = np.zeros((n + 1, m + 1), int); D[0, 0] = 0
    for i in range(1, n + 1):
        for j in range(1, min(i, m) + 1):
            for k in range(j - 1, i):
                if D[k, j - 1] >= INF: continue
                dur = sum(b - a for a, b in segs[k:i]); c = D[k, j - 1] + ((dur - exp[j - 1]) / max(exp[j - 1], 0.3)) ** 2
                if c < D[i, j]: D[i, j] = c; B[i, j] = k
    out, i = [], n
    for j in range(m, 0, -1):
        k = B[i, j]; out.append([segs[k][0], segs[i - 1][1]]); i = k
    return out[::-1]


def fit_segments(x, phrases):
    for db, gap in ((-35, 0.15), (-38, 0.12), (-32, 0.10), (-40, 0.09)):
        segs = segments(x, db, gap)
        if len(segs) == len(phrases): return segs
        if len(segs) > len(phrases):
            print(f"note: {len(segs)} segments for {len(phrases)} phrases, merging by text length (check the contact sheet)")
            return group(segs, phrases)
    raise SystemExit(f"only {len(segs)} segments for {len(phrases)} phrases: ask for a VO with clearer pauses between sentences")


bp = lambda x, lo, hi: sosfilt(butter(2, [lo, hi], "band", fs=SR, output="sos"), x)
lp = lambda x, f: sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)


def room(x, wet=0.35, tail=1.2):
    ir = np.zeros(int(tail * SR)); ir[0] = 1
    for d, g in ((0.031, .5), (0.047, .42), (0.073, .33), (0.11, .25), (0.17, .18)): ir[int(d * SR)] += g
    t = np.arange(len(ir)) / SR; ir += lp(rng.standard_normal(len(ir)), 2500) * np.exp(-t / 0.35) * 0.08
    xx = np.concatenate([x, np.zeros(len(ir))]); return lp(np.convolve(xx, ir)[: len(xx)] * wet + xx * (1 - wet), 4200)


def through_door(x):            # muffled, boomy: heard through wood
    return room(lp(x, 900) * 1.6, wet=0.5, tail=0.8)


def ringtone(dur):              # original 6-note phone melody (not a real brand tone), muffled later
    notes = [76, 79, 83, 81, 79, 74]; step = 0.18; out = np.zeros(int(dur * SR))
    k = 0
    while k * step * 8 < dur:
        for j, m in enumerate(notes):
            t0 = int((k * step * 8 + j * step) * SR); n = int(step * 0.9 * SR); tt = np.arange(n) / SR
            f = 440 * 2 ** ((m - 69) / 12)
            tone = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(4 * np.pi * f * tt)) * np.exp(-tt / 0.12)
            seg = out[t0: t0 + n]; seg += tone[: len(seg)]
        k += 1
    return out * 0.5


def dialtone(n_rings=2):        # Indonesian-style ringback: 425 Hz, 1 s on / 4 s off (shortened to 2.2 s cycle)
    cyc = 2.2; out = np.zeros(int(n_rings * cyc * SR)); t = np.arange(int(1.0 * SR)) / SR
    tone = np.sin(2 * np.pi * 425 * t) * np.minimum(1, np.minimum(t, 1 - t) / 0.02) * 0.25
    for k in range(n_rings): out[int(k * cyc * SR): int(k * cyc * SR) + len(tone)] += tone
    return bp(out, 300, 3400)


def buzz(dur=1.1):              # phone vibrating on a hand/table: two pulses
    t = np.arange(int(dur * SR)) / SR
    gate = ((t % 0.55) < 0.38).astype(float)
    return (np.sin(2 * np.pi * 155 * t) * 0.6 + bp(rng.standard_normal(len(t)), 120, 400) * 0.4) * gate * 0.5


def main():
    ev, inserts = {}, {}
    # ---- story inserts after a phrase index: (seconds, label)
    if BR == "A":
        inserts = {1: 1.4, 4: 1.2, 7: 1.0, 8: 1.0, 22: 1.4, 25: 1.6}
    else:
        inserts = {1: 1.4, 4: 0.6, 7: 1.2, 10: 2.4, 12: 0.6, 13: None, 16: None}
    if MODE == "real":
        narr = load(ROOT / f"audio/vo/narator_{BR}.mp3")
        segs = fit_segments(narr, PHRASES)
    else:
        segs, t = [], 0.6
        for p in PHRASES:
            d = max(0.35, len(p) / 15.5); segs.append([t, t + d]); t += d + (0.6 if p.rstrip("”").endswith((".", "?", ":")) else 0.4)
        narr = None
    ibu1 = ibu2 = None
    if BR == "B":
        if MODE == "real":
            ib = load(ROOT / "audio/vo/ibu_B.mp3")
            ibu1 = ib / np.max(np.abs(ib)) * 0.75
        else:
            ibu1 = np.zeros(int(3.6 * SR))
        # the door voice repeats the LAST words of the call ("kenapa telepon jam segini?") in sync
        isegs = segments(ibu1, -38, 0.25) if MODE == "real" else [[0, 0.8], [1.0, 1.8], [2.0, 3.5]]
        cut = isegs[-1][0] - 0.05 if len(isegs) > 1 else len(ibu1) / SR * 0.55
        tailv = ibu1[int(cut * SR):]
        ibu2 = (lp(tailv, 3400) * 0.9, through_door(tailv) * 1.1)       # phone copy + door copy
        inserts[13] = len(ibu1) / SR + 0.6
        inserts[16] = 1.2 + len(tailv) / SR + 1.4                          # freeze, double voice, sting

    shift, on, end = 0.0, [], []
    for i, (a, b) in enumerate(segs):
        on.append(round(a + shift, 3)); end.append(round(b + shift, 3))
        gap = inserts.get(i, 0.0) or 0.0
        e = b + shift
        if BR == "A":
            if i == 4: ev["door_open"] = [round(e + 0.1, 3), round(e + 1.1, 3)]
            if i == 8: ev["buzz"] = round(on[8] + 0.6, 3)
            if i == 22: ev["typing_long"] = [round(e + 0.1, 3), round(e + 1.3, 3)]
            if i == 25: ev["silence"] = [round(e + 0.05, 3), round(e + 1.55, 3)]
        else:
            if i == 4: ev["call_start"] = round(e + 0.1, 3)
            if i == 7: ev["ringback_end"] = round(e + 1.0, 3)
            if i == 8: ev["ring_door"] = [round(on[8] + 0.7, 3), None]
            if i == 13: ev["pickup"] = round(e + 0.05, 3); ev["ring_door"][1] = ev["pickup"]; ev["ibu1"] = [round(e + 0.35, 3), round(len(ibu1) / SR, 3)]
            if i == 16:
                ev["freeze"] = [round(e + 0.1, 3), round(e + 1.2, 3)]
                ev["double"] = [round(e + 1.2, 3), round(len(ibu2[0]) / SR, 3)]
                ev["silence"] = [round(e + 1.2 + len(ibu2[0]) / SR + 0.05, 3), round(e + gap - 0.05, 3)]
        shift += gap
    if BR == "B":   # ringback starts with the call and keeps cycling under "nada sambung"
        ev["ringback"] = [round(on[5] - 0.4, 3), 2]
    total = round(end[-1] + 2.0, 2)
    n = int(total * SR) + SR
    t = np.arange(n) / SR

    # ---- VO stem
    vo = np.zeros(n)
    if narr is not None:
        bounds = [0.0] + [(segs[i][1] + segs[i + 1][0]) / 2 for i in range(len(segs) - 1)] + [len(narr) / SR]
        for i in range(len(segs)):
            piece = narr[int(bounds[i] * SR): int(bounds[i + 1] * SR)].copy(); f = int(0.01 * SR)
            piece[:f] *= np.linspace(0, 1, f); piece[-f:] *= np.linspace(1, 0, f)
            at = int((bounds[i] + (on[i] - segs[i][0])) * SR); vo[at: at + len(piece)] += piece
    if BR == "B":
        at = int(ev["ibu1"][0] * SR); v = lp(ibu1, 3400) * 0.9; vo[at: at + len(v)] += v           # phone-band ibu
        at = int(ev["double"][0] * SR)
        for v in ibu2: vo[at: at + len(v)] += v[: n - at]
    s0, s1 = (int(v * SR) for v in ev["silence"]); vo[s0:s1] = 0

    # ---- story sound (written into the music stem so sfx.mjs stays for hits only)
    fx = np.zeros(n)
    def put(sig, at, g=1.0):
        a = int(at * SR); seg = fx[a: a + len(sig)]; seg += sig[: len(seg)] * g
    if BR == "A":
        put(buzz(), ev["buzz"], 0.9); put(buzz(), ev["buzz"] + 1.4, 0.6)
    else:
        put(dialtone(3), ev["ringback"][0], 0.8)
        r0, r1 = ev["ring_door"]; rt = through_door(ringtone(r1 - r0)) * np.linspace(0.35, 1.0, int((r1 - r0) * SR) + int(0.8 * SR))[: int((r1 - r0) * SR) + int(0.8 * SR)]
        rt[int((r1 - r0) * SR):] = 0                                                                 # stops dead on pickup
        put(rt, r0, 0.9)

    # ---- score (same family as Part 1)
    drone = (np.sin(2 * np.pi * 43.65 * t) + 0.7 * np.sin(2 * np.pi * 46.2 * t) + 0.35 * np.sin(2 * np.pi * 87.3 * t)
             + 0.12 * np.sin(2 * np.pi * 130.8 * t + 0.4 * np.sin(2 * np.pi * 0.11 * t)))
    air = bp(rng.standard_normal(n), 120, 900) * 0.5 + bp(rng.standard_normal(n), 3500, 8000) * 0.05
    climax0 = on[IDX["stop"]] - 12
    swell = 1 + 1.6 * np.clip((t - climax0) / 10, 0, 1) ** 2
    music = (drone * 0.11 + air * 0.09) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.06 * t)) * swell * np.clip(t / 0.4, 0, 1)
    st0 = ev["silence"][0] - 0.32; m = (t >= st0) & (t < ev["silence"][0]); tt = t[m] - st0
    music[m] += sum(np.sin(2 * np.pi * f * tt) for f in (110, 116.5, 155.6, 233.1, 466.2)) * np.exp(-tt / 0.5) * 0.11 + bp(rng.standard_normal(m.sum()), 500, 6000) * np.exp(-tt / 0.15) * 0.25
    if BR == "B": music[(t >= ev["freeze"][0]) & (t < ev["freeze"][1])] = 0                       # "tapi..." -> dead air
    music[int(ev["silence"][0] * SR): int(ev["silence"][1] * SR)] = 0
    post = t >= ev["silence"][1]; music[post] *= 0.35
    hb = np.zeros(n); thump_n = int(0.16 * SR); tt = np.arange(thump_n) / SR
    thump = np.sin(2 * np.pi * (60 * np.exp(-tt * 9) + 42) * tt) * np.exp(-tt / 0.05)
    k = on[IDX["A"]] - 0.4
    while k < end[-1] - 0.2:
        for off, g in ((0, 1.0), (0.24, 0.65)): a = int((k + off) * SR); hb[a: a + thump_n] += thump * g
        k += 0.82
    music = music / np.max(np.abs(music)) * 0.5 + hb * 0.28 + fx * 0.6
    music[int(ev["silence"][0] * SR): int(ev["silence"][1] * SR)] = 0
    music[int(end[-1] * SR):] *= np.linspace(1, 0, n - int(end[-1] * SR))
    save(ROOT / "audio/vo.wav", vo[: int(total * SR)]); save(ROOT / "audio/music.wav", music[: int(total * SR)])

    # ---- shots: (start time, name)
    P = lambda i, lead=0.18: round(on[i] - lead, 3)
    if BR == "A":
        shots = [(0, "vote"), (P(2), "knob"), (P(5), "hall"), (P(8), "buzz"), (P(9), "chat"), (P(14), "stamp"), (P(16), "chat"),
                 (P(23), "chatlast"), (round((on[24] + end[24]) / 2, 3), "house"), (ev["silence"][1], "pause"), (P(IDX["A"], 0.3), "choice"), (P(IDX["cta"]), "end")]
    else:
        shots = [(0, "vote"), (P(2), "calling"), (P(8), "door"), (P(11), "gap"), (P(13), "call"), (P(14), "room"),
                 (P(16), "freeze"), (ev["silence"][1], "pause"), (P(IDX["A"], 0.3), "choice"), (P(IDX["cta"]), "end")]
    beats = {"bpm": 60, "period": 1.0, "offset": 0.0, "n_beats": int(total), "beats": [float(i) for i in range(int(total) + 1)],
             "sections": [{"name": "story", "start": 0, "end": int(ev["silence"][1])}, {"name": "choice", "start": int(ev["silence"][1]), "end": int(total)}]}
    (ROOT / "beats.json").write_text(json.dumps(beats))
    tl = {"branch": BR, "mode": MODE, "total": total, "shots": shots, "events": ev, "idx": IDX,
          "phrases": [{"i": i, "text": PHRASES[i], "t0": on[i], "t1": end[i]} for i in range(len(PHRASES))]}
    (ROOT / "timeline.json").write_text(json.dumps(tl, indent=1, ensure_ascii=False))
    (ROOT / "film.json").write_text(json.dumps({"title": f"KAMU PILIH Part 2{BR}", "duration": total, "formats": ["9x16"],
                                                 "poster": round(shots[-2][0] + 1.0, 2)}, indent=1))
    print(BR, MODE, "total", total, "phrases", len(PHRASES)); print("shots", shots); print("events", json.dumps(ev))
    (ROOT / f"docs/vo_script_{BR}.txt").write_text("\n".join(PHRASES) + "\n")


if __name__ == "__main__":
    main()

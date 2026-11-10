"""Offline Indonesian narrator for KAMU PILIH (sherpa-onnx + piper id_ID news_tts), processed for horror.

    from tts.say import say   ->  say(text, style='narrator'|'entity') -> numpy float array @48k
Styles:
  narrator: slower, ~2.5 semitones lower, warm low-pass, small dark room
  entity:   the thing behind the door (ibu's copied voice): higher, breathy, through-the-door muffled + long echo
Cached by (style, text) in tts/cache/."""
import hashlib, subprocess, tempfile
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
SR = 48000
CACHE = HERE / "cache"; CACHE.mkdir(exist_ok=True)
STYLES = {
    # length_scale (>1 slower), ffmpeg filter chain applied after synthesis
    "narrator": (1.18, "asetrate=22050*0.86,aresample=48000,atempo=1.0,lowpass=f=5200,highpass=f=70,"
                       "aecho=0.8:0.55:38|61:0.22|0.12,volume=1.4"),
    "entity":   (1.30, "asetrate=22050*1.06,aresample=48000,atempo=0.92,lowpass=f=2600,highpass=f=180,"
                       "aecho=0.8:0.7:120|260|420:0.35|0.22|0.12,tremolo=f=6:d=0.15,volume=1.6"),
}


def _clean(text):
    t = text.replace("“", "").replace("”", "").replace("\"", "")
    t = t.replace("A:", "A.").replace("B:", "B.").replace("·", ",").replace("00:00", "nol nol, nol nol")
    t = t.replace("02.", "jam dua lewat ").replace("hp", "hape").replace("...", ", ")
    return t.strip()


def say(text, style="narrator"):
    ls, chain = STYLES[style]
    key = hashlib.sha1(f"{style}|{text}".encode()).hexdigest()[:16]
    out = CACHE / f"{key}.f32"
    if not out.exists():
        with tempfile.TemporaryDirectory() as d:
            raw = Path(d) / "raw.wav"
            subprocess.run([str(HERE / "sherpa-onnx-offline-tts"), f"--vits-model={HERE}/voice/id_ID-news_tts-medium.onnx",
                            f"--vits-tokens={HERE}/voice/tokens.txt", f"--vits-data-dir={HERE}/voice/espeak-ng-data",
                            f"--vits-length-scale={ls}", f"--output-filename={raw}", _clean(text)],
                           check=True, capture_output=True)
            pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(raw), "-af", chain, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                 check=True, capture_output=True).stdout
            out.write_bytes(pcm)
    x = np.frombuffer(out.read_bytes(), np.float32).astype(np.float64)
    # trim leading/trailing near-silence
    idx = np.where(np.abs(x) > 0.01)[0]
    if len(idx): x = x[max(0, idx[0] - 480): idx[-1] + 4800]
    return x / (np.max(np.abs(x)) + 1e-9) * 0.8

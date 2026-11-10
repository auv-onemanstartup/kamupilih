"""Offline Indonesian narrator for KAMU PILIH (sherpa-onnx + piper id_ID news_tts), processed for horror.

    from tts.say import say   ->  say(text, style='narrator'|'entity') -> numpy float array @48k
Styles:
  narrator: natural pitch, slow, close and dark (user's pick, style 1)
  entity:   the thing behind the door: a whisper with a trace of real voice, long echo
Cached by (style, text) in tts/cache/."""
import hashlib, subprocess, tempfile
from pathlib import Path
import numpy as np

HERE = Path(__file__).resolve().parent
SR = 48000
CACHE = HERE / "cache"; CACHE.mkdir(exist_ok=True)
STYLES = {
    # length_scale (>1 slower), ffmpeg filter chain applied after synthesis.
    # narrator = style 1 chosen by the user (natural pitch, slow, close and dark; no pitch shift: it sounded cartoonish)
    "narrator": (1.25, "aresample=48000,highpass=f=80,lowpass=f=6500,aecho=0.8:0.4:30|55:0.15|0.08,volume=1.6", None),
    # entity = a whisper (phase-randomized voice) with a little of the real voice under it, behind the door, long echo
    "entity":   (1.30, None, "[0:a]aresample=48000,asplit[a][b];[a]afftfilt=real='hypot(re,im)*cos(2*PI*random(0))':"
                             "imag='hypot(re,im)*sin(2*PI*random(0))':win_size=512:overlap=0.75,highpass=f=300,lowpass=f=5000,volume=2.2[w];"
                             "[b]lowpass=f=1100,volume=0.3[v];[w][v]amix=inputs=2:normalize=0,aecho=0.8:0.6:90|200|380:0.3|0.18|0.1,volume=1.5"),
}


def _clean(text):
    t = text.replace("“", "").replace("”", "").replace("\"", "")
    t = t.replace("A:", "A.").replace("B:", "B.").replace("·", ",").replace("00:00", "nol nol, nol nol")
    t = t.replace("02.", "jam dua lewat ").replace("hp", "hape").replace("...", ", ")
    return t.strip()


def say(text, style="narrator"):
    ls, chain, graph = STYLES[style]
    key = hashlib.sha1(f"{style}|{text}".encode()).hexdigest()[:16]
    out = CACHE / f"{key}.f32"
    if not out.exists():
        with tempfile.TemporaryDirectory() as d:
            raw = Path(d) / "raw.wav"
            subprocess.run([str(HERE / "sherpa-onnx-offline-tts"), f"--vits-model={HERE}/voice/id_ID-news_tts-medium.onnx",
                            f"--vits-tokens={HERE}/voice/tokens.txt", f"--vits-data-dir={HERE}/voice/espeak-ng-data",
                            f"--vits-length-scale={ls}", f"--output-filename={raw}", _clean(text)],
                           check=True, capture_output=True)
            fl = ["-af", chain] if chain else ["-filter_complex", graph]
            pcm = subprocess.run(["ffmpeg", "-v", "error", "-i", str(raw), *fl, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                                 check=True, capture_output=True).stdout
            out.write_bytes(pcm)
    x = np.frombuffer(out.read_bytes(), np.float32).astype(np.float64)
    # trim leading/trailing near-silence
    idx = np.where(np.abs(x) > 0.01)[0]
    if len(idx): x = x[max(0, idx[0] - 480): idx[-1] + 4800]
    return x / (np.max(np.abs(x)) + 1e-9) * 0.8

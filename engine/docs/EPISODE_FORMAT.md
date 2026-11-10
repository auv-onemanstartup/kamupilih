# Episode file format (engine/episodes/partNX.json)

One file = one finished Reel. `bash engine/make_episode.sh engine/episodes/partNX.json`
writes `out/episodes/KamuPilih_partNX.mp4` (+ contact sheet). Every beat is one line of on-screen text,
read aloud by the offline Indonesian narrator (`engine/tts/`, sherpa-onnx + piper id_ID news_tts, no credits).
A beat lasts max(reading time `len/12.5 + 0.85 s`, voice length + 0.35 s). Red lines that start with “ are
voiced as the entity (higher, muffled, echoing). `"novoice": true` on a beat keeps it silent; `"voice": false`
at the top level makes a text-only episode.

```json
{
  "part": 4, "branch": "A", "winnerLabel": "TAHAN PINTUNYA", "clock": "02.27",
  "vote": {"mode": "vote", "a": 64, "b": 36, "labelA": "TAHAN PINTUNYA", "labelB": "TAHAN NAPAS"},
  "beats": [ { "text": "...", ... } ],
  "choice": {"a": "...", "b": "...", "labelA": "LINE1\nLINE2", "labelB": "...",
             "cardA": ["phone", [170, 640, 560, 1109]], "cardB": ["knob", [190, 280, 560, 1109]]}
}
```

- `vote.mode`: `"vote"` (bar with a/b %) or `"auto"` (no screenshot: "KALIAN DIEM AJA... JADI AKU YANG MILIH.").
- The engine appends the standard tail itself: stop / kelanjutannya / kalian lagi yang nentuin → A/B cards → "tulis A atau B di komentar" → follow part N+1.
- Exactly one story beat should carry `"silence@end"` (the scare: frame freezes, dead silence 1.65 s). If none, the last story beat gets it.

## Beat fields
| field | meaning |
|---|---|
| `text` | the line (lowercase, natural Indonesian). Quotes from characters in “ ” |
| `shot` | starts a new shot at this beat (see below) |
| `events` | `["kind", "kind@0.4", "kind@end", "kind@-8"]` offset from the beat start (s) |
| `dur` / `hold` | override reading time / extra pause after |
| `red` | whole line red (scary line, ibu's voice) |
| `nosuper` | don't show as a super (e.g. the text is already in a chat bubble) |
| `msg` | chat bubble appears at this beat: `{"side":"in|out","text":"...","time":"02.26","hl":true}` |
| `typing` | "sedang mengetik..." + typing dots during this beat |
| `notif` | lock-screen banner: `{"title":"ibu","body":"..."}` (pair with event `notif`) |
| `time` | story clock from this beat on (phone + red bedside clock) |

## Shots
| type | fields |
|---|---|
| `plate` | `img` (key below), `from`/`to` `[cx, cy, zoom]` in source px, `hand` (0.3 calm–1.5 panic), `fx` list, `dark` 0–1, `ringBase` |
| `phone` | `ui`: `call` · `chat` · `lock` · `history` (`rows:[{name,kind,dur,time,hl,missed}]`) · `off`; `zoom:[from,to]` (<1.6 pulls back to show the room), `dimFrom` s |
| `knob` | gagang close-up; event `turn` starts the turn, `open` opens the door (light floods the seam) |

## Plates (keys) and fx
| key | picture | anchors / fx that work |
|---|---|---|
| `phone` | hand holding phone in bed, door + red clock behind | phone UIs |
| `gapClose` | door bottom, ibu's phone lying outside, glowing | `ring` (pulses with ring events, `ringBase` idle glow, dies on `lightOff`) |
| `gapWide` | wide: bed edge + door + phone outside | `ring` |
| `phoneBed` | phone on bed, door open to red hallway | `lamp` |
| `knob` | gagang close-up | use shot type `knob` |
| `doorOpen` | open door to empty red hallway | `lamp` |
| `house` | ibu's village house, pale figure at the door | `window` (goes dark on `lightOff`) |
| `room`, `inside`, `hall`, `book`, `door13` | Part 1 Canva style (use sparingly) | – |
Screen-space fx for any plate: `dust`, `fog`, `embers`, `rain`, `flicker`.

## Events
`knock` (3 hard + shake) · `softknock` · `click` · `buzz` (phone vibrates, shakes the phone shot) · `notif` ·
`msg` · `dial`/`pickup`/`hangup` (call screen state + clicks) · `ring` … `ringStop` (ibu's ringtone behind the door, muffled) ·
`dialStop` · `turn` · `open` · `lightOff` · `flash` · `glitch` · `impact` · `sub` · `hl` (history row turns red) ·
`deadair` (1 s freeze + silence mid-story) · `silence` (the scare).

// KAMU PILIH Part 1: pure function of time. window.seek(t) paints frame t (see lib/motion.js).
// Grid is 60 bpm, so u (beats) == t (seconds). timeline.json (audio/build_audio.py) holds every
// placed VO phrase, the shot cuts and the event times, so picture follows the measured voice.
import * as M from './lib/motion.js';

const { W, H, E, prog, lerp, clamp, bump, springU, SPRING, font, layout, glyph, noise1, hash01, mulberry32 } = M;

const TL = await fetch('timeline.json').then((r) => r.json());
const SH = TL.shots, EV = TL.events, PH = TL.phrases;
const C = { night: '#05080f', ink: '#0a0e18', red: '#d8202e', bone: '#ecebe6', dim: '#9aa3b5' };
const DISPLAY = 'Display', UI = 'UI';
const on = (i) => PH[i].t0;

// ---------------------------------------------------------------- hits -> sfx.mjs
const knock = (t, g) => [t, 'knock', 'thud+click', { pitch: 150, to: 70, len: 0.14, gain: g, verb: 0.35 }];
const HITS = [
  [0, 'hook', 'sub', { len: 1.4, gain: 0.8 }],
  [on(1), 'kamu yang nentuin', 'thud', { pitch: 90, to: 45, len: 0.35, verb: 0.3, gain: 0.7 }],
  [SH[1], 'into hallway', 'whoosh', { len: 0.6, from: 300, to: 1400, gain: 0.6 }],
  [SH[1] + 0.9, 'lamp flicker', 'click', { gain: 0.25 }],
  [SH[1] + 1.7, 'lamp flicker', 'click', { gain: 0.2 }],
  [SH[1] + 2.6, 'lamp flicker', 'click', { gain: 0.25 }],
  [SH[2], 'door 13', 'thud', { pitch: 110, to: 50, len: 0.35, verb: 0.4, gain: 0.8 }],
  [on(7) - 0.05, 'cut in on 13', 'sub', { len: 0.9, gain: 0.7 }],
  [SH[3], 'bedroom', 'whoosh', { len: 0.5, from: 1600, to: 300, gain: 0.4 }],
  ...EV.knocks.map((t) => knock(t, 1.0)),
  [SH[4], 'inside the door', 'sub', { len: 0.8, gain: 0.5 }],
  [SH[5], 'window', 'whoosh', { len: 0.7, from: 900, to: 200, gain: 0.35 }],
  [on(18), '300 KM', 'sub', { len: 1.1, gain: 0.8 }],
  [SH[6] + 0.1, 'phone', 'blip', { pitch: 'E6', gain: 0.5 }],
  [SH[6] + 0.22, 'phone', 'blip', { pitch: 'B6', gain: 0.4 }],
  [SH[7], 'knob', 'sub', { len: 0.7, gain: 0.5 }],
  ...EV.soft_knocks.map((t) => knock(t, 0.5)),
  [EV.soft_knocks[2] + 0.55, 'knob turns', 'tick', { gain: 0.5, pitch: 'C4' }],
  [EV.soft_knocks[2] + 1.6, 'knob turns back', 'tick', { gain: 0.4, pitch: 'A3' }],
  [SH[8], 'floor gap', 'sub', { len: 1.0, gain: 0.6 }],
  [on(28), 'kakinya nggak napak', 'thud', { pitch: 70, to: 35, len: 0.5, gain: 1.0, verb: 0.2 }],
  [SH[9], 'tape stop', 'whoosh', { len: 0.8, from: 1400, to: 70, gain: 0.6 }],
  [on(33), 'card A', 'thud', { pitch: 120, to: 60, len: 0.25, gain: 0.7 }],
  [on(35), 'card B', 'thud', { pitch: 120, to: 60, len: 0.25, gain: 0.7 }],
  [SH[11], 'end card', 'impact', { gain: 0.6 }],
  [on(41), 'follow', 'blip', { pitch: 'D6', gain: 0.4 }],
];

// ---------------------------------------------------------------- camera over a painted plate
// cam(): source point (cx, cy) at screen centre, zoom z over cover scale, clamped so the
// plate always covers the frame. Draw overlays in source pixels after apply().
function cam(img, cx, cy, z) {
  const s = Math.max(W / img.width, H / img.height) * z;
  const ox = clamp(W / 2 - cx * s, W - img.width * s, 0);
  const oy = clamp(H / 2 - cy * s, H - img.height * s, 0);
  return { s, ox, oy, apply(ctx) { ctx.translate(ox, oy); ctx.scale(s, s); } };
}
const logZoom = (a, b, p) => a * (b / a) ** clamp(p);
function plate(ctx, img, cx, cy, z, extra) {
  const c = cam(img, cx, cy, z);
  ctx.save(); c.apply(ctx); ctx.drawImage(img, 0, 0); if (extra) extra(ctx, c); ctx.restore();
  return c;
}
function glow(ctx, x, y, r, rgb, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function darken(ctx, a) { if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${clamp(a)})`; ctx.fillRect(0, 0, W, H); } }

// ---------------------------------------------------------------- living layers (v4)
// Screen-space dust motes drifting through a light area; seeded, wraps inside its box.
function dust(ctx, u, { x, y, w, h, n = 40, seed = 1, rgb = '215,225,245', a = 0.5, vx = 6, vy = -12, size = 3 }) {
  a = Math.min(0.75, a * 1.35); size *= 1.3;
  ctx.save();
  for (let i = 0; i < n; i++) {
    const r1 = hash01(i, seed), r2 = hash01(i, seed + 7), r3 = hash01(i, seed + 13);
    const sp = 0.4 + r3;
    const px = x + ((r1 * w + u * vx * sp + 8 * noise1(u * 0.6 + i, seed)) % w + w) % w;
    const py = y + ((r2 * h + u * vy * sp) % h + h) % h;
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * noise1(u * 1.3 + i * 3.1, seed + 2));
    const rad = size * (0.5 + r3);
    ctx.fillStyle = `rgba(${rgb},${a * tw})`;
    ctx.beginPath(); ctx.arc(px, py, rad, 0, M.TAU); ctx.fill();
    if (r3 > 0.85) { ctx.fillStyle = `rgba(${rgb},${a * tw * 0.12})`; ctx.beginPath(); ctx.arc(px, py, rad * 5, 0, M.TAU); ctx.fill(); }
  }
  ctx.restore();
}
// Low fog crawling along the bottom of the frame.
function fog(ctx, u, y0, a = 0.22, rgb = '60,70,95') {
  for (let k = 0; k < 7; k++) {
    const x = ((hash01(k, 41) * W * 1.6 + u * (18 + 14 * hash01(k, 42))) % (W * 1.6)) - W * 0.3;
    const y = y0 + hash01(k, 43) * 260, rx = 340 + 200 * hash01(k, 44);
    const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
    g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
  }
}
// Embers drifting up.
function embers(ctx, u, n = 26, seed = 5) {
  for (let i = 0; i < n; i++) {
    const r1 = hash01(i, seed), r2 = hash01(i, seed + 3), sp = 40 + 70 * hash01(i, seed + 6);
    const y = H - (((r2 * H + u * sp) % (H + 100)));
    const x = r1 * W + 30 * Math.sin(u * 0.9 + i);
    const a = 0.5 * (0.5 + 0.5 * Math.sin(u * 4 + i * 2));
    ctx.fillStyle = `rgba(235,60,50,${a})`; ctx.beginPath(); ctx.arc(x, y, 2 + 2 * r1, 0, M.TAU); ctx.fill();
  }
}

// ---------------------------------------------------------------- shots
function s1Book(ctx, u, IMG) {               // hook: push into the blank page, candle breathes
  const p = prog(u, 0, SH[1]);
  plate(ctx, IMG.book, lerp(560, 650, p), lerp(900, 980, p), logZoom(1.0, 1.55, p), (c) => {
    const f = 0.55 + 0.25 * noise1(u * 7, 4) + 0.12 * noise1(u * 23, 9);
    c2(c, () => glow(ctx, 122, 215, 260, '220,40,30', 0.35 * f));
    glow(ctx, 640, 960, 420, '200,170,140', 0.08 + 0.05 * f);
  });
  dust(ctx, u, { x: 0, y: 200, w: W, h: 1300, n: 45, seed: 11, rgb: '255,190,160', a: 0.45, vx: 5, vy: -9 });
}
const c2 = (c, fn) => fn();
function s2Hall(ctx, u, IMG) {
  const p = prog(u, SH[1], SH[2]);
  const sw = Math.sin((u - SH[1]) * 2.3) * 22;
  plate(ctx, IMG.hall, 472, lerp(820, 760, p), logZoom(1.0, 1.22, p), () => {
    glow(ctx, 472 + sw * 0.4, 250, 160, '255,40,40', 0.25);
    ctx.save(); ctx.scale(1, 0.35); glow(ctx, 472 + sw * 1.6, 1150 / 0.35, 260, '200,20,30', 0.28); ctx.restore();
  });
  dust(ctx, u, { x: 260, y: 300, w: 560, h: 900, n: 40, seed: 21, rgb: '255,120,120', a: 0.35, vx: 3, vy: 6 });
  const flick = Math.max(...[0.9, 1.7, 2.6].map((d) => bump(u, SH[1] + d, 0.09)));
  darken(ctx, 0.75 * flick);
}
function s3Door13(ctx, u, IMG) {
  const cut = on(7) - 0.05;                   // cut-in on "kata ibu kos"
  if (u < cut) { const p = prog(u, SH[2], cut); plate(ctx, IMG.door13, 540, 900, logZoom(1.0, 1.12, p)); }
  else { const p = prog(u, cut, SH[3]); plate(ctx, IMG.door13, 640, 560, logZoom(1.9, 2.25, p)); }
  if (u < cut) glow(ctx, W / 2, H * 0.9, 520, '170,190,230', 0.07 + 0.05 * Math.max(0, noise1(u * 5, 8)));
  dust(ctx, u, { x: 0, y: 0, w: W, h: H, n: 55, seed: 31, a: 0.3, vx: -4, vy: -6, size: 2.6 });
}
function s4Room(ctx, u, IMG) {
  const p = prog(u, SH[3], SH[4]);
  ctx.save();
  EV.knocks.forEach((t) => M.shake(ctx, u, t, 26, 5, 0.1));
  plate(ctx, IMG.room, 560, 760, logZoom(1.05, 1.16, p), () => {
    glow(ctx, 755, 472, 170, '230,30,40', 0.18 + 0.1 * Math.sin(u * 3.1));
    const beam = ctx.createLinearGradient(120, 300, 520, 1300);
    beam.addColorStop(0, `rgba(150,175,220,${0.10 + 0.03 * noise1(u * 0.7, 3)})`); beam.addColorStop(1, 'rgba(150,175,220,0)');
    ctx.fillStyle = beam; ctx.beginPath(); ctx.moveTo(40, 220); ctx.lineTo(250, 230); ctx.lineTo(760, 1350); ctx.lineTo(260, 1420); ctx.closePath(); ctx.fill();
    if (Math.floor(u * 2) % 2) { ctx.fillStyle = '#120608'; ctx.fillRect(749, 455, 9, 34); }
  });
  dust(ctx, u, { x: 60, y: 300, w: 700, h: 1100, n: 50, seed: 41, a: 0.4, vx: 6, vy: 9 });
  ctx.restore();
  EV.knocks.forEach((t) => darken(ctx, 0.45 * bump(u, t + 0.03, 0.06)));
}
function gapShadow(ctx, u, x, a) {           // a soft body passing behind the door gap
  ctx.save(); ctx.filter = 'blur(10px)'; ctx.fillStyle = `rgba(2,3,8,${a})`;
  ctx.beginPath(); ctx.ellipse(x, 1112, 85, 38, 0.06, 0, M.TAU); ctx.fill();
  ctx.restore();
}
function s5Inside(ctx, u, IMG) {
  const p = prog(u, SH[4], SH[5]);
  const [w0, wd] = EV.ibu1;
  plate(ctx, IMG.inside, 480, lerp(820, 980, p), logZoom(1.0, 1.35, p), () => {
    const sp = prog(u, w0 + 0.3, w0 + wd - 0.6);
    if (sp > 0 && sp < 1) gapShadow(ctx, u, lerp(250, 730, E.inOutSine(sp)), 0.95);
    const sb = prog(u, SH[4] + 0.4, w0 - 0.2);
    if (sb > 0 && sb < 1) gapShadow(ctx, u, lerp(760, 220, E.inOutSine(sb)), 0.7);
    const fl = 0.5 + 0.5 * noise1(u * 11, 6);
    ctx.fillStyle = `rgba(190,210,245,${0.25 * fl})`; ctx.beginPath(); ctx.moveTo(262, 1096); ctx.lineTo(712, 1126); ctx.lineTo(712, 1134); ctx.lineTo(262, 1104); ctx.closePath(); ctx.fill();
  });
  dust(ctx, u, { x: 150, y: 1150, w: 800, h: 450, n: 40, seed: 51, a: 0.35, vx: 4, vy: -5, size: 2.4 });
}
function s6Window(ctx, u, IMG) {
  const p = prog(u, SH[5], SH[6]);
  plate(ctx, IMG.far, 320, lerp(1250, 1000, E.inOutSine(p)), logZoom(1.0, 1.15, p), () => {
    ctx.save(); ctx.filter = 'blur(26px)'; ctx.fillStyle = 'rgba(8,12,24,0.75)';
    for (let k = 0; k < 2; k++) {               // clouds drifting across the moon
      const x = lerp(-200, 900, ((u - SH[5]) * 0.07 + k * 0.5) % 1.2);
      ctx.beginPath(); ctx.ellipse(x, 1040 + k * 60, 220, 46, 0, 0, M.TAU); ctx.fill();
    }
    ctx.restore();
    const lightOn = u < on(17) + 0.5 || (u < on(17) + 0.75 && Math.floor(u * 20) % 2);
    if (lightOn) { glow(ctx, 610, 1560, 60, '255,190,110', 0.9); ctx.fillStyle = '#ffcf85'; ctx.fillRect(604, 1552, 12, 14); }
    ctx.save(); ctx.strokeStyle = '#03050a'; ctx.lineCap = 'round';
    [[1100, 820, 0.0], [1100, 1240, 1.7]].forEach(([ax, ay, ph]) => {
      const a = Math.sin(u * 0.9 + ph) * 0.05 + Math.sin(u * 2.3 + ph) * 0.015;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(a);
      ctx.lineWidth = 26; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-300, 40, -560, -30); ctx.stroke();
      ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(-260, 20); ctx.quadraticCurveTo(-360, 140, -470, 170); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-420, -10); ctx.quadraticCurveTo(-500, -120, -620, -150); ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  });
  dust(ctx, u, { x: 0, y: 500, w: W, h: 900, n: 35, seed: 61, a: 0.3, vx: 3, vy: -4, size: 2.2 });
}
function s7Phone(ctx, u, IMG) {
  const k = springU(u, SH[6], SPRING.gentle);
  const p = prog(u, SH[6], SH[7]);
  ctx.save(); ctx.translate(0, (1 - k) * 420 - 190);
  plate(ctx, IMG.phone, 540, lerp(980, 1060, p), logZoom(1.0, 1.12, p), () => {
    glow(ctx, 540, 960, 520, '90,120,190', 0.06 + 0.04 * Math.sin(u * 2.2));
    const ty = prog(u, on(22) + 0.5, on(22) + 0.7);
    if (ty > 0) {
      ctx.fillStyle = '#10141e'; ctx.fillRect(400, 497, 380, 36);
      ctx.font = font(24, 700, UI); ctx.fillStyle = '#7fd0a0'; ctx.fillText('sedang mengetik...', 402, 524);
      ctx.save(); ctx.globalAlpha = ty; ctx.fillStyle = '#242836'; M.rrect(ctx, 292, 1040, 150, 72, 26); ctx.fill();
      for (let d = 0; d < 3; d++) {
        const b = Math.max(0, Math.sin(u * 7 - d * 0.9));
        ctx.fillStyle = `rgba(220,224,232,${0.4 + 0.6 * b})`; ctx.beginPath(); ctx.arc(328 + d * 38, 1076 - 8 * b, 9, 0, M.TAU); ctx.fill();
      }
      ctx.restore();
    }
  });
  ctx.restore();
  darken(ctx, 1 - k);
}
function knobOverlay(ctx, img, ang) {         // re-draw the knob ring rotated about its centre
  const cx = 660, cy = 602, r = 30;
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, M.TAU); ctx.clip();
  ctx.fillStyle = '#0a0f1a'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.translate(cx, cy); ctx.rotate(ang); ctx.translate(-cx, -cy);
  ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2, cx - r, cy - r, r * 2, r * 2);
  ctx.restore();
}
function s8Knob(ctx, u, IMG) {
  const p = prog(u, SH[7], SH[8]);
  const t0 = EV.soft_knocks[2] + 0.55, t1 = EV.soft_knocks[2] + 1.6;
  const ang = -0.9 * E.inOutCubic(prog(u, t0, t0 + 0.9)) + 0.9 * E.inOutCubic(prog(u, t1, t1 + 1.1));
  ctx.save();
  EV.soft_knocks.forEach((t) => M.shake(ctx, u, t, 9, 7, 0.1));
  plate(ctx, IMG.inside, 660, 610, logZoom(2.4, 3.6, p), () => {
    knobOverlay(ctx, IMG.inside, ang);
    glow(ctx, 670, 655, 26, '255,60,50', 0.25 + 0.2 * Math.max(0, noise1(u * 3, 12)));
    glow(ctx, 660, 602, 70, '230,30,40', 0.12 * Math.abs(ang));
  });
  ctx.restore();
}
const gapY = (x) => 1100 + (x - 262) * (30 / 448);   // the slanted light gap in 04_pintu_dalam
function feetShadows(ctx, u, rise) {
  // brighten the gap so the shapes read, then two feet that block its upper part only:
  // a line of light stays visible under them (they don't touch the floor)
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = 'blur(2px)'; ctx.fillStyle = 'rgba(150,175,215,0.9)';
  ctx.beginPath(); ctx.moveTo(262, gapY(262) - 7); ctx.lineTo(712, gapY(712) - 7); ctx.lineTo(712, gapY(712) + 5); ctx.lineTo(262, gapY(262) + 5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.filter = 'blur(1.6px)'; ctx.fillStyle = 'rgb(2,3,7)';
  for (const x of [432, 548]) {
    const y = gapY(x);
    ctx.beginPath(); ctx.ellipse(x, y - 4.5 - rise, 40, 4.6, Math.atan2(30, 448), 0, M.TAU); ctx.fill();
  }
  // their long shadows reaching toward us across the light spill on the floor
  ctx.filter = 'blur(9px)'; ctx.fillStyle = 'rgba(1,2,6,0.82)';
  for (const [x, d] of [[432, -55], [548, 40]]) {
    const y = gapY(x) + 6;
    ctx.beginPath(); ctx.moveTo(x - 30, y); ctx.lineTo(x + 30, y); ctx.lineTo(x + d + 85, y + 260); ctx.lineTo(x + d - 85, y + 260); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function s9Gap(ctx, u, IMG, frozenAt) {
  const tt = frozenAt ?? u;
  const p = prog(tt, SH[8], EV.silence[0]);
  const rise = 3 * E.inOutCubic(prog(tt, on(26), on(28) + 0.5));
  const out = E.outCubic(prog(tt, EV.silence[0] - 0.05, EV.silence[0] + 0.15)) * 0.92;
  const appear = E.inOutSine(prog(tt, on(26) - 0.3, on(26) + 0.8));
  plate(ctx, IMG.inside, 487, 1150, logZoom(1.7, 2.6, p), () => {
    ctx.save(); ctx.globalAlpha = appear; feetShadows(ctx, tt, rise); ctx.restore();
    if (out > 0) { ctx.fillStyle = `rgba(1,2,4,${out})`; ctx.fillRect(0, 0, 944, 1680); }
  });
}
function s9Live(ctx, u, IMG) {
  s9Gap(ctx, u, IMG);
  if (u < EV.silence[0]) dust(ctx, u, { x: 0, y: 500, w: W, h: 900, n: 45, seed: 71, a: 0.32, vx: 2, vy: -4, size: 2.4 });
}
function s10Pause(ctx, u, IMG) {
  ctx.save(); ctx.filter = 'grayscale(1) brightness(1.35) contrast(1.1)';
  s9Gap(ctx, u, IMG, on(28) + 0.6);
  ctx.restore();
  const r = mulberry32(Math.floor(u * 30) * 7 + 3);
  for (let k = 0; k < 3; k++) {               // tape wobble bands
    const y = (r() * H) | 0, h = 6 + r() * 26;
    ctx.drawImage(ctx.canvas, 0, y, W, h, (r() - 0.5) * 30, y, W, h);
  }
  ctx.fillStyle = C.bone; ctx.fillRect(84, 300, 22, 64); ctx.fillRect(122, 300, 22, 64);
  M.text(ctx, 'PAUSE', 168, 356, font(64, 700, UI), C.bone);
}
function card(ctx, img, src, x, y, w, h, k, letter, label) {
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(k); ctx.translate(x + w / 2, y + h / 2 + (1 - k) * 120); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
  ctx.save(); ctx.filter = 'brightness(1.7) contrast(1.1)'; ctx.drawImage(img, ...src, -w / 2, -h / 2, w, h); ctx.restore();
  ctx.strokeStyle = C.bone; ctx.lineWidth = 4; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.font = font(190, 700, DISPLAY); ctx.textAlign = 'center'; ctx.fillStyle = C.bone; ctx.fillText(letter, 0, h / 2 + 200);
  ctx.font = font(52, 700, UI); ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 14; ctx.fillStyle = C.red; ctx.fillText(label, 0, h / 2 + 275);
  ctx.restore();
}
function s11Choice(ctx, u, IMG) {
  M.fill(ctx, '#120306');
  glow(ctx, W / 2, H * 0.45, 900, '120,10,20', 0.6 + 0.15 * Math.sin(u * 7.6));
  card(ctx, IMG.inside, [200, 300, 560, 1109], 70, 420, 430, 852, springU(u, on(33) - 0.1, SPRING.snappy), 'A', 'BUKA PINTU');
  card(ctx, IMG.phone, [250, 330, 580, 1150], W - 500, 420, 430, 852, springU(u, on(35) - 0.1, SPRING.snappy), 'B', 'TELEPON IBU');
  fog(ctx, u, 1450, 0.3, '120,20,30'); embers(ctx, u);
  title(ctx, u, 'KAMU PILIH', SH[10], 300, 104, C.bone);
}
function s12End(ctx, u, IMG) {
  M.fill(ctx, C.night);
  plate(ctx, IMG.inside, 480, 840, 1.0); darken(ctx, 0.62);
  fog(ctx, u, 1300, 0.26); embers(ctx, u, 18, 9);
  const beat = 0.5 + 0.5 * Math.cos(((u - SH[10]) / 0.82) * M.TAU);
  title(ctx, u, 'KOMEN', SH[11], 560, 160, C.bone);
  title(ctx, u, 'A  atau  B', SH[11] + 0.3, 760, 150 + 8 * beat, C.red);
  const fk = springU(u, on(41), SPRING.snappy);
  if (fk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(fk);
    M.text(ctx, 'follow buat part 2', W / 2, 1000 + (1 - fk) * 40, font(56, 700, UI), C.bone, 'center');
    const ay = 1060 + 14 * Math.sin(u * 6);
    ctx.fillStyle = C.bone; ctx.beginPath(); ctx.moveTo(W / 2 - 30, ay); ctx.lineTo(W / 2 + 30, ay); ctx.lineTo(W / 2, ay + 40); ctx.fill();
    ctx.restore();
  }
}

// ---------------------------------------------------------------- type
// One display title at a time, glyphs spring up in order; supers: one VO phrase at a time.
function title(ctx, u, str, u0, y, size, color) {
  const f = font(size, 700, DISPLAY);
  let s = size, L = layout(ctx, str, f, 0);
  if (L.width > W - 140) { s = Math.floor(size * (W - 140) / L.width); L = layout(ctx, str, font(s, 700, DISPLAY), 0); }
  const x0 = (W - L.width) / 2;
  L.glyphs.forEach((g, j) => {
    const k = springU(u, u0 + j * 0.025, SPRING.snappy);
    if (k <= 0) return;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 24;
    glyph(ctx, g.ch, x0 + g.cx, y + (1 - k) * 50, font(s, 700, DISPLAY), color, 1, clamp(k));
    ctx.restore();
  });
}
const TITLES = [
  { a: 0.0, b: SH[1] - 0.1, lines: [['CERITA INI', 0.0, 520, 118, C.bone], ['BELUM PUNYA ENDING.', 0.55, 650, 104, C.bone], ['KAMU YANG NENTUIN.', on(1) - 0.05, 800, 84, C.red]] },
  { a: on(18) - 0.05, b: SH[6] - 0.1, lines: [['300 KM', on(18) - 0.05, 640, 200, C.red], ['dari sini.', on(18) + 0.6, 760, 70, C.bone]] },
  { a: on(28) - 0.05, b: EV.silence[0] + 0.05, lines: [['KAKINYA', on(28) - 0.05, 520, 150, C.red], ['NGGAK NAPAK.', on(28) + 0.2, 680, 130, C.red]] },
];
const NO_SUPER = new Set([0, 1, 18, 28, 33, 34, 35, 36]);
const KEY = /^(ending|nentuin|13|02\.13|ngetuk|pintu|suara|ibu|persis|300|kampung|22\.00|kaki|napak|kamu\.?|A|B|follow,?)[.,:”]*$/i;
const SUPERS = [
  ...PH.filter((p) => !NO_SUPER.has(p.i)).map((p) => ({ a: p.t0, b: p.t1 + 0.35, text: p.text, red: false })),
  { a: EV.ibu1[0], b: EV.ibu1[0] + EV.ibu1[1] - 1.0, text: '“nak... buka...”', red: true },
  { a: EV.ibu2[0], b: EV.ibu2[0] + EV.ibu2[1] - 1.0, text: '“ibu kedinginan...”', red: true },
].sort((x, y) => x.a - y.a);
SUPERS.forEach((s, i) => { if (SUPERS[i + 1]) s.b = Math.min(s.b, SUPERS[i + 1].a - 0.02); });

function superText(ctx, u) {
  const s = SUPERS.find((x) => u >= x.a && u < x.b);
  if (!s || (u >= EV.silence[0] && u < EV.silence[1])) return;
  const f = font(58, 700, UI);
  ctx.font = f;
  const words = s.text.split(' '), lines = [[]];
  for (const w of words) {
    const test = [...lines[lines.length - 1], w].join(' ');
    if (ctx.measureText(test).width > 900 && lines[lines.length - 1].length) lines.push([w]); else lines[lines.length - 1].push(w);
  }
  const typeDur = Math.min(0.35, (s.b - s.a) * 0.4);
  const shown = Math.ceil(s.text.length * E.outQuad(prog(u, s.a, s.a + typeDur)));
  const fade = 1 - prog(u, s.b - 0.12, s.b);
  let n = 0;
  lines.forEach((ln, li) => {
    const str = ln.join(' ');
    const lw = ctx.measureText(str).width;
    let x = (W - lw) / 2;
    const y = 1390 + li * 74 - (lines.length - 1) * 37;
    ln.forEach((w, wi) => {
      const word = (wi ? ' ' : '') + w;
      const visible = Math.max(0, Math.min(word.length, shown - n));
      n += word.length;
      const color = s.red || KEY.test(w) ? C.red : C.bone;
      ctx.save(); ctx.globalAlpha = fade; ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 18;
      ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.font = f;
      ctx.fillText(word.slice(0, visible), x, y);
      ctx.restore();
      x += ctx.measureText(word).width;
    });
  });
}

// ---------------------------------------------------------------- grade (post: after blur)
let GRAIN = [];
function initGrain() {
  GRAIN = [0, 1, 2, 3].map((k) => {
    const c = document.createElement('canvas'); c.width = 540; c.height = 960;
    const g = c.getContext('2d'), d = g.createImageData(540, 960), r = mulberry32(91 + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return c;
  });
}
function grade(ctx, u) {
  const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.48, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.09;
  ctx.drawImage(GRAIN[Math.floor(u * 24) % 4], 0, 0, W, H); ctx.restore();
  darken(ctx, 0.04 * (0.5 + 0.5 * noise1(u * 9, 2)));          // low breathing flicker
}

// ---------------------------------------------------------------- film
const SHOTS = [s1Book, s2Hall, s3Door13, s4Room, s5Inside, s6Window, s7Phone, s8Knob, s9Live, s10Pause, s11Choice, s12End];
M.film({
  fonts: [font(100, 700, DISPLAY), font(40, 700, UI)],
  images: {
    book: 'assets/art/00_buku.png', hall: 'assets/art/01_lorong.png', door13: 'assets/art/02_pintu13.png',
    room: 'assets/art/03_kamar_0213.png', inside: 'assets/art/04_pintu_dalam.png', far: 'assets/art/05_jauh.png',
    phone: 'assets/art/06_chat_ibu.png',
  },
  hits: HITS,
  samples: 4,
  init() { initGrain(); },
  draw(ctx, u, t, IMG) {
    M.fill(ctx, C.night);
    let i = 0; while (i < SH.length - 2 && u >= SH[i + 1]) i++;
    SHOTS[i](ctx, u, IMG);
    for (const T of TITLES) if (u >= T.a && u < T.b) for (const [s, u0, y, size, col] of T.lines) title(ctx, u, s, u0, y, size, col);
    superText(ctx, u);
  },
  post(ctx, u) { grade(ctx, u); },
});

// KAMU PILIH episode engine: one generic film driven by timeline.json (build_ep.py <- episodes/*.json).
// No narrator: the story is told by one line of text at a time, with story sounds and a dark score.
// Shot types: vote, plate, phone, knob, pause, choice, end. See docs/EPISODE_FORMAT.md.
import * as M from './lib/motion.js';
import * as HX from './lib/horror.js';
HX.setup(M, { display: 'Display', ui: 'UI' });

const { W, H, E, prog, lerp, clamp, springU, SPRING, font, noise1 } = M;
const TL = await fetch('timeline.json').then((r) => r.json());
const C = HX.C, B = TL.beats, SH = TL.shots, EV = TL.events, SIL = TL.silence;
const logZoom = (a, b, p) => a * (b / a) ** clamp(p);
const evAt = (kind) => EV.filter((e) => e.kind === kind).map((e) => e.t);
const firstEv = (kind, after = -1) => evAt(kind).find((t) => t > after);
const lastEvBefore = (kind, u) => evAt(kind).filter((t) => t <= u).pop();
const shotIndex = (u) => { let i = 0; while (i < SH.length - 1 && u >= SH[i + 1].t) i++; return i; };
const shotEnd = (i) => (i + 1 < SH.length ? SH[i + 1].t : TL.total);
const beatOf = (type) => B.find((b) => b.card === type);

// ---------------------------------------------------------------- plates (941x1672 source px) + anchors
const PLATES = {
  phone: { src: 'assets/art/09_hp_tangan.png' },
  gapClose: { src: 'assets/art/08_celah_hp.png', phoneOut: [624, 988], gap: [100, 976, 845, 998] },
  gapWide: { src: 'assets/art/11_celah_lebar.png', phoneOut: [590, 1132], gap: [240, 1124, 770, 1138] },
  phoneBed: { src: 'assets/art/12_hp_kasur.png', lamp: [585, 385] },
  knob: { src: 'assets/art/13_gagang.png' },
  doorOpen: { src: 'assets/art/10_pintu_terbuka.png', lamp: [515, 442] },
  house: { src: 'assets/art/07_rumah_desa_ai.png', window: [146, 695, 138, 150], moon: [740, 105] },
  room: { src: 'assets/art/03_kamar_0213.png' },
  inside: { src: 'assets/art/04_pintu_dalam.png' },
  hall: { src: 'assets/art/01b_lorong_kosong.png' },
  book: { src: 'assets/art/00_buku.png' },
  door13: { src: 'assets/art/02_pintu13.png' },
};
let IMG_ = null;

// ---------------------------------------------------------------- hits -> sfx.mjs
const HITS = [[0.05, 'open', 'sub', { len: 1.4, gain: 0.8 }], [1.6, 'winner', 'impact', { gain: 0.7 }]];
B.forEach((b) => { if (!b.nosuper && b.text) [0, 0.09, 0.2].forEach((d) => HITS.push([b.t0 + d, 'type', 'type', { gain: 0.16 }])); });
SH.forEach((s, i) => { if (i > 0 && !['pause', 'choice', 'end'].includes(s.type)) HITS.push([s.t, 'cut', 'whoosh', { len: 0.45, from: 1200, to: 300, gain: 0.22 }]); });
const KNOCK = { thud: { pitch: 150, to: 70, len: 0.14, verb: 0.35 } };
for (const e of EV) {
  const t = e.t;
  if (e.kind === 'knock') [0, 0.42, 0.84].forEach((d) => HITS.push([t + d, 'knock', 'thud+click', { ...KNOCK.thud, gain: 1.0 }]));
  if (e.kind === 'softknock') [0, 0.55, 1.1].forEach((d) => HITS.push([t + d, 'soft knock', 'thud+click', { ...KNOCK.thud, gain: 0.5 }]));
  if (e.kind === 'click' || e.kind === 'pickup' || e.kind === 'hangup' || e.kind === 'dial') HITS.push([t, e.kind, 'click', { gain: 0.5 }]);
  if (e.kind === 'notif') HITS.push([t, 'notif', 'blip', { pitch: 'E6', gain: 0.45 }]);
  if (e.kind === 'msg') HITS.push([t, 'bubble', 'pop', { gain: 0.5 }]);
  if (e.kind === 'turn') HITS.push([t, 'knob', 'tick', { gain: 0.5, pitch: 'C4' }], [t + 0.5, 'knob', 'tick', { gain: 0.4, pitch: 'B3' }]);
  if (e.kind === 'open') HITS.push([t, 'door creak', 'whoosh', { len: 1.1, from: 180, to: 90, gain: 0.5, verb: 0.4 }], [t, 'latch', 'click', { gain: 0.5 }]);
  if (e.kind === 'impact' || e.kind === 'flash') HITS.push([t, 'hit', 'impact', { gain: 0.8 }]);
  if (e.kind === 'sub' || e.kind === 'lightOff') HITS.push([t, 'drop', 'sub', { len: 1.0, gain: 0.7 }]);
  if (e.kind === 'glitch') HITS.push([t, 'glitch', 'crash', { gain: 0.4 }]);
}
B.filter((b) => b.msg).forEach((b) => HITS.push([b.t0, 'bubble', 'pop', { gain: 0.45 }]));
HITS.push([SIL[0] - 0.02, 'scare', 'impact', { gain: 1.0 }], [SIL[1], 'tape stop', 'whoosh', { len: 0.8, from: 1400, to: 70, gain: 0.6 }],
  [beatOf('A').t0, 'card A', 'thud', { pitch: 120, to: 60, len: 0.25, gain: 0.7 }], [beatOf('B').t0, 'card B', 'thud', { pitch: 120, to: 60, len: 0.25, gain: 0.7 }],
  [TL.endStart, 'end', 'impact', { gain: 0.6 }], [B.find((b) => b.follow).t0, 'follow', 'blip', { pitch: 'D6', gain: 0.4 }]);

// ---------------------------------------------------------------- phone in hand (09_hp_tangan)
const SCR = { x: 288, y: 888, w: 330, h: 620, r: 34 };
const UI_W = 640, UI_H = Math.round(640 * SCR.h / SCR.w);
function onScreen(ctx, fn) {
  ctx.save(); M.rrect(ctx, SCR.x, SCR.y, SCR.w, SCR.h, SCR.r); ctx.clip();
  ctx.fillStyle = '#0b0f19'; ctx.fillRect(SCR.x, SCR.y, SCR.w, SCR.h);
  ctx.translate(SCR.x, SCR.y); ctx.scale(SCR.w / UI_W, SCR.w / UI_W); fn({ x: 0, y: 0, w: UI_W, h: UI_H }); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'screen'; HX.glow(ctx, SCR.x + SCR.w / 2, SCR.y + SCR.h * 0.55, 520, '70,110,200', 0.18); ctx.restore();
}
function clockOverlay(ctx, txt) {
  ctx.fillStyle = '#0b0507'; ctx.fillRect(136, 480, 88, 34);
  ctx.save(); ctx.shadowColor = 'rgba(255,30,40,0.9)'; ctx.shadowBlur = 14; M.text(ctx, txt, 180, 507, font(28, 700, 'UI'), '#ff2a36', 'center'); ctx.restore();
  HX.glow(ctx, 180, 497, 90, '255,30,40', 0.18);
}
const timeAt = (u) => { const b = B.filter((x) => x.time && x.t0 <= u).pop(); return b ? b.time : TL.clock; };
// chat state from beats
const MSGS = B.filter((b) => b.msg).map((b) => ({ t: b.t0, side: b.msg.side || 'in', text: b.msg.text, time: b.msg.time || TL.clock,
  read: b.msg.side === 'out' ? b.t0 + 0.7 : undefined, hl: b.msg.hl ? b.t0 + 0.8 : undefined }));
const TYPING = B.filter((b) => b.typing).map((b) => [b.t0, b.t1 + 0.3]);
const typingStatus = (u) => (TYPING.some(([a, c]) => u >= a && u < c) ? 'sedang mengetik...' : 'online');
function callHistory(ctx, u, box, rows, hlAt) {
  ctx.fillStyle = '#0d1018'; ctx.fillRect(box.x, box.y, box.w, box.h);
  M.text(ctx, 'Riwayat', box.x + 40, box.y + 110, font(52, 700, 'UI'), C.bone);
  rows.forEach((r, i) => {
    const k = springU(u, (SH.find((s) => s.type === 'phone' && s.ui === 'history') || { t: 0 }).t + 0.15 * i, SPRING.snappy);
    const y = box.y + 190 + i * 130;
    ctx.save(); ctx.globalAlpha = clamp(k * 1.4); ctx.translate((1 - k) * 60, 0);
    ctx.fillStyle = '#5a6478'; ctx.beginPath(); ctx.arc(box.x + 80, y + 40, 38, 0, M.TAU); ctx.fill();
    M.text(ctx, r.name, box.x + 140, y + 32, font(40, 700, 'UI'), r.missed ? C.red : C.bone);
    M.text(ctx, r.kind, box.x + 140, y + 78, font(28, 700, 'UI'), C.dim);
    const hl = r.hl && hlAt != null && u >= hlAt;
    M.text(ctx, r.dur || '', box.x + box.w - 40, y + 32, font(hl ? 46 : 34, 700, 'UI'), hl ? `rgba(230,40,50,${0.6 + 0.4 * (Math.floor(u * 3) % 2)})` : C.dim, 'right');
    M.text(ctx, r.time || '', box.x + box.w - 40, y + 78, font(26, 700, 'UI'), C.dim, 'right');
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fillRect(box.x + 40, y + 110, box.w - 80, 2);
    ctx.restore();
  });
}
function lockScreen(ctx, u, box) {
  M.text(ctx, timeAt(u), box.w / 2, 300, font(130, 700, 'UI'), C.bone, 'center');
  M.text(ctx, 'selasa', box.w / 2, 360, font(34, 700, 'UI'), C.dim, 'center');
  B.filter((b) => b.notif && u >= b.t0 - 0.05).slice(-2).forEach((b, k, arr) => {
    HX.notif(ctx, u, b.t0, TL.total, { title: b.notif.title || 'ibu', body: b.notif.body || '', time: b.notif.time || timeAt(u), w: box.w, y0: 450 + (arr.length - 1 - k) * 190 });
  });
}
function sPhone(ctx, u, IMG, i) {
  const s = SH[i], a = s.t, b = shotEnd(i), p = prog(u, a, b);
  const [z0, z1] = s.zoom || [1.98, 2.08];
  const cy = s.zoom && s.zoom[1] < 1.6 ? lerp(1198, 900, E.outCubic(p)) : 1198;
  const lit = s.ui === 'off' ? 0 : 1;
  const buzzT = lastEvBefore('buzz', u);
  ctx.save(); HX.applyHandheld(ctx, u, s.hand ?? 0.35);
  if (buzzT != null) [0, 0.55, 1.4].forEach((d) => M.shake(ctx, u, buzzT + d, 12, 22, 0.28));
  HX.plate(ctx, IMG.phone, 453, cy, logZoom(z0, z1, E.inOutSine(p)), () => {
    clockOverlay(ctx, timeAt(u));
    if (lit) onScreen(ctx, (box) => {
      if (s.ui === 'chat') HX.chat(ctx, u, { name: s.name || 'ibu', msgs: MSGS, typing: TYPING, status: typingStatus, now: timeAt(u), x: 22, y: 22, w: box.w - 44, h: box.h - 44 });
      else if (s.ui === 'call') HX.callScreen(ctx, u, { name: s.name || 'ibu', ringFrom: firstEv('dial', -1) ?? firstEv('ring', -1) ?? a, pickUp: lastEvBefore('pickup', u) ?? null, end: lastEvBefore('hangup', u) ?? null, ...box });
      else if (s.ui === 'history') callHistory(ctx, u, box, s.rows || [], firstEv('hl', a));
      else lockScreen(ctx, u, box);
    });
    const off = s.ui === 'off' ? 1 : s.dimFrom != null ? clamp((u - s.t - s.dimFrom) / 1.5) : 0;
    if (off > 0) { ctx.fillStyle = `rgba(4,6,12,${off})`; M.rrect(ctx, SCR.x, SCR.y, SCR.w, SCR.h, SCR.r); ctx.fill(); }
  }, { u });
  ctx.restore();
  HX.dust(ctx, u, { n: 24, a: 0.26, seed: 41 + i });
}

// ---------------------------------------------------------------- plate shots + fx
const ringPulse = (u) => {
  for (const [r0, r1] of TL.rings) if (u >= r0 && u < r1) { const d = (u - r0) % 1.44; return d < 1.08 ? Math.exp(-((d % 0.18) / 0.08)) : 0; }
  return 0;
};
function fxIn(ctx, u, name, P, s) {                   // fx drawn in plate (source px) space
  if (name === 'ring' && P.phoneOut) {
    const lo = firstEv('lightOff', s.t - 0.01), dead = lo != null && u >= lo;
    const rp = dead ? 0 : ringPulse(u), base = dead ? 0 : (s.ringBase ?? 0.12);
    if (base <= 0 && rp <= 0) return;
    const [x0, y0, x1, y1] = P.gap, [px, py] = P.phoneOut;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    HX.glow(ctx, px, py, 250 + 60 * rp, '120,160,255', base + 0.4 * rp);
    ctx.fillStyle = `rgba(170,200,255,${base * 0.7 + 0.45 * rp})`; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    ctx.restore();
    HX.rays(ctx, u, { x0, x1, y: y1, len: 480, a: 0.03 + 0.12 * rp, n: 8 });
  }
  if (name === 'lamp' && P.lamp) {
    const [lx, ly] = P.lamp, sw = Math.sin(u * 1.7) * 14;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    HX.glow(ctx, lx + sw * 0.4, ly, 120, '255,40,40', 0.3 + 0.12 * HX.flicker(u, 3)); ctx.restore();
    HX.rays(ctx, u, { x0: lx - 30, x1: lx + 30, y: ly + 12, len: 420, a: 0.07, rgb: '255,80,80', n: 5 });
  }
  if (name === 'window' && P.window) {
    const [wx, wy, ww, wh] = P.window, off = firstEv('lightOff', -1);
    if (off != null && u >= off) { ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgba(20,24,40,1)'; ctx.fillRect(wx, wy, ww, wh); ctx.restore(); }
    else { ctx.save(); ctx.globalCompositeOperation = 'screen'; HX.glow(ctx, wx + ww / 2, wy + wh / 2, 230, '255,170,90', 0.16 + 0.05 * noise1(u * 3, 7)); ctx.restore(); }
  }
}
function fxOut(ctx, u, name, i) {                    // fx drawn in screen space
  if (name === 'dust') HX.dust(ctx, u, { n: 36, a: 0.3, seed: 11 + i });
  if (name === 'fog') HX.fogDeep(ctx, u, { y0: H * 0.6, h: H * 0.4, a: 0.55 });
  if (name === 'embers') HX.embers(ctx, u, 20, 5 + i);
  if (name === 'rain') HX.rain(ctx, u, { a: 0.18 });
  if (name === 'flicker') HX.darken(ctx, 0.5 * (1 - HX.flicker(u, 9, 1.4)));
}
function sPlate(ctx, u, IMG, i) {
  const s = SH[i], a = s.t, b = shotEnd(i), p = E.inOutSine(prog(u, a, b));
  const P = PLATES[s.img] || PLATES.room, img = IMG[s.img] || IMG.room;
  const f = s.from || [470, 836, 1.05], to = s.to || [f[0], f[1], f[2] * 1.15];
  ctx.save(); HX.applyHandheld(ctx, u, s.hand ?? 0.4);
  HX.plate(ctx, img, lerp(f[0], to[0], p), lerp(f[1], to[1], p), logZoom(f[2], to[2], p), () => (s.fx || []).forEach((n) => fxIn(ctx, u, n, P, s)), { u });
  ctx.restore();
  (s.fx || []).forEach((n) => fxOut(ctx, u, n, i));
  if (s.dark) HX.darken(ctx, s.dark);
}

// ---------------------------------------------------------------- knob (13_gagang): turn on 'turn', door opens on 'open'
const KNOB = { x: 460, y: 525, r: 122 };
function knobOverlay(ctx, img, ang) {
  const { x, y, r } = KNOB;
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, M.TAU); ctx.clip();
  ctx.translate(x, y); ctx.rotate(ang); ctx.translate(-x, -y);
  ctx.drawImage(img, x - r, y - r, r * 2, r * 2, x - r, y - r, r * 2, r * 2); ctx.restore();
}
function sKnob(ctx, u, IMG, i) {
  const s = SH[i], a = s.t, b = shotEnd(i), img = IMG.knob;
  const tTurn = firstEv('turn', a - 0.01), tOpen = firstEv('open', a - 0.01);
  const turnEnd = tOpen != null ? tOpen - 0.3 : (tTurn != null ? tTurn + (s.turnDur || 2.5) : b);
  const ang = tTurn == null ? 0 : -(s.turnAngle || 0.75) * E.inOutCubic(prog(u, tTurn, turnEnd));
  const open = tOpen == null ? 0 : E.inOutSine(prog(u, tOpen, Math.min(b, tOpen + 1.6)));
  ctx.save(); HX.applyHandheld(ctx, u, 0.3 + open * 0.6);
  HX.plate(ctx, img, lerp(470, 560, prog(u, a, b)), lerp(640, 820, prog(u, a, b)), logZoom(1.25, 1.05, E.inOutSine(prog(u, a, b))), () => {
    const x0 = 388, w = 300 * open;
    const doorXf = () => { ctx.translate(w, 0); ctx.translate(x0, 700); ctx.scale(1 + 0.06 * open, 1 + 0.06 * open); ctx.translate(-x0, -700); };
    if (open > 0) {
      ctx.drawImage(img, 290, 120, 98, 270, 290, 388, 98, 270);
      const g = ctx.createLinearGradient(x0, 0, x0 + w, 0);
      g.addColorStop(0, `rgb(${Math.round(lerp(20, 215, open))},${Math.round(lerp(25, 228, open))},${Math.round(lerp(40, 255, open))})`);
      g.addColorStop(1, `rgb(${Math.round(lerp(20, 140, open))},${Math.round(lerp(25, 165, open))},${Math.round(lerp(40, 220, open))})`);
      ctx.fillStyle = g; ctx.fillRect(x0, 0, w + 2, 1460);
      ctx.save(); ctx.beginPath(); ctx.rect(x0 + w, -100, 1200, 1900); ctx.clip(); doorXf();
      ctx.drawImage(img, x0, 0, 941 - x0, 1672, x0, 0, 941 - x0, 1672);
      ctx.fillStyle = `rgba(0,0,0,${0.3 * open})`; ctx.fillRect(x0, -100, 1200, 1900);
      ctx.restore();
    }
    ctx.save(); doorXf(); knobOverlay(ctx, img, ang);
    ctx.globalCompositeOperation = 'screen'; HX.glow(ctx, 505, 520, 90, '255,40,40', 0.2 + 0.25 * Math.abs(ang)); ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const gapA = s.gapLight ?? (0.15 + 0.1 * HX.flicker(u, 5));
    ctx.fillStyle = `rgba(190,210,255,${gapA})`;
    ctx.beginPath(); ctx.moveTo(385, 1342); ctx.lineTo(941, 1428); ctx.lineTo(941, 1446); ctx.lineTo(385, 1352); ctx.closePath(); ctx.fill();
    if (open > 0) HX.glow(ctx, x0 + w / 2, 900, 380, '170,195,255', 0.25 * open);
    ctx.restore();
    if (open > 0) HX.rays(ctx, u, { x0, x1: x0 + w, y: 1350, len: 520, a: 0.22 * open, n: 6 });
  }, { u });
  ctx.restore();
  HX.dust(ctx, u, { x: 100, y: 200, w: 900, h: 1300, n: 40, seed: 3, a: 0.3 });
}

// ---------------------------------------------------------------- vote / pause / choice / end
const coverKey = SH.find((s) => s.type === 'plate')?.img || 'gapWide';
function sVote(ctx, u, IMG) {
  HX.plate(ctx, IMG[coverKey], 470, 900, logZoom(1.12, 1.0, E.outCubic(prog(u, 0, 4))), null, { u }); HX.darken(ctx, 0.6);
  HX.fogDeep(ctx, u, { a: 0.5 }); HX.embers(ctx, u, 20, 3);
  const V = TL.vote;
  if (V.mode === 'vote') {
    HX.title(ctx, u, 'MAYORITAS', -0.6, 470, 110, C.bone);
    HX.title(ctx, u, 'KALIAN PILIH', -0.45, 590, 110, C.bone);
    HX.voteBar(ctx, u, 0.4, { a: V.a, b: V.b, y: 800, labelA: V.labelA, labelB: V.labelB });
  } else {
    // honest auto-pick hooks (no screenshot = no real count, so never show numbers), rotated per part
    const HOOKS = [['KALI INI', 'AKU YANG MILIH.'], ['TEBAKANKU', 'KALIAN BAKAL MILIH INI.'], ['AKU YANG MILIH.', 'PROTES DI KOMEN.']];   // no claims about the comments we could not read
    const [h1, h2] = HOOKS[(TL.part + 1) % HOOKS.length];
    HX.title(ctx, u, h1, -0.6, 560, 92, C.bone);
    HX.title(ctx, u, h2, 0.7, 700, 92, C.bone);
  }
  const k = springU(u, 1.6, SPRING.snappy);
  if (k > 0) {
    ctx.save(); ctx.globalAlpha = clamp(k * 1.4); ctx.translate(W / 2, 1380); ctx.rotate(-0.06); ctx.scale(1.6 - 0.6 * k, 1.6 - 0.6 * k);
    ctx.strokeStyle = C.red; ctx.lineWidth = 8; ctx.strokeRect(-430, -95, 860, 150);
    ctx.font = font(96, 700, 'Display'); let fs = 96; while (ctx.measureText(TL.winnerLabel).width > 800 && fs > 40) { fs -= 4; ctx.font = font(fs, 700, 'Display'); }
    M.text(ctx, TL.winnerLabel, 0, 25 * fs / 96, font(fs, 700, 'Display'), C.red, 'center');
    ctx.restore();
  }
}
function card(ctx, img, src, x, y, w, h, k, letter, label) {
  if (k <= 0) return;
  ctx.save(); ctx.globalAlpha = clamp(k); ctx.translate(x + w / 2, y + h / 2 + (1 - k) * 120); ctx.scale(0.9 + 0.1 * k, 0.9 + 0.1 * k);
  ctx.save(); ctx.filter = 'brightness(1.45) contrast(1.1)'; ctx.drawImage(img, ...src, -w / 2, -h / 2, w, h); ctx.restore();
  ctx.strokeStyle = C.bone; ctx.lineWidth = 4; ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.font = font(190, 700, 'Display'); ctx.textAlign = 'center'; ctx.fillStyle = C.bone; ctx.fillText(letter, 0, h / 2 + 200);
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 14; ctx.fillStyle = C.red;
  label.split('\n').forEach((l, n) => { ctx.font = font(46, 700, 'UI'); ctx.fillText(l, 0, h / 2 + 270 + n * 54); });
  ctx.restore();
}
function sChoice(ctx, u, IMG) {
  M.fill(ctx, '#120306');
  HX.glow(ctx, W / 2, H * 0.45, 900, '120,10,20', 0.6 + 0.15 * Math.sin(u * 7.6));
  const ch = TL.choice, ca = ch.cardA || ['phone', [170, 640, 560, 1109]], cb = ch.cardB || ['knob', [190, 280, 560, 1109]];
  card(ctx, IMG[ca[0]], ca[1], 70, 380, 430, 852, springU(u, beatOf('A').t0 - 0.1, SPRING.snappy), 'A', ch.labelA);
  card(ctx, IMG[cb[0]], cb[1], W - 500, 380, 430, 852, springU(u, beatOf('B').t0 - 0.1, SPRING.snappy), 'B', ch.labelB);
  HX.fogDeep(ctx, u, { y0: H * 0.7, h: H * 0.3, a: 0.5, tint: '120,20,30' }); HX.embers(ctx, u);
  HX.title(ctx, u, 'KAMU PILIH', TL.choiceStart, 260, 104, C.bone);
}
function sEnd(ctx, u, IMG) {
  HX.plate(ctx, IMG[coverKey], 470, 840, 1.0, null, { u }); HX.darken(ctx, 0.6);
  HX.fogDeep(ctx, u, { a: 0.55 }); HX.embers(ctx, u, 18, 9);
  const beat = 0.5 + 0.5 * Math.cos(((u - TL.choiceStart) / 0.82) * M.TAU);
  HX.title(ctx, u, 'KOMEN', TL.endStart, 560, 160, C.bone);
  HX.title(ctx, u, 'A  atau  B', TL.endStart + 0.3, 760, 150 + 8 * beat, C.red);
  const fb = B.find((b) => b.follow), fk = springU(u, fb.t0, SPRING.snappy);
  if (fk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(fk);
    M.text(ctx, `follow buat part ${TL.part + 1}`, W / 2, 1000 + (1 - fk) * 40, font(56, 700, 'UI'), C.bone, 'center');
    const ay = 1060 + 14 * Math.sin(u * 6);
    ctx.fillStyle = C.bone; ctx.beginPath(); ctx.moveTo(W / 2 - 30, ay); ctx.lineTo(W / 2 + 30, ay); ctx.lineTo(W / 2, ay + 40); ctx.fill();
    ctx.restore();
  }
}
const DRAW = { vote: sVote, plate: sPlate, phone: sPhone, knob: sKnob, choice: sChoice, end: sEnd };
function drawStory(ctx, u, IMG) {
  const i = shotIndex(u), s = SH[i];
  if (s.type === 'pause') {                         // frozen last story frame in grey + tape PAUSE
    const fu = SIL[0] - 0.35, fi = shotIndex(fu);
    ctx.save(); ctx.filter = 'grayscale(1) brightness(1.1) contrast(1.1)'; (DRAW[SH[fi].type] || sPlate)(ctx, fu, IMG, fi); ctx.restore();
    HX.vhsPause(ctx, u); return;
  }
  (DRAW[s.type] || sPlate)(ctx, u, IMG, i);
}

// ---------------------------------------------------------------- supers
const KEY = /^(ibu\.?|pintu\.?|pintunya\.?|kunci|siapa\??|00:00\.?|tahu\.?|masuk|nggak|kalian|nentuin\.?|bersamaan\.?|sendiri\.?|tersambung\.?|muter\.?|napas\.?)$/i;
const SUPERS = B.filter((b) => !b.nosuper && b.text).map((b) => ({ a: b.t0, b: b.t1 + 0.25, text: b.text, red: !!b.red }));
for (let i = 0; i + 1 < SUPERS.length; i++) SUPERS[i].b = Math.min(SUPERS[i].b, SUPERS[i + 1].a - 0.02);
const mute = (u) => u < SH[1]?.t || (u >= SIL[0] && u < SIL[1]);

M.film({
  fonts: [font(100, 700, 'Display'), font(40, 700, 'UI')],
  images: Object.fromEntries(Object.entries(PLATES).map(([k, v]) => [k, v.src])),
  hits: HITS,
  samples: 4,
  draw(ctx, u, t, IMG) {
    IMG_ = IMG;
    M.fill(ctx, C.night);
    const frozen = u >= SIL[0] && u < SIL[1];
    const da = evAt('deadair').find((x) => u >= x && u < x + 1.0);
    const fu = frozen ? SIL[0] - 0.02 : da != null ? da : u;
    ctx.save();
    for (const x of evAt('knock')) [0, 0.42, 0.84].forEach((d) => M.shake(ctx, u, x + d, 16, 24, 0.3));
    for (const x of evAt('softknock')) [0, 0.55, 1.1].forEach((d) => M.shake(ctx, u, x + d, 7, 24, 0.25));
    drawStory(ctx, fu, IMG);
    ctx.restore();
    if (frozen) HX.darken(ctx, 0.55);
    const fl = evAt('flash').find((x) => u >= x && u < x + 0.25); if (fl != null) HX.flash(ctx, 1 - (u - fl) / 0.25, '210,225,255');
    const gl = evAt('glitch').find((x) => u >= x && u < x + 0.6); if (gl != null) { HX.glitch(ctx, u, 0.7 * (1 - (u - gl) / 0.6)); HX.chroma(ctx, 14 * (1 - (u - gl) / 0.6)); }
    const s = SH[shotIndex(u)];
    const onPhone = s.type === 'phone';
    HX.superText(ctx, u, SUPERS, { y: onPhone ? 175 : 1430, key: KEY, mute });
  },
  post(ctx, u) { HX.grade(ctx, u); },
});

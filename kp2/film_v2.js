// KAMU PILIH Part 2 (both branches): pure function of time. timeline.json (audio/build2.py) says
// which branch, every phrase onset, the shot list [t, name] and the story events. Kit: lib/horror.js.
import * as M from './lib/motion.js';
import * as HX from './lib/horror.js';
HX.setup(M, { display: 'Display', ui: 'UI' });

const { W, H, E, prog, lerp, clamp, bump, springU, SPRING, font, noise1 } = M;
const TL = await fetch('timeline.json').then((r) => r.json());
const VOTE = await fetch('vote.json').then((r) => r.json()).catch(() => null);
const BR = TL.branch, SH = TL.shots, EV = TL.events, PH = TL.phrases, IX = TL.idx;
const C = HX.C;
const on = (i) => PH[i].t0, off = (i) => PH[i].t1;
const shotStart = (name, k = 0) => SH.filter((s) => s[1] === name)[k][0];
const shotIndex = (u) => { let i = 0; while (i < SH.length - 1 && u >= SH[i + 1][0]) i++; return i; };
const shotEnd = (i) => (i + 1 < SH.length ? SH[i + 1][0] : TL.total);
const V = VOTE || (BR === 'A' ? { a: 62, b: 38 } : { a: 41, b: 59 });

// ---------------------------------------------------------------- hits -> sfx.mjs
const cut = (name, k = 0) => shotStart(name, k);
const HITS = [
  [0.05, 'vote reveal', 'sub', { len: 1.4, gain: 0.8 }],
  [on(1), 'winner', 'impact', { gain: 0.7 }],
  [on(4), 'tanggung jawab kalian', 'thud', { pitch: 90, to: 45, len: 0.35, verb: 0.3, gain: 0.7 }],
  [SH[1][0], 'cut', 'whoosh', { len: 0.5, from: 1400, to: 300, gain: 0.4 }],
  [cut('end'), 'end card', 'impact', { gain: 0.6 }],
  [on(IX.follow), 'follow', 'blip', { pitch: 'D6', gain: 0.4 }],
  [on(IX.A), 'card A', 'thud', { pitch: 120, to: 60, len: 0.25, gain: 0.7 }],
  [on(IX.B), 'card B', 'thud', { pitch: 120, to: 60, len: 0.25, gain: 0.7 }],
  [EV.silence[1], 'tape stop', 'whoosh', { len: 0.8, from: 1400, to: 70, gain: 0.6 }],
  [EV.silence[0] - 0.02, 'scare', 'impact', { gain: 1.0 }],
];
if (BR === 'A') {
  HITS.push(
    [on(2) + 0.6, 'knob turns', 'tick', { gain: 0.5, pitch: 'C4' }],
    [EV.door_open[0], 'door creak', 'whoosh', { len: 1.1, from: 180, to: 90, gain: 0.5, verb: 0.4 }],
    [EV.door_open[0], 'latch', 'click', { gain: 0.5 }],
    [cut('hall'), 'into hall', 'sub', { len: 0.9, gain: 0.5 }],
    [EV.buzz - 0.05, 'notif', 'blip', { pitch: 'E6', gain: 0.45 }],
    [on(12), 'bubble ibu', 'pop', { gain: 0.5 }],
    [cut('stamp'), '02.14', 'sub', { len: 1.0, gain: 0.7 }],
    ...[0, 0.12, 0.25, 0.4, 0.52, 0.66].map((d) => [on(17) - 0.9 + d, 'typing', 'type', { gain: 0.25 }]),
    [on(17), 'send', 'pop', { gain: 0.45, pitch: 'A5' }],
    [on(18), 'read', 'tick', { gain: 0.3, pitch: 'E6' }],
    [on(20), 'bubble ibu', 'pop', { gain: 0.5 }],
    ...[0, 0.1, 0.22, 0.35, 0.47].map((d) => [on(22) - 0.8 + d, 'typing', 'type', { gain: 0.25 }]),
    [on(22), 'send', 'pop', { gain: 0.45, pitch: 'A5' }],
    [on(23), 'last bubble', 'thud', { pitch: 110, to: 50, len: 0.3, gain: 0.7 }],
    [cut('house'), 'village', 'whoosh', { len: 0.9, from: 900, to: 150, gain: 0.45 }],
  );
} else {
  HITS.push(
    [cut('calling') + 0.2, 'phone up', 'blip', { pitch: 'E6', gain: 0.4 }],
    [EV.call_start, 'dial', 'click', { gain: 0.4 }],
    [cut('door'), 'door', 'sub', { len: 0.8, gain: 0.5 }],
    [cut('gap'), 'gap push', 'riser', { len: 2.5, gain: 0.35 }],
    [EV.pickup, 'pick up', 'click', { gain: 0.6 }],
    [cut('room'), 'relief', 'whoosh', { len: 0.8, from: 600, to: 200, gain: 0.25 }],
    [EV.double[0], 'two voices', 'crash', { gain: 0.5 }],
  );
}

// ---------------------------------------------------------------- shared shots
function sVote(ctx, u, IMG) {
  HX.plate(ctx, IMG.gapPhone, 470, 900, 1.05, null, { u }); HX.darken(ctx, 0.72);
  HX.fogDeep(ctx, u, { a: 0.5 }); HX.embers(ctx, u, 20, 3);
  HX.title(ctx, u, 'MAYORITAS', 0.1, 470, 110, C.bone);
  HX.title(ctx, u, 'KALIAN PILIH', 0.35, 590, 110, C.bone);
  HX.voteBar(ctx, u, 0.9, { a: V.a, b: V.b, y: 800 });
  const k = springU(u, on(1), SPRING.snappy);              // winner stamp
  if (k > 0) {
    const win = BR === 'A' ? 'BUKA PINTU' : 'TELEPON IBU';
    ctx.save(); ctx.globalAlpha = clamp(k * 1.4); ctx.translate(W / 2, 1380); ctx.rotate(-0.06); ctx.scale(1.6 - 0.6 * k, 1.6 - 0.6 * k);
    ctx.strokeStyle = C.red; ctx.lineWidth = 8; ctx.strokeRect(-400, -95, 800, 150);
    M.text(ctx, win, 0, 25, font(96, 700, 'Display'), C.red, 'center');
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
  label.split('\n').forEach((l, i) => { ctx.font = font(46, 700, 'UI'); ctx.fillText(l, 0, h / 2 + 270 + i * 54); });
  ctx.restore();
}
function sChoice(ctx, u, IMG) {
  M.fill(ctx, '#120306');
  HX.glow(ctx, W / 2, H * 0.45, 900, '120,10,20', 0.6 + 0.15 * Math.sin(u * 7.6));
  const [ia, sa, la, ib, sb, lb] = BR === 'A'
    ? [IMG.phoneHand, [170, 640, 560, 1109], 'VIDEO CALL\nIBU', IMG.doorOpen, [240, 170, 560, 1109], 'MATIKAN HP,\nPURA-PURA']
    : [IMG.gapPhone, [190, 320, 560, 1109], 'BILANG ADA\nYANG DI PINTU', IMG.phoneHand, [170, 640, 560, 1109], 'TUTUP\nTELEPON'];
  card(ctx, ia, sa, 70, 380, 430, 852, springU(u, on(IX.A) - 0.1, SPRING.snappy), 'A', la);
  card(ctx, ib, sb, W - 500, 380, 430, 852, springU(u, on(IX.B) - 0.1, SPRING.snappy), 'B', lb);
  HX.fogDeep(ctx, u, { y0: H * 0.7, h: H * 0.3, a: 0.5, tint: '120,20,30' }); HX.embers(ctx, u);
  HX.title(ctx, u, 'KAMU PILIH', cut('choice'), 260, 104, C.bone);
}
function sEnd(ctx, u, IMG) {
  HX.plate(ctx, IMG.gapPhone, 470, 840, 1.0, (c) => phoneGlowOutside(ctx, u, 0.5), { u }); HX.darken(ctx, 0.55);
  HX.fogDeep(ctx, u, { a: 0.55 }); HX.embers(ctx, u, 18, 9);
  const beat = 0.5 + 0.5 * Math.cos(((u - cut('choice')) / 0.82) * M.TAU);
  HX.title(ctx, u, 'KOMEN', cut('end'), 560, 160, C.bone);
  HX.title(ctx, u, 'A  atau  B', cut('end') + 0.3, 760, 150 + 8 * beat, C.red);
  const fk = springU(u, on(IX.follow), SPRING.snappy);
  if (fk > 0) {
    ctx.save(); ctx.globalAlpha = clamp(fk);
    M.text(ctx, 'follow buat part 3', W / 2, 1000 + (1 - fk) * 40, font(56, 700, 'UI'), C.bone, 'center');
    const ay = 1060 + 14 * Math.sin(u * 6);
    ctx.fillStyle = C.bone; ctx.beginPath(); ctx.moveTo(W / 2 - 30, ay); ctx.lineTo(W / 2 + 30, ay); ctx.lineTo(W / 2, ay + 40); ctx.fill();
    ctx.restore();
  }
}
function pauseOver(ctx, u, drawFrozen, bright = 1.35) {
  ctx.save(); ctx.filter = `grayscale(1) brightness(${bright}) contrast(1.1)`; drawFrozen(); ctx.restore();
  HX.vhsPause(ctx, u);
}


// ---------------------------------------------------------------- new plates (user's AI images, 941x1672)
// 09_hp_tangan: phone screen ~ (288,888)-(618,1508); red clock (138,482)-(220,512); door gap y 802, x 512-842
const SCR = { x: 288, y: 888, w: 330, h: 620, r: 34 };
const UI_W = 640, UI_H = Math.round(640 * SCR.h / SCR.w);      // phone UI box in its own px
function onScreen(ctx, fn) {                                     // draw a phone UI into the screen quad
  ctx.save(); M.rrect(ctx, SCR.x, SCR.y, SCR.w, SCR.h, SCR.r); ctx.clip();
  ctx.fillStyle = '#0b0f19'; ctx.fillRect(SCR.x, SCR.y, SCR.w, SCR.h);
  ctx.translate(SCR.x, SCR.y); ctx.scale(SCR.w / UI_W, SCR.w / UI_W); fn({ x: 0, y: 0, w: UI_W, h: UI_H }); ctx.restore();
  // the screen lights the hand and the blanket
  ctx.save(); ctx.globalCompositeOperation = 'screen'; HX.glow(ctx, SCR.x + SCR.w / 2, SCR.y + SCR.h * 0.55, 520, '70,110,200', 0.18); ctx.restore();
}
function clock(ctx, u, txt) {                                    // replace the 88 with the story time
  ctx.fillStyle = '#0b0507'; ctx.fillRect(136, 480, 88, 34);
  ctx.save(); ctx.shadowColor = 'rgba(255,30,40,0.9)'; ctx.shadowBlur = 14;
  M.text(ctx, txt, 180, 507, font(28, 700, 'UI'), Math.floor(u * 2) % 2 ? '#ff2a36' : '#ff2a36', 'center'); ctx.restore();
  HX.glow(ctx, 180, 497, 90, '255,30,40', 0.18);
}
function handPlate(ctx, u, z, cy, ui, { t = '02.14', screenOff = 0 } = {}) {
  return HX.plate(ctx, IMG_.phoneHand, 453, cy, z, () => {
    clock(ctx, u, t);
    if (ui) onScreen(ctx, ui);
    if (screenOff > 0) { ctx.fillStyle = `rgba(4,6,12,${screenOff})`; M.rrect(ctx, SCR.x, SCR.y, SCR.w, SCR.h, SCR.r); ctx.fill(); }
  }, { u });
}
// 08_celah_hp: gap y 975-1000, x 100-845; the phone lying outside at (522-726, 978-998)
function phoneGlowOutside(ctx, u, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  HX.glow(ctx, 624, 988, 260 + 60 * a, '120,160,255', 0.35 * a);
  ctx.fillStyle = `rgba(170,200,255,${0.5 * a})`; ctx.fillRect(100, 976, 745, 22);
  ctx.restore();
}
let IMG_ = null;

// ---------------------------------------------------------------- branch A: buka pintu
const KNOB = { x: 660, y: 602, r: 30 };
function knobOverlay(ctx, img, ang) {
  ctx.save(); ctx.beginPath(); ctx.arc(KNOB.x, KNOB.y, KNOB.r, 0, M.TAU); ctx.clip();
  ctx.fillStyle = '#0a0f1a'; ctx.fillRect(KNOB.x - 30, KNOB.y - 30, 60, 60);
  ctx.translate(KNOB.x, KNOB.y); ctx.rotate(ang); ctx.translate(-KNOB.x, -KNOB.y);
  ctx.drawImage(img, KNOB.x - 30, KNOB.y - 30, 60, 60, KNOB.x - 30, KNOB.y - 30, 60, 60); ctx.restore();
}
function aKnob(ctx, u, IMG, i) {
  const a = SH[i][0], b = shotEnd(i), [d0, d1] = EV.door_open;
  const ang = -1.1 * E.inOutCubic(prog(u, on(2) + 0.4, d0));
  const open = E.inOutSine(prog(u, d0, b));
  const z = logZoom(2.6, 1.15, E.inOutCubic(prog(u, on(3), d0 + 0.2)));        // pull back from the knob to the door
  ctx.save(); HX.applyHandheld(ctx, u, 0.35 + open * 0.5);
  HX.plate(ctx, IMG.inside, lerp(660, 480, prog(u, on(3), d0)), lerp(610, 820, prog(u, on(3), d0)), z, () => {
    knobOverlay(ctx, IMG.inside, ang);
    HX.glow(ctx, 670, 655, 26, '255,60,50', 0.3);
    if (open > 0) {                                   // the door swings in: cold light grows at the latch side
      const w = 300 * open, x1 = 765;
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createLinearGradient(x1 - w, 0, x1, 0);
      g.addColorStop(0, 'rgba(150,175,230,0.1)'); g.addColorStop(1, `rgba(200,220,255,${0.85 * open})`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x1 - w, 150 - 40 * open); ctx.lineTo(x1, 150); ctx.lineTo(x1, 1112); ctx.lineTo(x1 - w, 1112 + 60 * open); ctx.closePath(); ctx.fill();
      ctx.restore();
      HX.rays(ctx, u, { x0: x1 - w, x1, y: 1110, len: 560, a: 0.18 * open, n: 6 });
    }
  });
  ctx.restore();
  HX.dust(ctx, u, { x: 100, y: 300, w: 900, h: 1200, n: 40, seed: 3, a: 0.3 });
  HX.glow(ctx, W * 0.62, H * 0.33, 420, '120,140,190', 0.08);
}
const logZoom = (a, b, p) => a * (b / a) ** clamp(p);
function aHall(ctx, u, IMG, i) {                    // 10_pintu_terbuka: lamp (515,440), corridor floor
  const a = SH[i][0], b = shotEnd(i), p = prog(u, a, b);
  const sw = Math.sin((u - a) * 1.7) * 14;
  ctx.save(); HX.applyHandheld(ctx, u, 0.7, 12);
  HX.plate(ctx, IMG.doorOpen, lerp(470, 505, p), lerp(900, 760, p), logZoom(1.0, 1.55, E.inOutSine(p)), () => {
    HX.glow(ctx, 515 + sw * 0.4, 442, 120, '255,40,40', 0.35 + 0.1 * HX.flicker(u, 3));
    ctx.save(); ctx.scale(1, 0.4); HX.glow(ctx, 515 + sw * 1.4, 820 / 0.4, 200, '200,20,30', 0.22); ctx.restore();
    HX.rays(ctx, u, { x0: 485, x1: 545, y: 455, len: 420, a: 0.07, rgb: '255,80,80', n: 5 });
  }, { u });
  ctx.restore();
  HX.fogDeep(ctx, u, { y0: H * 0.6, h: H * 0.4, a: 0.55 });
  HX.dust(ctx, u, { x: 250, y: 300, w: 600, h: 1100, n: 40, seed: 21, rgb: '255,150,150', a: 0.35, vx: 3, vy: 6 });
  HX.darken(ctx, 0.75 * Math.max(...[1.4, 3.1].map((d) => bump(u, a + d, 0.08))));
}
function aBuzz(ctx, u, IMG, i) {
  const a = SH[i][0], b = shotEnd(i);
  const lit = clamp(prog(u, EV.buzz - 0.05, EV.buzz + 0.08));
  ctx.save();
  [EV.buzz, EV.buzz + 0.55, EV.buzz + 1.4].forEach((t) => M.shake(ctx, u, t, 12, 22, 0.28));
  handPlate(ctx, u, logZoom(1.0, 1.25, prog(u, a, b)), 1100, (box) => {
    if (lit <= 0) return;
    ctx.globalAlpha = lit;
    M.text(ctx, '02.14', box.w / 2, 300, font(130, 700, 'UI'), C.bone, 'center');
    M.text(ctx, 'selasa, 4 november', box.w / 2, 360, font(34, 700, 'UI'), C.dim, 'center');
    HX.notif(ctx, u, EV.buzz, b + 2, { title: 'ibu', body: '1 pesan baru', time: '02.14', w: box.w, y0: 450 });
  }, { screenOff: 1 - lit });
  ctx.restore();
  HX.darken(ctx, 0.25 * (1 - lit));
  HX.dust(ctx, u, { n: 30, a: 0.3, seed: 31 });
}
const MSGS = () => [
  { t: on(12), side: 'in', text: 'nak, jangan buka pintu ya. ibu mimpi buruk soal kamu.', time: '02.14', hl: cut('stamp') },
  { t: on(17), side: 'out', text: 'bu... aku udah buka.', time: '02.15', read: on(18) + 0.2 },
  { t: on(20), side: 'in', text: 'nak, kamu sekarang di mana?', time: '02.15' },
  { t: on(22), side: 'out', text: 'di kos, bu. di kamar.', time: '02.16', read: on(22) + 0.5 },
  { t: on(23), side: 'in', text: 'terus... yang lagi berdiri di depan rumah ibu sekarang... siapa?', time: '02.16' },
];
const TYPING = () => [[on(10) - 0.2, on(12)], [on(18) + 0.4, on(20)], EV.typing_long];
const typingStatus = (u) => (TYPING().some(([x, y]) => u >= x && u < y) ? 'sedang mengetik...' : 'online');
const nowAt = (u) => (u < on(17) ? '02.14' : u < on(22) ? '02.15' : '02.16');
function chatAt(ctx, u, extra = 0, box = {}) {
  return HX.chat(ctx, u, { name: 'ibu', msgs: MSGS(), typing: TYPING(), status: typingStatus, now: nowAt(u), glowA: 0.2 + extra, ...box });
}
function aChat(ctx, u, IMG, i) {
  const a = SH[i][0], b = shotEnd(i), p = prog(u, a, b);
  ctx.save(); HX.applyHandheld(ctx, u, 0.35);
  handPlate(ctx, u, logZoom(1.98, 2.08, p), 1198, (box) => chatAt(ctx, u, 0, { x: box.x + 22, y: box.y + 22, w: box.w - 44, h: box.h - 44 }), { t: nowAt(u) });
  ctx.restore();
  HX.dust(ctx, u, { n: 26, a: 0.28, seed: 41 });
}
function aStamp(ctx, u, IMG, i) {                       // close-up on the 02.14 timestamp
  const a = SH[i][0], b = shotEnd(i);
  M.fill(ctx, '#05070d');
  const z = logZoom(1.0, 2.7, E.outCubic(prog(u, a, a + 1.2))) * (1 + 0.04 * prog(u, a + 1.2, b));
  // first bubble sits top-left; its timestamp is near its bottom-right corner
  const fx = 680, fy = 560;
  ctx.save(); HX.applyHandheld(ctx, u, 0.6); ctx.translate(W / 2, H * 0.42); ctx.scale(z, z); ctx.translate(-fx, -fy);
  chatAt(ctx, u, 0.1); ctx.restore();
  HX.chroma(ctx, 10 * Math.max(0, 1 - (u - a) * 4));
}
function aChatLast(ctx, u, IMG, i) {
  aChat(ctx, u, IMG, i);
  HX.darken(ctx, 0.25 * prog(u, SH[i][0], shotEnd(i)));
}
function houseFrame(ctx, u, IMG, a, lightOff) {
  const p = prog(u, a, EV.silence[0]);
  HX.plate(ctx, IMG.houseAI, lerp(470, 520, p), lerp(900, 880, p), logZoom(1.0, 1.7, E.inOutSine(p)), () => {
    if (lightOff > 0) {
      ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = `rgba(20,24,40,${lightOff})`; ctx.fillRect(146, 695, 138, 150); ctx.restore();
    } else {
      ctx.save(); ctx.globalCompositeOperation = 'screen'; HX.glow(ctx, 215, 770, 230, '255,170,90', 0.16 + 0.05 * noise1(u * 3, 7)); ctx.restore();
    }
    HX.glow(ctx, 740, 105, 160, '170,190,240', 0.12);
  }, { u });
}
function aHouse(ctx, u, IMG, i) {
  const a = SH[i][0];
  const off = u >= EV.silence[0] ? 1 : 0;
  houseFrame(ctx, u, IMG, a, off);
  if (u < EV.silence[0]) {
    HX.fogDeep(ctx, u, { y0: H * 0.55, h: H * 0.45, a: 0.65 });
    HX.dust(ctx, u, { n: 25, a: 0.22, seed: 51 });
  } else {
    HX.darken(ctx, 0.5);
  }
}
function aPause(ctx, u, IMG) {
  pauseOver(ctx, u, () => houseFrame(ctx, EV.silence[0] - 0.4, IMG, cut('house'), 0));
}

// ---------------------------------------------------------------- branch B: telepon ibu
function bCalling(ctx, u, IMG, i) {
  const a = SH[i][0], b = shotEnd(i);
  ctx.save(); HX.applyHandheld(ctx, u, 0.4);
  handPlate(ctx, u, logZoom(1.6, 1.95, prog(u, a, b)), 1198, (box) => HX.callScreen(ctx, u, { name: 'ibu', ringFrom: EV.call_start, pickUp: null, ...box }), { t: '02.14' });
  ctx.restore();
  HX.dust(ctx, u, { n: 25, a: 0.25, seed: 61 });
}
// the ringtone's pulse (same 6-note pattern as build2.py: 0.18 s notes, 1.44 s cycle)
const ringPulse = (u) => {
  const [r0, r1] = EV.ring_door; if (u < r0 || u >= r1) return 0;
  const d = (u - r0) % 1.44; return d < 1.08 ? Math.exp(-((d % 0.18) / 0.08)) : 0;
};
const gapY = (x) => 1100 + (x - 262) * (30 / 448);
function gapLight(ctx, u, a) {
  ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.filter = 'blur(2px)'; ctx.fillStyle = `rgba(160,190,240,${a})`;
  ctx.beginPath(); ctx.moveTo(262, gapY(262) - 7); ctx.lineTo(712, gapY(712) - 7); ctx.lineTo(712, gapY(712) + 6); ctx.lineTo(262, gapY(262) + 6); ctx.closePath(); ctx.fill();
  ctx.restore();
}
function bDoor(ctx, u, IMG, i) {                       // 08_celah_hp: the ringing phone is OUTSIDE the door
  const a = SH[i][0], b = shotEnd(i), p = prog(u, a, b), rp = ringPulse(u);
  ctx.save(); HX.applyHandheld(ctx, u, 0.4);
  HX.plate(ctx, IMG.gapPhone, 470, lerp(760, 900, p), logZoom(1.0, 1.3, p), () => {
    phoneGlowOutside(ctx, u, 0.15 + 0.85 * rp);
    HX.rays(ctx, u, { x0: 100, x1: 845, y: 998, len: 520, a: 0.04 + 0.12 * rp, n: 8 });
  }, { u });
  ctx.restore();
  HX.fogDeep(ctx, u, { y0: H * 0.7, h: H * 0.3, a: 0.35 });
  HX.dust(ctx, u, { x: 100, y: 900, w: 900, h: 700, n: 35, seed: 71, a: 0.3 });
}
function bGap(ctx, u, IMG, i) {
  const a = SH[i][0], b = shotEnd(i), p = prog(u, a, b), rp = ringPulse(u);
  ctx.save(); HX.applyHandheld(ctx, u, 0.7);
  HX.plate(ctx, IMG.gapPhone, 600, 990, logZoom(1.9, 3.0, p), () => {
    phoneGlowOutside(ctx, u, 0.2 + 0.8 * rp);
    HX.rays(ctx, u, { x0: 420, x1: 820, y: 998, len: 300, a: 0.08 + 0.15 * rp, n: 9 });
  }, { u });
  ctx.restore();
  HX.dust(ctx, u, { x: 0, y: 600, w: W, h: 900, n: 40, seed: 81, a: 0.32 });
}
function bCall(ctx, u, IMG, i) {
  ctx.save(); HX.applyHandheld(ctx, u, 0.3);
  handPlate(ctx, u, 1.95, 1198, (box) => HX.callScreen(ctx, u, { name: 'ibu', ringFrom: EV.call_start, pickUp: EV.pickup, ...box }), { t: '02.15' });
  ctx.restore();
}
function roomFrame(ctx, u, IMG, a, b) {               // relief: pull back, phone still on the call
  const p = prog(u, a, b);
  handPlate(ctx, u, logZoom(1.45, 1.05, E.outCubic(p)), lerp(1190, 900, E.outCubic(p)), (box) => HX.callScreen(ctx, u, { name: 'ibu', ringFrom: EV.call_start, pickUp: EV.pickup, ...box }), { t: '02.15' });
}
function bRoom(ctx, u, IMG, i) {
  roomFrame(ctx, u, IMG, SH[i][0], shotEnd(i) + 3);
  HX.dust(ctx, u, { x: 60, y: 300, w: 900, h: 1100, n: 45, seed: 91, a: 0.35, vx: 6, vy: 9 });
}
function bFreeze(ctx, u, IMG, i) {
  const a = SH[i][0], [f0] = EV.freeze, [d0, dl] = EV.double;
  if (u < f0) { bRoom(ctx, u, IMG, i - 1 >= 0 ? i - 1 : i); return; }
  if (u < d0) { roomFrame(ctx, f0, IMG, SH[i - 1][0], a + 3); HX.darken(ctx, 0.15); return; }   // frozen, dead air
  if (u < EV.silence[0]) {                                // both voices: cut to the door, it reacts
    ctx.save(); M.shake(ctx, u, d0, 24, 9, 0.5);
    HX.plate(ctx, IMG.gapPhone, 600, 990, 2.2 + 0.5 * prog(u, d0, d0 + dl), () => phoneGlowOutside(ctx, u, 1), { u });
    ctx.restore();
    HX.chroma(ctx, 14 * (1 - prog(u, d0, d0 + dl)));
    HX.glitch(ctx, u, 0.6 * (1 - prog(u, d0, d0 + dl)));
    return;
  }
  HX.plate(ctx, IMG.gapPhone, 600, 990, 2.7, null, { u }); HX.darken(ctx, 0.93);      // gap light dies with the sound
}
function bPause(ctx, u, IMG) {
  pauseOver(ctx, u, () => HX.plate(ctx, IMG.gapPhone, 600, 990, 2.4, () => phoneGlowOutside(ctx, 0, 0.6)), 0.85);
}

// ---------------------------------------------------------------- shot table
const SHOTS_A = { vote: sVote, knob: aKnob, hall: aHall, buzz: aBuzz, chat: aChat, stamp: aStamp, chatlast: aChatLast, house: aHouse, pause: aPause, choice: sChoice, end: sEnd };
const SHOTS_B = { vote: sVote, calling: bCalling, door: bDoor, gap: bGap, call: bCall, room: bRoom, freeze: bFreeze, pause: bPause, choice: sChoice, end: sEnd };
const SHOTS = BR === 'A' ? SHOTS_A : SHOTS_B;

// ---------------------------------------------------------------- type
const QUOTED_A = new Set([12, 13, 17, 19, 20, 22, 23, 24, 25]);       // already on the chat screen / on the image
const NO_SUPER = new Set([0, 1, IX.A, IX.Aline, IX.B, IX.Bline, ...(BR === 'A' ? QUOTED_A : [])]);
const KEY = /^(kalian\.?|tanggung|jawab|kosong\.?|ibu\.?|02\.14\.?|satu|menit|buka|pintu\.?|di|mana\??|siapa\??|nada|dering|balik|pintu\.|lega\.?|tapi\.*|kalian|nentuin\.?|3\.?)$/i;
const SUPERS = [
  ...PH.filter((p) => !NO_SUPER.has(p.i)).map((p) => ({ a: p.t0, b: p.t1 + 0.35, text: p.text })),
  ...(BR === 'B' ? [
    { a: EV.ibu1[0], b: EV.ibu1[0] + EV.ibu1[1] + 0.3, text: '“halo nak? ibu di rumah. kenapa telepon jam segini?”', red: true },
    { a: EV.double[0], b: EV.silence[0], text: '“kenapa telepon jam segini?”', red: true },
  ] : []),
].sort((x, y) => x.a - y.a);
// a super never runs into the next one
for (let i = 0; i + 1 < SUPERS.length; i++) SUPERS[i].b = Math.min(SUPERS[i].b, SUPERS[i + 1].a - 0.02);
const TITLES = [];       // Part 2 keeps the big titles to the vote hook, the cards and the end card
const supersMute = (u) => TITLES.some((T) => u >= T.a && u < T.b) || (u >= EV.silence[0] && u < EV.silence[1]) || u < SH[1][0];

M.film({
  fonts: [font(100, 700, 'Display'), font(40, 700, 'UI')],
  images: {
    room: 'assets/art/03_kamar_0213.png', inside: 'assets/art/04_pintu_dalam.png', phone: 'assets/art/06_chat_ibu.png',
    gapPhone: 'assets/art/08_celah_hp.png', houseAI: 'assets/art/07_rumah_desa_ai.png',
    phoneHand: 'assets/art/09_hp_tangan.png', doorOpen: 'assets/art/10_pintu_terbuka.png',
  },
  hits: HITS,
  samples: 4,
  draw(ctx, u, t, IMG) {
    M.fill(ctx, C.night); IMG_ = IMG;
    const i = shotIndex(u);
    SHOTS[SH[i][1]](ctx, u, IMG, i);
    for (const T of TITLES) if (u >= T.a && u < T.b) HX.title(ctx, u, T.s, T.a, T.y, T.size, C.red);
    // on phone close-ups the screen fills the lower frame: supers move to the top band, above the phone
    const onPhone = ['buzz', 'chat', 'chatlast', 'calling', 'call', 'room'].includes(SH[i][1]);
    HX.superText(ctx, u, SUPERS, { y: onPhone ? 175 : 1430, key: KEY, mute: supersMute });
  },
  post(ctx, u) { HX.grade(ctx, u); },
});

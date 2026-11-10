// horror.js: the KAMU PILIH motion kit. Every function is a pure function of time (u = seconds on the
// 60 bpm grid), seeded, no Math.random, so it obeys the Motion Reel render contract.
//
//   import * as M from './motion.js';  import * as HX from './horror.js';
//   HX.setup(M, { display: 'Display', ui: 'UI' });   // once, at module top level
//
// Layers (draw order inside a shot):  plate -> light/shadow FX -> particles -> props (chat, cards)
//                                      -> titles -> supers;  post(): HX.grade()
// Rules learned on Part 1 (see docs/playbook.md): >= 2 moving layers per shot besides the camera,
// one text element at a time, supers per VO phrase, dead silence = frozen + dark frame.
let M, W, H, F = { display: 'Display', ui: 'UI' };
export const C = { night: '#05080f', ink: '#0a0e18', red: '#d8202e', bone: '#ecebe6', dim: '#9aa3b5', chatIn: '#242836', chatOut: '#22406a', chatBg: '#10141e' };
export function setup(motion, fonts = {}) { M = motion; W = M.W; H = M.H; Object.assign(F, fonts); }
const f = (size, weight, fam) => M.font(size, weight, fam === 'ui' ? F.ui : F.display);

// ---------------------------------------------------------------- camera over a painted plate
// cam(): source point (cx, cy) at screen centre, zoom z over cover scale, clamped so the plate always
// covers the frame. Draw overlays in source pixels inside plate()'s callback.
export function cam(img, cx, cy, z) {
  const s = Math.max(W / img.width, H / img.height) * z;
  const ox = M.clamp(W / 2 - cx * s, W - img.width * s, 0), oy = M.clamp(H / 2 - cy * s, H - img.height * s, 0);
  return { s, ox, oy, apply(ctx) { ctx.translate(ox, oy); ctx.scale(s, s); }, toScreen: (x, y) => [ox + x * s, oy + y * s] };
}
export const logZoom = (a, b, p) => a * (b / a) ** M.clamp(p);
// breathe: a tiny scale pulse (0.4 %) so even a locked-off plate is alive
export function plate(ctx, img, cx, cy, z, extra, { breathe = 0.004, u = 0 } = {}) {
  const c = cam(img, cx, cy, z * (1 + breathe * Math.sin(u * 1.3)));
  ctx.save(); c.apply(ctx); ctx.drawImage(img, 0, 0); if (extra) extra(ctx, c); ctx.restore();
  return c;
}

// ---------------------------------------------------------------- light + shadow
export function glow(ctx, x, y, r, rgb, a) {
  if (a <= 0) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
export function darken(ctx, a, w = W, h = H) { if (a > 0) { ctx.fillStyle = `rgba(0,0,0,${M.clamp(a)})`; ctx.fillRect(0, 0, w, h); } }
// flicker(u, seed): 0..1 brightness of a failing bulb (mostly on, short irregular dips)
export function flicker(u, seed = 1, rate = 1) {
  const n = M.noise1(u * 13 * rate, seed);
  const dip = n < -0.55 ? (n + 0.55) * 3 : 0;          // occasional deep dips
  return M.clamp(1 + dip + 0.06 * M.noise1(u * 47 * rate, seed + 1));
}
// a soft body passing behind a door gap: x along the gap, y the gap line (source px)
export function passShadow(ctx, x, y, a = 0.95, rx = 85, ry = 38) {
  ctx.save(); ctx.filter = 'blur(10px)'; ctx.fillStyle = `rgba(2,3,8,${a})`;
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.06, 0, M.TAU); ctx.fill(); ctx.restore();
}
// light beam (window / lamp) as a soft quad with a breathing alpha
export function beam(ctx, u, pts, rgb = '150,175,220', a = 0.1, seed = 3) {
  const [p0, p1, p2, p3] = pts;
  const g = ctx.createLinearGradient(p0[0], p0[1], (p2[0] + p3[0]) / 2, (p2[1] + p3[1]) / 2);
  g.addColorStop(0, `rgba(${rgb},${a * (0.8 + 0.25 * M.noise1(u * 0.7, seed))})`); g.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(...p0); ctx.lineTo(...p1); ctx.lineTo(...p2); ctx.lineTo(...p3); ctx.closePath(); ctx.fill();
}

// ---------------------------------------------------------------- particles
// dust motes drifting through a lit box (screen px); a few big soft bokeh ones
export function dust(ctx, u, { x = 0, y = 0, w = W, h = H, n = 40, seed = 1, rgb = '215,225,245', a = 0.6, vx = 6, vy = -12, size = 3.9 } = {}) {
  for (let i = 0; i < n; i++) {
    const r1 = M.hash01(i, seed), r2 = M.hash01(i, seed + 7), r3 = M.hash01(i, seed + 13), sp = 0.4 + r3;
    const px = x + ((r1 * w + u * vx * sp + 8 * M.noise1(u * 0.6 + i, seed)) % w + w) % w;
    const py = y + ((r2 * h + u * vy * sp) % h + h) % h;
    const tw = 0.35 + 0.65 * (0.5 + 0.5 * M.noise1(u * 1.3 + i * 3.1, seed + 2));
    const rad = size * (0.5 + r3);
    ctx.fillStyle = `rgba(${rgb},${a * tw})`; ctx.beginPath(); ctx.arc(px, py, rad, 0, M.TAU); ctx.fill();
    if (r3 > 0.85) { ctx.fillStyle = `rgba(${rgb},${a * tw * 0.12})`; ctx.beginPath(); ctx.arc(px, py, rad * 5, 0, M.TAU); ctx.fill(); }
  }
}
export function fog(ctx, u, y0, a = 0.22, rgb = '60,70,95', n = 7) {
  for (let k = 0; k < n; k++) {
    const x = ((M.hash01(k, 41) * W * 1.6 + u * (18 + 14 * M.hash01(k, 42))) % (W * 1.6)) - W * 0.3;
    const y = y0 + M.hash01(k, 43) * 260, rx = 340 + 200 * M.hash01(k, 44);
    glow(ctx, x, y, rx, rgb, a);
  }
}
export function embers(ctx, u, n = 26, seed = 5, rgb = '235,60,50') {
  for (let i = 0; i < n; i++) {
    const r1 = M.hash01(i, seed), r2 = M.hash01(i, seed + 3), sp = 40 + 70 * M.hash01(i, seed + 6);
    const y = H - ((r2 * H + u * sp) % (H + 100)), x = r1 * W + 30 * Math.sin(u * 0.9 + i);
    ctx.fillStyle = `rgba(${rgb},${0.5 * (0.5 + 0.5 * Math.sin(u * 4 + i * 2))})`;
    ctx.beginPath(); ctx.arc(x, y, 2 + 2 * r1, 0, M.TAU); ctx.fill();
  }
}
// rain streaks on a window (screen box)
export function rain(ctx, u, { x = 0, y = 0, w = W, h = H, n = 70, seed = 9, a = 0.25 } = {}) {
  ctx.save(); ctx.strokeStyle = `rgba(180,200,235,${a})`; ctx.lineWidth = 1.6;
  for (let i = 0; i < n; i++) {
    const sp = 900 + 600 * M.hash01(i, seed), px = x + M.hash01(i, seed + 1) * w;
    const py = y + ((M.hash01(i, seed + 2) * h + u * sp) % h);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px - 6, py + 26); ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- stick figure (faceless, 2.5-D-ish)
// pose: { x, y (feet), h, lean, armL, armR, legL, legR, breath } angles in radians; idle sway from noise
export function stick(ctx, u, { x, y, h = 420, lean = 0, armL = 0.25, armR = -0.25, legL = 0.12, legR = -0.12, color = '#e9e7e2', seed = 1, sitting = false } = {}) {
  const sway = 0.02 * M.noise1(u * 0.5, seed), br = 1 + 0.012 * Math.sin(u * 2.1);
  const head = h * 0.13, w = h * 0.06;
  ctx.save(); ctx.translate(x, y); ctx.rotate(lean + sway);
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round'; ctx.lineWidth = w;
  const hip = sitting ? -h * 0.18 : -h * 0.45, neck = -h * 0.8 * br;
  ctx.beginPath(); ctx.moveTo(0, hip); ctx.lineTo(0, neck); ctx.stroke();
  const limb = (ox, oy, ang, len) => { ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + Math.sin(ang) * len, oy + Math.cos(ang) * len); ctx.stroke(); };
  limb(0, neck + h * 0.06, armL, h * 0.36); limb(0, neck + h * 0.06, armR, h * 0.36);
  if (!sitting) { limb(0, hip, legL, h * 0.45); limb(0, hip, legR, h * 0.45); }
  ctx.beginPath(); ctx.ellipse(0, neck - head * 0.9, head * 0.85, head, 0, 0, M.TAU); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- phone chat (dark mode, no logos)
// msgs: [{ t, side: 'in'|'out', text, time, read? }], typing: [[a, b], ...] (the OTHER side typing),
// status(u) -> header line. Bubbles pop in on t with a spring, the list scrolls up as it fills,
// outgoing ticks turn blue at `read`. Box in screen px. Pure function of u.
export function chat(ctx, u, { x = 90, y = 220, w = 900, h = 1120, name = 'ibu', status = () => 'online', msgs = [], typing = [], glowA = 0.18, now = '02.13' } = {}) {
  ctx.save();
  glow(ctx, x + w / 2, y + h / 2, w * 0.9, '70,95,150', glowA + 0.04 * Math.sin(u * 2.2));
  M.rrect(ctx, x - 22, y - 22, w + 44, h + 44, 74); ctx.fillStyle = '#05060a'; ctx.fill();
  M.rrect(ctx, x, y, w, h, 56); ctx.fillStyle = C.chatBg; ctx.fill(); ctx.clip();
  // header
  ctx.fillStyle = '#151a26'; ctx.fillRect(x, y, w, 150);
  ctx.fillStyle = '#5a6478'; ctx.beginPath(); ctx.arc(x + 80, y + 82, 40, 0, M.TAU); ctx.fill();
  ctx.font = f(48, 700, 'ui'); ctx.fillStyle = C.bone; ctx.textAlign = 'left'; ctx.fillText(name, x + 140, y + 78);
  const st = status(u);
  ctx.font = f(26, 700, 'ui'); ctx.fillStyle = /ngetik|mengetik|typing/.test(st) ? '#7fd0a0' : C.dim; ctx.fillText(st, x + 140, y + 116);
  ctx.font = f(30, 700, 'ui'); ctx.fillStyle = C.red; ctx.textAlign = 'right'; ctx.fillText(now, x + w - 36, y + 64);
  // body: lay out visible bubbles bottom-up
  const shown = msgs.filter((m) => u >= m.t);
  const isTyping = typing.some(([a, b]) => u >= a && u < b);
  const fs = 42, lineH = 54, pad = 28, maxW = w * 0.78;
  ctx.font = f(fs, 700, 'ui');
  const wrap = (s) => { const out = [[]]; for (const wd of s.split(' ')) { const t = [...out[out.length - 1], wd].join(' '); if (ctx.measureText(t).width > maxW - pad * 2 && out[out.length - 1].length) out.push([wd]); else out[out.length - 1].push(wd); } return out.map((l) => l.join(' ')); };
  const items = shown.map((m) => { const lines = wrap(m.text); return { m, lines, bh: lines.length * lineH + pad * 2 + 26, bw: Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)) + pad * 2 + (m.side === 'out' ? 60 : 10)) }; });
  if (isTyping) items.push({ typing: true, bh: 84, bw: 170 });
  // top-down like a real chat; once it overflows, scroll so the newest sits at the bottom (eased)
  const top = y + 180, gap = 18;
  const total = items.reduce((a, it) => a + it.bh + gap, 0);
  const over = Math.max(0, total - (h - 220));
  let yy = top - over; const rects = [];
  for (const it of items) {
    const by = yy; yy += it.bh + gap;
    rects.push({ m: it.m, x: (!it.typing && it.m.side === 'out') ? x + w - 30 - it.bw : x + 30, y: by, w: it.bw, h: it.bh });
    if (by + it.bh < y + 150) continue;
    const k = it.typing ? 1 : M.springU(u, it.m.t, M.SPRING.snappy);
    const out = !it.typing && it.m.side === 'out';
    const bx = out ? x + w - 30 - it.bw : x + 30, ax = out ? bx + it.bw : bx;
    ctx.save(); ctx.globalAlpha = M.clamp(k * 1.4);
    ctx.translate(ax, by + it.bh); ctx.scale(0.8 + 0.2 * k, 0.8 + 0.2 * k); ctx.translate(-ax, -(by + it.bh + (1 - k) * 30));
    M.rrect(ctx, bx, by, it.bw, it.bh, 30); ctx.fillStyle = out ? C.chatOut : C.chatIn; ctx.fill();
    if (it.typing) {
      for (let d = 0; d < 3; d++) { const b = Math.max(0, Math.sin(u * 7 - d * 0.9)); ctx.fillStyle = `rgba(220,224,232,${0.4 + 0.6 * b})`; ctx.beginPath(); ctx.arc(bx + 45 + d * 40, by + 44 - 9 * b, 10, 0, M.TAU); ctx.fill(); }
    } else {
      ctx.font = f(fs, 700, 'ui'); ctx.fillStyle = '#e4e7ee'; ctx.textAlign = 'left';
      it.lines.forEach((l, li) => ctx.fillText(l, bx + pad, by + pad + fs * 0.85 + li * lineH));
      const hl = it.m.hl != null && u >= it.m.hl;
      ctx.font = f(hl ? 30 : 24, 700, 'ui'); ctx.fillStyle = hl ? `rgba(230,40,50,${0.6 + 0.4 * (Math.floor(u * 3) % 2)})` : '#8890a2'; ctx.textAlign = 'right';
      ctx.fillText(it.m.time || '', bx + it.bw - (out ? 70 : 22), by + it.bh - 16);
      if (out) { ctx.fillStyle = it.m.read != null && u >= it.m.read ? '#5ab4ff' : '#8890a2'; ctx.fillText('\u2713\u2713', bx + it.bw - 22, by + it.bh - 16); }
    }
    ctx.restore();
  }
  ctx.restore();
  return rects;
}

// ---------------------------------------------------------------- voting result bar (Part 2+ hook)
// a/b in percent; numbers count up, bars fill on a spring, winner pulses red
export function voteBar(ctx, u, u0, { a, b, labelA = 'BUKA PINTU', labelB = 'TELEPON IBU', y = 760 }) {
  const k = M.springU(u, u0, M.SPRING.gentle), win = a >= b ? 'a' : 'b';
  const row = (yy, letter, label, pct, isWin, d) => {
    const kk = M.springU(u, u0 + d, M.SPRING.gentle);
    ctx.save(); ctx.globalAlpha = M.clamp(kk * 1.3);
    ctx.font = f(120, 700); ctx.fillStyle = isWin ? C.red : C.bone; ctx.textAlign = 'left'; ctx.fillText(letter, 90, yy + 100);
    ctx.font = f(40, 700, 'ui'); ctx.fillStyle = C.dim; ctx.fillText(label, 210, yy + 34);
    M.rrect(ctx, 210, yy + 54, 760, 44, 22); ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fill();
    const fw = 760 * (pct / 100) * M.clamp(M.springU(u, u0 + d + 0.3, M.SPRING.gentle));
    if (fw > 1) { M.rrect(ctx, 210, yy + 54, fw, 44, 22); ctx.fillStyle = isWin ? C.red : '#5a6478'; ctx.fill(); }
    ctx.font = f(56, 700, 'ui'); ctx.fillStyle = isWin ? C.red : C.bone; ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(pct * M.clamp(M.springU(u, u0 + d + 0.3, M.SPRING.gentle)))}%`, 970, yy + 34);
    ctx.restore();
  };
  row(y, 'A', labelA, a, win === 'a', 0); row(y + 220, 'B', labelB, b, win === 'b', 0.15);
  return k;
}

// ---------------------------------------------------------------- VHS pause / glitch
export function vhsPause(ctx, u, label = 'PAUSE') {
  const r = M.mulberry32(Math.floor(u * 30) * 7 + 3);
  for (let k = 0; k < 3; k++) { const y = (r() * H) | 0, hh = 6 + r() * 26; ctx.drawImage(ctx.canvas, 0, y, W, hh, (r() - 0.5) * 30, y, W, hh); }
  ctx.fillStyle = C.bone; ctx.fillRect(84, 300, 22, 64); ctx.fillRect(122, 300, 22, 64);
  M.text(ctx, label, 168, 356, f(64, 700, 'ui'), C.bone);
}
// slice glitch: k (0..1) strength, call on a short window around a scare
export function glitch(ctx, u, k, seed = 17) {
  if (k <= 0) return;
  const r = M.mulberry32(Math.floor(u * 60) * 13 + seed);
  for (let i = 0; i < Math.round(8 * k); i++) {
    const y = (r() * H) | 0, hh = 8 + r() * 70;
    ctx.drawImage(ctx.canvas, 0, y, W, hh, (r() - 0.5) * 140 * k, y, W, hh);
  }
}

// ---------------------------------------------------------------- type
// title: display face, glyphs spring up in order, auto-fit to width
export function title(ctx, u, str, u0, y, size, color) {
  let s = size, L = M.layout(ctx, str, f(size, 700), 0);
  if (L.width > W - 140) { s = Math.floor(size * (W - 140) / L.width); L = M.layout(ctx, str, f(s, 700), 0); }
  const x0 = (W - L.width) / 2;
  L.glyphs.forEach((g, j) => {
    const k = M.springU(u, u0 + j * 0.025, M.SPRING.snappy);
    if (k <= 0) return;
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = 24;
    ctx.globalAlpha = M.clamp(k * 1.5); M.glyph(ctx, g.ch, x0 + g.cx, y + (1 - k) * 50, f(s, 700), color);
    ctx.restore();
  });
}
// supers: one VO phrase at a time, typed on, keyword words in red. supers = [{a, b, text, red}]
export function superText(ctx, u, supers, { y = 1390, size = 58, key = /^$/, mute = () => false } = {}) {
  const s = supers.find((x) => u >= x.a && u < x.b);
  if (!s || mute(u)) return;
  const fnt = f(size, 700, 'ui'); ctx.font = fnt;
  const lines = [[]];
  for (const w of s.text.split(' ')) { const t = [...lines[lines.length - 1], w].join(' '); if (ctx.measureText(t).width > 900 && lines[lines.length - 1].length) lines.push([w]); else lines[lines.length - 1].push(w); }
  const shown = Math.ceil(s.text.length * M.E.outQuad(M.prog(u, s.a, s.a + Math.min(0.35, (s.b - s.a) * 0.4))));
  const fade = 1 - M.prog(u, s.b - 0.12, s.b);
  let n = 0;
  lines.forEach((ln, li) => {
    const str = ln.join(' '); let x = (W - ctx.measureText(str).width) / 2;
    const yy = y + li * (size * 1.28) - (lines.length - 1) * size * 0.64;
    ln.forEach((w, wi) => {
      const word = (wi ? ' ' : '') + w, vis = Math.max(0, Math.min(word.length, shown - n)); n += word.length;
      ctx.save(); ctx.globalAlpha = fade; ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 18;
      ctx.fillStyle = s.red || key.test(w) ? C.red : C.bone; ctx.textAlign = 'left'; ctx.font = fnt;
      ctx.fillText(word.slice(0, vis), x, yy); ctx.restore();
      x += ctx.measureText(word).width;
    });
  });
}

// ---------------------------------------------------------------- grade (call from post())
let GRAIN = null;
function grain() {
  if (GRAIN) return GRAIN;
  GRAIN = [0, 1, 2, 3].map((k) => {
    const c = document.createElement('canvas'); c.width = 540; c.height = 960;
    const g = c.getContext('2d'), d = g.createImageData(540, 960), r = M.mulberry32(91 + k);
    for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() - 0.5) * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    g.putImageData(d, 0, 0); return c;
  });
  return GRAIN;
}
export function grade(ctx, u, { vignette = 0.6, grainA = 0.09, breathe = 0.04 } = {}) {
  const vg = ctx.createRadialGradient(W / 2, H * 0.48, H * 0.25, W / 2, H * 0.48, H * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${vignette})`);
  ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
  ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = grainA;
  ctx.drawImage(grain()[Math.floor(u * 24) % 4], 0, 0, W, H); ctx.restore();
  darken(ctx, breathe * (0.5 + 0.5 * M.noise1(u * 9, 2)));
}

// ================================================================ v2 additions (no downloads needed)
// ---------------------------------------------------------------- volumetric fog (fBm texture, 2-D)
// Three parallax sheets of fractal noise drifting at different speeds: reads as deep, slow fog
// without three.js. Textures are built once (seeded), drawn scaled up so they stay soft.
let FOGTEX = null;
function fogTex() {
  if (FOGTEX) return FOGTEX;
  const N = 256;
  FOGTEX = [11, 23, 37].map((seed) => {
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const g = c.getContext('2d'), d = g.createImageData(N, N);
    const r = M.mulberry32(seed), grid = (n) => Array.from({ length: n * n }, () => r());
    const oct = [4, 8, 16, 32].map((n) => ({ n, v: grid(n) }));
    const sm = (t) => t * t * (3 - 2 * t);
    const val = ({ n, v }, x, y) => {                       // tileable value noise
      const fx = x * n, fy = y * n, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = sm(fx - x0), ty = sm(fy - y0);
      const at = (i, j) => v[((j % n + n) % n) * n + ((i % n + n) % n)];
      const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * tx, b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * tx;
      return a + (b - a) * ty;
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      let s = 0, amp = 0.55;
      for (const o of oct) { s += val(o, i / N, j / N) * amp; amp *= 0.5; }
      const a = Math.max(0, Math.min(1, (s - 0.42) * 2.2)) * Math.sin(Math.PI * (j + 0.5) / N) ** 1.5;
      const k = (j * N + i) * 4; d.data[k] = d.data[k + 1] = d.data[k + 2] = 255; d.data[k + 3] = a * 255;
    }
    g.putImageData(d, 0, 0); return c;
  });
  return FOGTEX;
}
// fogDeep(ctx, u, {y0, h, a, tint}): band of rolling fog from y0 over h (screen px)
export function fogDeep(ctx, u, { y0 = H * 0.55, h = H * 0.45, a = 0.35, tint = '70,82,110', speed = 1 } = {}) {
  const T = fogTex();
  if (!fogDeep.buf) fogDeep.buf = document.createElement('canvas');
  const B = fogDeep.buf; B.width = W; B.height = Math.ceil(h);
  const g = B.getContext('2d'); g.clearRect(0, 0, W, h);
  T.forEach((tex, k) => {
    const sc = [3.2, 4.6, 6.4][k], tw = 256 * sc, th = 256 * sc * 0.6;
    const dx = (u * speed * [14, 26, 44][k]) % tw, dy = 12 * Math.sin(u * 0.2 + k);
    g.globalAlpha = [0.5, 0.65, 0.8][k] * (0.85 + 0.15 * Math.sin(u * 0.35 + k * 2));
    const yy = h - th * 0.9 + dy - k * h * 0.12;
    for (let x = -dx - tw; x < W + tw; x += tw) g.drawImage(tex, x, yy, tw, th);
  });
  // soft vertical mask: fade in from the top of the band, fade out at the very bottom
  g.globalAlpha = 1; g.globalCompositeOperation = 'destination-in';
  const m = g.createLinearGradient(0, 0, 0, h);
  m.addColorStop(0, 'rgba(0,0,0,0)'); m.addColorStop(0.45, 'rgba(0,0,0,1)'); m.addColorStop(0.92, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0.6)');
  g.fillStyle = m; g.fillRect(0, 0, W, h);
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = `rgb(${tint})`; g.globalAlpha = 0.35; g.fillRect(0, 0, W, h);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.globalAlpha = a; ctx.drawImage(B, 0, y0); ctx.restore();
}

// ---------------------------------------------------------------- light rays (god rays from a gap/window)
// rays fan out from a source line (x0..x1 at y) towards dir; each ray breathes and drifts
export function rays(ctx, u, { x0, x1, y, len = 900, dir = 1, n = 9, rgb = '200,215,255', a = 0.12, seed = 4, spread = 0.5 } = {}) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const p = (i + 0.5) / n, x = x0 + (x1 - x0) * p, wv = (x1 - x0) / n * (0.6 + M.hash01(i, seed));
    const ang = (p - 0.5) * spread + 0.05 * M.noise1(u * 0.3 + i, seed);
    const aa = a * (0.4 + 0.6 * (0.5 + 0.5 * M.noise1(u * 0.8 + i * 1.7, seed + 1)));
    const ex = x + Math.sin(ang) * len, ey = y + dir * Math.cos(ang) * len;
    const g = ctx.createLinearGradient(x, y, ex, ey);
    g.addColorStop(0, `rgba(${rgb},${aa})`); g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g; ctx.beginPath();
    ctx.moveTo(x - wv / 2, y); ctx.lineTo(x + wv / 2, y); ctx.lineTo(ex + wv * 2, ey); ctx.lineTo(ex - wv * 2, ey); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- handheld camera
// returns [dx, dy, rot] to apply before drawing a shot: a nervous, breathing operator.
// k = intensity (0.3 calm, 1 scared, 2 panic)
export function handheld(u, k = 0.5, seed = 8) {
  return [k * 9 * M.noise1(u * 0.9, seed) + k * 2.5 * M.noise1(u * 6, seed + 1),
          k * 7 * M.noise1(u * 0.8, seed + 2) + k * 2 * M.noise1(u * 5.5, seed + 3),
          k * 0.004 * M.noise1(u * 0.6, seed + 4)];
}
export function applyHandheld(ctx, u, k, seed) {
  const [dx, dy, r] = handheld(u, k, seed);
  ctx.translate(W / 2 + dx, H / 2 + dy); ctx.rotate(r); ctx.scale(1 + 0.02 * k, 1 + 0.02 * k); ctx.translate(-W / 2, -H / 2);
}

// ---------------------------------------------------------------- scare tools
// chroma: RGB split of the current frame by px (call on a scare, decays fast)
export function chroma(ctx, px) {
  if (px < 0.5) return;
  const c = ctx.canvas;
  if (!chroma.buf) { chroma.buf = document.createElement('canvas'); }
  const b = chroma.buf; b.width = c.width; b.height = c.height; b.getContext('2d').drawImage(c, 0, 0);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35;
  const tint = (col, dx) => { const t = document.createElement('canvas'); t.width = b.width; t.height = b.height; const g = t.getContext('2d');
    g.drawImage(b, 0, 0); g.globalCompositeOperation = 'multiply'; g.fillStyle = col; g.fillRect(0, 0, t.width, t.height);
    g.globalCompositeOperation = 'destination-in'; g.drawImage(b, 0, 0); ctx.drawImage(t, dx, 0); };
  tint('#ff0000', -px); tint('#0044ff', px);
  ctx.restore();
}
// flash: a single white/red frame burst. k 0..1 (use a 2-3 frame window)
export function flash(ctx, k, rgb = '255,255,255') { if (k > 0) { ctx.fillStyle = `rgba(${rgb},${M.clamp(k)})`; ctx.fillRect(0, 0, W, H); } }
// lightning: two quick flashes then a slow decay, starting at u0. Returns brightness for plates.
export function lightning(u, u0) {
  const d = u - u0; if (d < 0 || d > 1.6) return 0;
  return d < 0.06 ? 1 : d < 0.12 ? 0.15 : d < 0.2 ? 0.8 : Math.max(0, 0.8 * Math.exp(-(d - 0.2) * 4));
}
// blackout: hard cut to black for [a,b) with a 1-frame white pop at the start (jump-scare cut)
export function blackout(ctx, u, a, b) {
  if (u < a || u >= b) return false;
  M.fill(ctx, '#000'); if (u - a < 1 / 30) flash(ctx, 0.25);
  return true;
}

// ---------------------------------------------------------------- transitions
// inkWipe: a dark organic blot that grows from (x,y) to cover the frame; p 0..1
export function inkWipe(ctx, p, x = W / 2, y = H / 2, seed = 3) {
  if (p <= 0) return;
  const R = Math.hypot(W, H) * M.E.inOutCubic(M.clamp(p));
  ctx.save(); ctx.fillStyle = '#020306'; ctx.beginPath();
  const n = 48;
  for (let i = 0; i <= n; i++) {
    const a = i / n * M.TAU, rr = R * (1 + 0.18 * M.noise1(i * 0.37 + p * 3, seed) + 0.08 * M.noise1(i * 1.3, seed + 5));
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
  }
  ctx.fill(); ctx.restore();
}
// irisClose: frame shrinks to a circle around (x,y) like an old film ending; p 0..1
export function irisClose(ctx, p, x = W / 2, y = H / 2) {
  if (p <= 0) return;
  const r = Math.hypot(W, H) * (1 - M.E.inOutCubic(M.clamp(p)));
  ctx.save(); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(x, y, Math.max(0, r), 0, M.TAU, true); ctx.fill('evenodd'); ctx.restore();
}

// ---------------------------------------------------------------- props
// phone call screen (for "telepon ibu" branches): ringing pulse rings, timer once picked up
export function callScreen(ctx, u, { name = 'ibu', ringFrom = 0, pickUp = null, end = null, x = 90, y = 220, w = 900, h = 1120 } = {}) {
  ctx.save();
  M.rrect(ctx, x - 22, y - 22, w + 44, h + 44, 74); ctx.fillStyle = '#05060a'; ctx.fill();
  M.rrect(ctx, x, y, w, h, 56); const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#141a2a'); g.addColorStop(1, '#07090f'); ctx.fillStyle = g; ctx.fill(); ctx.clip();
  const cx = x + w / 2, cy = y + h * 0.36, live = pickUp != null && u >= pickUp, ended = end != null && u >= end;
  if (!live && u >= ringFrom) for (let k = 0; k < 3; k++) {
    const ph = ((u - ringFrom) * 0.8 + k / 3) % 1;
    ctx.strokeStyle = `rgba(120,200,150,${0.5 * (1 - ph)})`; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, cy, 120 + ph * 220, 0, M.TAU); ctx.stroke();
  }
  ctx.fillStyle = '#5a6478'; ctx.beginPath(); ctx.arc(cx, cy, 120, 0, M.TAU); ctx.fill();
  ctx.font = f(84, 700, 'ui'); ctx.fillStyle = C.bone; ctx.textAlign = 'center'; ctx.fillText(name, cx, cy + 260);
  let st = 'memanggil...';
  if (live) { const s = Math.floor(u - pickUp); st = `00:${String(s).padStart(2, '0')}`; }
  if (ended) st = 'panggilan berakhir';
  ctx.font = f(40, 700, 'ui'); ctx.fillStyle = ended ? C.red : C.dim; ctx.fillText(st, cx, cy + 330);
  // buttons
  const btn = (bx, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx, y + h - 190, 70, 0, M.TAU); ctx.fill(); };
  if (!live && !ended) { btn(cx - 200, '#c8323c'); btn(cx + 200, '#2e9e5a'); } else btn(cx, '#c8323c');
  ctx.restore();
}
// notification banner sliding down from the top (lock screen style). Visible [a, b)
export function notif(ctx, u, a, b, { title = 'ibu', body = '', time = 'sekarang', w = W, y0 = 0 } = {}) {
  if (u < a - 0.01 || u > b + 0.6) return;
  const k = M.springU(u, a, M.SPRING.snappy) - M.clamp((u - b) / 0.4);
  const y = y0 - 200 + 280 * M.clamp(k, -1, 1.2), x0 = 40, x1 = w - 40;
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 40;
  M.rrect(ctx, x0, y, x1 - x0, 170, 40); ctx.fillStyle = 'rgba(40,44,56,0.96)'; ctx.fill(); ctx.restore();
  ctx.font = f(30, 700, 'ui'); ctx.fillStyle = C.dim; ctx.textAlign = 'left'; ctx.fillText('PESAN', x0 + 40, y + 50);
  ctx.textAlign = 'right'; ctx.fillText(time, x1 - 40, y + 50);
  ctx.textAlign = 'left'; ctx.font = f(40, 700, 'ui'); ctx.fillStyle = C.bone; ctx.fillText(title, x0 + 40, y + 100);
  const maxC = Math.floor((x1 - x0 - 80) / 20);
  ctx.font = f(34, 700, 'ui'); ctx.fillStyle = '#c9cdd6'; ctx.fillText(body.length > maxC ? body.slice(0, maxC - 1) + '\u2026' : body, x0 + 40, y + 145);
}

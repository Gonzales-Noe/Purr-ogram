'use strict';

const W = 320, H = 180;

const PAL = {
  bg: '#040814', navy: '#081127', deep: '#0f1f4d', blue: '#1d4ed8', sky: '#3b82f6',
  cyan: '#22d3ee', teal: '#14b8a6', green: '#22c55e', lime: '#a3e635', white: '#ffffff',
  gray: '#cbd5e1', slate: '#334155', dark: '#1e293b', red: '#ef4444', orange: '#f97316',
  yellow: '#facc15', purple: '#a855f7', pink: '#f472b6',
};

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function fitCanvas() {
  const s = Math.min(window.innerWidth / W, window.innerHeight / H);
  const scale = s >= 2 ? Math.floor(s) : s;
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

/* ---------- math helpers ---------- */
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const choice = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const pointIn = (p, x, y, w, h) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + h;

/* ---------- input ---------- */
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  Space: 'action', Enter: 'action', KeyZ: 'action',
  Escape: 'back', KeyP: 'back', KeyM: 'mute', KeyF: 'fullscreen', KeyC: 'wheel',
  Tab: 'skip', KeyQ: 'qr',
};

const Input = {
  down: new Set(),
  pressed: new Set(),
  mouse: { x: -99, y: -99, down: false, clicked: false, moved: false },
  typed: [],
  textMode: false,
  press(a) { if (!this.down.has(a)) this.pressed.add(a); this.down.add(a); },
  release(a) { this.down.delete(a); },
  isDown(a) { return this.down.has(a); },
  hit(a) { return this.pressed.has(a); },
  endFrame() { this.pressed.clear(); this.mouse.clicked = false; this.mouse.moved = false; this.typed.length = 0; },
};

window.addEventListener('keydown', e => {
  Sound.init();
  if (Input.textMode) {
    const ch = /^Key([A-Z])$/.exec(e.code) || /^(?:Digit|Numpad)(\d)$/.exec(e.code);
    if (ch) Input.typed.push(ch[1]);
    else if (e.code === 'Space') Input.typed.push(' ');
    else if (e.code === 'Backspace') Input.typed.push('del');
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') { if (!e.repeat) Input.press('action'); }
    else if (e.code === 'Escape') { if (!e.repeat) Input.press('back'); }
    else return;
    e.preventDefault();
    return;
  }
  const digit = /^(Digit|Numpad)(\d)$/.exec(e.code);
  if (digit) Input.typed.push(digit[2]);
  else if (e.code === 'Backspace') { e.preventDefault(); Input.typed.push('del'); }
  const a = KEYMAP[e.code];
  if (!a) return;
  e.preventDefault();
  if (!e.repeat) Input.press(a);
});
window.addEventListener('keyup', e => { const a = KEYMAP[e.code]; if (a) Input.release(a); });
window.addEventListener('blur', () => Input.down.clear());

function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
}
canvas.addEventListener('pointerdown', e => {
  Sound.init();
  Object.assign(Input.mouse, pointerPos(e), { down: true, clicked: true, moved: true });
});
canvas.addEventListener('pointermove', e => { Object.assign(Input.mouse, pointerPos(e), { moved: true }); });
window.addEventListener('pointerup', () => { Input.mouse.down = false; });
window.addEventListener('pointercancel', () => { Input.mouse.down = false; });

function toggleFullscreen() {
  const el = document.documentElement;
  if (!(document.fullscreenElement || document.webkitFullscreenElement)) {
    if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
  } else if (document.exitFullscreen) document.exitFullscreen();
  else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
}

/* ---------- audio (synthesized chiptune, no files needed) ---------- */
const Sound = {
  ac: null, master: null, noiseBuf: null, muted: false,
  init() {
    if (!this.ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ac = new AC();
      this.master = this.ac.createGain();
      this.master.gain.value = this.muted ? 0 : 0.6;
      this.master.connect(this.ac.destination);
      const len = Math.floor(this.ac.sampleRate * 0.5);
      this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    // iPad/iPhone: keep playing with the silent switch on, and wake up after the app was in the background.
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
    if (this.ac.state !== 'running') this.ac.resume().catch(() => {});
  },
  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.6;
  },
  toneAt(t, freq, dur, type = 'square', vol = 0.05, slide = 0) {
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  },
  noiseAt(t, dur, vol = 0.08) {
    const s = this.ac.createBufferSource(), g = this.ac.createGain();
    s.buffer = this.noiseBuf;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.02);
  },
  tone(freq, dur, type, vol, slide = 0, delay = 0) { this.toneAt(this.ac.currentTime + delay, freq, dur, type, vol, slide); },
  noise(dur, vol, delay = 0) { this.noiseAt(this.ac.currentTime + delay, dur, vol); },
  play(name) {
    if (!this.ac || this.muted || !SFX[name]) return;
    SFX[name](this);
  },
};

const SFX = {
  blip: s => s.tone(660, 0.05, 'square', 0.04),
  select: s => { s.tone(523, 0.07, 'square', 0.05); s.tone(784, 0.1, 'square', 0.05, 0, 0.07); },
  coin: s => { s.tone(988, 0.06, 'square', 0.05); s.tone(1319, 0.12, 'square', 0.05, 0, 0.06); },
  good: s => s.tone(660, 0.1, 'square', 0.05, 440),
  hurt: s => { s.tone(200, 0.3, 'sawtooth', 0.08, -140); s.noise(0.15, 0.08); },
  deny: s => s.tone(140, 0.12, 'square', 0.05),
  shoot: s => s.tone(1000, 0.09, 'square', 0.025, -700),
  boom: s => { s.noise(0.3, 0.12); s.tone(120, 0.25, 'triangle', 0.1, -80); },
  jump: s => s.tone(280, 0.15, 'square', 0.04, 380),
  power: s => [523, 659, 784, 1047].forEach((f, i) => s.tone(f, 0.1, 'square', 0.05, 0, i * 0.07)),
  win: s => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => s.tone(f, 0.14, 'square', 0.05, 0, i * 0.1)),
  lose: s => [392, 330, 262, 196].forEach((f, i) => s.tone(f, 0.2, 'triangle', 0.09, 0, i * 0.16)),
  talk: s => s.tone(rand(880, 1250), 0.035, 'square', 0.022),
  tick: s => s.tone(1700, 0.02, 'square', 0.03),
  meow: s => { s.tone(700, 0.12, 'triangle', 0.08, 500); s.tone(1150, 0.18, 'triangle', 0.07, -450, 0.11); },
};

const midi = n => 440 * Math.pow(2, (n - 69) / 12);
const TRACKS = {
  calm: {
    bpm: 100, oct: 0, vol: 0.03, hat: false,
    chords: [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]],
    bass: [48, 45, 41, 43], arp: [0, 1, 2, 3, 2, 1, 2, 1],
  },
  action: {
    bpm: 150, oct: 12, vol: 0.018, hat: true,
    chords: [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]],
    bass: [45, 41, 36, 43], arp: [0, 2, 1, 3, 0, 2, 3, 2],
  },
};

const Music = {
  track: null, step: 0, next: 0,
  play(name) {
    const tr = TRACKS[name];
    if (this.track === tr) return;
    this.track = tr; this.step = 0; this.next = 0;
  },
  stop() { this.track = null; },
  update() {
    const s = Sound;
    if (!s.ac || !this.track || s.muted) return;
    const tr = this.track, now = s.ac.currentTime, len = 60 / tr.bpm / 2;
    if (this.next < now) this.next = now + 0.05;
    while (this.next < now + 0.12) {
      const bar = Math.floor(this.step / 8) % 4, i = this.step % 8;
      s.toneAt(this.next, midi(tr.chords[bar][tr.arp[i]] + tr.oct), len * 0.8, 'square', tr.vol);
      if (i % 4 === 0) s.toneAt(this.next, midi(tr.bass[bar]), len * 3.5, 'triangle', 0.09);
      if (tr.hat && i % 2 === 1) s.noiseAt(this.next, 0.03, 0.02);
      this.step++;
      this.next += len;
    }
  },
};

/* ---------- particles, floating text, screen shake ---------- */
const FX = {
  parts: [], texts: [], shake: 0,
  burst(x, y, color, n = 10, speed = 70) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(0.3, 1) * speed;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.8), color, s: Math.random() < 0.3 ? 2 : 1 });
    }
  },
  float(x, y, str, color = PAL.white) { this.texts.push({ x, y, str, color, life: 1.1 }); },
  update(dt) {
    for (const p of this.parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 60 * dt; p.life -= dt; }
    this.parts = this.parts.filter(p => p.life > 0);
    for (const t of this.texts) { t.y -= 18 * dt; t.life -= dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    this.shake = Math.max(0, this.shake - dt * 20);
  },
  draw() {
    for (const p of this.parts) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s); }
    for (const t of this.texts) {
      if (t.life < 0.25 && Math.floor(t.life * 20) % 2) continue;
      const w = textWidth(t.str);
      drawText(t.str, clamp(t.x - w / 2, 2, W - w - 2), t.y, t.color, { shadow: '#000' });
    }
  },
  clear() { this.parts = []; this.texts = []; this.shake = 0; },
};

/* ---------- drawing helpers ---------- */
function rect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function panel(x, y, w, h, fill = PAL.navy, border = PAL.cyan) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = border;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
}

function bar(x, y, w, h, frac, color, bg = PAL.dark) {
  rect(x, y, w, h, bg);
  rect(x, y, Math.round(w * clamp(frac, 0, 1)), h, color);
}

function hudBar(h = 12) {
  rect(0, 0, W, h, 'rgba(5,10,28,0.9)');
  rect(0, h, W, 1, PAL.blue);
}

function makeCanvas(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  fn(g, c);
  return c;
}

function pixLine(g, x0, y0, x1, y1, color) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = color;
  for (;;) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

function pixCircle(g, cx, cy, r, color) {
  g.fillStyle = color;
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(cx - half, cy + dy, half * 2 + 1, 1);
  }
}

/* ---------- menu ---------- */
class Menu {
  constructor(items, y, gap = 12) { this.items = items; this.y = y; this.gap = gap; this.i = 0; }
  rectOf(k) {
    const w = textWidth(this.items[k].label) + 20;
    return { x: W / 2 - w / 2, y: this.y + k * this.gap - 2, w, h: 11 };
  }
  update() {
    const n = this.items.length, m = Input.mouse;
    if (Input.hit('up')) { this.i = (this.i + n - 1) % n; Sound.play('blip'); }
    if (Input.hit('down')) { this.i = (this.i + 1) % n; Sound.play('blip'); }
    for (let k = 0; k < n; k++) {
      const r = this.rectOf(k);
      if (!pointIn(m, r.x, r.y, r.w, r.h)) continue;
      if (m.moved) this.i = k;
      if (m.clicked) { this.i = k; Sound.play('select'); this.items[k].fn(); return; }
    }
    if (Input.hit('action')) { Sound.play('select'); this.items[this.i].fn(); }
  }
  draw(color = PAL.white, sel = PAL.yellow) {
    this.items.forEach((it, k) => {
      const on = k === this.i;
      if (on) { const r = this.rectOf(k); panel(r.x, r.y, r.w, r.h, 'rgba(250,204,21,0.15)', sel); }
      drawText(it.label, W / 2, this.y + k * this.gap, on ? sel : color, { align: 'center', shadow: '#000' });
    });
  }
}

/* ---------- save data (localStorage) ---------- */
const Save = {
  key: 'convergeit-quest-2026',
  data: { badges: {}, won: [], bonus: false, player: null },
  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.key));
      if (d) {
        this.data = {
          badges: d.badges || {}, won: Array.isArray(d.won) ? d.won : [], bonus: !!d.bonus,
          player: d.player && typeof d.player.id === 'string' ? { id: d.player.id } : null,
        };
      }
    } catch (e) { /* storage unavailable: play without saving */ }
  },
  store() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },
  /* Starts a fresh run for a new player. Permanent records (js/records.js) are kept. */
  resetBadges() { this.data.badges = {}; this.data.won = []; this.data.bonus = false; this.data.player = null; this.store(); },
};

/* Mini-games register themselves here, in booth order. */
const GAMES = [];
const allBadges = () => GAMES.every(g => Save.data.badges[g.id]);
/* All 5 badges earn one wheel spin; following TechIS (staff-verified) earns one more. */
const spinsLeft = () => allBadges() ? Math.max(0, 1 + (Save.data.bonus ? 1 : 0) - Save.data.won.length) : 0;

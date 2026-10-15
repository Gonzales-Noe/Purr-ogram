'use strict';

/* ---------- Tech Innovators Society logo (pixelated from org-assets/TechIS Logo.png) ---------- */
const LOGO_PAL = { r: '#f0486e', b: '#128ab2', g: '#08d69e', y: '#fdd068' };
const LOGO = makeSprite([
  '..........r...........',
  '.........rr...........',
  '........rrr...........',
  '........rrr...........',
  '.......rrr..bbb.......',
  '......rrr...bbbb......',
  '.....rrr....bbb.......',
  '....rrrr.gg......r....',
  '....brr..ggg.....rrr..',
  '...bbr...gggg....rrrr.',
  '...bbbb...ggggg..rrrrr',
  '.y..bbbb...ggggg...rrr',
  'yyy..bbbb....gggg..rr.',
  'yyyy..bbbb....gggg..r.',
  '.yyyy..bbbb....ggg....',
  '..yyy...bbbb....ggg...',
  '...yy.....bbb..yyg....',
  '....y..ggg.bb.yyy.....',
  '.......ggg...yyyy.....',
  '.......ggg...yyy......',
  '........gg..yyy.......',
  '...........yyy........',
  '...........yyy........',
  '...........yy.........',
  '...........y..........',
], LOGO_PAL);

const LOGO_MINI = makeSprite([
  '....rr.....',
  '...rr.bb...',
  '..rr..bb...',
  '..r..g..rr.',
  '..b..gg..rr',
  'yybbb.gg..r',
  'yy..bb.gg..',
  '.yy..b..y..',
  '...gg..y...',
  '....g.yy...',
  '.....yy....',
], LOGO_PAL);

const PAW = makeSprite([
  '.p...p.',
  'ppp.ppp',
  '.p...p.',
  '..ppp..',
  '.ppppp.',
  '.ppppp.',
  '..ppp..',
], { p: '#f9a8d4' });

const MINI_HEART = makeSprite(['.p.p.', 'ppppp', '.ppp.', '..p..'], { p: '#f472b6' });

/* ---------- TEKIS, the TechIS robot-cat mascot (36x30, drawn procedurally so it can animate) ---------- */
const TK = {
  black: '#111318', shine: '#2c3140', pink: '#ff3fa4', screen: '#0b2e24', glow: '#145c43',
  eye: '#38bdf8', pupil: '#1e3a8a', white: '#f8fafc', yellow: '#facc15', peach: '#fcd5b5',
  lip: '#f43f5e', mouth: '#4c0519', tongue: '#f9a8d4', base: '#1d4ed8', baseHi: '#3b82f6',
  baseDark: '#1e3a8a', underglow: '#fdba74',
};

const TEKIS_EYES = {
  open: ['..ccc..', '.cnnnc.', 'cnnnwwc', 'cnnnnwc', 'ccccccc'],
  blink: ['.......', '.......', '.......', 'ccccccc', '.......'],
  happy: ['.......', '..ccc..', '.c...c.', 'c.....c', '.......'],
  sad: ['.......', '.......', '.ccccc.', 'c.....c', '.......'],
};
const TEKIS_MOUTHS = {
  open: ['.RRRRRRR.', 'RmyymyymR', 'RmmmmmmmR', 'RmtttttmR', '.RRRRRRR.'],
  half: ['.........', '.RRRRRRR.', 'RmyymyymR', '.RRtttRR.', '.........'],
  smile: ['.........', 'R.......R', '.RRRRRRR.', '.........', '.........'],
  sad: ['.........', '.RRRRRRR.', 'R.......R', '.........', '.........'],
};
const TINY_FONT = {
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  E: ['###', '#..', '##.', '#..', '###'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
};

function fillTri(g, a, b, c, color) {
  const area = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  g.fillStyle = color;
  for (let y = Math.min(a[1], b[1], c[1]); y <= Math.max(a[1], b[1], c[1]); y++) {
    for (let x = Math.min(a[0], b[0], c[0]); x <= Math.max(a[0], b[0], c[0]); x++) {
      const p = [x + 0.5, y + 0.5], w0 = area(b, c, p), w1 = area(c, a, p), w2 = area(a, b, p);
      if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) g.fillRect(x, y, 1, 1);
    }
  }
}

function stamp(g, rows, x, y, pal) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const c = pal[row[dx]];
      if (c) { g.fillStyle = c; g.fillRect(x + dx, y + dy, 1, 1); }
    }
  });
}

const tekisCache = new Map();
function tekisFrame(eyes, mouth, ear) {
  const key = `${eyes}|${mouth}|${ear}`;
  if (tekisCache.has(key)) return tekisCache.get(key);
  const c = makeCanvas(36, 30, g => {
    const R = (x, y, w, h, col) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const e = ear ? 1 : 0;
    fillTri(g, [0, e], [13, 6], [6, 19], TK.black);
    fillTri(g, [35, e], [22, 6], [29, 19], TK.black);
    fillTri(g, [2, 2 + e], [10, 7], [6, 15], '#4a1238');
    fillTri(g, [33, 2 + e], [25, 7], [29, 15], '#4a1238');
    pixLine(g, 0, e, 6, 18, TK.pink);
    pixLine(g, 35, e, 29, 18, TK.pink);
    pixLine(g, 4, 6 + e, 8, 8, TK.pink);
    pixLine(g, 31, 6 + e, 27, 8, TK.pink);
    pixLine(g, 4, 10 + e, 7, 12, TK.pink);
    pixLine(g, 31, 10 + e, 28, 12, TK.pink);
    R(2, 2 + e, 1, 1, '#fda4af');
    R(33, 2 + e, 1, 1, '#fda4af');

    R(7, 5, 22, 18, TK.black);
    R(6, 6, 24, 16, TK.black);
    R(9, 6, 18, 1, TK.shine);
    R(9, 8, 18, 13, TK.screen);
    R(8, 9, 20, 11, TK.screen);
    R(10, 14, 6, 2, TK.glow);
    R(20, 14, 6, 2, TK.glow);
    R(12, 8, 2, 1, TK.peach);
    R(22, 8, 2, 1, TK.yellow);

    const eyePal = { c: TK.eye, n: TK.pupil, w: TK.white };
    stamp(g, TEKIS_EYES[eyes], 10, 9, eyePal);
    stamp(g, TEKIS_EYES[eyes], 19, 9, eyePal);
    R(9, 15, 2, 1, TK.yellow); R(9, 16, 1, 1, TK.yellow);
    R(25, 15, 2, 1, TK.yellow); R(26, 16, 1, 1, TK.yellow);
    stamp(g, TEKIS_MOUTHS[mouth], 13, 15, { R: TK.lip, m: TK.mouth, y: TK.yellow, t: TK.tongue });

    R(5, 22, 26, 7, TK.base);
    R(5, 22, 26, 1, TK.baseHi);
    R(6, 28, 24, 1, TK.baseDark);
    R(7, 29, 22, 1, TK.underglow);
    R(6, 24, 1, 1, LOGO_PAL.r); R(7, 24, 1, 1, LOGO_PAL.b);
    R(6, 25, 1, 1, LOGO_PAL.y); R(7, 25, 1, 1, LOGO_PAL.g);
    const letterColors = ['#f9a8d4', '#fde68a', '#86efac', '#67e8f9', '#c4b5fd'];
    'TEKIS'.split('').forEach((ch, i) => stamp(g, TINY_FONT[ch], 10 + i * 4, 23, { '#': letterColors[i] }));
  });
  tekisCache.set(key, c);
  return c;
}

/* mood: 'normal' | 'excited' | 'sad'. Returns the bobbed top y so callers can anchor bubbles. */
function drawTekis(x, y, t, { scale = 1, talking = false, mood = 'normal' } = {}) {
  const blink = t % 3.3 < 0.13;
  const ear = t % 2.1 < 0.18 || (mood === 'excited' && Math.floor(t * 6) % 2 === 0);
  let eyes = blink ? 'blink' : 'open';
  if (mood === 'excited') eyes = 'happy';
  else if (mood === 'sad' && !blink) eyes = 'sad';
  let mouth = mood === 'sad' ? 'sad' : mood === 'excited' ? 'open' : 'smile';
  if (talking) mouth = Math.floor(t * 9) % 2 ? 'open' : 'half';
  const hop = mood === 'excited' ? Math.abs(Math.sin(t * 7)) * 4 : 0;
  const by = Math.round(y + Math.sin(t * 3) * 1.5 - hop) ;
  ctx.drawImage(tekisFrame(eyes, mouth, ear), Math.round(x), by, 36 * scale, 30 * scale);
  return by;
}

/* ---------- speech bubble + typewriter dialogue ---------- */
function speechBubble(x, y, w, h, tail) {
  panel(x, y, w, h, '#fff7fb', '#f472b6');
  if (!tail) return;
  const { side, at } = tail;
  ctx.fillStyle = '#f472b6';
  if (side === 'left') {
    for (let i = 0; i < 4; i++) ctx.fillRect(x - 4 + i, at - (3 - i), 1, (3 - i) * 2 + 1);
  } else if (side === 'bottom') {
    for (let i = 0; i < 4; i++) ctx.fillRect(at - (3 - i), y + h - 1 + 4 - i, (3 - i) * 2 + 1, 1);
  }
}

class Dialogue {
  constructor(pages, width) {
    this.raw = pages;
    this.pages = pages.map(p => wrapText(p, width));
    this.i = 0;
    this.chars = 0;
    this.spoken = -1;
  }
  get page() { return this.pages[this.i]; }
  get total() { return this.page.join('').length; }
  get typing() { return this.chars < this.total; }
  get last() { return this.i === this.pages.length - 1; }
  update(dt) {
    if (this.spoken !== this.i) { this.spoken = this.i; Voice.say(this.raw[this.i]); }
    if (!this.typing) return;
    const before = Math.floor(this.chars);
    this.chars = Math.min(this.total, this.chars + dt * 48);
    const now = Math.floor(this.chars);
    if (now !== before && now % 6 === 0) Sound.play('talk');
  }
  /* Returns true once the reader moves past the final page. */
  advance() {
    if (this.typing) { this.chars = this.total; return false; }
    if (!this.last) { this.i++; this.chars = 0; return false; }
    return true;
  }
  draw(x, y, color = '#3b0764', lineH = 9) {
    let left = Math.floor(this.chars);
    this.page.forEach((line, k) => {
      if (left <= 0) return;
      drawText(line.slice(0, left), x, y + k * lineH, color);
      left -= line.length;
    });
  }
}

function drawQR(x, y, scale = 1) {
  const q = QR.canvas(ORG.qrUrl);
  ctx.drawImage(q, Math.round(x), Math.round(y), q.width * scale, q.height * scale);
  return q.width * scale;
}

'use strict';

let title, hub;

const Game = {
  scene: null,
  paused: false,
  go(scene) {
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = scene;
    this.paused = false;
    FX.clear();
    Voice.stop();
    if (scene.enter) scene.enter();
  },
};

function tinyBubble(text, x, y, tailAt) {
  const w = textWidth(text) + 6;
  speechBubble(x, y, w, 11, tailAt === undefined ? null : { side: 'bottom', at: tailAt });
  drawText(text, x + 3, y + 2, '#be185d');
}

/* ================= TITLE ================= */
class TitleScene {
  constructor() {
    this.nodes = Array.from({ length: 26 }, () => ({ x: rand(0, W), y: rand(0, H), vx: rand(-8, 8), vy: rand(-8, 8) }));
  }

  enter() {
    this.t = 0; this.showScores = false;
    Music.play('calm');
    this.menu = new Menu([
      { label: 'START', fn: () => Game.go(Records.me ? new SplashScene() : new NameScene()) },
      { label: 'NEW PLAYER', fn: () => Game.go(new NameScene()) },
      { label: 'HIGH SCORES', fn: () => { this.showScores = true; Records.refreshBoard(); } },
    ], 106, 15);
  }

  update(dt) {
    this.t += dt;
    for (const n of this.nodes) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
    if (this.showScores) {
      if (Input.hit('action') || Input.hit('back') || Input.mouse.clicked) { this.showScores = false; Sound.play('blip'); }
      return;
    }
    this.menu.update();
  }

  draw() {
    rect(0, 0, W, H, '#040814');
    const ns = this.nodes;
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        if (Math.hypot(ns[i].x - ns[j].x, ns[i].y - ns[j].y) < 55) pixLine(ctx, ns[i].x, ns[i].y, ns[j].x, ns[j].y, '#0c1633');
      }
    }
    ctx.globalAlpha = 0.45;
    ns.forEach((n, i) => rect(n.x - 1, n.y - 1, 2, 2, [PAL.cyan, PAL.green, PAL.sky][i % 3]));
    ctx.globalAlpha = 1;

    drawText('CONVERGEIT', W / 2, 18, '#ffffff', { scale: 4, align: 'center', shadow: '#2563eb' });
    drawText('CONFERENCE 2026', W / 2, 54, '#facc15', { scale: 2, align: 'center', shadow: '#78350f' });
    drawText('CONVERGING TECHNOLOGIES FOR A RESPONSIBLE,', W / 2, 75, '#cbd5e1', { align: 'center' });
    drawText('SECURE, AND SUSTAINABLE DIGITAL FUTURE', W / 2, 84, '#cbd5e1', { align: 'center' });
    rect(W / 2 - 24, 96, 48, 1, '#1e40af');

    this.menu.draw('#ffffff', '#facc15');

    drawText('BATANGAS INFORMATION TECHNOLOGY SOCIETY', W / 2, 158, '#f1f5f9', { align: 'center' });
    drawText('OCT 17, 2026  -  LIPA CITY', W / 2, 168, '#22d3ee', { align: 'center' });
    drawText('M: MUTE  F: FULLSCREEN', W - 4, 3, '#334155', { align: 'right' });
    if (Records.me) drawText(`PLAYER: ${Records.name}`, 4, 3, '#64748b');

    if (this.showScores) {
      rect(0, 0, W, H, 'rgba(0,0,0,0.7)');
      panel(14, 22, W - 28, 136, PAL.navy, PAL.yellow);
      drawText('HIGH SCORES', W / 2, 28, PAL.yellow, { scale: 2, align: 'center', shadow: '#000' });
      const cols = GAMES.map((g, i) => ({ g, x: 128 + i * 38 }));
      drawText('PLAYER', 34, 58, '#64748b');
      cols.forEach(({ g, x }) => {
        ctx.drawImage(ICONS[g.id], x - Math.floor(ICONS[g.id].width / 2), 46);
        drawText(g.short, x, 58, g.color, { align: 'center' });
      });
      rect(22, 67, W - 44, 1, '#1e3a8a');
      const rows = Records.leaders(8);
      const tops = GAMES.map(g => Math.max(0, ...rows.map(r => r.scores[g.id] || 0)));
      rows.forEach((r, k) => {
        const y = 71 + k * 9;
        drawText(`${k + 1}`, 28, y, k < 3 ? PAL.yellow : '#64748b', { align: 'right' });
        drawText(r.name, 34, y, PAL.white);
        cols.forEach(({ g, x }, i) => {
          const s = r.scores[g.id] || 0;
          drawText(s ? String(s) : '-', x, y, s && s === tops[i] ? PAL.yellow : s ? PAL.gray : '#334155', { align: 'center' });
        });
      });
      if (!rows.length) drawText('NO SCORES YET - BE THE FIRST!', W / 2, 100, PAL.gray, { align: 'center' });
      drawText('SPACE: CLOSE', W / 2, 146, '#64748b', { align: 'center' });
    }
  }
}

/* ================= PLAYER NAME ================= */
const NAME_KEYS = (() => {
  const keys = [], kw = 18, gap = 2;
  ['ABCDEFGHIJKLM', 'NOPQRSTUVWXYZ', '0123456789'].forEach((row, r) => {
    const x0 = W / 2 - (row.length * (kw + gap) - gap) / 2;
    [...row].forEach((c, i) => keys.push({ k: c, label: c, x: x0 + i * (kw + gap), y: 98 + r * 14, w: kw, h: 12 }));
  });
  let x = W / 2 - 79;
  for (const [label, k, w] of [['SPACE', ' ', 78], ['DEL', 'del', 38], ['OK', 'ok', 38]]) {
    keys.push({ k, label, x, y: 140, w, h: 12 });
    x += w + 2;
  }
  return keys;
})();

class NameScene {
  enter() {
    this.t = 0; this.name = ''; this.msg = '';
    Input.textMode = true;
    Music.play('calm');
    Voice.say(TEKIS_SAYS.askName);
  }
  exit() { Input.textMode = false; }
  update(dt) {
    this.t += dt;
    Input.typed.forEach(k => this.key(k));
    const m = Input.mouse;
    if (m.clicked) {
      const key = NAME_KEYS.find(b => pointIn(m, b.x, b.y, b.w, b.h));
      if (key) this.key(key.k);
    }
    if (Game.scene !== this) return;
    if (Input.hit('action')) this.key('ok');
    else if (Input.hit('back')) Game.go(title);
  }
  key(k) {
    if (Game.scene !== this) return;
    if (k === 'ok') { this.done(); return; }
    if (k === 'del') {
      if (!this.name) return;
      this.name = this.name.slice(0, -1);
    } else if (this.name.length >= NAME_MAX || (k === ' ' && (!this.name || this.name.endsWith(' ')))) return;
    else this.name += k;
    this.msg = '';
    Sound.play('blip');
  }
  done() {
    const name = this.name.trim();
    if (!name) { this.msg = 'TYPE YOUR NAME FIRST!'; Sound.play('deny'); return; }
    Save.resetBadges();
    Records.newPlayer(name);
    hub.reset();
    Sound.play('select');
    Game.go(new SplashScene());
  }
  draw() {
    rect(0, 0, W, H, PAL.bg);
    drawText("WHAT'S YOUR NAME?", W / 2, 12, PAL.white, { scale: 2, align: 'center', shadow: '#000' });
    drawText('YOUR SCORES AND PRIZES ARE SAVED UNDER THIS NAME', W / 2, 32, PAL.gray, { align: 'center' });

    drawTekis(40, 48, this.t, { talking: Voice.speaking, mood: this.name ? 'excited' : 'normal' });
    panel(92, 52, 176, 24, PAL.navy, PAL.yellow);
    const cursor = this.name.length < NAME_MAX && Math.floor(this.t * 2) % 2 ? '_' : '';
    drawText(this.name + cursor, 102, 58, PAL.white, { scale: 2 });
    drawText(this.msg || `LETTERS AND NUMBERS, UP TO ${NAME_MAX}`, 180, 82, this.msg ? PAL.red : '#64748b', { align: 'center' });

    const m = Input.mouse;
    for (const b of NAME_KEYS) {
      const hover = pointIn(m, b.x, b.y, b.w, b.h);
      const ok = b.k === 'ok';
      panel(b.x, b.y, b.w, b.h, hover ? '#1e3a8a' : ok ? '#14532d' : PAL.navy, ok ? PAL.green : hover ? PAL.yellow : '#334155');
      drawText(b.label, b.x + b.w / 2, b.y + 3, ok ? PAL.green : PAL.white, { align: 'center' });
    }
    drawText('TYPE OR TAP  -  ENTER: OK  -  ESC: BACK', W / 2, 162, '#64748b', { align: 'center' });
  }
}

/* ================= PURR-OGRAM TITLE POP (after START) ================= */
const SPLASH_WORD = 'PURR-OGRAM';
const SPLASH_POP = 1.25;
const easeOutBack = p => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };

class SplashScene {
  enter() {
    this.t = 0; this.popped = 0; this.boomed = false;
    Music.play('calm');
  }
  update(dt) {
    this.t += dt;
    const shown = clamp(Math.floor((this.t - 0.25) / 0.07) + 1, 0, SPLASH_WORD.length);
    while (this.popped < shown) { this.popped++; Sound.play('blip'); }
    if (!this.boomed && this.t > SPLASH_POP) {
      this.boomed = true;
      Sound.play('power'); Sound.play('meow');
      for (let k = 0; k < 6; k++) FX.burst(rand(50, 270), rand(40, 90), choice([PAL.yellow, PAL.cyan, PAL.pink, PAL.green]), 14, 90);
      Voice.say(TEKIS_SAYS.splash);
    }
    if (this.t > 0.5 && (Input.hit('action') || Input.mouse.clicked)) { Sound.play('select'); Game.go(hub); return; }
    if (this.t > 4.5 && !Voice.speaking) Game.go(hub);
  }
  draw() {
    const t = this.t, since = t - SPLASH_POP;
    rect(0, 0, W, H, PAL.bg);

    if (since > 0 && since < 1.2) {
      ctx.globalAlpha = 1 - since / 1.2;
      ctx.strokeStyle = PAL.sky; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(W / 2, 62, 20 + since * 230, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const cw = 24, left = W / 2 - (SPLASH_WORD.length * cw - 4) / 2, cy = 62;
    const pulse = since > 0 && since < 0.4 ? 1 + Math.sin(since / 0.4 * Math.PI) * 0.14 : 1;
    [...SPLASH_WORD].forEach((ch, i) => {
      const p = clamp((t - 0.25 - i * 0.07) / 0.35, 0, 1);
      if (p <= 0) return;
      const s = easeOutBack(p) * pulse, w = 20 * s, h = 28 * s;
      const x = W / 2 + (left + i * cw + 10 - W / 2) * pulse;
      const y = cy + (since > 0.5 ? Math.round(Math.sin(t * 4 + i * 0.6) * 1.5) : 0);
      ctx.drawImage(renderText(ch, '#1e3a8a', 4), x - w / 2 + 2 * s, y - h / 2 + 2 * s, w, h);
      ctx.drawImage(renderText(ch, PAL.white, 4), x - w / 2, y - h / 2, w, h);
    });
    if (since > 0 && since < 0.25) rect(0, 0, W, H, `rgba(255,255,255,${0.45 * (1 - since / 0.25)})`);

    if (since > 0.25) {
      ctx.globalAlpha = clamp((since - 0.25) / 0.3, 0, 1);
      drawText('THE CONVERGEIT QUEST', W / 2, 90, PAL.yellow, { align: 'center', shadow: '#78350f' });
      if (Records.name) drawText(`WELCOME, ${Records.name}!`, W / 2, 104, PAL.cyan, { align: 'center' });
      ctx.globalAlpha = 1;
    }
    if (since > 0.35) {
      const rise = clamp((since - 0.35) / 0.35, 0, 1);
      drawTekis(W / 2 - 18, Math.round(H - easeOutBack(rise) * 52), t, { talking: Voice.speaking, mood: 'excited' });
    }
    if (since > 1 && Math.floor(t * 2) % 2) drawText('SPACE: CONTINUE', W - 8, 168, '#64748b', { align: 'right' });
  }
}

/* ================= MEET TEKIS / ORG PROMO ================= */
const ORG_PAGES = [
  `HI HI! I'M ${ORG.mascot}, THE ROBO-CAT MASCOT OF ${ORG.name}! NYA~ ♥`,
  `COME VISIT THE ${ORG.short} BOOTH AT CONVERGEIT 2026! IN MY GAME, EACH BOOTH IS A MINI-GAME ABOUT A TOPIC!`,
  `WIN ALL 5 BADGES TO SPIN MY PRIZE WHEEL! FOLLOW ${ORG.short} FOR A BONUS SPIN! PURR~`,
  `AND PSST... SCAN MY QR CODE TO FOLLOW ${ORG.short}! LET'S LEARN, BUILD AND INNOVATE TOGETHER! ♥`,
];

class OrgScene {
  constructor(back) { this.back = back; }
  enter() { this.t = 0; this.dlg = new Dialogue(ORG_PAGES, 27); Music.play('calm'); Sound.play('meow'); }
  update(dt) {
    this.t += dt;
    this.dlg.update(dt);
    if (Input.hit('back')) { Game.go(this.back); return; }
    if (this.t > 0.2 && (Input.hit('action') || Input.mouse.clicked) && this.dlg.advance()) Game.go(this.back);
  }
  draw() {
    rect(0, 0, W, H, '#0d0619');
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 8; i++) {
      const x = (i * 53 + this.t * 6) % (W + 10) - 8, y = (i * 37) % 160 + 8;
      ctx.drawImage(i % 2 ? PAW : MINI_HEART, Math.round(x), y);
    }
    ctx.globalAlpha = 1;
    ctx.drawImage(LOGO, 14, 8);
    drawText(ORG.name, 42, 17, PAL.white, { shadow: '#000' });
    rect(42, 27, textWidth(ORG.name), 1, '#db2777');

    speechBubble(12, 40, 176, 58, { side: 'bottom', at: 52 });
    this.dlg.draw(18, 45);
    if (!this.dlg.typing && Math.floor(this.t * 3) % 2) drawText(this.dlg.last ? 'OK!' : '>', 182, 89, '#db2777', { align: 'right' });
    drawTekis(16, 102, this.t, { scale: 2, talking: this.dlg.typing || Voice.speaking, mood: this.dlg.last && !this.dlg.typing ? 'excited' : 'normal' });
    drawText(`MEET ${ORG.mascot}, OUR ROBO-CAT MASCOT!`, 8, 168, PAL.cyan, { shadow: '#000' });

    const q = QR.canvas(ORG.qrUrl), s = q.width * 2 <= 100 ? 2 : 1, size = q.width * s;
    const qx = 246 - size / 2, qy = 86 - size / 2;
    rect(qx - 3, qy - 3, size + 6, size + 6, '#f472b6');
    drawQR(qx, qy, s);
    if (Math.floor(this.t * 2) % 2 === 0) drawText('SCAN ME!', 246, qy + size + 7, PAL.yellow, { align: 'center', shadow: '#000' });
    drawText(ORG.qrLabel, 246, qy + size + 17, PAL.white, { align: 'center' });

    drawText(this.dlg.last && !this.dlg.typing ? 'SPACE: BACK' : 'SPACE: NEXT', W - 8, 171, PAL.gray, { align: 'right' });
  }
}

/* ================= EXPO HALL (hub) ================= */
const BW = 52, BH = 30;
const BOOTHS = [
  { x: 20, y: 28, top: true }, { x: 134, y: 28, top: true }, { x: 248, y: 28, top: true },
  { x: 76, y: 138, top: false }, { x: 192, y: 138, top: false },
];
const STAGE = { x: 108, y: 80, w: 106, h: 34 };
const TEKIS_POS = { x: 175, y: 82 };
const npcTarget = side => ({ x: side ? rand(222, 292) : rand(16, 92), y: rand(70, 118) });
const NPC_LINES = [
  'HAVE YOU TRIED THE AI BOOTH?', 'PQC = POST-QUANTUM CRYPTO!', 'SAVE ENERGY, SAVE EARTH!',
  '#CONVERGEIT2026', 'EDGE AI IS SO FAST!', 'KEEP UPSKILLING!', 'COLLECT ALL 5 BADGES!',
  `FOLLOW ${ORG.short}! ♥`, `${ORG.mascot} IS SO CUTE!`, 'THINK BEFORE YOU CLICK!',
];
const TEKIS_HUB_LINES = [
  'NYA~ VISIT ALL 5 BOOTHS!', `FOLLOW ${ORG.short} = BONUS SPIN!`, '5 BADGES = PRIZE WHEEL SPIN!',
  `TALK TO ME TO FOLLOW ${ORG.short}! ♥`, 'PURR~ HAVE FUN!', 'EACH BOOTH = ONE TOPIC!',
];
const NPC_LOOKS = [
  { b: PAL.green, h: '#111827' }, { b: PAL.red, h: '#78350f' }, { b: PAL.purple, h: '#111827', s: '#c68642' },
  { b: PAL.orange, h: '#fbbf24' }, { b: PAL.teal, h: '#3b2414', s: '#8d5524' },
];

class HubScene {
  constructor() {
    this.t = 0;
    this.staff = GAMES.map(g => makePerson({ b: g.color, h: '#1f2937' }));
    this.npcs = NPC_LOOKS.map((look, i) => {
      const side = i % 2, { x, y } = npcTarget(side);
      return { spr: makePerson(look), side, x, y, tx: x, ty: y, wait: rand(0, 3), walk: 0, say: '', sayT: 0 };
    });
    this.sayTimer = 2;
    this.tekisSay = TEKIS_HUB_LINES[0]; this.tekisSayT = 4; this.tekisTimer = 7;
    this.bg = makeCanvas(W, H, g => {
      for (let j = 0; j * 16 < H; j++) {
        for (let i = 0; i * 16 < W; i++) {
          g.fillStyle = (i + j) % 2 ? '#0a1230' : '#080f28';
          g.fillRect(i * 16, 14 + j * 16, 16, 16);
        }
      }
      g.fillStyle = '#050a1c'; g.fillRect(0, 13, W, 14);
      for (let x = 4; x < W; x += 24) {
        if (x > 60 && x < 250) continue;
        g.fillStyle = '#1e3a8a';
        g.fillRect(x, 17, 12, 1); g.fillRect(x + 12, 17, 1, 5); g.fillRect(x + 12, 22, 6, 1);
        g.fillStyle = PAL.cyan; g.fillRect(x + 18, 21, 2, 2);
      }
      g.fillStyle = '#3b0d3a'; g.fillRect(72, 14, 176, 13);
      g.fillStyle = '#f472b6'; g.fillRect(72, 14, 176, 1); g.fillRect(72, 26, 176, 1);
      g.drawImage(LOGO_MINI, 76, 15);
      drawText(ORG.name, 166, 17, '#fbcfe8', { align: 'center', ctx: g });
      g.fillStyle = PAL.blue; g.fillRect(0, 27, W, 1);

      g.fillStyle = '#1d4ed8'; g.fillRect(STAGE.x, STAGE.y, STAGE.w, STAGE.h);
      g.fillStyle = '#1e3a8a'; g.fillRect(STAGE.x + 2, STAGE.y + 2, STAGE.w - 4, STAGE.h - 4);
      drawText('CONVERGEIT', 140, STAGE.y + 8, PAL.white, { align: 'center', ctx: g });
      drawText('2026', 140, STAGE.y + 17, PAL.green, { scale: 2, align: 'center', ctx: g });
      for (const [px, py] of [[4, 30], [308, 30], [4, 150], [308, 150]]) g.drawImage(PLANT, px, py);
    });
    this.reset();
  }

  reset() { this.px = 155; this.py = 118; this.walk = 0; this.near = -1; this.onStage = false; }

  feet(x = this.px, y = this.py) { return { x: x + 1, y: y + 10, w: 8, h: 4 }; }

  blocked(x, y) {
    if (x < 4 || x > W - 14 || y < 16 || y > 156) return true;
    const f = this.feet(x, y);
    return BOOTHS.some(b => overlap(f, { x: b.x, y: b.y, w: BW, h: BH }));
  }

  zone(b) { return b.top ? { x: b.x, y: b.y + BH, w: BW, h: 14 } : { x: b.x, y: b.y - 14, w: BW, h: 14 }; }

  enterBooth(i) { Sound.play('select'); Game.go(new IntroScene(GAMES[i])); }

  enter() { Music.play('calm'); }

  update(dt) {
    this.t += dt;
    if (Input.hit('back')) { Game.go(title); return; }

    let dx = (Input.isDown('right') ? 1 : 0) - (Input.isDown('left') ? 1 : 0);
    let dy = (Input.isDown('down') ? 1 : 0) - (Input.isDown('up') ? 1 : 0);
    const m = Input.mouse;
    if (!dx && !dy && m.down) {
      const tx = m.x - 5 - this.px, ty = m.y - 12 - this.py;
      if (Math.hypot(tx, ty) > 3) { dx = tx; dy = ty; }
    }
    const len = Math.hypot(dx, dy);
    if (len) {
      const sp = 75 * dt / len;
      if (!this.blocked(this.px + dx * sp, this.py)) this.px += dx * sp;
      if (!this.blocked(this.px, this.py + dy * sp)) this.py += dy * sp;
      this.walk += dt;
    } else this.walk = 0;

    const f = this.feet();
    this.near = BOOTHS.findIndex(b => overlap(f, this.zone(b)));
    this.onStage = overlap(f, STAGE);

    if (m.clicked) {
      const i = BOOTHS.findIndex(b => pointIn(m, b.x, b.y, BW, BH));
      if (i >= 0) { this.enterBooth(i); return; }
      if (pointIn(m, TEKIS_POS.x, TEKIS_POS.y, 36, 30)) { Game.go(new OrgScene(hub)); return; }
    }
    if (Input.hit('action')) {
      if (this.near >= 0) { this.enterBooth(this.near); return; }
      if (this.onStage) { Game.go(allBadges() ? new WheelScene() : new OrgScene(hub)); return; }
    }
    if (Input.hit('wheel') && allBadges()) { Game.go(new WheelScene()); return; }
    if (Input.hit('qr')) { Game.go(new OrgScene(hub)); return; }

    for (const n of this.npcs) {
      if (n.sayT > 0) n.sayT -= dt;
      if (n.wait > 0) { n.wait -= dt; n.walk = 0; continue; }
      const ddx = n.tx - n.x, ddy = n.ty - n.y, d = Math.hypot(ddx, ddy);
      if (d < 1) { const tgt = npcTarget(n.side); n.tx = tgt.x; n.ty = tgt.y; n.wait = rand(1, 4); continue; }
      n.x += ddx / d * 22 * dt; n.y += ddy / d * 22 * dt; n.walk += dt;
    }
    this.sayTimer -= dt;
    if (this.sayTimer <= 0) {
      this.sayTimer = rand(3, 6);
      const n = choice(this.npcs);
      n.say = choice(NPC_LINES); n.sayT = 3;
    }
    this.tekisSayT -= dt;
    this.tekisTimer -= dt;
    if (this.tekisTimer <= 0) {
      this.tekisTimer = rand(7, 10);
      this.tekisSay = choice(TEKIS_HUB_LINES); this.tekisSayT = 3.5;
    }
  }

  drawBooth(b, i) {
    const g = GAMES[i];
    panel(b.x, b.y, BW, 20, g.dark, g.color);
    drawText(g.short, b.x + BW / 2, b.y + 3, PAL.white, { align: 'center' });
    const staff = this.staff[i];
    ctx.drawImage(Math.floor(this.t * 2 + i) % 2 ? staff.a : staff.b, b.x + 21, b.y + 10);
    rect(b.x + 1, b.y + 19, BW - 2, 11, '#e2e8f0');
    rect(b.x + 1, b.y + 19, BW - 2, 2, g.color);
    rect(b.x + 1, b.y + 29, BW - 2, 1, '#94a3b8');
    ctx.drawImage(ICONS[g.id], b.x + 22, b.y + 21);
    if (Save.data.badges[g.id]) ctx.drawImage(STAR, b.x + BW - 9, b.y + 2);
    if (this.near === i && Math.floor(this.t * 4) % 2) {
      const c = PAL.yellow;
      rect(b.x - 2, b.y - 2, 6, 1, c); rect(b.x - 2, b.y - 2, 1, 6, c);
      rect(b.x + BW - 4, b.y - 2, 6, 1, c); rect(b.x + BW + 1, b.y - 2, 1, 6, c);
      rect(b.x - 2, b.y + BH + 1, 6, 1, c); rect(b.x - 2, b.y + BH - 4, 1, 6, c);
      rect(b.x + BW - 4, b.y + BH + 1, 6, 1, c); rect(b.x + BW + 1, b.y + BH - 4, 1, 6, c);
    }
  }

  drawInfo(i) {
    const g = GAMES[i], b = BOOTHS[i];
    const lines = wrapText(g.topic, 44);
    const h = 30 + lines.length * 9;
    const y = b.top ? 78 : 66 - lines.length * 4;
    panel(24, y, 272, h, 'rgba(7,13,36,0.94)', g.color);
    ctx.drawImage(ICONS[g.id], 30, y + 4);
    drawText(g.title, 42, y + 5, g.color);
    lines.forEach((l, k) => drawText(l, 30, y + 16 + k * 9, PAL.gray));
    const best = Records.best(g.id);
    const has = Save.data.badges[g.id];
    drawText(has ? 'BADGE EARNED!' : `BADGE AT ${g.badgeScore}`, 30, y + h - 10, has ? PAL.yellow : PAL.white);
    drawText(`BEST ${best}`, 160, y + h - 10, PAL.white);
    if (Math.floor(this.t * 3) % 2) drawText('SPACE: PLAY', 290, y + 5, PAL.yellow, { align: 'right' });
  }

  draw() {
    ctx.drawImage(this.bg, 0, 0);
    const done = allBadges();
    if (done) {
      const bob = Math.round(Math.sin(this.t * 4) * 2);
      ctx.drawImage(STAR, 133, STAGE.y - 12 + bob, 14, 14);
    }
    BOOTHS.forEach((b, i) => this.drawBooth(b, i));

    const tekisMood = this.onStage ? 'excited' : 'normal';
    let ty = TEKIS_POS.y;
    const actors = this.npcs.map(n => ({ y: n.y, draw: () => ctx.drawImage(Math.floor(n.walk * 6) % 2 ? n.spr.b : n.spr.a, Math.round(n.x), Math.round(n.y)) }));
    actors.push({ y: this.py, draw: () => ctx.drawImage(Math.floor(this.walk * 8) % 2 ? PLAYER.b : PLAYER.a, Math.round(this.px), Math.round(this.py)) });
    actors.push({ y: TEKIS_POS.y + 16, draw: () => { ty = drawTekis(TEKIS_POS.x, TEKIS_POS.y, this.t, { talking: this.tekisSayT > 0, mood: tekisMood }); } });
    actors.sort((a, b) => a.y - b.y).forEach(a => a.draw());
    if (this.near < 0) rect(this.px + 3, this.py - 5, 4, 3, Math.floor(this.t * 3) % 2 ? PAL.yellow : PAL.orange);

    for (const n of this.npcs) {
      if (n.sayT <= 0) continue;
      const w = tinyWidth(n.say) + 6;
      const x = clamp(n.x + 5 - w / 2, 2, W - w - 2);
      panel(x, n.y - 10, w, 9, PAL.white, PAL.slate);
      drawTiny(n.say, x + 3, n.y - 8, PAL.navy);
    }
    if (this.tekisSayT > 0 && this.near < 0) {
      const w = tinyWidth(this.tekisSay) + 6;
      const x = clamp(TEKIS_POS.x + 18 - w / 2, 2, W - w - 2);
      speechBubble(x, ty - 12, w, 9, { side: 'bottom', at: TEKIS_POS.x + 18 });
      drawTiny(this.tekisSay, x + 3, ty - 10, '#be185d');
    }

    if (this.near >= 0) this.drawInfo(this.near);
    else if (this.onStage) {
      const msg = !done ? `SPACE: TALK TO ${ORG.mascot} ♥`
        : spinsLeft() ? 'SPACE: SPIN THE PRIZE WHEEL!' : Save.data.bonus ? 'SPACE: SEE YOUR PRIZES ♥' : 'SPACE: GET A BONUS SPIN!';
      const w = textWidth(msg) + 12;
      panel(W / 2 - w / 2, 120, w, 13, 'rgba(7,13,36,0.94)', '#f472b6');
      drawText(msg, W / 2, 123, '#f9a8d4', { align: 'center' });
    }

    rect(0, 0, W, 13, '#02050f');
    drawText('PLAYER:', 4, 3, '#64748b');
    drawText(Records.name || '---', 48, 3, PAL.cyan);
    const count = GAMES.filter(g => Save.data.badges[g.id]).length;
    drawText(`BADGES ${count}/5`, 238, 3, PAL.white, { align: 'right' });
    GAMES.forEach((g, i) => {
      ctx.globalAlpha = Save.data.badges[g.id] ? 1 : 0.2;
      ctx.drawImage(ICONS[g.id], 246 + i * 14, 2);
      ctx.globalAlpha = 1;
    });

    rect(0, 171, W, 9, '#02050f');
    const hint = done ? 'ALL BADGES! VISIT TEKIS ON THE STAGE ♥' : 'MOVE: ARROWS/WASD  PLAY: SPACE  ESC: TITLE';
    drawText(hint, W / 2, 172, done ? PAL.yellow : PAL.gray, { align: 'center' });
  }
}

/* ================= GAME INTRO (Tekis explains the mechanics) ================= */
const SKIP_LABEL = 'TAB: SKIP >>';

class IntroScene {
  constructor(def) { this.def = def; }
  enter() { this.t = 0; this.dlg = new Dialogue(this.def.tekis, 32); Music.play('calm'); Sound.play('meow'); }
  skipRect() { const w = textWidth(SKIP_LABEL); return { x: W - 20 - w - 2, y: 156, w: w + 4, h: 11 }; }
  start() { Sound.play('select'); Game.go(new PlayScene(this.def)); }
  update(dt) {
    this.t += dt;
    this.dlg.update(dt);
    if (Input.hit('back')) { Game.go(hub); return; }
    const m = Input.mouse, s = this.skipRect();
    if (Input.hit('skip') || (m.clicked && pointIn(m, s.x, s.y, s.w, s.h))) { this.start(); return; }
    if (this.t > 0.2 && (Input.hit('action') || m.clicked) && this.dlg.advance()) this.start();
  }
  draw() {
    const d = this.def;
    rect(0, 0, W, H, PAL.bg);
    panel(8, 8, W - 16, H - 16, PAL.navy, d.color);
    ctx.drawImage(ICONS[d.id], 20, 16, 24, 24);
    drawText(d.title, 52, 15, d.color, { scale: 2, shadow: '#000' });
    wrapText(d.topic, 42).slice(0, 2).forEach((l, k) => drawText(l, 52, 32 + k * 9, PAL.gray));
    drawText(`BADGE: SCORE ${d.badgeScore}+`, 20, 52, PAL.green);
    drawText(`BEST ${Records.best(d.id)}`, W - 20, 52, PAL.white, { align: 'right' });

    drawTekis(14, 92, this.t, { scale: 2, talking: this.dlg.typing || Voice.speaking });
    speechBubble(94, 64, 210, 84, { side: 'left', at: 110 });
    this.dlg.draw(102, 70);
    this.dlg.pages.forEach((_, k) => rect(102 + k * 6, 141, 4, 2, k === this.dlg.i ? '#db2777' : '#fbcfe8'));
    if (!this.dlg.typing && Math.floor(this.t * 3) % 2) {
      drawText(this.dlg.last ? "LET'S PLAY! >" : 'NEXT >', 298, 138, '#db2777', { align: 'right' });
    }

    drawText('SPACE: NEXT   ESC: BACK', 20, 158, PAL.gray);
    drawText(SKIP_LABEL, W - 20, 158, PAL.yellow, { align: 'right' });
  }
}

/* ================= PLAYING A MINI-GAME ================= */
class PlayScene {
  constructor(def) { this.def = def; }
  enter() {
    this.game = this.def.create();
    this.paused = false; this.endT = 0;
    Music.play('action');
    this.pauseMenu = new Menu([
      { label: 'RESUME', fn: () => { this.paused = false; } },
      { label: 'RESTART', fn: () => Game.go(new PlayScene(this.def)) },
      { label: 'QUIT TO EXPO HALL', fn: () => Game.go(hub) },
    ], 88);
  }
  update(dt) {
    const g = this.game;
    if (g.over) {
      if (this.endT === 0) Music.stop();
      this.endT += dt;
      if (this.endT > 2.4 || (this.endT > 0.8 && (Input.hit('action') || Input.mouse.clicked))) Game.go(new ResultScene(this.def, g));
      return;
    }
    if (this.paused) {
      if (Input.hit('back')) { this.paused = false; Game.paused = false; return; }
      this.pauseMenu.update();
      if (Game.scene === this) Game.paused = this.paused;
      return;
    }
    if (Input.hit('back')) { this.paused = true; Game.paused = true; this.pauseMenu.i = 0; Sound.play('select'); return; }
    g.update(dt);
  }
  draw() {
    const g = this.game;
    g.draw();
    if (this.paused) {
      rect(0, 0, W, H, 'rgba(0,0,0,0.65)');
      drawText('PAUSED', W / 2, 60, PAL.white, { scale: 2, align: 'center', shadow: '#000' });
      this.pauseMenu.draw();
    } else if (g.over) {
      rect(0, 68, W, 38, 'rgba(5,10,28,0.88)');
      drawText(g.won ? 'COMPLETE!' : 'GAME OVER', W / 2, 74, g.won ? PAL.green : PAL.red, { scale: 2, align: 'center', shadow: '#000' });
      drawText(g.reason, W / 2, 93, PAL.white, { align: 'center' });
    }
  }
}

/* ================= RESULTS ================= */
const TEKIS_WIN = ['MEOW-VELOUS!', 'PURR-FECT!', 'NYA~ SO COOL!', 'YOU ROCK! ♥'];
const TEKIS_LOSE = ['YOU GOT THIS~', 'TRY AGAIN! NYA', 'SO CLOSE! >_<'];

class ResultScene {
  constructor(def, game) { this.def = def; this.score = Math.floor(game.score); this.won = game.won; }
  enter() {
    const id = this.def.id, d = Save.data;
    this.prevBest = Records.best(id);
    this.newBest = this.score > this.prevBest;
    const had = !!d.badges[id];
    this.earned = this.score >= this.def.badgeScore;
    if (this.earned) d.badges[id] = true;
    this.firstBadge = this.earned && !had;
    Save.store();
    Records.score(id, this.score, this.earned);

    this.fact = wrapText(choice(this.def.facts), 46);
    this.cheer = choice(this.earned ? TEKIS_WIN : TEKIS_LOSE);
    Voice.say(this.firstBadge && allBadges() ? TEKIS_SAYS.allBadges : this.cheer);
    this.t = 0;
    const items = [];
    if (this.firstBadge && allBadges()) items.push({ label: 'SPIN THE PRIZE WHEEL!', fn: () => Game.go(new WheelScene()) });
    items.push(
      { label: 'PLAY AGAIN', fn: () => Game.go(new PlayScene(this.def)) },
      { label: 'BACK TO EXPO HALL', fn: () => Game.go(hub) },
    );
    this.menu = new Menu(items, 132);
    Music.play('calm');
    Sound.play(this.earned ? 'win' : 'lose');
    if (this.firstBadge) for (let k = 0; k < 4; k++) FX.burst(rand(60, 260), rand(40, 70), choice([PAL.yellow, PAL.green, PAL.cyan, PAL.pink]), 16, 90);
  }
  update(dt) {
    this.t += dt;
    if (this.t > 0.6) this.menu.update();
  }
  draw() {
    const d = this.def;
    rect(0, 0, W, H, PAL.bg);
    panel(8, 6, W - 16, H - 12, PAL.navy, d.color);
    ctx.drawImage(ICONS[d.id], 16, 12);
    drawText(d.title, 28, 13, d.color);
    drawText('SCORE', W / 2, 26, PAL.gray, { align: 'center' });
    drawText(String(this.score), W / 2, 36, PAL.white, { scale: 3, align: 'center', shadow: '#000' });
    if (this.newBest && Math.floor(this.t * 4) % 2) drawText('NEW BEST!', W / 2, 60, PAL.yellow, { align: 'center' });
    else if (!this.newBest) drawText(`BEST ${this.prevBest}`, W / 2, 60, PAL.gray, { align: 'center' });

    if (this.earned) {
      ctx.drawImage(ICONS[d.id], W / 2 - 60, 69, 16, 16);
      drawText(this.firstBadge ? 'NEW BADGE EARNED!' : 'BADGE SECURED!', W / 2 + 10, 74, PAL.yellow, { align: 'center' });
    } else {
      drawText(`SCORE ${d.badgeScore} TO EARN THE BADGE - TRY AGAIN!`, W / 2, 74, PAL.orange, { align: 'center' });
    }

    drawText('DID YOU KNOW?', W / 2, 92, PAL.cyan, { align: 'center' });
    this.fact.forEach((l, k) => drawText(l, W / 2, 102 + k * 9, PAL.white, { align: 'center' }));
    this.menu.draw();

    drawTekis(16, 142, this.t, { talking: Voice.speaking, mood: this.earned ? 'excited' : 'sad' });
    tinyBubble(this.cheer, 12, 128, 30);
  }
}

/* ================= PRIZE WHEEL ================= */
const TAU = Math.PI * 2;
const normAng = a => ((a % TAU) + TAU) % TAU;
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const WHEEL_COLORS = ['#f472b6', '#22d3ee', '#fdd068', '#34d399', '#a78bfa', '#fb923c', '#60a5fa', '#f87171'];
const WHEEL = { cx: 86, cy: 102, r: 56 };
const WHEEL_RIM = hexRgb('#3b0d3a'), WHEEL_LINE = hexRgb('#ffffff'), WHEEL_HUB = hexRgb('#fff7fb');

/* Prizes come from server.py (/admin) when available, else from PRIZES in config.js. */
const PrizeStore = {
  list: PRIZES,
  online: location.protocol.startsWith('http'),
  active() { return this.list.filter(p => p.weight > 0); },
  refresh() {
    if (!this.online) return Promise.resolve();
    return fetch('/api/prizes', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && Array.isArray(d.prizes) && d.prizes.some(p => p.weight > 0)) this.list = d.prizes; })
      .catch(() => {});
  },
  checkPin(pin) {
    const local = () => pin === String(ORG.staffPin);
    if (!this.online) return Promise.resolve(local());
    return fetch('/api/verify-pin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pin }) })
      .then(r => (r.status === 404 || r.status === 501 ? local() : r.json().then(d => !!d.ok)))
      .catch(local);
  },
};

const PIN_KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];
const PAD = { x: 224, y: 80, w: 24, h: 15, gap: 3 };
const padRect = i => ({ x: PAD.x + (i % 3) * (PAD.w + PAD.gap), y: PAD.y + Math.floor(i / 3) * (PAD.h + PAD.gap), w: PAD.w, h: PAD.h });

class WheelScene {
  enter() {
    const size = WHEEL.r * 2 + 1;
    this.wheel = makeCanvas(size, size, g => { this.wctx = g; });
    this.pix = this.wctx.createImageData(size, size);
    this.t = 0; this.readyT = 0; this.angle = rand(0, TAU); this.wobble = 0; this.confT = 0;
    this.pin = ''; this.pinMsg = ''; this.pinShake = 0; this.checking = false;
    this.justWon = null;
    this.state = spinsLeft() ? 'ready' : 'result';
    this.resultT = 1;
    this.buildSlices();
    PrizeStore.refresh().then(() => { if (this.state !== 'spinning') this.buildSlices(); });
    Music.play('calm'); Sound.play('meow');
    Voice.say(this.state === 'ready' ? TEKIS_SAYS.wheelHello : TEKIS_SAYS.wheelSummary);
  }
  buildSlices() {
    const prizes = PrizeStore.active(), total = prizes.reduce((s, p) => s + p.weight, 0);
    let acc = 0;
    this.slices = prizes.map((p, i) => {
      const color = WHEEL_COLORS[i % WHEEL_COLORS.length], from = acc / total * TAU;
      acc += p.weight;
      const rgb = hexRgb(color);
      return { label: p.label, weight: p.weight, color, rgb, shade: rgb.map(v => Math.round(v * 0.72)), from, to: acc / total * TAU };
    });
    this.lastSlice = this.pointerSlice();
  }
  sliceAt(f) { return Math.max(0, this.slices.findIndex(s => f < s.to)); }
  pointerSlice() { return this.sliceAt(normAng(-this.angle)); }
  spin() {
    let r = rand(0, this.slices.reduce((s, p) => s + p.weight, 0)), k = 0;
    while (k < this.slices.length - 1 && (r -= this.slices[k].weight) > 0) k++;
    const s = this.slices[k], pad = Math.min(0.12, (s.to - s.from) * 0.2);
    const f = rand(s.from + pad, s.to - pad);
    this.from = this.angle;
    this.to = this.angle + TAU * randi(5, 7) + normAng(-f - this.angle);
    this.spinT = 0; this.spinDur = 4.8; this.pick = k; this.state = 'spinning';
    Sound.play('power');
    Voice.say(TEKIS_SAYS.spinning);
  }
  next() {
    if (spinsLeft()) { this.state = 'ready'; this.readyT = 0; this.justWon = null; Voice.say(TEKIS_SAYS.spinAgain); }
    else if (!Save.data.bonus) {
      this.state = 'follow'; this.pin = ''; this.pinMsg = '';
      Voice.say(TEKIS_SAYS.bonusAsk);
    }
    else Game.go(hub);
  }
  pinKey(k) {
    if (this.checking) return;
    if (k === 'ok') { this.submitPin(); return; }
    if (k === 'del') this.pin = this.pin.slice(0, -1);
    else if (this.pin.length < 8) this.pin += k;
    this.pinMsg = '';
    Sound.play('blip');
  }
  submitPin() {
    if (!this.pin) return;
    this.checking = true;
    PrizeStore.checkPin(this.pin).then(ok => {
      this.checking = false;
      if (ok) {
        Save.data.bonus = true; Save.store();
        Records.bonus();
        Sound.play('power'); Sound.play('meow');
        FX.float(W / 2, 40, 'BONUS SPIN UNLOCKED!', PAL.yellow);
        this.state = 'ready'; this.readyT = 0; this.justWon = null;
        Voice.say(TEKIS_SAYS.bonusOk);
      } else {
        this.pin = ''; this.pinMsg = 'WRONG PIN! >_<'; this.pinShake = 0.4;
        Sound.play('deny');
        Voice.say(TEKIS_SAYS.wrongPin);
      }
    });
  }
  update(dt) {
    this.t += dt;
    this.wobble = Math.max(0, this.wobble - dt * 8);
    this.pinShake = Math.max(0, this.pinShake - dt);
    if (this.state === 'ready') {
      this.readyT += dt;
      this.angle += dt * 0.35;
      if (this.readyT > 0.4 && (Input.hit('action') || Input.mouse.clicked)) this.spin();
      else if (Input.hit('back')) Game.go(hub);
    } else if (this.state === 'spinning') {
      this.spinT += dt;
      const p = Math.min(1, this.spinT / this.spinDur);
      this.angle = this.from + (this.to - this.from) * (1 - Math.pow(1 - p, 3));
      if (p >= 1) {
        this.justWon = this.slices[this.pick].label;
        Save.data.won.push(this.justWon); Save.store();
        Records.prize(this.justWon);
        this.state = 'result'; this.resultT = 0;
        Sound.play('win'); Sound.play('meow');
        Voice.say(TEKIS_SAYS.won);
        for (let k = 0; k < 5; k++) FX.burst(rand(30, 290), rand(30, 90), choice(WHEEL_COLORS), 18, 100);
      }
    } else if (this.state === 'result') {
      this.resultT += dt; this.confT -= dt;
      if (this.justWon && this.confT <= 0) { this.confT = 0.4; FX.burst(rand(20, 300), rand(5, 30), choice(WHEEL_COLORS), 10, 50); }
      if (this.resultT > 1) {
        if (Input.hit('back')) Game.go(hub);
        else if (Input.hit('action') || Input.mouse.clicked) this.next();
      }
    } else if (this.state === 'follow') {
      if (Input.hit('back')) { this.state = 'result'; return; }
      Input.typed.forEach(k => this.pinKey(k));
      if (Input.hit('action')) this.pinKey('ok');
      if (Input.mouse.clicked) {
        const i = PIN_KEYS.findIndex((k, n) => { const b = padRect(n); return pointIn(Input.mouse, b.x, b.y, b.w, b.h); });
        if (i >= 0) this.pinKey(PIN_KEYS[i]);
      }
    }
    const cur = this.pointerSlice();
    if (cur !== this.lastSlice) {
      this.lastSlice = cur;
      if (this.state === 'spinning') { Sound.play('tick'); this.wobble = 1; }
    }
  }
  renderWheel() {
    const R = WHEEL.r, size = R * 2 + 1, px = this.pix.data;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - R, dy = y - R, d = Math.hypot(dx, dy), o = (y * size + x) * 4;
        if (d > R + 0.4) { px[o + 3] = 0; continue; }
        let c;
        if (d > R - 3) c = WHEEL_RIM;
        else if (d < 9) c = WHEEL_HUB;
        else {
          const f = normAng(Math.atan2(dy, dx) + Math.PI / 2 - this.angle);
          const s = this.slices[this.sliceAt(f)];
          if (Math.min(f - s.from, s.to - f) * d < 0.9) c = WHEEL_LINE;
          else c = d > R - 6 || d < 12 ? s.shade : s.rgb;
        }
        px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
      }
    }
    this.wctx.putImageData(this.pix, 0, 0);
  }
  draw() {
    rect(0, 0, W, H, '#0d0619');
    ctx.globalAlpha = 0.12;
    for (let i = 0; i < 8; i++) {
      const x = (i * 53 + this.t * 6) % (W + 10) - 8, y = (i * 37) % 160 + 8;
      ctx.drawImage(i % 2 ? PAW : MINI_HEART, Math.round(x), y);
    }
    ctx.globalAlpha = 1;
    drawText(`${ORG.mascot} PRIZE WHEEL!`, W / 2, 5, PAL.yellow, { scale: 2, align: 'center', shadow: '#db2777' });

    const { cx, cy, r } = WHEEL;
    this.renderWheel();
    ctx.drawImage(this.wheel, cx - r, cy - r);
    this.slices.forEach((s, i) => {
      const a = (s.from + s.to) / 2 + this.angle - Math.PI / 2;
      drawText(String(i + 1), Math.round(cx + Math.cos(a) * r * 0.66), Math.round(cy + Math.sin(a) * r * 0.66) - 3, PAL.white, { align: 'center', shadow: '#000' });
    });
    for (let k = 0; k < 16; k++) {
      const a = k / 16 * TAU, on = (k + Math.floor(this.t * (this.state === 'spinning' ? 10 : 3))) % 2;
      rect(Math.round(cx + Math.cos(a) * (r - 1.5)) - 1, Math.round(cy + Math.sin(a) * (r - 1.5)) - 1, 2, 2, on ? PAL.yellow : '#fff7fb');
    }
    ctx.drawImage(LOGO_MINI, cx - 5, cy - 5);

    const py = cy - r - 8 - Math.round(this.wobble * 2);
    for (let k = 0; k < 7; k++) rect(cx - 6 + k, py + k, 13 - k * 2, 1, k < 1 ? '#3b0d3a' : '#f472b6');
    rect(cx - 6, py - 3, 13, 3, '#3b0d3a');
    rect(cx - 1, py + 1, 3, 2, '#fff7fb');

    panel(166, 28, 146, 16 + this.slices.length * 10, 'rgba(10,4,22,0.95)', '#f472b6');
    drawText('PRIZES', 239, 32, '#f472b6', { align: 'center' });
    this.slices.forEach((s, i) => {
      const y = 44 + i * 10;
      const hot = this.state === 'result' && s.label === this.justWon;
      if (hot && Math.floor(this.t * 4) % 2) rect(169, y - 2, 140, 10, 'rgba(253,208,104,0.3)');
      rect(173, y, 7, 7, s.color);
      drawText(`${i + 1} ${s.label}`, 185, y, hot ? PAL.yellow : PAL.white);
    });
    drawText(`SPINS LEFT: ${spinsLeft()}`, 4, 24, PAL.cyan, { shadow: '#000' });

    const say = this.state === 'ready' ? 'SPIN IT! NYA~' : this.state === 'spinning' ? 'GO GO GO~!' : 'YAY! ♥';
    const ty = drawTekis(274, 138, this.t, { talking: Voice.speaking || this.state === 'spinning', mood: this.state === 'ready' ? 'normal' : 'excited' });
    tinyBubble(say, 314 - textWidth(say) - 6, ty - 15, 292);
    if (this.state === 'ready' && Math.floor(this.t * 2) % 2 === 0) drawText('SPACE / CLICK: SPIN!', 208, 166, PAL.yellow, { align: 'center', shadow: '#000' });

    if (this.state === 'result' && (this.resultT > 0.7 || !this.justWon)) this.drawResult();
    if (this.state === 'follow') this.drawFollow();
  }
  drawResult() {
    const won = Save.data.won;
    const main = this.justWon || won[won.length - 1] || 'NO PRIZE YET';
    const others = won.slice();
    others.splice(others.lastIndexOf(main), 1);
    const slice = this.slices.find(s => s.label === main);
    rect(0, 0, W, H, 'rgba(0,0,0,0.45)');
    panel(34, 34, W - 68, 116, '#fff7fb', '#f472b6');
    panel(37, 37, W - 74, 110, '#fff7fb', '#fbcfe8');
    for (let x = 46; x < W - 50; x += 18) { ctx.drawImage(MINI_HEART, x, 40); ctx.drawImage(MINI_HEART, x, 141); }
    const who = Records.name;
    const head = this.justWon ? `♥ ${who || 'YOU'} WON ♥` : who ? `♥ ${who}'S PRIZES ♥` : '♥ YOUR PRIZES ♥';
    drawText(head, W / 2, 50, '#db2777', { align: 'center' });
    const big = textWidth(main) * 2 <= W - 90;
    drawText(main, W / 2, big ? 61 : 65, slice ? slice.color : '#7c3aed', { scale: big ? 2 : 1, align: 'center', shadow: '#3b0d3a' });
    if (others.length) drawText(`+ ${others.join(' + ')}`, W / 2, 80, '#7c3aed', { align: 'center' });
    drawText(`SHOW THIS SCREEN TO A ${ORG.short}`, W / 2, 91, '#374151', { align: 'center' });
    drawText(`MEMBER TO CLAIM YOUR PRIZE${won.length > 1 ? 'S' : ''}!`, W / 2, 100, '#374151', { align: 'center' });
    const cta = spinsLeft() ? 'SPACE: SPIN AGAIN!' : !Save.data.bonus ? `SPACE: FOLLOW ${ORG.short} FOR A BONUS SPIN!` : 'SPACE: BACK TO EXPO HALL';
    if (Math.floor(this.t * 2) % 2 === 0) drawText(cta, W / 2, 115, '#db2777', { align: 'center' });
    if (spinsLeft() || !Save.data.bonus) drawText('ESC: BACK TO EXPO HALL', W / 2, 127, '#6b7280', { align: 'center' });
  }
  drawFollow() {
    rect(0, 0, W, H, 'rgba(0,0,0,0.55)');
    panel(8, 22, W - 16, 150, '#fff7fb', '#f472b6');

    const q = QR.canvas(ORG.qrUrl), s = q.width * 2 <= 84 ? 2 : 1, size = q.width * s;
    const qx = 56 - size / 2, qy = 32;
    rect(qx - 2, qy - 2, size + 4, size + 4, '#f472b6');
    drawQR(qx, qy, s);
    if (Math.floor(this.t * 2) % 2 === 0) drawText('SCAN ME!', 56, qy + size + 5, '#db2777', { align: 'center' });
    drawText(ORG.qrLabel, 56, qy + size + 15, '#7c3aed', { align: 'center' });

    drawText('BONUS SPIN! ♥', 108, 30, '#db2777', { scale: 2, shadow: '#fbcfe8' });
    wrapText(`FOLLOW THE ${ORG.short} PAGE, THEN SHOW A ${ORG.short} MEMBER. THEY WILL TYPE THE STAFF PIN.`, 32)
      .forEach((l, k) => drawText(l, 108, 50 + k * 9, '#1f2937'));

    const sx = this.pinShake > 0 ? Math.round(Math.sin(this.t * 60) * 2) : 0;
    drawText('STAFF PIN', 112, 82, '#7c3aed');
    panel(108 + sx, 92, 108, 16, '#ffffff', '#db2777');
    const shown = this.pin ? '*'.repeat(this.pin.length) : Math.floor(this.t * 2) % 2 ? '_' : '';
    drawText(shown, 162 + sx, 97, '#1e1b4b', { align: 'center', scale: 1 });
    if (this.checking) drawText('CHECKING...', 162, 113, '#374151', { align: 'center' });
    else if (this.pinMsg) drawText(this.pinMsg, 162, 113, PAL.red, { align: 'center' });

    PIN_KEYS.forEach((k, n) => {
      const b = padRect(n), hover = pointIn(Input.mouse, b.x, b.y, b.w, b.h);
      const fill = k === 'ok' ? (hover ? '#6ee7b7' : '#34d399') : k === 'del' ? (hover ? '#fecaca' : '#fca5a5') : hover ? '#fbcfe8' : '#ffffff';
      panel(b.x, b.y, b.w, b.h, fill, '#db2777');
      drawText(k.toUpperCase(), b.x + b.w / 2, b.y + 4, '#1e1b4b', { align: 'center' });
    });

    drawTekis(112, 128, this.t, { talking: Voice.speaking, mood: this.pinMsg ? 'sad' : 'normal' });
    drawText('PLEASE~ ♥', 154, 140, '#be185d');
    drawText('ESC: BACK', W - 14, 160, '#6b7280', { align: 'right' });
  }
}

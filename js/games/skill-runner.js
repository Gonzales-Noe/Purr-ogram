'use strict';

/* Topic: Trusted Digital Transformation and Future-Ready Skills — an endless runner. */
(() => {
  const GROUND = 150;
  const SKILLS = ['AI', 'CLOUD', 'DATA', 'CYBER', 'CODE', 'ETHICS'];
  const GROUND_OBS = [
    { kind: 'crt', label: 'LEGACY', w: 14, h: 12 },
    { kind: 'tape', label: 'RED TAPE', w: 10, h: 16 },
    { kind: 'silo', label: 'SILO', w: 10, h: 22 },
    { kind: 'floppy', label: 'OUTDATED', w: 12, h: 12 },
  ];
  const AIR_LABELS = ['FAKE NEWS', 'PHISHING', 'SCAM BOT'];

  const SKY = makeCanvas(W, H, g => {
    const bands = ['#081028', '#0b1736', '#0f1f4d', '#13296a', '#1a3a8a', '#2449a8', '#2f5bc4'];
    const bh = Math.ceil(GROUND / bands.length);
    bands.forEach((c, i) => { g.fillStyle = c; g.fillRect(0, i * bh, W, bh); });
    pixCircle(g, 250, 52, 14, '#fde68a');
    pixCircle(g, 250, 52, 11, '#fef3c7');
  });

  function skyline(color, minH, maxH, windows) {
    return makeCanvas(W, H, g => {
      let x = 0;
      while (x < W) {
        const w = randi(14, 30), h = randi(minH, maxH);
        g.fillStyle = color; g.fillRect(x, GROUND - h, w - 2, h);
        if (windows) {
          g.fillStyle = windows;
          for (let wy = GROUND - h + 4; wy < GROUND - 4; wy += 6) {
            for (let wx = x + 3; wx < x + w - 5; wx += 5) if (Math.random() < 0.45) g.fillRect(wx, wy, 2, 3);
          }
        }
        x += w;
      }
    });
  }
  const FAR = skyline('#1e3a8a', 30, 70, null);
  const NEAR = skyline('#0f1f4d', 18, 50, '#facc1588');

  function drawObstacle(o, t) {
    const x = Math.round(o.x), y = Math.round(o.y);
    switch (o.kind) {
      case 'crt':
        rect(x, y, 14, 11, '#9ca3af'); rect(x + 2, y + 2, 10, 6, '#1e3a8a');
        rect(x + 3, y + 3, 2, 1, '#60a5fa'); rect(x + 4, y + 11, 6, 1, '#6b7280');
        break;
      case 'tape':
        rect(x + 4, y, 2, 16, '#78716c');
        for (let k = 0; k < 3; k++) rect(x, y + 2 + k * 5, 10, 3, k % 2 ? PAL.yellow : PAL.red);
        break;
      case 'silo':
        rect(x, y + 2, 10, 20, '#64748b'); rect(x + 1, y, 8, 2, '#94a3b8');
        rect(x + 2, y + 7, 6, 1, '#475569'); rect(x + 2, y + 14, 6, 1, '#475569');
        break;
      case 'floppy':
        rect(x, y, 12, 12, '#1e3a8a'); rect(x + 3, y, 6, 4, '#cbd5e1'); rect(x + 2, y + 6, 8, 6, PAL.white);
        break;
      case 'air': {
        const up = Math.floor(t * 8) % 2;
        rect(x + 2, y + 1, 10, 7, PAL.white); rect(x + 6, y + 3, 2, 3, PAL.red);
        rect(x, y + (up ? 0 : 4), 2, 2, '#cbd5e1'); rect(x + 12, y + (up ? 0 : 4), 2, 2, '#cbd5e1');
        break;
      }
    }
    drawText(o.label, x + o.w / 2, y - 9, '#fca5a5', { align: 'center', shadow: '#000' });
  }

  class SkillRunner {
    constructor() {
      this.score = 0; this.bonus = 0; this.over = false; this.won = false; this.reason = '';
      this.lives = 3; this.inv = 0; this.dist = 0; this.speed = 110; this.t = 0;
      this.p = { x: 46, y: GROUND - 14, vy: 0, onGround: true, jumps: 0, duck: false };
      this.obs = []; this.tokens = []; this.spawnT = 1.2; this.tokenT = 0.8;
      this.skills = new Set(); this.readyCount = 0;
    }

    hitbox() {
      const p = this.p;
      return p.duck ? { x: p.x + 1, y: GROUND - 8, w: 9, h: 8 } : { x: p.x + 2, y: p.y + 1, w: 7, h: 13 };
    }

    jump() {
      const p = this.p;
      if (p.onGround) { p.vy = -270; p.onGround = false; p.jumps = 1; Sound.play('jump'); }
      else if (p.jumps < 2) { p.vy = -230; p.jumps = 2; Sound.play('jump'); FX.burst(p.x + 5, p.y + 14, PAL.white, 5, 40); }
    }

    update(dt) {
      this.t += dt; this.inv -= dt;
      this.speed = Math.min(270, 110 + this.t * 3);
      this.dist += this.speed * dt;
      this.score = Math.floor(this.dist / 20) + this.bonus;

      const p = this.p;
      if (Input.hit('up') || Input.hit('action') || Input.mouse.clicked) this.jump();
      p.duck = Input.isDown('down') && p.onGround;
      if (Input.isDown('down') && !p.onGround) p.vy += 900 * dt;
      p.vy += 800 * dt;
      p.y += p.vy * dt;
      if (p.y >= GROUND - 14) { p.y = GROUND - 14; p.vy = 0; p.onGround = true; p.jumps = 0; }

      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = rand(170, 280) / this.speed;
        if (this.dist > 600 && Math.random() < 0.3) {
          this.obs.push({ kind: 'air', label: choice(AIR_LABELS), x: W + 10, y: GROUND - 19, w: 14, h: 8 });
        } else {
          const o = choice(GROUND_OBS);
          this.obs.push({ ...o, x: W + 10, y: GROUND - o.h });
        }
      }
      this.tokenT -= dt;
      if (this.tokenT <= 0) {
        this.tokenT = rand(1.4, 2.6);
        const missing = SKILLS.filter(s => !this.skills.has(s));
        const skill = missing.length && Math.random() < 0.75 ? choice(missing) : choice(SKILLS);
        this.tokens.push({ skill, x: W + 10, y: choice([GROUND - 26, GROUND - 46, GROUND - 60]), w: textWidth(skill) + 6, h: 11 });
      }

      const hb = this.hitbox();
      for (const o of this.obs) {
        o.x -= this.speed * dt;
        if (o.x < -40) o.dead = true;
        if (o.hit || this.inv > 0) continue;
        if (overlap(hb, { x: o.x + 1, y: o.y + 1, w: o.w - 2, h: o.h - 1 })) {
          o.hit = true; this.lives--; this.inv = 1.5; FX.shake = 5;
          Sound.play('hurt'); FX.burst(p.x + 5, p.y + 7, PAL.red, 12); FX.float(p.x + 5, p.y - 10, `${o.label}!`, PAL.red);
          if (this.lives <= 0) {
            this.over = true; this.reason = `YOU RAN ${Math.floor(this.dist / 10)} M TOWARD THE FUTURE`;
            Sound.play('lose');
            return;
          }
        }
      }
      for (const k of this.tokens) {
        k.x -= this.speed * dt;
        if (k.x < -40) k.dead = true;
        if (!k.dead && overlap(hb, k)) {
          k.dead = true; this.bonus += 25; this.skills.add(k.skill);
          Sound.play('coin'); FX.float(k.x + k.w / 2, k.y - 6, `+25 ${k.skill}`, PAL.yellow);
          FX.burst(k.x + k.w / 2, k.y + 5, PAL.yellow, 8);
          if (this.skills.size === SKILLS.length) {
            this.bonus += 300; this.readyCount++; this.skills.clear();
            Sound.play('power'); FX.float(W / 2, 60, 'FUTURE-READY! +300', PAL.green);
          }
        }
      }
      this.obs = this.obs.filter(o => !o.dead);
      this.tokens = this.tokens.filter(k => !k.dead);
    }

    draw() {
      ctx.drawImage(SKY, 0, 0);
      for (const [layer, f] of [[FAR, 0.15], [NEAR, 0.4]]) {
        const off = Math.floor(this.dist * f) % W;
        ctx.drawImage(layer, -off, 0);
        ctx.drawImage(layer, W - off, 0);
      }
      rect(0, GROUND, W, H - GROUND, '#14532d');
      rect(0, GROUND, W, 1, PAL.lime);
      const go = Math.floor(this.dist) % 16;
      for (let x = -go; x < W; x += 16) rect(x, GROUND + 5, 8, 2, '#166534');

      for (const o of this.obs) drawObstacle(o, this.t);
      for (const k of this.tokens) {
        const y = k.y + Math.round(Math.sin(this.t * 5 + k.x * 0.05));
        panel(k.x, y, k.w, k.h, PAL.navy, PAL.yellow);
        drawText(k.skill, k.x + 3, y + 2, PAL.yellow);
      }

      const p = this.p;
      if (this.inv <= 0 || Math.floor(this.t * 12) % 2) {
        const frame = !p.onGround || Math.floor(this.dist / 12) % 2 ? PLAYER.b : PLAYER.a;
        if (p.duck) ctx.drawImage(frame, Math.round(p.x), GROUND - 8, 10, 8);
        else ctx.drawImage(frame, Math.round(p.x), Math.round(p.y));
      }

      hudBar(21);
      drawText(`SCORE ${this.score}`, 4, 3, PAL.white);
      drawText(`${Math.floor(this.dist / 10)} M`, W / 2, 3, PAL.cyan, { align: 'center' });
      drawHearts(W - 30, 3, this.lives);
      const total = SKILLS.reduce((s, k) => s + textWidth(k) + 6, -6);
      let x = W / 2 - total / 2;
      for (const s of SKILLS) {
        drawText(s, x, 12, this.skills.has(s) ? PAL.yellow : '#64748b');
        x += textWidth(s) + 6;
      }
      if (this.readyCount) drawText(`READY X${this.readyCount}`, 4, 12, PAL.green);

      if (this.t < 4) {
        panel(30, 52, 260, 31, 'rgba(7,13,36,0.9)', PAL.yellow);
        drawText('JUMP: SPACE / UP / CLICK (TWICE = DOUBLE)', W / 2, 56, PAL.white, { align: 'center' });
        drawText('DUCK: DOWN', W / 2, 65, PAL.white, { align: 'center' });
        drawText('COLLECT ALL 6 SKILLS FOR A BONUS!', W / 2, 74, PAL.yellow, { align: 'center' });
      }
    }
  }

  GAMES.push({
    id: 'skills', short: 'SKILLS', title: 'SKILL RUNNER',
    topic: 'TRUSTED DIGITAL TRANSFORMATION AND FUTURE-READY SKILLS',
    color: PAL.orange, dark: '#431407', badgeScore: 500,
    tekis: [
      "NYA~ LET'S RUN TOWARD A FUTURE-READY CAREER! ZOOM ZOOM!",
      'PRESS SPACE, UP OR CLICK TO JUMP. PRESS AGAIN IN THE AIR FOR A DOUBLE JUMP! HOLD DOWN TO DUCK.',
      'JUMP OVER LEGACY SYSTEMS, RED TAPE AND SILOS. DUCK UNDER FAKE NEWS AND PHISHING!',
      'COLLECT SKILLS: AI, CLOUD, DATA, CYBER, CODE AND ETHICS. GET ALL 6 FOR A +300 BONUS! MEOW-VELOUS~',
    ],
    facts: [
      'FUTURE-READY SKILLS INCLUDE AI LITERACY, CLOUD, DATA, CYBERSECURITY AND DIGITAL ETHICS.',
      'DIGITAL TRANSFORMATION IS ABOUT PEOPLE AND TRUST, NOT JUST TECHNOLOGY.',
      'LIFELONG LEARNING IS THE ULTIMATE FUTURE-READY SKILL. KEEP UPSKILLING!',
      'TRUSTED SYSTEMS ARE TRANSPARENT, SECURE, INCLUSIVE AND RESPECT PRIVACY.',
    ],
    create: () => new SkillRunner(),
  });
})();

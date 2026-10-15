'use strict';

/* Topic: Cyber Resilience and Post-Quantum Security — a space-invaders style defense. */
(() => {
  const SHIP = makeSprite([
    '......c......',
    '.....ccc.....',
    '.....cwc.....',
    '.b..ccccc..b.',
    '.bccbbbbbccb.',
    'bbbbbbbbbbbbb',
    'bbccbbbbbccbb',
    '.b.........b.',
  ], { c: PAL.cyan, w: PAL.white, b: PAL.blue });

  const SPR = {
    virus: makeSprite([
      '..g.....g..',
      '...g...g...',
      '..ggggggg..',
      '.gg.ggg.gg.',
      'ggggggggggg',
      'g.ggggggg.g',
      'g.g.....g.g',
      '...gg.gg...',
    ], { g: PAL.green }),
    phish: makeSprite([
      '...ooooo...',
      '.ooooooo..o',
      'oowooooo.oo',
      'ooooooooooo',
      'oooooooo.oo',
      '.ooooooo..o',
      '...ooooo...',
      '.....y.....',
    ], { o: PAL.orange, w: PAL.white, y: PAL.yellow }),
    ransom: makeSprite([
      '...rrrrr...',
      '..r.....r..',
      '..r.....r..',
      '.rrrrrrrrr.',
      '.rrrryrrrr.',
      '.rrryyyrrr.',
      '.rrrryrrrr.',
      '.rrrrrrrrr.',
    ], { r: PAL.red, y: PAL.yellow }),
    quantum: makeSprite([
      '.p.......p.',
      '..p.....p..',
      '.ppppppppp.',
      'pp.pwwwp.pp',
      'ppppwwwpppp',
      '.ppppppppp.',
      '..p.p.p.p..',
      '.p.......p.',
    ], { p: PAL.purple, w: PAL.white }),
  };

  const TYPES = {
    virus: { hp: 1, pts: 10, color: PAL.green },
    phish: { hp: 1, pts: 15, color: PAL.orange },
    ransom: { hp: 2, pts: 25, color: PAL.red },
    quantum: { hp: 1, pts: 40, color: PAL.purple, pqc: true },
  };
  const WAVES = [
    ['phish', 'virus', 'virus'],
    ['ransom', 'phish', 'virus', 'virus'],
    ['quantum', 'ransom', 'phish', 'virus'],
    ['quantum', 'quantum', 'ransom', 'phish', 'virus'],
  ];
  const WAVE_NAMES = [
    'VIRUSES & PHISHING',
    'RANSOMWARE INCOMING!',
    'QUANTUM BOTS! GRAB THE Q POWER-UP',
    'FULL-SCALE ATTACK!',
    'Q-DAY - ONLY PQC CAN HURT IT!',
  ];
  const TOTAL_WAVES = WAVES.length + 1;

  class FirewallDefender {
    constructor() {
      this.score = 0; this.lives = 3; this.over = false; this.won = false; this.reason = '';
      this.p = { x: 154, y: 160 };
      this.cool = 0; this.inv = 0; this.pqc = 0; this.hintT = 0; this.t = 0;
      this.bullets = []; this.ebullets = []; this.pickups = [];
      this.efire = 1.5; this.pqcDrop = 4;
      this.stars = Array.from({ length: 40 }, () => ({ x: randi(0, W - 1), y: rand(0, H), s: rand(10, 40) }));
      this.startWave(0);
    }

    startWave(n) {
      this.wave = n; this.banner = 2; this.enemies = []; this.boss = null; this.ebullets = [];
      if (n < WAVES.length) {
        WAVES[n].forEach((type, row) => {
          for (let col = 0; col < 8; col++) this.enemies.push({ type, hp: TYPES[type].hp, col, row, x: 0, y: 0 });
        });
        this.waveCount = this.enemies.length;
        this.fx = 40; this.fy = 20; this.fdir = 1;
        this.layout();
      } else {
        this.boss = { x: 138, y: 22, hp: 36, max: 36, t: 0, fire: 2, flash: 0 };
      }
    }

    layout() {
      for (const e of this.enemies) { e.x = this.fx + e.col * 16; e.y = this.fy + e.row * 12; }
    }

    end(reason) {
      this.over = true; this.won = false; this.reason = reason;
      FX.shake = 6; Sound.play('lose');
    }

    hurt() {
      this.lives--; this.inv = 1.6; FX.shake = 5;
      Sound.play('hurt'); FX.burst(this.p.x + 6, this.p.y + 4, PAL.cyan, 14);
      if (this.lives <= 0) this.end('SYSTEMS COMPROMISED!');
    }

    updateFormation(dt) {
      const speed = 10 + this.wave * 4 + (1 - this.enemies.length / this.waveCount) * 35;
      this.fx += this.fdir * speed * dt;
      this.layout();
      let minX = W, maxX = 0, maxY = 0;
      for (const e of this.enemies) { minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x + 11); maxY = Math.max(maxY, e.y + 8); }
      if ((this.fdir > 0 && maxX >= W - 4) || (this.fdir < 0 && minX <= 4)) { this.fdir *= -1; this.fy += 6; this.layout(); }
      if (maxY >= this.p.y) { this.lives = 0; this.end('FIREWALL BREACHED!'); return; }
      this.efire -= dt;
      if (this.efire <= 0 && this.enemies.length) {
        this.efire = rand(0.5, 1.3) / (1 + this.wave * 0.3);
        const s = choice(this.enemies);
        this.ebullets.push({ x: s.x + 5, y: s.y + 8, vx: 0, vy: 70 + this.wave * 12 });
      }
    }

    updateBoss(dt) {
      const B = this.boss;
      B.t += dt; B.flash -= dt;
      B.x = 138 + Math.sin(B.t * 0.8) * 110;
      B.y = 22 + Math.sin(B.t * 1.6) * 6;
      B.fire -= dt;
      if (B.fire <= 0) {
        B.fire = B.hp < B.max / 2 ? 0.9 : 1.4;
        for (let a = -2; a <= 2; a++) this.ebullets.push({ x: B.x + 22, y: B.y + 30, vx: a * 30, vy: 80 });
        Sound.play('shoot');
      }
    }

    deflect(b) {
      FX.burst(b.x, b.y, PAL.gray, 3, 40);
      Sound.play('deny');
      if (this.hintT <= 0) { FX.float(b.x, b.y - 8, 'NEED PQC!', PAL.purple); this.hintT = 1.5; }
    }

    maybeDrop(x, y) {
      const r = Math.random();
      if (r < 0.07 && this.lives < 3) this.pickups.push({ kind: 'backup', x: x - 4, y });
      else if (r < 0.17) this.pickups.push({ kind: 'pqc', x: x - 4, y });
    }

    hitTargets() {
      for (const b of this.bullets) {
        if (b.dead) continue;
        if (this.boss) {
          const B = this.boss;
          if (!pointIn(b, B.x, B.y, 44, 32)) continue;
          b.dead = true;
          if (!b.pqc) { this.deflect(b); continue; }
          B.hp--; B.flash = 0.08; this.score += 10;
          FX.burst(b.x, b.y, PAL.purple, 5); Sound.play('blip');
          if (B.hp <= 0) {
            this.score += 500;
            for (let k = 0; k < 6; k++) FX.burst(B.x + rand(0, 44), B.y + rand(0, 32), choice([PAL.purple, PAL.white, PAL.pink]), 20, 100);
            FX.shake = 8; Sound.play('boom'); Sound.play('win');
            this.over = true; this.won = true; this.reason = 'Q-DAY DEFEATED - YOU ARE QUANTUM-SAFE!';
            return;
          }
          continue;
        }
        for (const e of this.enemies) {
          if (e.dead || !pointIn(b, e.x - 1, e.y, 13, 9)) continue;
          b.dead = true;
          const T = TYPES[e.type];
          if (T.pqc && !b.pqc) { this.deflect(b); break; }
          e.hp--;
          if (e.hp > 0) { Sound.play('blip'); FX.burst(b.x, b.y, T.color, 4); break; }
          e.dead = true; this.score += T.pts;
          FX.burst(e.x + 5, e.y + 4, T.color, 10); FX.float(e.x + 5, e.y - 4, `+${T.pts}`, T.color);
          Sound.play('boom');
          this.maybeDrop(e.x + 5, e.y + 4);
          break;
        }
      }
      this.enemies = this.enemies.filter(e => !e.dead);
    }

    update(dt) {
      this.t += dt; this.cool -= dt; this.inv -= dt; this.pqc -= dt; this.hintT -= dt;
      const p = this.p, m = Input.mouse;
      const dir = (Input.isDown('right') ? 1 : 0) - (Input.isDown('left') ? 1 : 0);
      if (dir) p.x += dir * 150 * dt;
      else if (m.down) p.x += clamp(m.x - 6 - p.x, -200 * dt, 200 * dt);
      p.x = clamp(p.x, 2, W - 15);

      if ((Input.isDown('action') || m.down) && this.cool <= 0) {
        const pq = this.pqc > 0;
        this.bullets.push({ x: p.x + 6, y: p.y - 3, pqc: pq });
        this.cool = pq ? 0.2 : 0.28;
        Sound.play('shoot');
      }
      for (const b of this.bullets) { b.y -= 230 * dt; if (b.y < 12) b.dead = true; }

      if (this.banner > 0) this.banner -= dt;
      else if (this.boss) this.updateBoss(dt);
      else this.updateFormation(dt);
      if (this.over) return;

      this.hitTargets();
      if (this.over) return;

      for (const b of this.ebullets) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        if (b.y > H) b.dead = true;
        else if (this.inv <= 0 && b.x >= p.x && b.x <= p.x + 13 && b.y + 3 >= p.y + 1 && b.y <= p.y + 8) {
          b.dead = true; this.hurt();
          if (this.over) return;
        }
      }

      const needPqc = this.boss || this.enemies.some(e => e.type === 'quantum');
      if (needPqc && this.pqc <= 0 && !this.pickups.some(k => k.kind === 'pqc')) {
        this.pqcDrop -= dt;
        if (this.pqcDrop <= 0) { this.pqcDrop = this.boss ? 3 : 5; this.pickups.push({ kind: 'pqc', x: rand(20, W - 30), y: 14 }); }
      }
      for (const k of this.pickups) {
        k.y += 40 * dt;
        if (k.y > H) { k.dead = true; continue; }
        if (k.x < p.x + 13 && k.x + 9 > p.x && k.y + 9 > p.y && k.y < p.y + 8) {
          k.dead = true;
          Sound.play('power');
          if (k.kind === 'pqc') { this.pqc = 9; FX.float(p.x + 6, p.y - 12, 'POST-QUANTUM CRYPTO!', PAL.purple); }
          else { this.lives = Math.min(3, this.lives + 1); FX.float(p.x + 6, p.y - 12, 'BACKUP RESTORED!', PAL.green); }
        }
      }

      this.bullets = this.bullets.filter(b => !b.dead);
      this.ebullets = this.ebullets.filter(b => !b.dead);
      this.pickups = this.pickups.filter(k => !k.dead);

      if (!this.boss && !this.enemies.length) {
        const bonus = 100 * (this.wave + 1);
        this.score += bonus;
        FX.float(W / 2, 60, `WAVE CLEAR! +${bonus}`, PAL.yellow);
        Sound.play('power');
        this.startWave(this.wave + 1);
      }
    }

    draw() {
      rect(0, 0, W, H, '#050a1c');
      for (const s of this.stars) {
        const y = (s.y + this.t * s.s) % H, big = s.s > 25;
        rect(s.x, y, 1, big ? 2 : 1, big ? '#1e40af' : '#172554');
      }
      for (let x = 0; x < W; x += 16) {
        rect(x + 1, 172, 14, 8, PAL.dark);
        rect(x + 3, 174, 2, 1, Math.floor(this.t * 4 + x) % 3 ? PAL.green : '#14532d');
        rect(x + 3, 177, 10, 1, PAL.slate);
      }

      const wob = Math.floor(this.t * 4) % 2;
      for (const e of this.enemies) ctx.drawImage(SPR[e.type], Math.round(e.x), Math.round(e.y) + wob);

      if (this.boss) {
        const B = this.boss;
        if (B.flash > 0) ctx.globalAlpha = 0.5;
        ctx.drawImage(SPR.quantum, Math.round(B.x), Math.round(B.y), 44, 32);
        ctx.globalAlpha = 1;
        bar(B.x + 2, B.y + 34, 40, 3, B.hp / B.max, PAL.pink);
        drawText('Q-DAY', B.x + 22, B.y + 39, PAL.pink, { align: 'center', shadow: '#000' });
      }

      for (const b of this.bullets) {
        if (b.pqc) { rect(b.x - 1, b.y, 3, 5, PAL.purple); rect(b.x, b.y + 1, 1, 3, PAL.white); }
        else rect(b.x, b.y, 1, 4, PAL.cyan);
      }
      for (const b of this.ebullets) rect(b.x - 1, b.y, 2, 4, PAL.orange);

      for (const k of this.pickups) {
        const pq = k.kind === 'pqc';
        panel(k.x, k.y, 9, 9, PAL.navy, pq ? PAL.purple : PAL.green);
        drawText(pq ? 'Q' : '+', k.x + 2, k.y + 1, pq ? PAL.purple : PAL.green);
      }

      const p = this.p;
      if (this.inv <= 0 || Math.floor(this.t * 12) % 2) {
        if (this.pqc > 0) panel(p.x - 2, p.y - 2, 17, 12, 'rgba(168,85,247,0.25)', PAL.purple);
        ctx.drawImage(SHIP, Math.round(p.x), p.y);
      }

      hudBar();
      drawText(`SCORE ${this.score}`, 4, 3, PAL.white);
      drawText(this.boss ? 'BOSS WAVE' : `WAVE ${this.wave + 1}/${TOTAL_WAVES}`, W / 2, 3, PAL.cyan, { align: 'center' });
      drawHearts(W - 30, 3, this.lives);
      if (this.pqc > 0) {
        drawText('PQC', 4, 16, PAL.purple, { shadow: '#000' });
        bar(24, 17, 36, 4, this.pqc / 9, PAL.purple);
      }
      if (this.banner > 0) {
        const title = this.boss ? 'FINAL BOSS' : `WAVE ${this.wave + 1}`;
        drawText(title, W / 2, 74, PAL.white, { scale: 2, align: 'center', shadow: '#000' });
        drawText(WAVE_NAMES[this.wave], W / 2, 94, PAL.yellow, { align: 'center', shadow: '#000' });
      }
    }
  }

  GAMES.push({
    id: 'cyber', short: 'CYBER', title: 'FIREWALL DEFENDER',
    topic: 'CYBER RESILIENCE AND POST-QUANTUM SECURITY',
    color: PAL.sky, dark: '#172554', badgeScore: 500,
    tekis: [
      'NYA!! ALERT ALERT! MALWARE IS ATTACKING OUR DATA CENTER! >_<',
      'MOVE WITH ARROWS (OR DRAG) AND HOLD SPACE TO FIRE! ZAP THE VIRUSES, PHISHING FISH AND RANSOMWARE LOCKS!',
      'PURPLE QUANTUM BOTS LAUGH AT NORMAL SHOTS... GRAB THE Q POWER-UP FOR POST-QUANTUM CRYPTO! MEOW-SOME!',
      'A GREEN + IS A BACKUP THAT GIVES A HEART BACK. CLEAR 4 WAVES, THEN BEAT THE BIG BAD Q-DAY BOSS! YOU GOT THIS~ ♥',
    ],
    facts: [
      'POST-QUANTUM CRYPTOGRAPHY (PQC) USES MATH PROBLEMS THAT EVEN QUANTUM COMPUTERS FIND HARD.',
      'IN 2024, NIST PUBLISHED ITS FIRST PQC STANDARDS, INCLUDING ML-KEM AND ML-DSA.',
      'HARVEST NOW, DECRYPT LATER: ATTACKERS STEAL ENCRYPTED DATA TODAY TO CRACK IT WITH FUTURE QUANTUM COMPUTERS.',
      'CYBER RESILIENCE MEANS YOU CAN PREVENT, DETECT, RESPOND AND RECOVER. KEEP OFFLINE BACKUPS!',
      'MOST BREACHES START WITH PHISHING. THINK BEFORE YOU CLICK!',
    ],
    create: () => new FirewallDefender(),
  });
})();

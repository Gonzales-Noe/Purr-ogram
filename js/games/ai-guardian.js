'use strict';

/* Topic: Responsible Agentic and Generative AI — catch responsible outputs, dodge harmful ones. */
(() => {
  const GOOD = ['FACT-CHECKED', 'CITED SOURCE', 'USER CONSENT', 'HUMAN REVIEW', 'FAIR DATA',
    'AI LABELED', 'PRIVACY SAFE', 'EXPLAINABLE', 'AUDIT LOG', 'SAFE ACTION'];
  const BAD = ['DEEPFAKE', 'BIASED OUTPUT', 'HALLUCINATION', 'DATA LEAK', 'PROMPT INJECT',
    'FAKE CITATION', 'STOLEN ART', 'ROGUE AGENT', 'SPAM BOT', 'TOXIC TEXT'];
  const DURATION = 60;

  const BOT = makeSprite([
    '....yy....',
    '.....c....',
    '..cccccc..',
    '.cbbbbbbc.',
    '.cbwbbwbc.',
    '.cbbbbbbc.',
    '.cbbkkbbc.',
    '..cccccc..',
    '.c.cccc.c.',
    'c..cccc..c',
    '...c..c...',
  ], { y: PAL.yellow, c: PAL.cyan, b: PAL.navy, w: PAL.white, k: PAL.pink });

  class AIGuardian {
    constructor() {
      this.score = 0; this.lives = 3; this.time = DURATION; this.t = 0;
      this.over = false; this.won = false; this.reason = '';
      this.px = W / 2; this.pw = 36; this.py = 154; this.walk = 0; this.mouseMode = false;
      this.bot = { x: W / 2, vx: 55 };
      this.items = []; this.spawnT = 1; this.guardT = 10; this.combo = 0; this.shield = 0;
      this.bg = makeCanvas(W, H, g => {
        g.fillStyle = PAL.bg; g.fillRect(0, 0, W, H);
        const nodes = Array.from({ length: 22 }, () => ({ x: rand(8, W - 8), y: rand(40, 150) }));
        for (const a of nodes) for (const b of nodes) {
          if (a !== b && Math.hypot(a.x - b.x, a.y - b.y) < 60) pixLine(g, a.x, a.y, b.x, b.y, '#10224a');
        }
        g.fillStyle = '#1e3a8a';
        for (const n of nodes) g.fillRect(Math.round(n.x) - 1, Math.round(n.y) - 1, 3, 3);
        g.fillStyle = PAL.deep; g.fillRect(0, 171, W, 9);
      });
    }

    spawn(level, guard = false) {
      let text, type;
      if (guard) { text = 'GUARDRAIL'; type = 'guard'; }
      else if (Math.random() < 0.5) { text = choice(GOOD); type = 'good'; }
      else { text = choice(BAD); type = 'bad'; }
      const w = textWidth(text) + 6;
      this.items.push({
        text, type, w, h: 11,
        x: clamp(this.bot.x - w / 2, 2, W - w - 2), y: 36,
        vy: lerp(32, 72, level) + rand(-5, 8),
      });
    }

    catchItem(it) {
      const cx = it.x + it.w / 2, fy = this.py - 10;
      if (it.type === 'guard') {
        it.dead = true; this.shield = 7;
        Sound.play('power'); FX.burst(cx, this.py, PAL.yellow, 14); FX.float(cx, fy, 'GUARDRAILS ON!', PAL.yellow);
      } else if (it.type === 'good') {
        it.dead = true; this.combo++;
        const pts = 10 + Math.min(this.combo, 10) * 2;
        this.score += pts;
        Sound.play('good'); FX.burst(cx, this.py, PAL.green, 8); FX.float(cx, fy, `+${pts}`, PAL.green);
      } else if (this.shield > 0) {
        it.done = true; it.vy = -90; this.score += 5;
        Sound.play('deny'); FX.float(cx, fy, 'BLOCKED +5', PAL.yellow);
      } else {
        it.dead = true; this.lives--; this.combo = 0; FX.shake = 4;
        Sound.play('hurt'); FX.burst(cx, this.py, PAL.red, 12); FX.float(cx, fy, `${it.text}!`, PAL.red);
        if (this.lives <= 0) { this.over = true; this.reason = 'TOO MUCH HARMFUL AI GOT THROUGH'; Sound.play('lose'); }
      }
    }

    update(dt) {
      this.t += dt; this.time -= dt;
      if (this.time <= 0) {
        this.time = 0; this.over = true; this.won = true;
        this.reason = 'THE AI AGENT STAYED RESPONSIBLE!'; Sound.play('win');
        return;
      }
      const level = 1 - this.time / DURATION;

      const m = Input.mouse;
      const dir = (Input.isDown('right') ? 1 : 0) - (Input.isDown('left') ? 1 : 0);
      if (m.moved || m.down) this.mouseMode = true;
      if (dir) this.mouseMode = false;
      let move = dir * 170 * dt;
      if (this.mouseMode && !dir) move = clamp(m.x - this.px, -260 * dt, 260 * dt);
      this.px = clamp(this.px + move, this.pw / 2 + 2, W - this.pw / 2 - 2);
      if (Math.abs(move) > 0.2) this.walk += dt;
      if (this.shield > 0) this.shield -= dt;

      const b = this.bot;
      b.x += b.vx * dt;
      if (b.x < 30 || b.x > W - 30) { b.vx *= -1; b.x = clamp(b.x, 30, W - 30); }
      if (Math.random() < dt * 0.6) b.vx = choice([-1, 1]) * rand(40, 95);

      this.spawnT -= dt;
      if (this.spawnT <= 0) { this.spawnT = lerp(1.1, 0.45, level) * rand(0.8, 1.2); this.spawn(level); }
      this.guardT -= dt;
      if (this.guardT <= 0) { this.guardT = rand(12, 16); this.spawn(level, true); }

      for (const it of this.items) {
        it.y += it.vy * dt;
        const bottom = it.y + it.h;
        if (!it.done && bottom >= this.py && bottom <= this.py + 10 &&
            it.x < this.px + this.pw / 2 && it.x + it.w > this.px - this.pw / 2) {
          this.catchItem(it);
          if (this.over) return;
        }
        if (it.y > H + 4 || it.y < -20) {
          it.dead = true;
          if (it.type === 'good' && !it.done) { this.combo = 0; FX.float(it.x + it.w / 2, 150, 'MISSED', PAL.gray); }
        }
      }
      this.items = this.items.filter(i => !i.dead);
    }

    draw() {
      ctx.drawImage(this.bg, 0, 0);
      const bob = Math.round(Math.sin(this.t * 6) * 1.5);
      ctx.drawImage(BOT, Math.round(this.bot.x - 10), 15 + bob, 20, 22);

      for (const it of this.items) {
        const border = it.type === 'guard' ? PAL.yellow : it.done ? PAL.red : PAL.cyan;
        panel(it.x, it.y, it.w, it.h, PAL.navy, border);
        drawText(it.text, it.x + 3, it.y + 2, it.type === 'guard' ? PAL.yellow : PAL.white);
      }

      const left = this.px - this.pw / 2;
      if (this.shield > 0 && (this.shield > 1.5 || Math.floor(this.t * 10) % 2)) {
        rect(left - 2, this.py - 6, this.pw + 4, 1, PAL.yellow);
        rect(left - 3, this.py - 5, 1, 4, PAL.yellow);
        rect(left + this.pw + 2, this.py - 5, 1, 4, PAL.yellow);
      }
      rect(left, this.py, this.pw, 3, PAL.cyan);
      rect(left, this.py + 3, this.pw, 1, PAL.blue);
      const frame = Math.floor(this.walk * 8) % 2 ? PLAYER.b : PLAYER.a;
      ctx.drawImage(frame, Math.round(this.px - 5), this.py + 3);

      hudBar();
      drawText(`SCORE ${this.score}`, 4, 3, PAL.white);
      drawText(`TIME ${Math.ceil(this.time)}`, W / 2, 3, PAL.cyan, { align: 'center' });
      drawHearts(W - 30, 3, this.lives);
      if (this.combo > 1) drawText(`COMBO X${this.combo}`, 4, 16, PAL.yellow, { shadow: '#000' });
      if (this.shield > 0) {
        drawText('GUARDRAIL', W - 100, 16, PAL.yellow, { shadow: '#000' });
        bar(W - 44, 17, 40, 4, this.shield / 7, PAL.yellow);
      }
      if (this.t < 4) {
        panel(30, 80, 260, 22, 'rgba(7,13,36,0.9)', PAL.yellow);
        drawText('CATCH RESPONSIBLE AI OUTPUTS.', W / 2, 83, PAL.green, { align: 'center' });
        drawText('DODGE THE HARMFUL ONES!', W / 2, 92, PAL.red, { align: 'center' });
      }
    }
  }

  GAMES.push({
    id: 'ai', short: 'AI', title: 'AI GUARDIAN',
    topic: 'RESPONSIBLE AGENTIC AND GENERATIVE AI',
    color: PAL.cyan, dark: '#083344', badgeScore: 250,
    tekis: [
      "HI HI! I'M TEKIS, THE ROBO-CAT OF TECH INNOVATORS SOCIETY! NYA~ ♥",
      "SEE THAT AI AGENT UP THERE? IT'S SPITTING OUT CONTENT SUPER FAST! YOU'RE THE HUMAN IN THE LOOP, OKAY?",
      'READ EVERY BOX AS IT FALLS! CATCH THE GOOD ONES LIKE FACT-CHECKED OR USER CONSENT. PURR-FECT!',
      'BUT DODGE THE BAD STUFF LIKE DEEPFAKE OR DATA LEAK... THOSE COST YOU A HEART! >_<',
      'THE YELLOW GUARDRAIL BLOCKS BAD OUTPUTS FOR A WHILE! MOVE WITH ARROWS OR MOUSE. SURVIVE 60 SECONDS! GO GO~',
    ],
    facts: [
      'AGENTIC AI CAN TAKE ACTIONS ON ITS OWN. KEEP A HUMAN IN THE LOOP FOR HIGH-STAKES DECISIONS.',
      'ALWAYS LABEL AI-GENERATED CONTENT AND FACT-CHECK IT BEFORE SHARING.',
      'PROMPT INJECTION HIDES COMMANDS IN TEXT TO HIJACK AN AI AGENT. NEVER TRUST UNVERIFIED INPUT.',
      'AI CAN HALLUCINATE - CONFIDENTLY STATING FALSE FACTS. VERIFY WITH TRUSTED SOURCES.',
    ],
    create: () => new AIGuardian(),
  });
})();

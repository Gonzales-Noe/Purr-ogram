'use strict';

/* Topic: Sustainable AI and Green Computing — a whack-a-mole style data center manager. */
(() => {
  const RW = 40, RH = 56, DURATION = 60;
  const LABELS = { ok: 'ONLINE', idle: 'IDLE', hot: 'HOT!', job: 'AI JOB', sleep: 'ECO', down: 'DOWN' };
  const COLORS = { ok: PAL.green, idle: PAL.yellow, hot: PAL.red, job: PAL.sky, sleep: '#475569', down: '#7f1d1d' };

  const FLAME = makeSprite([
    '...r...',
    '..rr...',
    '..rro..',
    '.rrorr.',
    '.royor.',
    'rooyoor',
    'royyyor',
    '.ryyyr.',
  ], { r: PAL.red, o: PAL.orange, y: PAL.yellow });

  const SUN = makeSprite([
    '....y....',
    '.y.....y.',
    '...yyy...',
    '..yyyyy..',
    'y.yyyyy.y',
    '..yyyyy..',
    '...yyy...',
    '.y.....y.',
    '....y....',
  ], { y: PAL.yellow });

  class GreenDataCenter {
    constructor() {
      this.score = 0; this.over = false; this.won = false; this.reason = '';
      this.time = DURATION; this.t = 0; this.carbon = 0; this.renew = 0;
      this.cursor = 0; this.spawnT = 1.2; this.solarT = 7;
      this.racks = [];
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 5; c++) this.racks.push({ x: 32 + c * 54, y: 30 + r * 74, state: 'ok', t: 0, dur: 0, solar: 0 });
      }
    }

    mult() { return this.renew > 0 ? 2 : 1; }

    act(i) {
      const k = this.racks[i], cx = k.x + RW / 2, cy = k.y + 20;
      if (k.solar > 0 && k.state === 'ok') {
        k.solar = 0; this.renew = 7;
        Sound.play('power'); FX.burst(cx, cy, PAL.yellow, 16); FX.float(cx, cy - 8, 'RENEWABLE POWER! X2', PAL.yellow);
        return;
      }
      const pts = (n) => n * this.mult();
      switch (k.state) {
        case 'idle': {
          const p = pts(10); this.score += p; k.state = 'sleep'; k.t = 0;
          Sound.play('good'); FX.float(cx, cy, `SLEEP MODE +${p}`, PAL.green); FX.burst(cx, cy, PAL.green, 8);
          break;
        }
        case 'hot': {
          const p = pts(15); this.score += p; k.state = 'ok'; k.t = 0;
          Sound.play('good'); FX.float(cx, cy, `COOLED +${p}`, PAL.cyan); FX.burst(cx, cy, PAL.white, 12);
          break;
        }
        case 'job':
          this.score = Math.max(0, this.score - 20); k.state = 'ok'; k.t = 0; FX.shake = 3;
          Sound.play('hurt'); FX.float(cx, cy, 'AI JOB KILLED! -20', PAL.red);
          break;
        default:
          Sound.play('deny');
      }
    }

    update(dt) {
      this.t += dt; this.time -= dt; this.renew -= dt;
      if (this.time <= 0) {
        this.time = 0; this.over = true; this.won = true;
        this.reason = 'SHIFT COMPLETE - YOUR DATA CENTER STAYED GREEN!'; Sound.play('win');
        return;
      }
      const level = 1 - this.time / DURATION;

      let c = this.cursor % 5, r = Math.floor(this.cursor / 5);
      if (Input.hit('left')) c = (c + 4) % 5;
      if (Input.hit('right')) c = (c + 1) % 5;
      if (Input.hit('up') || Input.hit('down')) r = 1 - r;
      this.cursor = r * 5 + c;

      const m = Input.mouse;
      const hover = this.racks.findIndex(k => pointIn(m, k.x, k.y, RW, RH));
      if (hover >= 0 && (m.moved || m.clicked)) this.cursor = hover;
      if (m.clicked && hover >= 0) this.act(hover);
      else if (Input.hit('action')) this.act(this.cursor);

      const free = () => this.racks.filter(k => k.state === 'ok' && k.solar <= 0);
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = lerp(1.3, 0.5, level) * rand(0.7, 1.3);
        const list = free();
        if (list.length) {
          const k = choice(list), roll = Math.random();
          k.state = roll < 0.4 ? 'idle' : roll < 0.7 ? 'hot' : 'job';
          k.t = 0; k.dur = rand(3, 4.5);
        }
      }
      this.solarT -= dt;
      if (this.solarT <= 0) {
        this.solarT = rand(9, 13);
        const list = free();
        if (list.length) choice(list).solar = 3.5;
      }

      for (const k of this.racks) {
        k.t += dt;
        if (k.solar > 0) k.solar -= dt;
        switch (k.state) {
          case 'idle': this.carbon += 3 * dt; break;
          case 'hot':
            this.carbon += 5 * dt;
            if (k.t > 5) {
              k.state = 'down'; k.t = 0; this.carbon += 12; FX.shake = 4;
              Sound.play('hurt'); FX.float(k.x + RW / 2, k.y + 10, 'OVERHEATED!', PAL.red);
              FX.burst(k.x + RW / 2, k.y + RH / 2, PAL.orange, 16);
            }
            break;
          case 'job':
            if (k.t >= k.dur) {
              const p = 20 * this.mult(); this.score += p; k.state = 'ok'; k.t = 0;
              Sound.play('coin'); FX.float(k.x + RW / 2, k.y + 10, `MODEL TRAINED +${p}`, PAL.sky);
            }
            break;
          case 'sleep':
          case 'down':
            if (k.t > 4) { k.state = 'ok'; k.t = 0; }
            break;
        }
      }
      this.carbon = clamp(this.carbon - (this.renew > 0 ? 5 : 1.5) * dt, 0, 100);
      if (this.carbon >= 100) {
        this.over = true; this.reason = 'CARBON LIMIT EXCEEDED!'; FX.shake = 6; Sound.play('lose');
      }
    }

    drawRack(k, i) {
      const { x, y } = k, col = COLORS[k.state];
      panel(x, y, RW, RH, '#111827', i === this.cursor ? PAL.yellow : '#475569');
      const hotBlink = k.state === 'hot' && Math.floor(this.t * 8) % 2;
      rect(x + 2, y + 2, RW - 4, 9, k.state === 'ok' ? PAL.dark : hotBlink ? PAL.orange : col);
      drawText(LABELS[k.state], x + RW / 2, y + 3, k.state === 'ok' ? PAL.green : '#0b1020', { align: 'center' });

      for (let b = 0; b < 5; b++) {
        const by = y + 14 + b * 8;
        rect(x + 4, by, RW - 8, 6, '#1f2937');
        rect(x + 6, by + 2, 14, 1, '#374151');
        let led = col;
        if (k.state === 'ok') led = Math.floor(this.t * 5 + b * 1.7 + i) % 3 ? PAL.green : '#14532d';
        else if (k.state === 'job') led = Math.floor(this.t * 10) % 5 === b ? PAL.white : PAL.sky;
        else if (k.state === 'hot') led = hotBlink ? PAL.red : PAL.orange;
        else if (k.state === 'sleep') led = PAL.slate;
        else if (k.state === 'down') led = '#000';
        rect(x + RW - 10, by + 2, 2, 2, led);
        rect(x + RW - 7, by + 2, 2, 2, led);
      }

      const cx = x + RW / 2;
      if (k.state === 'idle') {
        panel(cx - 13, y + 22, 26, 13, '#0b1020', PAL.yellow);
        drawText('ZZZ', cx, y + 25 + Math.round(Math.sin(this.t * 4)), PAL.yellow, { align: 'center' });
      } else if (k.state === 'hot') {
        ctx.drawImage(FLAME, cx - 7, y + 20 + (Math.floor(this.t * 10) % 2), 14, 16);
      } else if (k.state === 'job') {
        panel(x + 4, y + 26, RW - 8, 8, '#0b1020', PAL.sky);
        rect(x + 5, y + 27, Math.round((RW - 10) * Math.min(1, k.t / k.dur)), 6, PAL.sky);
      } else if (k.state === 'sleep') {
        ctx.drawImage(ICONS.green, cx - 8, y + 24, 16, 16);
      } else if (k.state === 'down') {
        drawText('X', cx, y + 26, PAL.red, { scale: 2, align: 'center', shadow: '#000' });
      }
      if (k.solar > 0) {
        const bob = Math.round(Math.sin(this.t * 6) * 2);
        if (Math.floor(this.t * 6) % 2) panel(cx - 11, y + 18 + bob, 22, 22, 'rgba(250,204,21,0.2)', PAL.yellow);
        ctx.drawImage(SUN, cx - 9, y + 20 + bob, 18, 18);
      }
    }

    draw() {
      rect(0, 0, W, H, '#0a0f1e');
      for (let x = 0; x < W; x += 20) rect(x, 13, 1, H - 13, '#0f172a');
      this.racks.forEach((k, i) => this.drawRack(k, i));

      hudBar();
      drawText(`SCORE ${this.score}`, 4, 3, PAL.white);
      drawText(`TIME ${Math.ceil(this.time)}`, 130, 3, PAL.cyan, { align: 'center' });
      drawText('CO2', 200, 3, PAL.gray);
      const cc = this.carbon > 70 ? PAL.red : this.carbon > 40 ? PAL.orange : PAL.green;
      bar(222, 4, 94, 5, this.carbon / 100, cc);
      if (this.renew > 0) drawText('RENEWABLE POWER: POINTS X2', W / 2, 18, PAL.yellow, { align: 'center', shadow: '#000' });
      drawText('ZZZ=SLEEP IT  FIRE=COOL IT  AI JOB=LEAVE IT!', W / 2, 167, PAL.gray, { align: 'center' });
    }
  }

  GAMES.push({
    id: 'green', short: 'GREEN', title: 'GREEN DATA CENTER',
    topic: 'SUSTAINABLE AI AND GREEN COMPUTING',
    color: PAL.green, dark: '#052e16', badgeScore: 400,
    tekis: [
      'MEOW~ OUR AI DATA CENTER NEEDS YOUR HELP TO STAY GREEN AND HAPPY!',
      "SERVER SAYS ZZZ? IT'S IDLE AND WASTING POWER, SO CLICK IT TO SLEEP! SERVER ON FIRE? CLICK TO COOL IT DOWN!",
      'BLUE AI JOB? LEAVE IT ALONE SO IT CAN FINISH TRAINING! STOPPING IT LOSES POINTS. >_<',
      'CLICK THE SUN FOR RENEWABLE POWER AND DOUBLE POINTS! USE MOUSE, OR ARROWS + SPACE. KEEP CO2 LOW FOR 60 SECONDS. PURR-FECT!',
    ],
    facts: [
      'IDLE SERVERS STILL DRAW POWER. CONSOLIDATE WORKLOADS AND SLEEP UNUSED MACHINES.',
      'SMALLER, EFFICIENT AI MODELS CAN DELIVER GREAT RESULTS WITH A FRACTION OF THE ENERGY.',
      'SCHEDULE HEAVY AI TRAINING WHEN RENEWABLE ENERGY IS PLENTIFUL.',
      'EFFICIENT COOLING AND RESPONSIBLE E-WASTE RECYCLING MAKE COMPUTING GREENER.',
    ],
    create: () => new GreenDataCenter(),
  });
})();

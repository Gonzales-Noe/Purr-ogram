'use strict';

/* Topic: Edge Intelligence, IoT, and Smart Communities — a snake that carries sensor data to edge nodes. */
(() => {
  const CELL = 8, COLS = 40, ROWS = 20, OY = 20, BASE = 4, DURATION = 90;

  const DEVICES = [
    {
      name: 'TEMP DATA',
      spr: makeSprite(['...ww...', '...wr...', '...wr...', '...wr...', '..wrrw..', '..rrrr..', '..rrrr..', '...rr...'],
        { w: PAL.white, r: PAL.red }),
    },
    {
      name: 'CCTV FEED',
      spr: makeSprite(['........', '.gggg...', 'gwwwgggg', 'gwbwgggg', 'gwwwgggg', '.gggg...', '..g.....', '.ggg....'],
        { g: PAL.gray, w: PAL.white, b: PAL.blue }),
    },
    {
      name: 'STREETLIGHT',
      spr: makeSprite(['..yyyy..', '.yywyyy.', '.yyyyyy.', '.yyyyyy.', '..yyyy..', '...gg...', '...gg...', '........'],
        { y: PAL.yellow, w: PAL.white, g: PAL.gray }),
    },
    {
      name: 'FLOOD LEVEL',
      spr: makeSprite(['...b....', '...b....', '..bbb...', '..bbb...', '.bbwbb..', '.bbbbb..', '..bbb...', '........'],
        { b: PAL.sky, w: PAL.white }),
    },
  ];

  const NODE = makeSprite([
    '.....c..',
    '....c.c.',
    '.....c..',
    'cccccccc',
    'cgcgkkkc',
    'cccccccc',
    'cgcgkkkc',
    'cccccccc',
  ], { c: PAL.cyan, g: PAL.green, k: PAL.navy });

  const BG = makeCanvas(W, H, g => {
    g.fillStyle = '#04121a'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const road = x % 6 === 0 || y % 5 === 0;
        const px = x * CELL, py = OY + y * CELL;
        g.fillStyle = road ? '#0c2733' : '#061a22';
        g.fillRect(px, py, CELL, CELL);
        if (road && x % 6 === 0 && y % 2 === 0 && y % 5) { g.fillStyle = '#1b4250'; g.fillRect(px + 3, py + 2, 2, 4); }
        if (!road && Math.random() < 0.18) { g.fillStyle = Math.random() < 0.5 ? '#3f3a12' : '#12333d'; g.fillRect(px + 3, py + 3, 2, 2); }
      }
    }
    g.fillStyle = PAL.teal;
    g.fillRect(0, OY, W, 1); g.fillRect(0, H - 1, W, 1);
    g.fillRect(0, OY, 1, H - OY); g.fillRect(W - 1, OY, 1, H - OY);
  });

  class EdgeSnake {
    constructor() {
      this.score = 0; this.over = false; this.won = false; this.reason = '';
      this.time = DURATION; this.t = 0;
      this.snake = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }, { x: 7, y: 10 }];
      this.dir = { x: 1, y: 0 }; this.queue = [];
      this.stepT = 0; this.interval = 0.13; this.grow = 0;
      this.carried = 0; this.latency = 0; this.homes = 0;
      this.devices = []; this.node = null;
      for (let i = 0; i < 3; i++) this.spawnDevice();
    }

    occupied(x, y) {
      return this.snake.some(s => s.x === x && s.y === y) ||
        this.devices.some(d => d.x === x && d.y === y) ||
        (this.node && this.node.x === x && this.node.y === y);
    }

    freeCell(minDist = 0) {
      const head = this.snake[0];
      for (let tries = 0; tries < 400; tries++) {
        const x = randi(1, COLS - 2), y = randi(1, ROWS - 2);
        const far = Math.abs(x - head.x) + Math.abs(y - head.y) >= minDist || tries > 300;
        if (far && !this.occupied(x, y)) return { x, y };
      }
      return { x: 1, y: 1 };
    }

    spawnDevice() { this.devices.push({ ...this.freeCell(3), kind: choice(DEVICES) }); }

    crash(msg) {
      this.over = true; this.reason = msg; FX.shake = 5;
      const h = this.snake[0];
      FX.burst(h.x * CELL + 4, OY + h.y * CELL + 4, PAL.red, 16);
      Sound.play('hurt'); Sound.play('lose');
    }

    process() {
      const pts = this.carried * this.carried * 5;
      this.score += pts; this.homes += this.carried;
      for (const s of this.snake.slice(BASE)) FX.burst(s.x * CELL + 4, OY + s.y * CELL + 4, PAL.yellow, 4);
      this.snake.length = Math.min(this.snake.length, BASE);
      this.grow = 0; this.carried = 0; this.latency = 0; this.node = null;
      this.interval = Math.max(0.075, this.interval - 0.006);
      FX.float(W / 2, 40, `EDGE PROCESSED +${pts}`, PAL.cyan);
      Sound.play('power');
    }

    step() {
      while (this.queue.length) {
        const d = this.queue.shift();
        const reverse = d.x === -this.dir.x && d.y === -this.dir.y;
        const same = d.x === this.dir.x && d.y === this.dir.y;
        if (!reverse && !same) { this.dir = d; break; }
      }
      const head = this.snake[0];
      const nx = head.x + this.dir.x, ny = head.y + this.dir.y;
      if (nx < 0 || ny < 0 || nx >= COLS || ny >= ROWS) return this.crash('CONNECTION LOST - HIT THE WALL!');
      const body = this.grow > 0 ? this.snake : this.snake.slice(0, -1);
      if (body.some(s => s.x === nx && s.y === ny)) return this.crash('PACKET COLLISION!');

      this.snake.unshift({ x: nx, y: ny });
      if (this.grow > 0) this.grow--; else this.snake.pop();

      const di = this.devices.findIndex(d => d.x === nx && d.y === ny);
      if (di >= 0) {
        const d = this.devices.splice(di, 1)[0];
        this.carried++; this.grow++; this.score += 5;
        FX.float(nx * CELL + 4, OY + ny * CELL - 6, d.kind.name, PAL.yellow);
        FX.burst(nx * CELL + 4, OY + ny * CELL + 4, PAL.yellow, 6);
        Sound.play('coin');
        this.spawnDevice();
        if (this.carried >= 3 && !this.node) this.node = this.freeCell(10);
      }
      if (this.node && this.node.x === nx && this.node.y === ny) this.process();
    }

    update(dt) {
      this.t += dt; this.time -= dt;
      if (this.time <= 0) {
        this.time = 0; this.over = true; this.won = true;
        this.reason = `${this.homes} SMART HOMES POWERED!`; Sound.play('win');
        return;
      }
      const dirs = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };
      for (const a in dirs) if (Input.hit(a)) this.queue.push(dirs[a]);
      if (this.queue.length > 3) this.queue = this.queue.slice(0, 3);

      this.latency += this.carried * 1.3 * dt;
      if (this.latency >= 100) { this.latency = 100; this.crash('NETWORK OVERLOAD - TOO MUCH LATENCY!'); return; }

      this.stepT += dt;
      while (this.stepT >= this.interval) {
        this.stepT -= this.interval;
        this.step();
        if (this.over) return;
      }
    }

    draw() {
      ctx.drawImage(BG, 0, 0);
      for (const d of this.devices) {
        const x = d.x * CELL, y = OY + d.y * CELL;
        ctx.drawImage(d.kind.spr, x, y);
        if (Math.floor(this.t * 3 + d.x) % 3 === 0) rect(x + 3, y - 2, 2, 1, PAL.cyan);
      }
      if (this.node) {
        const x = this.node.x * CELL, y = OY + this.node.y * CELL;
        rect(x - 2, y - 2, 12, 12, Math.floor(this.t * 6) % 2 ? 'rgba(34,211,238,0.55)' : 'rgba(34,211,238,0.2)');
        ctx.drawImage(NODE, x, y);
        drawText('EDGE', x + 4, y - 9, PAL.cyan, { align: 'center', shadow: '#000' });
      }
      for (let i = this.snake.length - 1; i >= 0; i--) {
        const s = this.snake[i], x = s.x * CELL, y = OY + s.y * CELL;
        if (i === 0) {
          rect(x, y, 8, 8, PAL.cyan);
          const e = this.dir;
          const eyes = e.x ? [[e.x > 0 ? 5 : 1, 1], [e.x > 0 ? 5 : 1, 5]] : [[1, e.y > 0 ? 5 : 1], [5, e.y > 0 ? 5 : 1]];
          for (const [ex, ey] of eyes) rect(x + ex, y + ey, 2, 2, PAL.navy);
        } else if (i < BASE) {
          rect(x + 1, y + 1, 6, 6, i % 2 ? PAL.teal : PAL.cyan);
        } else {
          rect(x + 1, y + 1, 6, 6, PAL.yellow);
          rect(x + 3, y + 3, 2, 2, PAL.orange);
        }
      }

      hudBar(19);
      drawText(`SCORE ${this.score}`, 4, 2, PAL.white);
      drawText(`TIME ${Math.ceil(this.time)}`, W / 2, 2, PAL.cyan, { align: 'center' });
      drawText(`HOMES ${this.homes}`, W - 4, 2, PAL.green, { align: 'right' });
      drawText(`DATA ${this.carried}`, 4, 11, PAL.yellow);
      drawText('LATENCY', 120, 11, PAL.gray);
      const lc = this.latency > 70 ? PAL.red : this.latency > 40 ? PAL.orange : PAL.green;
      bar(166, 12, 150, 5, this.latency / 100, lc);

      if (this.t < 4) {
        panel(40, 120, 240, 31, 'rgba(7,13,36,0.9)', PAL.yellow);
        drawText('COLLECT IOT SENSOR DATA, THEN', W / 2, 124, PAL.white, { align: 'center' });
        drawText('DELIVER IT TO THE EDGE NODE.', W / 2, 133, PAL.cyan, { align: 'center' });
        drawText('MORE DATA = MORE POINTS!', W / 2, 142, PAL.yellow, { align: 'center' });
      }
    }
  }

  GAMES.push({
    id: 'iot', short: 'IOT', title: 'EDGE SNAKE',
    topic: 'EDGE INTELLIGENCE, IOT, AND SMART COMMUNITIES',
    color: PAL.teal, dark: '#042f2e', badgeScore: 300,
    tekis: [
      "PURR~ WELCOME TO THE SMART CITY! HERE YOU'RE A SPEEDY DATA STREAM. HOW COOL IS THAT?",
      'STEER WITH ARROWS OR WASD. MUNCH DATA FROM IOT SENSORS AND YOUR TAIL TURNS YELLOW WITH DATA!',
      'AFTER 3 PACKETS, AN EDGE NODE APPEARS. DELIVER YOUR DATA THERE TO PROCESS IT! MORE DATA = WAY MORE POINTS~',
      "BUT CAREFUL! CARRYING DATA RAISES LATENCY. DON'T OVERLOAD, AND DON'T BONK THE WALLS OR YOUR TAIL! NYA~",
    ],
    facts: [
      'EDGE COMPUTING PROCESSES DATA NEAR WHERE IT IS CREATED, CUTTING LATENCY AND BANDWIDTH.',
      'SMART COMMUNITIES USE IOT SENSORS FOR TRAFFIC, FLOOD ALERTS, STREETLIGHTS AND MORE.',
      'SECURE YOUR IOT DEVICES: CHANGE DEFAULT PASSWORDS AND KEEP FIRMWARE UPDATED.',
      'EDGE AI RUNS MODELS ON-DEVICE, SO SENSITIVE DATA CAN STAY LOCAL AND PRIVATE.',
    ],
    create: () => new EdgeSnake(),
  });
})();

'use strict';

/* Sprites are tiny string grids; each char maps to a palette color, '.' is transparent. */
function makeSprite(rows, pal) {
  return makeCanvas(rows[0].length, rows.length, g => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const color = pal[row[x]];
        if (color) { g.fillStyle = color; g.fillRect(x, y, 1, 1); }
      }
    });
  });
}

const PERSON_TOP = [
  '...hhhh...',
  '..hhhhhh..',
  '..hssssh..',
  '..sesses..',
  '..ssssss..',
  '...ssss...',
  '..bwbbwb..',
  '.bbbwwbbb.',
  '.sbbyybbs.',
  '.sbbbbbbs.',
  '..bbbbbb..',
];
const LEGS_A = ['..pp..pp..', '..pp..pp..', '..kk..kk..'];
const LEGS_B = ['..pp..pp..', '.pp....pp.', '.kk....kk.'];

function makePerson(colors = {}) {
  const pal = Object.assign({
    h: '#3b2414', s: '#f2c08f', e: '#1e293b', b: PAL.blue, w: PAL.white,
    y: PAL.yellow, p: '#1e293b', k: '#0b1020',
  }, colors);
  return { a: makeSprite([...PERSON_TOP, ...LEGS_A], pal), b: makeSprite([...PERSON_TOP, ...LEGS_B], pal) };
}

const PLAYER = makePerson();

const HEART_ROWS = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
const HEART = makeSprite(HEART_ROWS, { r: PAL.red });
const HEART_EMPTY = makeSprite(HEART_ROWS, { r: '#475569' });

function drawHearts(x, y, lives, max = 3) {
  for (let i = 0; i < max; i++) ctx.drawImage(i < lives ? HEART : HEART_EMPTY, x + i * 9, y);
}

const STAR = makeSprite([
  '...y...',
  '...y...',
  'yyyyyyy',
  '.yyyyy.',
  '..yyy..',
  '.yy.yy.',
  'yy...yy',
], { y: PAL.yellow });

const PLANT = makeSprite([
  '.g..g...',
  'gg.gg.g.',
  '.ggggg..',
  '..ggg.gg',
  '...gggg.',
  '...gg...',
  '.bbbbbb.',
  '.bbbbbb.',
  '..bbbb..',
  '..bbbb..',
], { g: PAL.green, b: '#92400e' });

/* One 8x8 icon per conference topic, keyed by game id. */
const ICONS = {
  ai: makeSprite([
    '....y...',
    '....c...',
    '.cccccc.',
    'cckcckcc',
    'cccccccc',
    'cckkkkcc',
    '.cccccc.',
    '..c..c..',
  ], { c: PAL.cyan, y: PAL.yellow, k: PAL.navy }),
  cyber: makeSprite([
    '.bbbbbb.',
    'bbbwwbbb',
    'bbwbbwbb',
    'bbwwwwbb',
    'bbwkkwbb',
    '.bwwwwb.',
    '..bbbb..',
    '...bb...',
  ], { b: PAL.sky, w: PAL.white, k: PAL.navy }),
  iot: makeSprite([
    '...tt...',
    '..tttt..',
    '.tttttt.',
    'tttttttt',
    '.tyttyt.',
    '.tttttt.',
    '.ttkktt.',
    '.ttkktt.',
  ], { t: PAL.teal, y: PAL.yellow, k: PAL.navy }),
  green: makeSprite([
    '......gg',
    '....gggg',
    '..gggglg',
    '.gggglgg',
    '.gglggg.',
    '.glggg..',
    '.lgg....',
    'l.......',
  ], { g: PAL.green, l: PAL.lime }),
  skills: makeSprite([
    '...pp...',
    '.pppppp.',
    'pppppppp',
    '.pppppp.',
    '..pppp.y',
    '..ssss.y',
    '..ssss..',
    '...ss...',
  ], { p: PAL.orange, y: PAL.yellow, s: '#f2c08f' }),
};

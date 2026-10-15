/**
 * PURR-OGRAM (The ConvergeIT Quest) - Google Sheet backup for player records (Tech Innovators Society booth).
 *
 * SETUP (one time, about 5 minutes):
 *  1. Create a new Google Sheet (e.g. "TechIS Booth Players").
 *  2. In the Sheet: Extensions > Apps Script. Delete the sample code and paste this whole file.
 *  3. Change SECRET_KEY below to a long random phrase only your team knows. Save.
 *  4. Deploy > New deployment > type "Web app".
 *       Execute as: Me      Who has access: Anyone
 *     Click Deploy, allow the permissions, and copy the Web app URL (ends with /exec).
 *  5. On Render (your web service > Environment), add:
 *       SHEETS_URL = the Web app URL
 *       SHEETS_KEY = the same SECRET_KEY
 *     Save; Render restarts the game server and it starts syncing.
 *
 * The "Players" tab gets one row per player (name, best score per game, prizes, claimed or not).
 * The last column holds the full record the server reloads on restart - do not edit that column.
 * The first tab becomes "Leaderboard": a styled public board (logo, then one ranked table per date played,
 * newest date first) that rebuilds itself after every sync. To rebuild it by hand: PURR-OGRAM menu > Refresh leaderboard.
 * If you change this script later: Deploy > Manage deployments > Edit > Version: New version.
 */
const SECRET_KEY = 'CHANGE-ME-to-a-long-secret';

const GAMES = ['ai', 'cyber', 'iot', 'green', 'skills'];
const HEAD = ['Player ID', 'Name', 'AI', 'CYBER', 'IOT', 'GREEN', 'SKILLS', 'Total', 'Badges', 'Followed TechIS',
  'Prizes won', 'Unclaimed prizes', 'First played', 'Last played', 'record (do not edit)'];

function doGet(e) {
  if (!e || !e.parameter || e.parameter.key !== SECRET_KEY) return out({ error: 'Wrong key.' });
  return out({ players: readPlayers(), settings: readSettings() });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ error: 'Invalid JSON.' }); }
  if (body.key !== SECRET_KEY) return out({ error: 'Wrong key.' });
  const lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    if (Array.isArray(body.players) && body.players.length) {
      upsertPlayers(body.players);
      try { buildBoard(); } catch (err) { console.error('Leaderboard: ' + err); }
    }
    if (body.settings) writeSettings(body.settings);
  } finally {
    lock.releaseLock();
  }
  return out({ ok: true });
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(name, head) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(head);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, head.length).setFontWeight('bold');
  }
  return sh;
}

function toRow(p) {
  const best = p.best || {}, prizes = p.prizes || [];
  const total = GAMES.reduce((s, g) => s + (best[g] || 0), 0);
  return [
    p.id, p.name, ...GAMES.map(g => best[g] || 0), total, (p.badges || []).length, p.bonus ? 'YES' : 'NO',
    prizes.map(x => x.prize + (x.claimed ? ' (claimed)' : '')).join(' + '),
    prizes.filter(x => !x.claimed).map(x => x.prize).join(' + '),
    new Date(p.created), new Date(p.updated || p.created), JSON.stringify(p),
  ];
}

function upsertPlayers(players) {
  const sh = sheet('Players', HEAD);
  const last = sh.getLastRow();
  const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
  const fresh = [];
  players.forEach(p => {
    if (!p || !p.id) return;
    const row = toRow(p), i = ids.indexOf(String(p.id));
    if (i >= 0) sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
    else { fresh.push(row); ids.push(String(p.id)); }
  });
  if (fresh.length) sh.getRange(sh.getLastRow() + 1, 1, fresh.length, HEAD.length).setValues(fresh);
}

function readPlayers() {
  const sh = sheet('Players', HEAD);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, HEAD.length, last - 1, 1).getValues()
    .map(r => { try { return JSON.parse(r[0]); } catch (err) { return null; } })
    .filter(Boolean);
}

function readSettings() {
  const v = sheet('Settings', ['what', 'value']).getRange('B2').getValue();
  try { return v ? JSON.parse(v) : null; } catch (err) { return null; }
}

function writeSettings(settings) {
  sheet('Settings', ['what', 'value']).getRange('A2:B2').setValues([['prizes + staff PIN', JSON.stringify(settings)]]);
}

// ---------- Leaderboard (first tab) ----------

const BOARD = 'Leaderboard';
const BOARD_MAX = 100;
const BOARD_TOP = 9; // first row below the stat cards + spacer
const TZ = 'Asia/Manila';
const BOARD_COLS = 11;
const NAVY = '#0b1736', INK = '#1e293b', MUTED = '#64748b', LINE = '#e2e8f0';
const BOARD_GAMES = [
  ['AI\nGUARDIAN', '#1289b5'], ['FIREWALL\nDEFENDER', '#f2476f'], ['EDGE\nSNAKE', '#e9a10f'],
  ['GREEN DATA\nCENTER', '#06a77d'], ['SKILL\nRUNNER', '#6d5dfc'],
];
const MEDALS = [['🥇', '#fff6d5'], ['🥈', '#eef2f7'], ['🥉', '#fdebdc']];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('PURR-OGRAM').addItem('Refresh leaderboard', 'buildBoard').addToUi();
}

function boardSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(BOARD);
  if (!sh) {
    sh = ss.getSheets().find(s => s.getName() !== 'Players' && s.getName() !== 'Settings') || ss.insertSheet();
    sh.setName(BOARD);
  }
  if (sh.getIndex() !== 1) { ss.setActiveSheet(sh); ss.moveActiveSheet(1); }
  return sh;
}

function fitSheet(sh, rows, cols) {
  const r = sh.getMaxRows(), c = sh.getMaxColumns();
  if (r < rows) sh.insertRowsAfter(r, rows - r); else if (r > rows) sh.deleteRows(rows + 1, r - rows);
  if (c < cols) sh.insertColumnsAfter(c, cols - c); else if (c > cols) sh.deleteColumns(cols + 1, c - cols);
}

function buildBoard() {
  const sh = boardSheet();
  const all = readPlayers().map(p => {
    const best = p.best || {}, prizes = p.prizes || [];
    const day = Utilities.formatDate(new Date(p.created || p.updated || Date.now()), TZ, 'yyyy-MM-dd');
    return { p, best, prizes, day, total: GAMES.reduce((s, g) => s + (best[g] || 0), 0), badges: (p.badges || []).length };
  });
  all.sort((a, b) => b.total - a.total || b.badges - a.badges || (a.p.created || 0) - (b.p.created || 0));
  const days = [...new Set(all.map(x => x.day))].sort().reverse()
    .map(day => ({ day, list: all.filter(x => x.day === day).slice(0, BOARD_MAX) }));
  // Each date: banner row + header row + player rows + spacer row.
  const rows = BOARD_TOP - 2 + (days.length ? days.reduce((s, d) => s + d.list.length + 3, 0) : 1);

  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).breakApart();
  sh.clear();
  fitSheet(sh, rows, BOARD_COLS);
  sh.setHiddenGridlines(true);
  sh.getRange(1, 1, rows, BOARD_COLS).setFontFamily('Montserrat').setVerticalAlignment('middle');

  [80, 170, 104, 104, 104, 104, 104, 96, 112, 220, 126].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  [44, 24, 24, 6, 20, 36, 14].forEach((h, i) => sh.setRowHeight(i + 1, h));

  // Header band with logo, game title, full org name and event.
  sh.getRange(1, 1, 3, BOARD_COLS).setBackground(NAVY);
  sh.getRange('B1:K1').merge().setValue('PURR-OGRAM: THE CONVERGEIT QUEST  ·  HALL OF FAME')
    .setFontSize(20).setFontWeight('bold').setFontColor('#ffffff');
  sh.getRange('B2:K2').merge().setValue('TECH INNOVATORS SOCIETY (TechIS)')
    .setFontSize(12).setFontWeight('bold').setFontColor('#22d3ee');
  sh.getRange('B3:K3').merge()
    .setValue('Batangas State University – The National Engineering University, Lipa Campus   ·   ConvergeIT Conference 2026  ·  October 17, 2026  ·  Lipa City')
    .setFontSize(9).setFontColor('#cbd5e1');
  const stripe = ['#f2476f', '#1289b5', '#06d6a0', '#ffd166'];
  sh.getRange(4, 1, 1, BOARD_COLS).setBackgrounds([Array.from({ length: BOARD_COLS }, (_, i) => stripe[i % 4])]);
  if (!sh.getImages().length && LOGO_PNG) {
    const img = sh.insertImage(Utilities.newBlob(Utilities.base64Decode(LOGO_PNG), 'image/png', 'techis.png'), 1, 1, 12, 8);
    img.setHeight(76).setWidth(68);
  }
  sh.setFrozenRows(4);

  // Stat cards (all dates together).
  const winners = all.filter(x => x.prizes.length).length;
  const unclaimed = all.reduce((s, x) => s + x.prizes.filter(z => !z.claimed).length, 0);
  const cards = [
    ['A5:B5', 'A6:B6', 'PLAYERS (ALL DATES)', all.length],
    ['C5:E5', 'C6:E6', 'COMPLETED ALL 5 BADGES', all.filter(x => x.badges >= GAMES.length).length],
    ['F5:H5', 'F6:H6', 'PRIZE WINNERS', winners],
    ['I5:J5', 'I6:J6', 'PRIZES TO CLAIM', unclaimed],
    ['K5', 'K6', 'UPDATED', Utilities.formatDate(new Date(), TZ, 'MMM d, h:mm a')],
  ];
  cards.forEach(([lab, val, label, value]) => {
    sh.getRange(lab).merge().setValue(label).setBackground('#eef2ff').setFontColor(MUTED)
      .setFontSize(8).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(val).merge().setValue(value).setBackground('#eef2ff').setFontColor(NAVY)
      .setFontSize(typeof value === 'number' ? 18 : 10).setFontWeight('bold').setHorizontalAlignment('center');
    sh.getRange(lab.split(':')[0] + ':' + val.split(':').pop())
      .setBorder(true, true, true, true, null, null, '#ffffff', SpreadsheetApp.BorderStyle.SOLID_THICK);
  });

  if (!days.length) {
    sh.getRange(BOARD_TOP - 1, 1, 1, BOARD_COLS).merge().setValue('No players yet - come play PURR-OGRAM at the TechIS booth!')
      .setHorizontalAlignment('center').setFontColor(MUTED).setFontStyle('italic');
    return;
  }
  let row = BOARD_TOP - 1;
  days.forEach(d => { row = drawDay(sh, row, d.day, d.list); });
}

// One date's table: date banner, column headers, ranked players. Returns the next free row.
function drawDay(sh, row, day, list) {
  const date = Utilities.parseDate(day, TZ, 'yyyy-MM-dd');
  const won = list.filter(x => x.prizes.length).length;
  sh.setRowHeight(row, 32);
  sh.getRange(row, 1, 1, 8).merge()
    .setValue('📅  ' + Utilities.formatDate(date, TZ, 'EEEE, MMMM d, yyyy').toUpperCase())
    .setFontSize(12).setFontWeight('bold').setFontColor('#ffffff').setBackground('#1289b5');
  sh.getRange(row, 9, 1, 3).merge()
    .setValue(list.length + (list.length === 1 ? ' PLAYER' : ' PLAYERS') + '  ·  ' + won + (won === 1 ? ' WINNER' : ' WINNERS'))
    .setFontSize(9).setFontWeight('bold').setFontColor('#e0f2fe').setBackground('#1289b5').setHorizontalAlignment('right');

  const headRow = row + 1;
  sh.setRowHeight(headRow, 42);
  sh.getRange(headRow, 1, 1, BOARD_COLS)
    .setValues([['RANK', 'PLAYER', ...BOARD_GAMES.map(g => g[0]), 'TOTAL', 'BADGES', 'PRIZES WON', 'PRIZE STATUS']])
    .setBackground(NAVY).setFontColor('#ffffff').setFontSize(9).setFontWeight('bold')
    .setHorizontalAlignment('center').setWrap(true);
  BOARD_GAMES.forEach((g, i) => sh.getRange(headRow, 3 + i).setBackground(g[1]));
  sh.getRange(headRow, 2).setHorizontalAlignment('left');
  sh.getRange(headRow, 10).setHorizontalAlignment('left');

  const top = headRow + 1, n = list.length;
  const values = [], bgs = [], colors = [];
  list.forEach((x, i) => {
    const medal = MEDALS[i];
    const open = x.prizes.filter(z => !z.claimed).length;
    const status = !x.prizes.length ? '' : open ? 'TO CLAIM (' + open + ')' : 'CLAIMED';
    values.push([
      medal ? medal[0] + ' ' + (i + 1) : i + 1, x.p.name, ...GAMES.map(g => x.best[g] || 0), x.total,
      '★'.repeat(x.badges) + '☆'.repeat(Math.max(0, GAMES.length - x.badges)),
      x.prizes.map(z => z.prize).join(', '), status,
    ]);
    bgs.push(Array(BOARD_COLS).fill(medal ? medal[1] : i % 2 ? '#f8fafc' : '#ffffff'));
    const c = Array(BOARD_COLS).fill(INK);
    c[8] = x.badges >= GAMES.length ? '#d4a106' : '#94a3b8';
    c[10] = open ? '#ea580c' : '#059669';
    colors.push(c);
  });
  sh.setRowHeights(top, n, 30);
  sh.getRange(top, 1, n, BOARD_COLS).setValues(values).setBackgrounds(bgs).setFontColors(colors).setFontSize(10)
    .setBorder(null, null, true, null, null, true, LINE, SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange(top, 1, n, 1).setHorizontalAlignment('center').setFontWeight('bold');
  sh.getRange(top, 2, n, 1).setFontWeight('bold');
  sh.getRange(top, 3, n, 6).setHorizontalAlignment('center').setNumberFormat('#,##0;-#,##0;"–"');
  sh.getRange(top, 8, n, 1).setFontWeight('bold').setFontColor(NAVY).setFontSize(11);
  sh.getRange(top, 9, n, 1).setHorizontalAlignment('center').setFontSize(12);
  sh.getRange(top, 10, n, 1).setWrap(true).setFontSize(9);
  sh.getRange(top, 11, n, 1).setHorizontalAlignment('center').setFontWeight('bold').setFontSize(9);
  sh.setRowHeight(top + n, 22);
  return top + n + 1;
}

// TechIS logo (PNG, base64) for the leaderboard header.
const LOGO_PNG = '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';

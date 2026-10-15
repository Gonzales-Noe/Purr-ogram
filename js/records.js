'use strict';

/* Permanent player records: name, best score per game, badges and prizes won.
   NEW PLAYER never clears these. Saved first on this device (browser storage, works offline;
   export as JSON/CSV at /admin), then synced to the server whenever it can be reached. */
const NAME_MAX = 10;

const Records = {
  key: 'convergeit-records-2026',
  data: { players: {}, pending: [] },
  board: null,
  syncing: null,
  online: location.protocol.startsWith('http'),

  load() {
    try {
      const d = JSON.parse(localStorage.getItem(this.key));
      if (d && d.players) this.data = { players: d.players, pending: Array.isArray(d.pending) ? d.pending : [] };
    } catch (e) { /* storage unavailable: records live for this session only */ }
    this.sync();
    window.addEventListener('online', () => this.sync());
    setInterval(() => this.sync(), 30000);
  },
  store() {
    try { localStorage.setItem(this.key, JSON.stringify(this.data)); } catch (e) { /* ignore */ }
  },

  get me() { const p = Save.data.player; return (p && this.data.players[p.id]) || null; },
  get name() { return this.me ? this.me.name : ''; },

  newPlayer(name) {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
    this.data.players[id] = { id, name, created: Date.now(), best: {}, badges: {}, bonus: false, prizes: [], v: 0 };
    Save.data.player = { id };
    Save.store();
    this.changed();
  },
  best(game) { return (this.me && this.me.best[game]) || 0; },
  score(game, score, badge) {
    const p = this.me;
    if (!p) return;
    p.best[game] = Math.max(p.best[game] || 0, score);
    if (badge) p.badges[game] = true;
    this.changed();
  },
  prize(label) {
    const p = this.me;
    if (!p) return;
    p.prizes.push({ prize: label, at: Date.now() });
    this.changed();
  },
  bonus() {
    const p = this.me;
    if (!p) return;
    p.bonus = true;
    this.changed();
  },

  changed() {
    const p = this.me;
    if (p) {
      p.v = (p.v || 0) + 1;
      if (!this.data.pending.includes(p.id)) this.data.pending.push(p.id);
    }
    this.store();
    this.sync();
  },
  /* Sends players with unsaved changes to the booth server, one at a time; retried on the next change. */
  sync() {
    if (this.syncing) return this.syncing;
    if (!this.online || !this.data.pending.length) return Promise.resolve();
    const id = this.data.pending[0], p = this.data.players[id];
    if (!p) { this.data.pending.shift(); this.store(); return this.sync(); }
    const sent = p.v;
    this.syncing = fetch('/api/record', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) })
      .then(r => {
        if ((r.ok || r.status === 400) && p.v === sent) this.data.pending = this.data.pending.filter(x => x !== id);
        this.store();
        return r.ok;
      })
      .catch(() => false)
      .then(ok => { this.syncing = null; return ok ? this.sync() : undefined; });
    return this.syncing;
  },

  /* Public high scores: every player's name and best score per mini-game, ranked by total.
     Uses the booth server's list (all devices) when reachable, else this device's records. */
  refreshBoard() {
    if (!this.online) return Promise.resolve();
    return this.sync()
      .then(() => fetch('/api/leaderboard', { cache: 'no-store' }))
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && Array.isArray(d.players)) this.board = d.players; })
      .catch(() => {});
  },
  leaders(limit = 8) {
    if (this.board) return this.board.slice(0, limit);
    const total = p => Object.values(p.best).reduce((s, v) => s + v, 0);
    return Object.values(this.data.players)
      .filter(p => total(p) > 0)
      .sort((a, b) => total(b) - total(a) || a.created - b.created)
      .slice(0, limit)
      .map(p => ({ name: p.name, scores: p.best }));
  },
};

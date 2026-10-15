'use strict';

/* Extra lines Tekis says out loud (dialogue pages and result cheers are voiced too).
   After editing any spoken text, re-record with:  python tools/make_voice.py */
const TEKIS_SAYS = {
  allBadges: "Purr-fect! You got all 5 badges! Let's spin my prize wheel!",
  wheelHello: 'Welcome to my prize wheel! Spin it!',
  wheelSummary: 'Here are your prizes!',
  spinning: 'Go go go!',
  spinAgain: 'Spin again!',
  won: `Yay! You won! Show this screen to a ${ORG.short} member!`,
  bonusAsk: `Want a bonus spin? Scan my QR code and follow ${ORG.short}, then show a ${ORG.short} member. Pretty please!`,
  bonusOk: 'Yay! Thank you for following! Bonus spin unlocked!',
  wrongPin: 'Oops! Wrong pin!',
  askName: "Hi hi! What's your name?",
  splash: "Welcome to Purr-ogram! Let's go!",
};

/* Same FNV-1a hash as tools/make_voice.py: maps a line of text to its recorded clip. */
function voiceKey(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h.toString(16).padStart(8, '0');
}

/* Plays Tekis's pre-recorded robo-cat voice clips from audio/voice/. Lines without a clip stay silent.
   Clips go through the Web Audio context (unlocked by the first tap/key), because iPad/iPhone Safari
   blocks new Audio() elements that are not started directly inside a tap. */
const Voice = {
  src: null, playing: false, token: 0, buffers: new Map(),
  get speaking() { return this.playing; },
  load(key) {
    if (this.buffers.has(key)) return this.buffers.get(key);
    const ac = Sound.ac;
    const p = fetch(`audio/voice/${key}.mp3`)
      .then(r => (r.ok ? r.arrayBuffer() : null))
      .then(data => data && new Promise(done => ac.decodeAudioData(data, done, () => done(null))))
      .catch(() => null);
    this.buffers.set(key, p);
    if (this.buffers.size > 8) this.buffers.delete(this.buffers.keys().next().value);
    return p;
  },
  say(text) {
    this.stop();
    if (Sound.muted || !text || !Sound.ac) return;
    const key = voiceKey(text);
    if (typeof VOICE_CLIPS === 'undefined' || !VOICE_CLIPS.has(key)) return;
    const token = this.token;
    this.playing = true;
    this.load(key).then(buf => {
      if (token !== this.token) return;
      if (!buf || Sound.muted) { this.playing = false; return; }
      const src = Sound.ac.createBufferSource();
      src.buffer = buf;
      src.connect(Sound.ac.destination);
      src.onended = () => { if (this.src === src) { this.src = null; this.playing = false; } };
      this.src = src;
      src.start();
    });
  },
  stop() {
    this.token++;
    this.playing = false;
    if (this.src) { try { this.src.stop(); } catch (e) { /* already stopped */ } this.src = null; }
  },
};

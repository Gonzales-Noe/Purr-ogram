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

/* Plays Tekis's pre-recorded robo-cat voice clips from audio/voice/. Lines without a clip stay silent. */
const Voice = {
  audio: null,
  get speaking() { return !!this.audio && !this.audio.paused && !this.audio.ended; },
  say(text) {
    this.stop();
    if (Sound.muted || !text) return;
    const key = voiceKey(text);
    if (typeof VOICE_CLIPS === 'undefined' || !VOICE_CLIPS.has(key)) return;
    this.audio = new Audio(`audio/voice/${key}.mp3`);
    this.audio.play().catch(() => {});
  },
  stop() {
    if (this.audio) { this.audio.pause(); this.audio = null; }
  },
};

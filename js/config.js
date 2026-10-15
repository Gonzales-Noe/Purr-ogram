'use strict';

const ORG = {
  name: 'TECH INNOVATORS SOCIETY',
  short: 'TECHIS',
  mascot: 'TEKIS',
  // TechIS Facebook page; the in-game QR codes regenerate from this.
  qrUrl: 'https://web.facebook.com/TechISBatStateUTNEULipa',
  qrLabel: 'FOLLOW TECHIS!',
  // Staff PIN for the follow bonus spin. Only used when the game is opened without server.py;
  // with server.py running, set the PIN at /admin instead.
  staffPin: '2026',
};

// Default prize wheel (unlocked after all 5 badges). With server.py running, edit prizes at /admin instead.
// weight = slice size: a weight-3 prize is three times as likely as a weight-1 prize. 0 = out of stock (hidden).
// Keep labels short (max 18 chars).
const PRIZES = [
  { label: 'STICKER', weight: 3 },
  { label: 'CANDY', weight: 3 },
  { label: 'BUTTON PIN', weight: 2 },
  { label: 'BOOKMARK', weight: 2 },
  { label: 'KEYCHAIN', weight: 1 },
  { label: 'MYSTERY PRIZE', weight: 1 },
];

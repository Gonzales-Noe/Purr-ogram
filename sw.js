'use strict';

/* Lets the game open without internet after one online visit (/admin always needs the server).
   Network first, so updates show up immediately when online; cached copy when offline. */
importScripts('/js/voice-manifest.js');

const CACHE = 'convergeit-quest-v4';
const CORE = [
  '/', '/manifest.webmanifest', '/favicon.svg', '/icons/icon-192.png', '/icons/icon-512.png',
  '/icons/maskable-512.png', '/icons/apple-touch-icon.png', '/css/style.css', '/js/config.js', '/js/engine.js', '/js/records.js', '/js/font.js', '/js/sprites.js',
  '/js/qr.js', '/js/voice-manifest.js', '/js/voice.js', '/js/tekis.js', '/js/games/ai-guardian.js',
  '/js/games/firewall-defender.js', '/js/games/edge-snake.js', '/js/games/green-datacenter.js',
  '/js/games/skill-runner.js', '/js/scenes.js', '/js/install.js', '/js/main.js',
  ...[...VOICE_CLIPS].map(id => '/audio/voice/' + id + '.mp3'),
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;
  const key = url.pathname === '/index.html' ? '/' : url.pathname;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key).then(hit => hit || Response.error())),
  );
});

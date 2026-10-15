'use strict';

Save.load();
Records.load();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/sw.js').catch(() => {});
title = new TitleScene();
hub = new HubScene();

if (matchMedia('(any-pointer: coarse)').matches || navigator.maxTouchPoints > 1) document.body.classList.add('touch');
let typedCode = '';
window.addEventListener('keydown', e => {
  if (!/^[a-z0-9]$/i.test(e.key)) return;
  const code = ORG.adminCode.toUpperCase();
  typedCode = (typedCode + e.key.toUpperCase()).slice(-code.length);
  if (code && typedCode === code) { typedCode = ''; Voice.stop(); location.href = '/admin/login'; }
});
// iPad only (no keyboard for the code): 5 quick taps on the title screen's top-right corner open the admin page.
const isIPad = /iPad/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
let adminTaps = 0, lastAdminTap = 0;
if (isIPad) canvas.addEventListener('pointerdown', e => {
  const p = pointerPos(e), now = performance.now();
  if (Game.scene !== title || p.x < W - 70 || p.y > 24) { adminTaps = 0; return; }
  adminTaps = now - lastAdminTap < 600 ? adminTaps + 1 : 1;
  lastAdminTap = now;
  if (adminTaps >= 5) { adminTaps = 0; Voice.stop(); location.href = '/admin/login'; }
});
// iPad Safari ignores user-scalable=no; block pinch and double-tap zoom so taps stay on the game.
['gesturestart', 'dblclick'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
document.querySelectorAll('#touch [data-act]').forEach(btn => {
  const act = btn.dataset.act;
  const on = e => { e.preventDefault(); Sound.init(); Input.press(act); };
  const off = e => { e.preventDefault(); Input.release(act); };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('pointercancel', off);
});

Music.load();
Game.go(title);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (Input.hit('mute')) { Sound.toggle(); if (Sound.muted) Voice.stop(); FX.float(W / 2, H / 2, Sound.muted ? 'SOUND OFF' : 'SOUND ON', PAL.yellow); }
  if (Input.hit('fullscreen')) toggleFullscreen();
  if (Input.hit('volup')) Music.change(0.5);
  if (Input.hit('voldown')) Music.change(-0.5);

  Game.scene.update(dt);
  Install.update(Game.scene === title);
  if (!Game.paused) FX.update(dt);
  Music.update();

  rect(0, 0, W, H, '#000');
  ctx.save();
  if (FX.shake > 0.5) ctx.translate(Math.round(rand(-FX.shake, FX.shake)), Math.round(rand(-FX.shake, FX.shake)));
  Game.scene.draw();
  FX.draw();
  ctx.restore();
  Music.drawLevel(dt);

  Input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

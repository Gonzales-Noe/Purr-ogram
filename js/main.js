'use strict';

Save.load();
Records.load();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('/sw.js').catch(() => {});
title = new TitleScene();
hub = new HubScene();

if (window.matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
document.querySelectorAll('#touch [data-act]').forEach(btn => {
  const act = btn.dataset.act;
  const on = e => { e.preventDefault(); Sound.init(); Input.press(act); };
  const off = e => { e.preventDefault(); Input.release(act); };
  btn.addEventListener('pointerdown', on);
  btn.addEventListener('pointerup', off);
  btn.addEventListener('pointerleave', off);
  btn.addEventListener('pointercancel', off);
});

Game.go(title);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;

  if (Input.hit('mute')) { Sound.toggle(); if (Sound.muted) Voice.stop(); FX.float(W / 2, H / 2, Sound.muted ? 'SOUND OFF' : 'SOUND ON', PAL.yellow); }
  if (Input.hit('fullscreen')) toggleFullscreen();

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

  Input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

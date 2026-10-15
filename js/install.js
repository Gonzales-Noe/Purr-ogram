'use strict';

/* "Install app" button. Chrome/Edge (laptop, Android) fire beforeinstallprompt only while the app is NOT
   installed, so the button disappears by itself once installed. Apple browsers have no install prompt:
   the button shows the Add to Home Screen / Add to Dock steps instead. Inside the installed app it never shows. */
const Install = (() => {
  const btn = document.getElementById('install');
  const help = document.getElementById('install-help');
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const macSafari = !iOS && /Macintosh/.test(ua) && /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
  let prompt = null;

  const standalone = () => navigator.standalone === true ||
    matchMedia('(display-mode: standalone), (display-mode: fullscreen), (display-mode: minimal-ui)').matches;

  function guide() {
    help.querySelector('.steps').innerHTML = iOS
      ? 'Tap <b>Share</b> <span class="ico">&#x2191;</span> in the browser bar,<br>then <b>Add to Home Screen</b>.'
      : 'In the menu bar choose <b>File</b> &rarr; <b>Add to Dock</b>.';
    help.hidden = false;
  }

  function markInstalled() {
    prompt = null;
    help.hidden = true;
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    prompt = e;
  });
  window.addEventListener('appinstalled', markInstalled);

  btn.addEventListener('click', async () => {
    btn.blur();
    Sound.init();
    if (!prompt) return guide();
    const event = prompt;
    prompt = null;
    event.prompt();
    const choice = await event.userChoice.catch(() => null);
    if (choice && choice.outcome === 'accepted') markInstalled();
  });
  help.querySelector('button').addEventListener('click', () => { help.hidden = true; });

  return {
    available() {
      if (standalone()) return false;
      if (prompt) return true;
      return iOS || macSafari;
    },
    update(show) {
      const visible = show && this.available();
      if (btn.hidden === visible) btn.hidden = !visible;
      if (!visible && !help.hidden && standalone()) help.hidden = true;
    },
  };
})();

(() => {
  const switcher = document.querySelector('.locale-switch');
  if (!switcher) return;
  const videoKey = video => (video.querySelector('source')?.getAttribute('src') || video.getAttribute('src') || '').split('?')[0].split('/').pop();
  try {
    const saved = JSON.parse(sessionStorage.getItem('neo-locale-playback') || 'null');
    if (saved && saved.path === location.pathname) {
      sessionStorage.removeItem('neo-locale-playback');
      if (Number.isInteger(saved.step)) document.querySelector('[data-lesson-step="' + saved.step + '"]')?.click();
      for (const video of document.querySelectorAll('video')) {
        const time = saved.times[videoKey(video)];
        if (!Number.isFinite(time) || time <= 0) continue;
        video.pause();
        const restore = () => { video.currentTime = Math.min(time, video.duration || time); video.pause(); };
        if (video.readyState >= 1) restore();
        else { video.addEventListener('loadedmetadata', restore, {once: true}); video.load(); }
      }
    }
  } catch (_) {}
  for (const a of switcher.querySelectorAll('a')) {
    const target = new URL(a.href);
    target.search = location.search;
    target.hash = location.hash;
    a.href = target.href;
    a.addEventListener('click', () => {
      try { localStorage.setItem('neo-site-language', a.hreflang); } catch (_) {}
      try {
        const tab = document.querySelector('[data-lesson-step][aria-selected="true"]');
        const times = Object.fromEntries([...document.querySelectorAll('video')].map(video => [videoKey(video), video.currentTime]));
        sessionStorage.setItem('neo-locale-playback', JSON.stringify({path: target.pathname, times, step: tab ? Number(tab.dataset.lessonStep) : null}));
      } catch (_) {}
    });
  }
})();

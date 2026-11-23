(() => {
  const switcher = document.querySelector('.locale-switch');
  if (!switcher) return;
  for (const a of switcher.querySelectorAll('a')) {
    const target = new URL(a.href);
    target.search = location.search;
    target.hash = location.hash;
    a.href = target.href;
    a.addEventListener('click', () => {
      try { localStorage.setItem('neo-site-language', a.hreflang); } catch (_) {}
    });
  }
})();

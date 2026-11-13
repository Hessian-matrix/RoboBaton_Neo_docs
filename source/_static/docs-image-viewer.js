(() => {
  const links = [...document.querySelectorAll('.web-page-card a.page-preview, .web-page-overview a.image-reference')];
  if (!links.length) return;
  for (const link of links) {
    link.target = '_blank';
    link.rel = 'noopener';
  }
  if (typeof HTMLDialogElement === 'undefined') return;
  const dialog = document.createElement('dialog');
  dialog.className = 'docs-image-viewer';
  dialog.setAttribute('aria-label', '图片查看器');
  dialog.innerHTML = '<div class="docs-image-toolbar"><span class="docs-image-title"></span><button type="button" data-image-size aria-pressed="false">原尺寸</button><button type="button" data-image-close autofocus aria-label="关闭大图，返回文档">关闭 ×</button></div><div class="docs-image-stage" tabindex="0" aria-label="图片区域，原尺寸下可滚动查看"><img alt=""></div>';
  document.body.append(dialog);
  const image = dialog.querySelector('img');
  const stage = dialog.querySelector('.docs-image-stage');
  const size = dialog.querySelector('[data-image-size]');
  let opener;
  let previousOverflow;
  const fit = () => {
    dialog.classList.remove('is-original');
    size.textContent = '原尺寸';
    size.setAttribute('aria-pressed', 'false');
    stage.scrollTo(0, 0);
  };
  for (const link of links) {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      opener = link;
      image.src = link.href;
      image.alt = link.querySelector('img').alt;
      dialog.querySelector('.docs-image-title').textContent = image.alt;
      fit();
      previousOverflow = document.body.style.overflow;
      dialog.showModal();
      document.body.style.overflow = 'hidden';
    });
  }
  size.addEventListener('click', () => {
    if (dialog.classList.contains('is-original')) {
      fit();
    } else {
      dialog.classList.add('is-original');
      size.textContent = '适应窗口';
      size.setAttribute('aria-pressed', 'true');
    }
  });
  dialog.querySelector('[data-image-close]').addEventListener('click', () => dialog.close());
  let backdropDown = false;
  dialog.addEventListener('pointerdown', event => { backdropDown = event.target === dialog; });
  dialog.addEventListener('click', event => {
    if (backdropDown && event.target === dialog) dialog.close();
    backdropDown = false;
  });
  dialog.addEventListener('close', () => {
    document.body.style.overflow = previousOverflow;
    opener?.focus({preventScroll: true});
  });
})();

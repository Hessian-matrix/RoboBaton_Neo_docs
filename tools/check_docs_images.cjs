const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'release/docs-images');
const profile = path.join(root, 'tmp/image-viewer-test-' + Date.now());
const base = process.env.DOCS_URL || 'http://127.0.0.1:8873/docs/web-guide.html';
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
fs.mkdirSync(output, {recursive: true});
fs.mkdirSync(profile, {recursive: true});
const chrome = spawn(process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'
], {windowsHide: true, stdio: 'ignore'});
chrome.on('error', error => { console.error(error); process.exitCode = 1; });
let socket;
const pending = new Map();
let sequence = 0;
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const identity = ++sequence;
    const timer = setTimeout(() => {pending.delete(identity); reject(Error('CDP timeout: ' + method));}, 15000);
    pending.set(identity, {resolve, reject, timer});
    socket.send(JSON.stringify({id: identity, method, params}));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function click(selector) {
  await evaluate('document.querySelector(' + JSON.stringify(selector) + ').scrollIntoView({block: "center", behavior: "instant"})');
  await pause(250);
  const point = await evaluate('(() => {const rect = document.querySelector(' + JSON.stringify(selector) + ').getBoundingClientRect(); return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};})()');
  await send('Input.dispatchMouseEvent', {type: 'mousePressed', ...point, button: 'left', clickCount: 1});
  await send('Input.dispatchMouseEvent', {type: 'mouseReleased', ...point, button: 'left', clickCount: 1});
  await pause(80);
}
(async () => {
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    const filename = path.join(profile, 'DevToolsActivePort');
    if (fs.existsSync(filename)) {port = fs.readFileSync(filename, 'utf8').split('\n')[0]; break;}
    await pause(100);
  }
  assert(port, 'Chrome debugging endpoint');
  const targets = await (await fetch('http://127.0.0.1:' + port + '/json')).json();
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {socket.onopen = resolve; socket.onerror = reject;});
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    const request = pending.get(message.id);
    if (!request) return;
    pending.delete(message.id);
    clearTimeout(request.timer);
    if (message.error) request.reject(Error(JSON.stringify(message.error)));
    else request.resolve(message.result);
  };
  await send('Page.enable');
  await send('Page.navigate', {url: base});
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate('document.readyState === "complete" && !!document.querySelector(".docs-image-viewer")')) break;
    await pause(100);
  }
  assert(await evaluate('!!document.querySelector(".docs-image-viewer")'));
  const report = [];
  for (const width of [1440, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: false});
    await pause(500);
    for (const theme of ['light', 'dark']) {
      await evaluate('document.documentElement.dataset.theme = ' + JSON.stringify(theme));
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".device-entry")).backgroundColor'), theme === 'dark' ? 'rgb(28, 31, 35)' : 'rgb(246, 247, 248)');
      assert(await evaluate('Math.abs(document.querySelector(".web-page-card").getBoundingClientRect().width - document.querySelector(".web-page-grid").getBoundingClientRect().width) < 2'));
      await evaluate('scrollTo({left: 0, top: 0, behavior: "instant"})');
      await pause(250);
      let screenshot = await send('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(output, 'page-' + width + '-' + theme + '.png'), Buffer.from(screenshot.data, 'base64'));
      await click('.web-page-card a.page-preview');
      assert(await evaluate('document.querySelector(".docs-image-viewer").open'));
      const scroll = await evaluate('scrollY');
      assert.equal(await evaluate('location.href'), base);
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
      assert(await evaluate('(() => {const rect = document.querySelector("[data-image-close]").getBoundingClientRect(); return rect.x >= 0 && rect.right <= innerWidth && rect.bottom < innerHeight;})()'));
      await click('[data-image-size]');
      assert(await evaluate('document.querySelector(".docs-image-viewer").classList.contains("is-original")'));
      assert.equal(await evaluate('getComputedStyle(document.querySelector(".docs-image-stage img")).width'), '1280px');
      await click('[data-image-size]');
      assert.equal(await evaluate('document.querySelector("[data-image-size]").getAttribute("aria-pressed")'), 'false');
      screenshot = await send('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(output, 'viewer-' + width + '-' + theme + '.png'), Buffer.from(screenshot.data, 'base64'));
      await send('Input.dispatchKeyEvent', {type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
      await send('Input.dispatchKeyEvent', {type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27});
      await pause(80);
      assert.equal(await evaluate('document.querySelector(".docs-image-viewer").open'), false);
      assert(Math.abs(await evaluate('scrollY') - scroll) <= 1);
      assert(await evaluate('document.activeElement.matches(".web-page-card a.page-preview")'));
      await click('.web-page-card:nth-child(2) a.page-preview');
      assert(await evaluate('document.querySelector(".docs-image-viewer").open'));
      await click('[data-image-close]');
      assert.equal(await evaluate('document.querySelector(".docs-image-viewer").open'), false);
      assert.equal(await evaluate('document.body.style.overflow'), '');
      await click('.web-page-card:nth-child(2) a.page-preview');
      await send('Input.dispatchMouseEvent', {type: 'mousePressed', x: 1, y: 1, button: 'left', clickCount: 1});
      await send('Input.dispatchMouseEvent', {type: 'mouseReleased', x: 1, y: 1, button: 'left', clickCount: 1});
      await pause(80);
      assert.equal(await evaluate('document.querySelector(".docs-image-viewer").open'), false);
      report.push({width, theme, passed: true});
    }
  }
  for (const chapter of ['positioning', 'imaging']) {
  const positioningUrl = new URL(chapter + '.html', base).href;
  await send('Page.navigate', {url: positioningUrl});
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate('location.pathname.endsWith(' + JSON.stringify('/' + chapter + '.html') + ') && document.readyState === "complete" && !!document.querySelector(".docs-image-viewer")')) break;
    await pause(100);
  }
  for (const width of [1920, 1440, 390, 320]) {
    await send('Emulation.setDeviceMetricsOverride', {width, height: 900, deviceScaleFactor: 1, mobile: false});
    for (const theme of ['light', 'dark']) {
      await evaluate('document.documentElement.dataset.theme = ' + JSON.stringify(theme));
      await evaluate('scrollTo({left: 0, top: 0, behavior: "instant"})');
      await pause(500);
      await evaluate('document.querySelectorAll("video").forEach(video => {video.pause(); if (video.readyState > 0) video.currentTime = 0;})');
      assert(await evaluate('document.documentElement.scrollWidth <= innerWidth'));
      assert.equal(await evaluate('document.querySelector("article figure img").naturalWidth'), 1280);
      assert.equal(await evaluate('document.querySelector(".bd-article h2").textContent.trim().replace(/#$/, "").trim()'), '功能演示');
      assert.equal(await evaluate('document.querySelectorAll(".bd-article video").length'), 3);
      assert.equal(await evaluate('document.querySelectorAll(".bd-sidebar-secondary").length'), 0);
      assert.equal(await evaluate('document.querySelector(".docs-page-toc").open'), false);
      assert(await evaluate('document.querySelector(".docs-page-toc").getBoundingClientRect().width < 140'));
      const articleWidth = await evaluate('document.querySelector("article").getBoundingClientRect().width');
      await click('.docs-page-toc summary');
      assert(await evaluate('document.querySelector(".docs-page-toc").open && document.querySelectorAll(".docs-page-toc a[href]").length > 1'), JSON.stringify({width, theme, details: await evaluate('(() => {const rect = document.querySelector(".docs-page-toc summary").getBoundingClientRect(); return {rect: rect.toJSON(), hit: document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.outerHTML.slice(0,250)};})()')}));
      await click('.docs-page-toc summary');
      assert.equal(await evaluate('document.querySelector("article").getBoundingClientRect().width'), articleWidth);
      assert.equal(await evaluate('document.querySelector(".docs-page-toc").open'), false);
      assert(await evaluate('(() => {const screen = document.querySelector(".web-tutorial-screen").getBoundingClientRect(); const steps = document.querySelector(".web-tutorial-directions").getBoundingClientRect(); const player = document.querySelector(".web-tutorial-player").getBoundingClientRect(); return steps.top >= screen.bottom - 1 && Math.abs(screen.width - player.width) <= 3;})()'));
      await evaluate('scrollTo({left: 0, top: 0, behavior: "instant"})');
      await pause(100);
      assert(await evaluate('[...document.querySelectorAll("video")].every(video => video.preload === "none" && video.muted)'));
      const screenshot = await send('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(output, chapter + '-' + width + '-' + theme + '.png'), Buffer.from(screenshot.data, 'base64'));
      await evaluate('document.querySelector(".web-tutorial-player").scrollIntoView({block: "start", behavior: "instant"})');
      await pause(100);
      const videoScreenshot = await send('Page.captureScreenshot', {format: 'png'});
      fs.writeFileSync(path.join(output, chapter + '-video-' + width + '-' + theme + '.png'), Buffer.from(videoScreenshot.data, 'base64'));
      await click('.web-page-overview a.image-reference');
      assert(await evaluate('document.querySelector(".docs-image-viewer").open'));
      assert.equal(await evaluate('location.href'), positioningUrl);
      assert(await evaluate('document.querySelector(".docs-image-viewer img").src.endsWith(' + JSON.stringify(chapter === 'positioning' ? 'page-vioTab-annotated.png' : 'page-imaging-annotated.png') + ')'));
      await click('[data-image-close]');
      assert.equal(await evaluate('document.querySelector(".docs-image-viewer").open'), false);
      assert(await evaluate('document.activeElement.matches(".web-page-overview a.image-reference")'));
      await evaluate('document.querySelector("video").scrollIntoView({block: "center", behavior: "instant"})');
      for (let attempt = 0; attempt < 80; attempt++) {
        if (await evaluate('!document.querySelector("video").paused && document.querySelector("video").currentTime > 0')) break;
        await pause(100);
      }
      assert(await evaluate('!document.querySelector("video").paused && document.querySelector("video").muted && document.querySelector("video").currentTime > 0'), chapter + ' scroll autoplay at ' + width);
      await evaluate('document.querySelectorAll("video")[1].scrollIntoView({block: "center", behavior: "instant"})');
      for (let attempt = 0; attempt < 80; attempt++) {
        if (await evaluate('!document.querySelectorAll("video")[1].paused && document.querySelector("video").paused')) break;
        await pause(100);
      }
      assert(await evaluate('document.querySelector("video").paused && !document.querySelectorAll("video")[1].paused'));
      assert.equal(await evaluate('[...document.querySelectorAll("video")].filter(video => !video.paused).length'), 1);
      await evaluate('scrollTo({top: 0, behavior: "instant"})');
      await pause(200);
      assert(await evaluate('[...document.querySelectorAll("video")].every(video => {const rect = video.getBoundingClientRect(); return (rect.bottom > 0 && rect.top < innerHeight) || video.paused;})'));
      report.push({chapter, width, theme, passed: true});
    }
  }
  }
  fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
  console.log('PASS: ' + report.length + ' desktop/mobile light/dark layouts; image viewer, folded contents, video layout and scroll autoplay');
})().catch(error => {console.error(error); process.exitCode = 1;}).finally(() => {socket?.close(); chrome.kill();});

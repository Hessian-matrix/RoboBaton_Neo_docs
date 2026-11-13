'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');
const website = path.join(root, 'tmp/site');
const output = path.join(root, 'release/web-tutorials');
fs.mkdirSync(output, {recursive: true});
const catalogue = JSON.parse(fs.readFileSync(path.join(root, 'source/_static/web-tutorials/catalog.json'), 'utf8'));
const server = http.createServer((req, res) => {
    const name = path.resolve(website, '.' + new URL(req.url, 'http://localhost').pathname);
    if (!name.startsWith(website + path.sep) || !fs.existsSync(name) || !fs.statSync(name).isFile()) {res.writeHead(404); res.end(); return;}
    const size = fs.statSync(name).size;
    const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webm': 'video/webm', '.vtt': 'text/vtt; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml'};
    const headers = {'Content-Type': mime[path.extname(name)] || 'application/octet-stream', 'Accept-Ranges': 'bytes'};
    const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range || '');
    if (range) {
        const start = Number(range[1]), end = range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
        if (start > end || start >= size) {res.writeHead(416); res.end(); return;}
        res.writeHead(206, {...headers, 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Length': end - start + 1});
        fs.createReadStream(name, {start, end}).pipe(res);
    } else {
        res.writeHead(200, {...headers, 'Content-Length': size}); fs.createReadStream(name).pipe(res);
    }
});

(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const errors = [], failed = [], videos = [], external = [];
    const report = {realDevice: false, layouts: [], decoded: [], passed: false};
    try {
        const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
        page.on('pageerror', error => errors.push(error.message));
        page.on('response', response => {if (response.status() >= 400) failed.push(response.url());});
        page.on('request', request => {
            if (request.url().includes('.webm')) videos.push(request.url());
            if (!request.url().startsWith(base) && !request.url().startsWith('data:')) external.push(request.url());
        });
        await page.goto(base + '/docs/quick-start.html', {waitUntil: 'networkidle'});
        await page.waitForURL('**/web-guide.html');
        await page.goto(base + '/docs/positioning.html', {waitUntil: 'networkidle'});
        assert.equal(await page.locator('#tutorial-positioning video').count(), 3);
        assert(await page.locator('video').evaluateAll(elements => elements.every(video => video.muted && video.preload === 'none')));
        const first = page.locator('[data-web-tutorial]').nth(0), second = page.locator('[data-web-tutorial]').nth(1);
        await first.scrollIntoViewIfNeeded();
        await first.locator('[data-tutorial-time="3"]').click();
        await page.waitForFunction(() => document.querySelector('video').currentTime >= 3 && !document.querySelector('video').paused);
        assert.equal(await first.locator('[aria-current="step"]').count(), 1);
        assert.equal(await first.locator('[aria-current="step"]').getAttribute('data-tutorial-time'), '3');
        await page.evaluate(() => {document.querySelector('video').textTracks[0].mode = 'showing';});
        await page.waitForFunction(() => document.querySelector('video').textTracks[0]?.cues?.length === 3);
        await second.scrollIntoViewIfNeeded(); await second.locator('[data-tutorial-time="0"]').click();
        await page.waitForFunction(() => document.querySelectorAll('video')[0].paused && !document.querySelectorAll('video')[1].paused);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForFunction(() => [...document.querySelectorAll('video')].every(video => video.paused));
        const chapters = ['web-guide', 'positioning', 'imaging', 'mount-settings', 'flight-page', 'recording', 'calibration', 'device-settings', 'maintenance'];
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({width, height: 1000});
            for (const theme of ['light', 'dark']) {
                for (const chapter of chapters) {
                    await page.goto(base + '/docs/' + chapter + '.html', {waitUntil: 'load'});
                    await page.evaluate(theme => {document.documentElement.dataset.mode = theme; document.documentElement.dataset.theme = theme;}, theme);
                    const player = page.locator('[data-web-tutorial]').first();
                    if (await player.count()) {
                        await player.evaluate(node => {
                            for (let parent = node.parentElement; parent; parent = parent.parentElement) {
                                if (parent.tagName === 'DETAILS') parent.open = true;
                            }
                        });
                        await player.scrollIntoViewIfNeeded();
                        const bounds = await page.locator('video').first().boundingBox(); assert(bounds.width > 160 && bounds.height > 100);
                    }
                    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), chapter + ' overflow at ' + width);
                    await page.screenshot({path: path.join(output, chapter + '-' + width + '-' + theme + '.png')});
                    report.layouts.push({chapter, width, theme});
                }
            }
        }
        await page.goto(base + '/docs/web-guide.html');
        for (const lesson of catalogue.flatMap(group => group.lessons)) {
            const metadata = await page.evaluate(async ({base, identity}) => {
                const video = document.createElement('video'); video.preload = 'auto'; video.muted = true;
                document.body.append(video);
                try {
                    await new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject(Error('Video timeout: ' + identity)), 15000);
                        video.onloadeddata = () => {clearTimeout(timer); resolve();};
                        video.onerror = () => {clearTimeout(timer); reject(Error('Video decode: ' + identity));};
                        video.src = base + '/docs/_static/web-tutorials/' + identity + '.webm';
                    });
                    return {id: identity, duration: video.duration, width: video.videoWidth, height: video.videoHeight};
                } finally {video.pause(); video.removeAttribute('src'); video.load(); video.remove();}
            }, {base, identity: lesson.id});
            assert(Math.abs(metadata.duration - lesson.duration) <= .25, JSON.stringify(metadata));
            assert.equal(metadata.width, 1000); assert.equal(metadata.height, 750);
            report.decoded.push(metadata);
        }
        const offline = await browser.newContext({javaScriptEnabled: false, viewport: {width: 320, height: 800}});
        const fallback = await offline.newPage(); await fallback.goto(base + '/docs/calibration.html');
        assert.equal(await fallback.locator('[data-web-tutorial]').count(), 3);
        assert.equal(await fallback.locator('[data-tutorial-time]').count(), 9);
        assert((await fallback.locator('article').innerText()).includes('保存参数'));
        await fallback.screenshot({path: path.join(output, 'no-javascript-320.png'), fullPage: true}); await offline.close();
        assert.deepEqual(errors, []); assert.deepEqual(failed, []); assert.deepEqual(external, []);
        report.passed = true;
        console.log('PASS: ' + report.decoded.length + ' decoded clips, captions, seeking, playback, responsive light/dark views, no-JavaScript text, no external requests');
    } finally {
        Object.assign(report, {errors, failed, external});
        fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify(report, null, 2));
        await browser.close(); server.close();
    }
})().catch(error => {console.error(error); server.close(); process.exitCode = 1;});

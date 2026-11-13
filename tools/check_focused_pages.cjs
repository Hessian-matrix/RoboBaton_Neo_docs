const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'release/focused-pages');
const base = process.env.DOCS_URL || 'http://127.0.0.1:8873/docs/';
const chapters = {positioning: 'positioning', imaging: 'imaging', 'mount-settings': 'mount', 'flight-page': 'flight', recording: 'recording', calibration: 'calibration', 'device-settings': 'settings', maintenance: 'update'};
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'source/_static/web-tutorials/catalog.json'), 'utf8'));
fs.mkdirSync(output, {recursive: true});
(async () => {
    const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const report = {realDevice: false, layouts: [], videos: []};
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        for (const [chapter, group] of Object.entries(chapters)) {
            const lessons = catalog.find(item => item.id === group);
            for (const width of [1440, 390, 320]) {
                for (const theme of ['light', 'dark']) {
                    await page.setViewportSize({width, height: 1000});
                    await page.goto(new URL(chapter + '.html', base).href);
                    await page.evaluate(theme => {document.documentElement.dataset.theme = theme;}, theme);
                    const metrics = await page.evaluate(() => {
                        const article = document.querySelector('article');
                        const figure = article.querySelector('figure');
                        const video = article.querySelector('video');
                        const screen = article.querySelector('.web-tutorial-screen').getBoundingClientRect();
                        const directions = article.querySelector('.web-tutorial-directions').getBoundingClientRect();
                        return {
                            count: article.querySelectorAll('video').length,
                            imageFirst: !!(figure.compareDocumentPosition(video) & Node.DOCUMENT_POSITION_FOLLOWING),
                            imageLoaded: figure.querySelector('img').naturalWidth,
                            directionsBelow: directions.top >= screen.bottom - 1,
                            overflow: document.documentElement.scrollWidth > innerWidth,
                            tocFolded: !document.querySelector('.docs-page-toc').open,
                            notes: article.querySelectorAll('.tutorial-notes p').length,
                            staleSources: [...article.querySelectorAll('video source')].some(source => !source.src.includes('?v='))
                        };
                    });
                    assert.deepEqual(metrics, {count: 3, imageFirst: true, imageLoaded: 1280, directionsBelow: true, overflow: false, tocFolded: true, notes: ['positioning', 'imaging'].includes(chapter) ? 0 : 3, staleSources: false});
                    await page.screenshot({path: path.join(output, chapter + '-' + width + '-' + theme + '.png')});
                    report.layouts.push({chapter, width, theme, passed: true});
                }
            }
            await page.setViewportSize({width: 1440, height: 1000});
            await page.evaluate(() => {document.documentElement.dataset.theme = 'light';});
            for (const identity of lessons.publishedLessons) {
                const lesson = lessons.lessons.find(item => item.id === identity);
                const video = page.locator('#' + identity + ' video');
                await video.scrollIntoViewIfNeeded();
                await video.evaluate(async video => {
                    if (video.readyState < 2) await new Promise((resolve, reject) => {
                        video.addEventListener('loadeddata', resolve, {once: true});
                        video.addEventListener('error', () => reject(Error('Video decode failed')), {once: true});
                        video.load();
                    });
                });
                const metadata = await video.evaluate(video => ({width: video.videoWidth, height: video.videoHeight, duration: video.duration, src: video.currentSrc}));
                assert.equal(metadata.width, 1000);
                assert.equal(metadata.height, 750);
                assert(Math.abs(metadata.duration - lesson.duration) < .25);
                const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'source/_static/web-tutorials', identity + '.webm'))).digest('hex').slice(0, 12);
                assert.equal(new URL(metadata.src).searchParams.get('v'), hash);
                for (let index = 0; index < 3; index++) {
                    await video.evaluate(async (video, time) => {
                        video.pause();
                        await new Promise(resolve => {video.addEventListener('seeked', resolve, {once: true}); video.currentTime = time;});
                        if (Math.abs(video.currentTime - time) > .1) throw Error('Preview server failed to seek: ' + video.currentTime);
                        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                    }, lesson.steps[index].time + 1.5);
                    await video.screenshot({path: path.join(output, identity + '-step-' + index + '.png')});
                }
                report.videos.push({id: identity, passed: true, ...metadata});
            }
        }
        await page.goto(new URL('imaging.html?review=focused#monitor-panel', base).href);
        const imu = page.locator('#monitor-panel video');
        await imu.scrollIntoViewIfNeeded();
        await imu.evaluate(async video => {
            if (video.readyState < 2) await new Promise(resolve => {video.addEventListener('loadeddata', resolve, {once: true}); video.load();});
        });
        const imuSource = await imu.evaluate(video => video.currentSrc);
        const expectedHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'source/_static/web-tutorials/monitor-panel.webm'))).digest('hex').slice(0, 12);
        assert.equal(new URL(imuSource).searchParams.get('v'), expectedHash);
        const ranged = await fetch(imuSource, {headers: {Range: 'bytes=100-119'}});
        assert.equal(ranged.status, 206);
        assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), fs.readFileSync(path.join(root, 'source/_static/web-tutorials/monitor-panel.webm')).subarray(100, 120));
        for (const time of [2, 5, 7.5]) {
            await imu.evaluate(async (video, time) => {
                video.pause();
                await new Promise(resolve => {video.addEventListener('seeked', resolve, {once: true}); video.currentTime = time;});
                if (Math.abs(video.currentTime - time) > .1) throw Error('IMU seek returned to start: ' + video.currentTime);
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            }, time);
            await imu.screenshot({path: path.join(output, 'imu-actual-' + time + '.png')});
        }
        report.imu = {passed: true, source: imuSource, checkedTimes: [2, 5, 7.5]};
        assert.deepEqual(errors, []);
        report.passed = true;
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        console.log('PASS: eight pages, 48 responsive light/dark layouts, 24 decoded focus videos; actual versioned IMU playback at 2/5/7.5 seconds');
    } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});

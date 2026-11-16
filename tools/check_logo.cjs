const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'tmp/site');
const output = path.join(root, 'release/neo-logo-refined');
const pages = ['index.html', 'quick-start.html', 'integration.html', 'robot-mounting.html', 'calibration-guide.html', 'docs/index.html'];
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css'};
const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = path.resolve(site, '.' + pathname + (pathname.endsWith('/') ? 'index.html' : ''));
    if (!filename.startsWith(site + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        response.writeHead(404);
        return response.end();
    }
    response.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
    fs.createReadStream(filename).pipe(response);
});
(async () => {
    fs.mkdirSync(output, {recursive: true});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    let browser;
    try {
        browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
        const page = await browser.newPage({reducedMotion: 'reduce'});
        const report = [];
        for (const width of [1280, 390, 320]) {
            await page.setViewportSize({width, height: 850});
            for (const filename of pages) {
                await page.goto('http://127.0.0.1:' + server.address().port + '/' + filename, {waitUntil: 'load'});
                for (const theme of filename.startsWith('docs/') ? ['light', 'dark'] : ['light']) {
                    await page.evaluate(theme => {
                        document.documentElement.dataset.theme = theme;
                        document.documentElement.dataset.mode = theme;
                    }, theme);
                    const mark = page.locator('header .neo-mark');
                    assert.equal(await mark.count(), 1, filename);
                    assert(await mark.isVisible(), filename);
                    assert.equal(await mark.getAttribute('viewBox'), '18 26 60 60');
                    assert.deepEqual(await mark.locator('path').evaluateAll(paths => paths.map(item => item.getAttribute('d'))), ['M62 31.751 A28 28 0 1 0 72.249 42', 'M38 66.5 V45.5 L58 66.5 V45.5']);
                    assert.equal(await mark.locator('circle').getAttribute('r'), '3.2');
                    assert.equal(await mark.locator('circle').getAttribute('cx'), '67.799');
                    assert.equal(await mark.locator('circle').getAttribute('cy'), '36.201');
                    assert.equal(await mark.getAttribute('aria-hidden'), 'true');
                    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), filename + ' overflow');
                    const bounds = await mark.boundingBox();
                    assert(bounds.width >= 25 && bounds.width <= 32);
                    const link = mark.locator('..');
                    assert((await link.getAttribute('aria-label')).includes('RoboBaton Neo'));
                    await page.locator('header').first().screenshot({path: path.join(output, width + '-' + filename.replaceAll('/', '-') + '-' + theme + '.png')});
                    report.push({filename, width, theme, passed: true});
                }
            }
        }
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        console.log('PASS: ' + report.length + ' logo checks; shared geometry, accessible navigation, mobile layout, light/dark docs');
    } finally {
        if (browser) await browser.close();
        server.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});

const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'tmp/site');
const output = path.join(root, 'release/sdk-docs');
fs.mkdirSync(output, {recursive: true});
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.zip': 'application/zip', '.png': 'image/png', '.svg': 'image/svg+xml'};
const server = http.createServer((request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(site, '.' + pathname);
    if (!filename.startsWith(site + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
        response.writeHead(404); response.end(); return;
    }
    response.setHeader('Content-Type', types[path.extname(filename)] || 'application/octet-stream');
    response.end(fs.readFileSync(filename));
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({headless: true,
        executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const base = 'http://127.0.0.1:' + server.address().port;
    const results = [];
    const errors = [];
    try {
        for (const width of [1440, 390, 320]) {
            for (const theme of ['light', 'dark']) {
                const page = await browser.newPage({viewport: {width, height: 1000}, reducedMotion: 'reduce'});
                page.on('pageerror', error => errors.push(error.message));
                for (const name of ['sdk', 'sdk-python', 'sdk-cpp', 'sdk-stm32', 'ros', 'ros2']) {
                    const response = await page.goto(base + '/docs/' + name + '.html');
                    assert.equal(response.status(), 200);
                    await page.evaluate(theme => {document.documentElement.dataset.theme = theme;}, theme);
                    await page.locator('article h1').waitFor();
                    const article = await page.locator('article').innerText();
                    if (name === 'sdk-cpp') {
                        assert(article.includes('observe_gray_jpeg'));
                        assert(article.includes('neo_image http://192.168.11.1'));
                    }
                    if (name === 'sdk-python') assert(article.includes('SDK/python/examples/image.py'));
                    if (name === 'ros' || name === 'ros2') {
                        assert(article.includes('/neo/image/compressed'));
                        assert(article.includes('/neo/image/source_header'));
                        assert(article.includes('image_frame'));
                        assert(!article.includes('本次包不发布图像'));
                    }
                    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' overflow ' + width);
                    assert.equal(await page.locator('.toctree-wrapper').count(), 0);
                    if (name === 'sdk') {
                        for (const target of ['sdk-python', 'sdk-cpp', 'sdk-stm32', 'ros', 'ros2'])
                            assert(await page.locator('article a[href="' + target + '.html"]').count() > 0);
                    }
                    if (name === 'sdk' || (width === 320 && ['sdk-stm32', 'sdk-cpp', 'ros', 'ros2'].includes(name)))
                        await page.screenshot({path: path.join(output, name + '-' + width + '-' + theme + '.png'), fullPage: true});
                    results.push({name, width, theme, passed: true});
                }
                await page.goto(base + '/docs/');
                assert.equal(await page.locator('.docs-chapter').count(), 5);
                await page.locator('.chapter-links a[href="sdk.html"]').click();
                await page.waitForURL('**/docs/sdk.html');
                if (width === 1440 && theme === 'light') {
                    const [download] = await Promise.all([
                        page.waitForEvent('download'),
                        page.locator('article a[href$="robobaton-neo-sdk.zip"]').click(),
                    ]);
                    const file = await download.path();
                    const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
                    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'source/_downloads/sdk-provenance.json')));
                    assert.equal(hash, manifest.sha256);
                    results.push({download: download.suggestedFilename(), sha256: hash, passed: true});
                }
                await page.goto(base + '/integration.html');
                await page.locator('.sdk-entry').scrollIntoViewIfNeeded();
                assert.equal(await page.locator('.sdk-entry nav a').count(), 6);
                assert(await page.locator('.sdk-entry a[href="docs/sdk.html"]').isVisible(), JSON.stringify(await page.locator('.sdk-entry').evaluate(element => ({html: element.outerHTML, parents: [element, element.parentElement].map(node => ({tag: node.tagName, display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility, box: node.getBoundingClientRect().toJSON()})), links: [...element.querySelectorAll('a')].map(node => ({display: getComputedStyle(node).display, visibility: getComputedStyle(node).visibility, box: node.getBoundingClientRect().toJSON()}))}))));
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                await page.locator('.sdk-entry a[href="docs/sdk.html"]').click();
                await page.waitForURL('**/docs/sdk.html');
                await page.close();
            }
        }
        const page = await browser.newPage();
        await page.goto(base + '/docs/search.html?q=STM32');
        await page.waitForFunction(() => document.querySelectorAll('#search-results li a').length > 0);
        assert((await page.locator('#search-results').innerText()).includes('STM32'));
        await page.close();
        assert.deepEqual(errors, []);
        assert(!fs.existsSync(path.join(site, 'docs/_sdk')));
        fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify({results, errors, search: 'STM32', deviceConnected: false}, null, 2));
        console.log('PASS: 36 SDK document views at 1440/390/320px in light/dark, five-part navigation, source ZIP download SHA256, SDK entry and search');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {console.error(error); server.close(); process.exitCode = 1;});

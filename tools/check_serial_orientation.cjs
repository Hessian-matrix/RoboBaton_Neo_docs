const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'release/serial-orientation-2026-11-16');
fs.mkdirSync(output, {recursive: true});
const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const filename = path.resolve(root, 'tmp/site', '.' + pathname);
    if (!filename.startsWith(path.join(root, 'tmp/site') + path.sep) || !fs.existsSync(filename)) {
        response.writeHead(404);
        return response.end();
    }
    response.setHeader('Content-Type', {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json'}[path.extname(filename)] || 'application/octet-stream');
    response.end(fs.readFileSync(filename));
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const results = [];
    const errors = [];
    try {
        const page = await browser.newPage({reducedMotion: 'reduce'});
        page.on('pageerror', error => errors.push(error.message));
        for (const width of [1280, 390, 320]) {
            await page.setViewportSize({width, height: 1000});
            for (const embedded of [false, true]) {
                await page.goto('http://127.0.0.1:' + server.address().port + (embedded ? '/quick-start.html' : '/integration.html'), {waitUntil: 'networkidle'});
                const view = embedded ? page.frameLocator('#chapter-program iframe') : page;
                await view.locator('[data-transport="serial"]').click();
                assert(await view.locator('.wiring-orientation').isVisible());
                const note = await view.locator('.wiring-orientation').innerText();
                assert(note.includes('TF 卡槽在左，6pin 在右；上 6 ↓ 下 1'));
                assert(note.includes('不是线束插头的线端视图'));
                assert.equal(await view.locator('.wiring-heading a').getAttribute('href'), 'docs/connect-serial.html');
                const pins = await view.locator('.wiring-map g[data-wire-part]').evaluateAll(groups => groups.filter(group => group.querySelector('circle[cx="141"]')).map(group => ({id: group.dataset.wirePart, y: Number(group.querySelector('circle').getAttribute('cy')), text: group.textContent})));
                assert.deepEqual(pins.map(pin => pin.id), ['6', '5', '4', '3', '2', '1']);
                assert.deepEqual(pins.map(pin => pin.y), [65, 102, 139, 176, 213, 250]);
                assert(pins[0].text.includes('VIN') && pins[5].text.includes('曝光'));
                assert.deepEqual(await view.locator('[data-wire]').evaluateAll(buttons => buttons.map(button => button.dataset.wire)), ['6', '5', '4', '3', '2', '1']);
                for (const pin of pins) {
                    await view.locator('[data-wire="' + pin.id + '"]').click();
                    assert.equal(await view.locator('[data-wire="' + pin.id + '"]').getAttribute('aria-pressed'), 'true');
                    const lines = await view.locator('.wiring-map g[data-wire-part="' + pin.id + '"] path').evaluateAll(paths => paths.map(item => item.getAttribute('d')));
                    assert(lines.some(line => line.startsWith('M154 ' + pin.y)), 'Wrong wire origin for pin ' + pin.id);
                }
                await view.locator('[data-wire="3"]').click();
                await view.locator('#serial-art').screenshot({path: path.join(output, width + (embedded ? '-embedded' : '-standalone') + '.png')});
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                assert(await view.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                results.push({width, embedded, physicalOrder: '6-5-4-3-2-1', passed: true});
            }
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'browser-report.json'), JSON.stringify({results, errors}, null, 2));
        console.log('PASS: device-back orientation, physical pin order, six wire origins and highlights; standalone and quick-start embed at 1280/390/320px');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {console.error(error); server.close(); process.exitCode = 1;});

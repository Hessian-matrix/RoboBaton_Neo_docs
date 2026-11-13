const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'tmp/site');
const output = path.join(root, 'release/tf-slot-correction');
fs.mkdirSync(output, {recursive: true});
const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const filename = path.resolve(site, '.' + (pathname.endsWith('/') ? pathname + 'index.html' : pathname));
    if (!filename.startsWith(site + path.sep) || !fs.existsSync(filename)) {
        response.writeHead(404);
        return response.end();
    }
    response.setHeader('Content-Type', {'.js': 'text/javascript', '.html': 'text/html; charset=utf-8', '.css': 'text/css'}[path.extname(filename)] || 'application/octet-stream');
    response.end(fs.readFileSync(filename));
});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const errors = [];
    const results = [];
    try {
        const page = await browser.newPage({reducedMotion: 'reduce'});
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(process.env.SITE_URL || 'http://127.0.0.1:' + server.address().port + '/', {waitUntil: 'networkidle'});
        const geometry = await page.evaluate(async () => {
            const script = [...document.scripts].find(item => item.src.includes('port-scene.js'));
            const source = await (await fetch(script.src)).text();
            const relative = source.match(/from '(\.\/enclosure-model\.js[^']*)'/)[1];
            const module = await import(new URL(relative, script.src).href);
            const model = module.createEnclosure();
            const points = model.geometry.getAttribute('position');
            const colors = model.geometry.getAttribute('color');
            const three = await import(new URL('./three.module.js', script.src).href);
            const color = new three.Color('#81998a');
            const slot = [];
            for (let index = 0; index < points.count; index++) {
                if (Math.abs(colors.getX(index) - color.r) < 0.00001 && Math.abs(colors.getY(index) - color.g) < 0.00001 && Math.abs(colors.getZ(index) - color.b) < 0.00001) slot.push(points.getX(index));
            }
            const ray = new three.Raycaster(new three.Vector3(80, 70, 20), new three.Vector3(-92, -70, -24.1).normalize());
            const translated = module.createEnclosure();
            translated.position.set(0, -9, 11.2);
            translated.updateMatrixWorld();
            const hits = ray.intersectObject(translated);
            return {slotVertices: slot.length, slotMaxX: Math.max(...slot), firstHitX: hits[0].point.x,
                insertionMatches: source.includes('tfAssembly.rotation.z=-Math.PI/2;tfAssembly.position.set(-12,-9,-4.1)')};
        });
        assert.equal(geometry.slotVertices, 36);
        assert(geometry.slotMaxX < -11.8);
        assert(geometry.firstHitX > 0, 'Opaque near wall must hide the rear TF slot');
        assert(geometry.insertionMatches);
        for (const width of [1440, 390, 320]) {
            await page.setViewportSize({width, height: 1000});
            for (const mode of ['pins', 'usb', 'tf', 'pins']) {
                await page.locator('[data-interface-view=' + mode + ']').click();
                assert.equal(await page.locator('.port-showcase').getAttribute('data-mode'), mode);
                await page.locator('.port-showcase').screenshot({path: path.join(output, width + '-' + mode + '.png')});
                assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
                results.push({width, mode, passed: true});
            }
        }
        assert.deepEqual(errors, []);
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({geometry, results, errors}, null, 2));
        console.log('PASS: TF slot on rear side, occluded in wiring view; matching insertion direction; 12 responsive views');
    } finally {
        await browser.close();
        await new Promise(resolve => server.close(resolve));
    }
})().catch(error => {console.error(error); server.close(); process.exitCode = 1;});

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {spawn} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');
const app = path.resolve(process.env.NEO_APP_ROOT || path.join(root, '../cv-610-pub'));
const assets = path.join(root, 'source/_static/web-tutorials');
const scratch = path.join(root, 'tmp/web-tutorials');
fs.mkdirSync(scratch, {recursive: true});
const mime = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml'};
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    if (name === 'tutorial-fixture.js') {
        res.writeHead(200, {'Content-Type': 'text/javascript'});
        res.end(fs.readFileSync(path.join(__dirname, 'web_tutorial_fixture.js'))); return;
    }
    const directory = name.startsWith('runtime/') ? path.join(app, 'calibration/calibration-js/browser/dist/public') : path.join(app, 'visualization/public');
    const file = path.resolve(directory, name.startsWith('runtime/') ? name.slice(8) : name);
    if (!file.startsWith(directory + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
        res.writeHead(404); res.end(); return;
    }
    res.writeHead(200, {'Content-Type': mime[path.extname(file)] || 'application/octet-stream'});
    if (name === 'index.html') {
        res.end(fs.readFileSync(file, 'utf8').replace('<script src="./runtime/runtime.js"></script>', '<script src="./runtime/runtime.js"></script><script src="/tutorial-fixture.js"></script>')); return;
    }
    fs.createReadStream(file).pipe(res);
});

async function mock(page, base) {
    let vio = {state: 'stopped', tracking: null, error: null, warning: null};
    const stored = {
        '/api/buttons/config': {short_action: 'none', long_action: 'record_toggle', long_press_ms: 2000, recording_channels: ['gray', 'imu']},
        '/api/boot/config': {vio_autostart: false},
        '/api/network/config': {subnet: 11},
        '/api/recording': {state: 'idle'},
        '/api/recording/check': {active: false, result: null},
        '/api/recording/list': {recordings: []},
        '/api/recordings': {recordings: [], items: []},
        '/api/monitor': {tf_card: {state: 'ready', total_bytes: '32000000000', available_bytes: '28000000000'}, imu: {rate_hz: 200}, camera: {rate_hz: 60}},
        '/api/datasets': {datasets: [{id: 'tutorial-demo', channels: ['gray', 'imu'], result: {state: 'completed', complete: true, end_reason: 'user_stop', duration_s: 12, bytes_written: '1400000', counts: {gray: '60', imu: '2400'}}}], next_offset: null},
        '/api/mount/config': {configured: true, ...require(path.join(app, 'visualization/public/robot-frame-core.js')).toPublic(require(path.join(app, 'visualization/public/robot-frame-core.js')).identity())},
        '/api/color/config': {codec: 'mjpeg', width: 1080, height: 1280, fps: 5, fps_max: 60, quality: 80},
        '/api/mavlink/status': {connected: true, flight_controller: 'ardupilot', system_id: 1, flight_controller_component_id: 1, firmware_version: '4.5.0', armed: false, active_operation_id: null},
        '/api/mavlink/serial': {baud: 921600, system_id: 1, component_id: 197},
        '/api/serial/status': {mode: 'mavlink', baud: 921600, system_id: 1, component_id: 197},
        '/api/update': {available: true, running: {version: '演示版本'}, installed: {metadata: {version: '演示版本'}}, limits: {free_bytes: '200000000', max_package_bytes: '100000000'}, package: null, operation: null},
        '/api/system/status': {available: true, reboot: null},
        '/api/calibration/status': {connected: true, state: 'IDLE', recording: false, preview: {connected: true, frame_count: 100, last_frame_time: Date.now() / 1000, rate_hz: 15}, workflow: {runtime: {state: 'STARTED'}, jobs: {}}, quality: {}, imu_rate_hz: 200},
    };
    const calls = [];
    await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin !== base) return route.abort();
        if (!url.pathname.startsWith('/api/')) return route.continue();
        const endpoint = url.pathname;
        calls.push({method: req.method(), path: endpoint});
        if (endpoint === '/api/stream') return route.abort();
        let body = null;
        try { body = req.postDataJSON(); } catch (_) {}
        const json = (value, status = 200) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(value)});
        if (endpoint === '/api/mavlink/parameters' && req.method() === 'GET') return json({parameters: Object.fromEntries((url.searchParams.get('names') || '').split(',').map(name => [name, {value: 0, type: 'int32'}]))});
        if (endpoint === '/api/mavlink' && body?.action) {
            stored['/api/mavlink/status'].operation = {operation_id: 'tutorial-scan', action: body.action, state: stored.__manual ? 'failed' : 'succeeded', result: {}, error: stored.__manual ? {code: 'scan_failed'} : null};
            return json({accepted: true, operation_id: 'tutorial-scan'}, 202);
        }
        if (endpoint === '/api/datasets/tutorial-demo') return json(stored['/api/datasets'].datasets[0]);
        if (endpoint === '/api/recording' && body?.action) {
            stored[endpoint] = body.action === 'start' ? {state: 'recording', recording_id: 'tutorial-demo', channels: body.channels, duration_s: 4, counts: {gray: '20', imu: '800'}} : {state: 'idle'};
            return json({accepted: true, action: body.action}, 202);
        }
        if (endpoint === '/api/recording/check' && body?.action) {
            stored[endpoint] = {state: 'passed', active: null, result: {reason: 'short_test_passed'}};
            return json({accepted: true}, 202);
        }
        if (endpoint === '/api/update/upload') {
            stored['/api/update'].package = {package_id: 'tutorial', metadata: {version: '演示候选', trust: 'test', notes: '仅演示界面，不可安装到设备。'}};
            return json({package: stored['/api/update'].package});
        }
        if (endpoint.startsWith('/api/mavlink/') && req.method() === 'POST') return json({operation_id: 'tutorial-scan', state: 'succeeded', kind: 'scan', result: {}}, 202);
        if (endpoint === '/api/vio') {
            if (body?.action) {
                vio = {state: body.action === 'stop' ? 'stopped' : 'running', tracking: body.action === 'stop' ? null : 'initializing', error: null, warning: null};
                setTimeout(() => { if (vio.state === 'running') vio.tracking = 'valid'; }, 900);
                return json({action: body.action, accepted: true}, 202);
            }
            return json(vio);
        }
        if (body && Object.hasOwn(stored, endpoint) && endpoint.endsWith('/config')) stored[endpoint] = {...stored[endpoint], ...body};
        if (endpoint === '/api/color/config' && stored[endpoint].codec !== 'mjpeg') delete stored[endpoint].quality;
        if (Object.hasOwn(stored, endpoint)) return json(stored[endpoint]);
        return json({error: {code: 'NOT_FOUND', message: 'Local tutorial fixture has no data for this operation'}}, 404);
    });
    page.on('dialog', dialog => dialog.accept());
    return {calls, stored};
}

async function act(page, action, visiblePointer = false) {
    const [selector, operation, value] = action;
    if (operation === 'wait') return page.waitForTimeout(value);
    const element = page.locator(selector).first();
    if (operation === 'file') return element.setInputFiles({name: 'tutorial-only.viofw', mimeType: 'application/octet-stream', buffer: Buffer.from('Not a firmware package. Tutorial only.')});
    await element.waitFor({state: 'visible', timeout: 5000});
    for (let attempt = 0; attempt < 3; attempt++) {
        try { await element.scrollIntoViewIfNeeded(); break; }
        catch (error) { if (attempt === 2) throw error; await page.waitForTimeout(100); }
    }
    const box = await element.boundingBox();
    if (visiblePointer && box) {
        await page.locator('#tutorial-pointer').evaluate((pointer, box) => {
            pointer.style.left = (box.x + Math.min(box.width / 2, 100) - 11) + 'px';
            pointer.style.top = (box.y + Math.min(box.height / 2, 40) - 11) + 'px';
        }, box);
        await page.waitForTimeout(450);
    }
    if (operation === 'click') await element.click({timeout: 5000});
    else if (operation === 'fill') { await element.fill(value); await element.press('Tab'); }
    else if (operation === 'select') await element.selectOption(value);
    else if (operation === 'check') await element.check();
    else if (operation === 'drag' && box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.mouse.down(); await page.mouse.move(box.x + 100, box.y + 100, {steps: 12}); await page.mouse.up();
    }
}

async function prepare(page, scenario, fixture) {
    if (scenario.pre === 'flight-manual') {
        fixture.stored['/api/mavlink/status'].connected = false;
        fixture.stored.__manual = true;
    }
    await page.locator('#' + scenario.tab).click();
    await page.waitForTimeout(350);
    if (Array.isArray(scenario.pre)) {
        for (const action of scenario.pre) await act(page, action);
        return;
    }
    if (scenario.pre === 'flight-manual') {
        await act(page, ['#fgAutoScan', 'click']);
        await page.locator('#fgManualPanel').waitFor({state: 'visible', timeout: 8000}); return;
    }
    if (scenario.pre.startsWith('update-')) {
        fixture.stored['/api/update'].package = {package_id: 'tutorial', metadata: {version: '演示候选', trust: 'test', notes: '仅演示界面，不可用于设备。'}};
        if (scenario.pre === 'update-reboot') fixture.stored['/api/update'].operation = {state: 'reboot_required', operation_id: 'tutorial', package_id: 'tutorial'};
        await page.locator('#updateRefresh').click(); return;
    }
    await act(page, ['#enterScreenBtn', 'click']);
    await act(page, ['input[name="measureMode"][value="tag"]', 'click']);
    await act(page, ['#tagMeasuredSize', 'fill', '3']);
    await act(page, ['#measureConfirm', 'check']);
    await act(page, ['#confirmScreenBtn', 'click']);
    await page.waitForTimeout(250);
    if (scenario.pre === 'calibration-ready') return;
    await act(page, ['#skipCaptureTutorialBtn', 'click']);
    await act(page, ['#startRecordBtn', 'click']);
    await page.waitForTimeout(600);
    if (scenario.pre === 'calibration-capturing') return;
    await act(page, ['#guideFinishEarly', 'click']);
    await page.waitForTimeout(600);
    if (scenario.pre === 'calibration-finished') return;
    await act(page, ['#solveBtn', 'click']);
    await page.waitForTimeout(1500);
    if (scenario.pre === 'calibration-results') await act(page, ['#viewResultBtn', 'click']);
}

async function encode(raw, output) {
    const executable = process.env.FFMPEG_PATH || path.join(scratch, 'browsers/ffmpeg-1011/ffmpeg-win64.exe');
    await new Promise((resolve, reject) => {
        const child = spawn(executable, ['-y', '-loglevel', 'error', '-sseof', '-9.2', '-i', raw, '-t', '9', '-an', '-c:v', 'libvpx', '-deadline', 'realtime', '-cpu-used', '8', '-crf', '20', '-b:v', '500k', output], {windowsHide: true});
        let errors = ''; child.stderr.on('data', data => errors += data);
        child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(Error(errors)));
    });
}

async function runLessons(browser, base, recordVideo) {
    const catalogue = JSON.parse(fs.readFileSync(path.join(assets, 'catalog.json'), 'utf8'));
    const scenarios = require('./web_tutorial_scenarios.cjs');
    const wanted = process.env.TUTORIAL_ONLY?.split(',');
    const lessons = catalogue.flatMap(group => group.lessons).filter(lesson => !wanted || wanted.includes(lesson.id));
    const results = [];
    const queue = [...lessons];
    async function worker() {
        while (queue.length) {
            const lesson = queue.shift();
            if (process.env.TUTORIAL_SKIP_EXISTING && fs.existsSync(path.join(assets, lesson.id + '.webm'))) continue;
            const directory = path.join(scratch, lesson.id); fs.mkdirSync(directory, {recursive: true});
            const context = await browser.newContext({viewport: {width: 1000, height: 750}, ...(recordVideo ? {recordVideo: {dir: directory, size: {width: 1000, height: 750}}} : {})});
            const page = await context.newPage();
            page.setDefaultTimeout(6000);
            const errors = []; page.on('pageerror', error => errors.push(error.message));
            const fixture = await mock(page, base);
            try {
                await page.goto(base, {waitUntil: 'load'});
                await prepare(page, scenarios[lesson.id], fixture);
                for (let index = 0; index < lesson.steps.length; index++) {
                    const start = Date.now();
                    await page.evaluate(() => {
                        if (document.getElementById('tutorial-caption')) return;
                        const caption = document.createElement('div'); caption.id = 'tutorial-caption';
                        caption.style.cssText = 'position:fixed;bottom:12px;left:15%;right:15%;padding:12px;background:#244d40;color:white;z-index:2147483647;text-align:center;font:16px sans-serif';
                        const pointer = document.createElement('div'); pointer.id = 'tutorial-pointer';
                        document.body.append(caption, pointer);
                    });
                    await page.locator('#tutorial-caption').evaluate((node, text) => node.textContent = text, lesson.steps[index].text);
                    for (const action of scenarios[lesson.id].steps[index]) await act(page, action, recordVideo);
                    if (recordVideo) await page.waitForTimeout(Math.max(0, 3000 - (Date.now() - start)));
                    else await page.waitForTimeout(150);
                    await page.screenshot({path: path.join(directory, 'step-' + index + '.png')});
                }
                if (errors.length) throw Error(errors.join('; '));
                if (recordVideo) {
                    await page.screenshot({path: path.join(assets, lesson.id + '.jpg'), type: 'jpeg', quality: 80});
                    await page.waitForTimeout(200);
                    const video = page.video(); await context.close();
                    const raw = path.join(directory, 'raw.webm'); await video.saveAs(raw);
                    await encode(raw, path.join(assets, lesson.id + '.webm'));
                    const timestamp = seconds => '00:00:' + String(seconds).padStart(2, '0') + '.000';
                    fs.writeFileSync(path.join(assets, lesson.id + '.vtt'), 'WEBVTT\n\n' + lesson.steps.map((step, index) => timestamp(step.time) + ' --> ' + timestamp(index === 2 ? 9 : lesson.steps[index + 1].time) + '\n' + step.text + '\n').join('\n'));
                }
                results.push({id: lesson.id, passed: true, errors, calls: fixture.calls});
                console.log('PASS ' + lesson.id);
            } catch (error) {
                await page.screenshot({path: path.join(directory, 'failure.png')}).catch(() => {});
                results.push({id: lesson.id, passed: false, message: error.message, errors});
                console.log('FAIL ' + lesson.id + ': ' + error.message.split('\n')[0]);
            } finally { await context.close(); }
        }
    }
    await Promise.all(Array.from({length: Number(process.env.TUTORIAL_WORKERS || 3)}, worker));
    const report = {realDevice: false, recorded: recordVideo, results, passed: results.every(result => result.passed)};
    const destination = path.join(root, 'release/web-tutorials');
    fs.mkdirSync(destination, {recursive: true});
    fs.writeFileSync(path.join(destination, recordVideo ? 'recording-report.json' : 'operation-report.json'), JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 1;
}

async function main() {
    if (process.argv.includes('--posters')) {
        const catalogue = JSON.parse(fs.readFileSync(path.join(assets, 'catalog.json'), 'utf8'));
        const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
        try {
            const page = await browser.newPage();
            for (const lesson of catalogue.flatMap(group => group.lessons)) {
                const bytes = fs.readFileSync(path.join(scratch, lesson.id, 'step-0.png'));
                const jpeg = await page.evaluate(async data => {
                    const picture = new Image(); picture.src = 'data:image/png;base64,' + data; await picture.decode();
                    const canvas = document.createElement('canvas'); canvas.width = picture.width; canvas.height = picture.height;
                    canvas.getContext('2d').drawImage(picture, 0, 0); return canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
                }, bytes.toString('base64'));
                fs.writeFileSync(path.join(assets, lesson.id + '.jpg'), Buffer.from(jpeg, 'base64'));
            }
            console.log('PASS: 60 first-step video posters');
        } finally {await browser.close();}
        return;
    }
    if (process.argv.includes('--encode-existing')) {
        const catalogue = JSON.parse(fs.readFileSync(path.join(assets, 'catalog.json'), 'utf8'));
        const wanted = process.env.TUTORIAL_ONLY?.split(',');
        for (const lesson of catalogue.flatMap(group => group.lessons).filter(lesson => !wanted || wanted.includes(lesson.id))) {
            const raw = path.join(scratch, lesson.id, 'raw.webm');
            if (!fs.existsSync(raw)) throw Error('No recorded clip: ' + lesson.id);
            await encode(raw, path.join(assets, lesson.id + '.webm'));
            const stamp = value => '00:00:' + String(value).padStart(2, '0') + '.000';
            fs.writeFileSync(path.join(assets, lesson.id + '.vtt'), 'WEBVTT\n\n' + lesson.steps.map((step, index) => stamp(step.time) + ' --> ' + stamp(index === 2 ? 9 : lesson.steps[index + 1].time) + '\n' + step.text + '\n').join('\n'));
            console.log('ENCODED ' + lesson.id);
        }
        return;
    }
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    try {
        if (!process.argv.includes('--inspect')) {
            await runLessons(browser, base, process.argv.includes('--record')); return;
        }
        const page = await browser.newPage({viewport: {width: 1280, height: 800}});
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await mock(page, base);
        await page.goto(base, {waitUntil: 'load'});
        await page.waitForTimeout(1500);
        const dump = {};
        for (const tab of ['vioTab', 'mountTab', 'buttonTab', 'recordTab', 'calibrationTab', 'flightTab', 'updateTab']) {
            await page.locator('#' + tab).click();
            await page.waitForTimeout(400);
            dump[tab] = await page.locator('button,input,select,summary').evaluateAll(elements => elements.filter(el => el.getClientRects().length).map(el => ({id: el.id, text: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 70), tag: el.tagName, disabled: el.disabled, options: el.tagName === 'SELECT' ? [...el.options].map(option => [option.value, option.text]) : undefined})));
            await page.screenshot({path: path.join(scratch, tab + '.png')});
        }
        fs.writeFileSync(path.join(scratch, 'inspect.json'), JSON.stringify({errors, dump}, null, 2));
        console.log(JSON.stringify({errors, output: scratch}));
    } finally { await browser.close(); server.close(); }
}
main().catch(error => { console.error(error); server.close(); process.exitCode = 1; });

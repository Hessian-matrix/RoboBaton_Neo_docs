const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const {server, mock, act, prepare} = require('./record_web_tutorials.cjs');
const scenarios = require('./web_tutorial_scenarios.cjs');
const root = path.resolve(__dirname, '..');
const scratch = path.join(root, 'tmp/reviewed-tutorials');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'source/_static/web-tutorials/catalog.json'), 'utf8'));
const all = new Map(catalog.flatMap(group => group.lessons).map(lesson => [lesson.id, lesson]));
const published = catalog.filter(group => !['navigation', 'first-run', 'examples'].includes(group.id)).flatMap(group => group.publishedLessons);
const sources = [...new Set(published.flatMap(identity => all.get(identity).sourceLessons || [identity]))];
const focus = {
    'vio-control': [['#algorithmStatus', '#algoToggle'], '#algorithmStatus', ['#algorithmStatus', '#algoToggle']],
    'trajectory-views': ['#trajCanvas', '#trajCanvas', '#trajCanvas'],
    'pose-readout': ['.pose-panel', '.pose-panel', '.pose-panel'],
    'preview-toggle': ['#videoToggle', '.camera-panel', '.camera-panel'],
    'monitor-panel': [['#imuAccelValue', '#imuGyroValue', '#imuSampleRate', '#imuReceiveRate'], '#imuAccelChart', '#imuGyroChart'],
    'depth-control': ['#depthRunToggle', '#depthPreview', '#depthRunToggle'],
    'mount-platform': ['.mount-editor-heading', '.mount-editor-heading', '#mountBodySize'],
    'mount-coordinates': ['#mountConvention', '#mountConvention', '#mountConvention'],
    'mount-orientation': ['#mountRotationFields', '#mountRotationFields', '#mountRotationFields'],
    'mount-position': ['#mountPositionFields', '#mountPositionFields', '#mountPositionFields'],
    'mount-simulation': ['#mountCanvas', '#mountCanvas', '#mountCanvas'],
    'mount-matrix': ['#mountMatrixRows', '#mountMatrixRows', '#mountExport'],
    'mount-save': ['#mountPositionFields', '.mount-save-area', '.mount-save-area'],
    'flight-scan': ['#fgSteps', '#fgStatus', '#fgConnectFeedback'],
    'flight-manual': ['#fgManualPanel', '[data-action="choose-ardupilot"]', '#fgTryRate'],
    'flight-parameters': ['.fg-source-tabs', '.fg-source-tabs', '.fg-source-tabs'],
    'flight-apply': ['.fg-source-tabs', '#fgReferenceConfirm', '#fgReview'],
    'flight-verify': ['#fgVerification', '.fg-dock-primary', '#fgVerification'],
    'record-destination': ['#recordDestination', '#recordDestination', '#recordDestination'],
    'record-channels': ['#recordChannels', '#recordChannels', '#recordChannels'],
    'record-preflight': ['#tfStorageDetails', '#recordCheckStart', '#recordCheckStart'],
    'record-tf': [['#recordStopBtn', '#captureRecordDuration', '#captureRecordCounts'], ['#recordStopBtn', '#captureRecordDuration', '#captureRecordCounts'], ['#recordStartBtn', '#captureRecordDuration', '#captureRecordCounts']],
    'record-browser': ['#recordDestination', '#recordStopBtn', ['[data-id="usb:browser-tutorial-demo"] .dataset-identity', '[data-id="usb:browser-tutorial-demo"] .dataset-state', '[data-id="usb:browser-tutorial-demo"] .dataset-metrics']],
    'record-catalog': ['#recordSourceFilter', '#recordSourceFilter', '.dataset-detail-body section:first-child'],
    'record-download-delete': ['.dataset-detail-body section:first-child', '[data-action="download"]', '[data-action="delete"]'],
    'calibration-board': ['#boardCanvas', '#boardCanvas', '#measureConfirm'],
    'calibration-measure-tag': ['#tagMeasuredSize', '#tagMeasuredSize', '#confirmScreenBtn'],
    'calibration-settings': ['#tagRows', '#tagRows', '#spacingRatio'],
    'calibration-motion': ['#captureTutorialDialog', '#captureTutorialDialog', '#startRecordBtn'],
    'calibration-finish': ['#actionCoverageGrid', '#guideFinishEarly', '#jobState'],
    'calibration-solve': ['#jobState', '#jobState', '#viewResultBtn'],
    'calibration-results': ['#intrinsicsList', '#intrinsicsList', '#resultFiles'],
    'calibration-filter': ['#frameFilterPanel', '#frameFilterPanel', '#jobState'],
    'calibration-save': ['#downloadSessionZip', '#savedResultPath', '#savedResultPath'],
    'network-read': ['#networkCurrentIP', '#networkCurrentIP', '#networkCurrentIP'],
    'network-change': ['#networkIP', '#networkConfirm', '#networkIP'],
    'button-actions': ['#buttonSettingsFields', '#buttonShortAction', '#buttonLongAction'],
    'button-channels': ['.button-recording-options', '.button-recording-options', '#buttonSettingsState'],
    'boot-start': ['#bootSettings', '#bootSettings', '#bootSettings'],
    'update-version': ['.update-current', '.update-current', '.update-details'],
    'update-upload': ['#updateHelp', ['#updateChoose', '#updateFileInfo'], '#updateInstall'],
    'update-install': ['#updateInstall', '#updateConfirm', '#updateInstall'],
    'update-reboot': ['#updateState', '#updateConfirm', '#updateState'],
};

async function region(page, preferred, fallback) {
    if (Array.isArray(preferred)) {
        const last = page.locator(preferred[preferred.length - 1]).first();
        if (!await last.isVisible()) return region(page, null, fallback);
        await last.scrollIntoViewIfNeeded();
        return page.evaluate(selectors => {
            const boxes = selectors.map(selector => {
                const node = document.querySelector(selector);
                return (node?.closest('.value-line') || node)?.getBoundingClientRect();
            }).filter(box => box && box.width && box.height);
            const left = Math.max(0, Math.min(...boxes.map(box => box.left)) - 22);
            const top = Math.max(0, Math.min(...boxes.map(box => box.top)) - 24);
            const right = Math.min(innerWidth, Math.max(...boxes.map(box => box.right)) + 22);
            const bottom = Math.min(innerHeight, Math.max(...boxes.map(box => box.bottom)) + 24);
            return {selector: selectors.join(' + '), x: left, y: top, width: right - left, height: bottom - top, target: {x: left, y: top, width: right - left, height: bottom - top}, label: selectors.join(', ')};
        }, preferred);
    }
    let selector = preferred;
    let element = selector ? page.locator(selector).first() : null;
    if (!element || !await element.isVisible()) {
        selector = fallback;
        element = page.locator(selector).first();
    }
    if (!await element.isVisible()) return null;
    await element.scrollIntoViewIfNeeded();
    return element.evaluate((node, selector) => {
        const target = node.getBoundingClientRect();
        let context = target;
        if (target.width < 180 || target.height < 55) {
            const parent = node.closest('fieldset, .control-group, .imu-panel, .mount-save-area, .button-gesture-row, .mount-label, .cs-field, .pose-panel, .fg-field, .network-panel') || node.parentElement;
            const box = parent.getBoundingClientRect();
            if (box.width < 800 && box.height < 260) context = box;
        }
        let left = Math.max(0, context.x - 22);
        let top = Math.max(0, context.y - 24);
        let right = Math.min(innerWidth, context.right + 22);
        let bottom = Math.min(innerHeight, context.bottom + 24);
        for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (/(auto|scroll|hidden)/.test(style.overflowY) && parent.clientHeight < parent.scrollHeight) {
                const rect = parent.getBoundingClientRect();
                top = Math.max(top, rect.top);
                bottom = Math.min(bottom, rect.bottom);
            }
        }
        return {selector, x: left, y: top, width: Math.max(80, right - left), height: Math.max(60, bottom - top),
            target: {x: Math.max(0, target.x), y: Math.max(0, target.y), width: Math.min(target.width, innerWidth), height: Math.min(target.height, innerHeight)},
            label: (node.innerText || node.getAttribute('aria-label') || '').trim().slice(0, 80)};
    }, selector);
}

(async () => {
    fs.mkdirSync(scratch, {recursive: true});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const wanted = process.env.TUTORIAL_ONLY?.split(',');
    const queue = sources.filter(identity => !wanted || wanted.includes(identity));
    const reports = [];
    async function worker() {
        while (queue.length) {
            const identity = queue.shift();
            const directory = path.join(scratch, identity);
            fs.mkdirSync(directory, {recursive: true});
            const context = await browser.newContext({viewport: {width: 1280, height: 1000}, deviceScaleFactor: 2});
            const page = await context.newPage();
            page.setDefaultTimeout(6500);
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            try {
                const fixture = await mock(page, base);
                await page.goto(base);
                await page.addStyleTag({content: '#tutorial-disclosure,#tutorial-caption,#tutorial-pointer{display:none!important}*{scroll-behavior:auto!important}'});
                await prepare(page, scenarios[identity], fixture);
                if (identity === 'monitor-panel') await page.waitForTimeout(1400);
                const frames = [];
                const actions = [];
                for (let stage = 0; stage < 3; stage++) {
                    const stepActions = scenarios[identity].steps[stage];
                    const primary = stepActions.find(action => action[1] !== 'wait');
                    let currentRegion = await region(page, primary[0], primary[0]) || await region(page, focus[identity]?.[stage], primary[0]);
                    let didAct = false;
                    for (let frame = 0; frame < 24; frame++) {
                        const started = Date.now();
                        if (frame === 10) {
                            for (const action of stepActions) await act(page, action);
                            await page.waitForTimeout(120);
                            currentRegion = await region(page, focus[identity]?.[stage], primary[0]) || currentRegion;
                            didAct = true;
                            actions.push({stage, actions: stepActions, after: currentRegion});
                        }
                        if (!currentRegion) throw Error('No visible focus region: ' + identity + ':' + stage);
                        if (identity === 'trajectory-views' && didAct) {
                            const height = Math.min(currentRegion.height, 650);
                            currentRegion.y += (currentRegion.height - height) / 2;
                            currentRegion.height = height;
                            currentRegion.target = {x: currentRegion.x, y: currentRegion.y, width: currentRegion.width, height: currentRegion.height};
                        }
                        if (identity === 'mount-simulation' && didAct && currentRegion.selector === '#mountCanvas') {
                            const height = Math.min(currentRegion.height, 450);
                            currentRegion.y += (currentRegion.height - height) / 2;
                            currentRegion.height = height;
                            currentRegion.target = {x: currentRegion.x, y: currentRegion.y, width: currentRegion.width, height};
                        }
                        if (identity === 'flight-verify' && didAct && currentRegion.selector === '#fgVerification') {
                            currentRegion.width = Math.min(currentRegion.width, 840);
                            currentRegion.target = {x: currentRegion.x, y: currentRegion.y, width: currentRegion.width, height: currentRegion.height};
                        }
                        const filename = 'frame-' + String(frames.length).padStart(3, '0') + '.jpg';
                        await page.screenshot({path: path.join(directory, filename), type: 'jpeg', quality: 94});
                        frames.push({filename, stage, afterAction: didAct, region: currentRegion, operation: primary[1]});
                        await page.waitForTimeout(Math.max(0, 125 - (Date.now() - started)));
                    }
                }
                if (identity === 'update-upload') {
                    assert(await page.locator('#updateCandidate').isVisible(), 'Uploaded package was not displayed');
                    assert(!await page.locator('#updateError').isVisible(), 'Upload left an error on screen');
                }
                if (identity === 'pose-readout') {
                    assert(await page.locator('[name="pose-format"][value="euler"]').isChecked());
                    assert(await page.locator('[name="pose-unit"][value="rad"]').isChecked());
                }
                if (identity === 'calibration-filter') {
                    assert(!await page.locator('#resultsDialog').isVisible(), 'Filtered solve never left the result dialog');
                    assert((await page.locator('#jobState').innerText()).trim(), 'Filtered solve has no result state');
                }
                assert.deepEqual(errors, []);
                const capture = {id: identity, width: 1280, height: 1000, scale: 2, fps: 8, duration: 9, realDevice: false, frames, actions, calls: fixture.calls, passed: true};
                fs.writeFileSync(path.join(directory, 'capture.json'), JSON.stringify(capture, null, 2));
                reports.push({id: identity, passed: true, frames: frames.length});
                console.log('PASS capture ' + identity);
            } catch (error) {
                await page.screenshot({path: path.join(directory, 'failure.png')}).catch(() => {});
                reports.push({id: identity, passed: false, message: error.message});
                console.log('FAIL capture ' + identity + ': ' + error.message.split('\n')[0]);
            } finally {await context.close();}
        }
    }
    try {
        await Promise.all(Array.from({length: 3}, worker));
        const output = path.join(root, 'release/video-review');
        fs.mkdirSync(output, {recursive: true});
        const reportPath = path.join(output, 'capture-report.json');
        const previous = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')).sources : [];
        const merged = new Map(previous.map(item => [item.id, item]));
        for (const report of reports) merged.set(report.id, report);
        const results = [...merged.values()];
        fs.writeFileSync(reportPath, JSON.stringify({passed: results.every(item => item.passed), realDevice: false, sources: results}, null, 2));
        if (reports.some(item => !item.passed)) process.exitCode = 1;
    } finally {await browser.close(); server.close();}
})().catch(error => {console.error(error); server.close(); process.exitCode = 1;});

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const {server, mock} = require('./record_web_tutorials.cjs');
const root = path.resolve(__dirname, '..');
const scratch = path.join(root, 'tmp/web-tutorials/monitor-focused');
fs.mkdirSync(scratch, {recursive: true});
(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const base = 'http://127.0.0.1:' + server.address().port;
    const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const context = await browser.newContext({viewport: {width: 1280, height: 1100}, deviceScaleFactor: 2});
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
        await mock(page, base);
        await page.goto(base, {waitUntil: 'load'});
        await page.locator('#railMonitorTab').click();
        await page.locator('.imu-panel').scrollIntoViewIfNeeded();
        await page.waitForFunction(() => document.querySelector('#imuAccelValue').textContent !== '—');
        await page.waitForTimeout(1800);
        const panel = await page.locator('.imu-panel').boundingBox();
        const readout = await page.locator('#imuAccelValue').boundingBox();
        const accel = await page.locator('#imuAccelChart').boundingBox();
        const gyro = await page.locator('#imuGyroChart').boundingBox();
        const controls = await page.locator('.imu-scale-controls').boundingBox();
        assert(panel.width > 200 && gyro.y + gyro.height < 1100);
        const cameras = [
            {x: Math.max(0, panel.x - 12), y: Math.max(0, readout.y - 55), width: panel.width + 24, height: controls.y - readout.y + 110},
            {x: Math.max(0, accel.x - 12), y: controls.y - 16, width: accel.width + 24, height: gyro.y + gyro.height - controls.y + 32},
            {x: Math.max(0, accel.x - 12), y: controls.y - 16, width: accel.width + 24, height: gyro.y + gyro.height - controls.y + 32}
        ];
        const frames = [];
        for (let index = 0; index < 90; index++) {
            if (index === 35) await page.locator('#imuScaleAuto').click();
            if (index === 65) await page.locator('#imuScaleFixed').click();
            const started = Date.now();
            const filename = 'frame-' + String(index).padStart(3, '0') + '.png';
            await page.screenshot({path: path.join(scratch, filename)});
            frames.push(filename);
            await page.waitForTimeout(Math.max(0, 100 - (Date.now() - started)));
        }
        assert.deepEqual(errors, []);
        const details = {width: 1280, height: 1100, cameras, frames, realDevice: false,
            readout: await page.locator('#imuAccelValue').innerText(),
            labels: ['查看加速度、角速度与频率', '放大三轴 IMU 曲线', '切换自动与固定量程']};
        fs.writeFileSync(path.join(scratch, 'capture.json'), JSON.stringify(details, null, 2));
        await new Promise((resolve, reject) => {
            const child = spawn(process.env.PYTHON_PATH || 'python', [path.join(__dirname, 'render_imu_tutorial.py')], {windowsHide: true, stdio: 'inherit'});
            child.on('error', reject);
            child.on('exit', code => code === 0 ? resolve() : reject(Error('IMU render failed: ' + code)));
        });
        console.log('PASS: focused IMU tutorial, moving camera, populated demo readouts and both charts');
    } finally {
        await context.close();
        await browser.close();
        server.close();
    }
})().catch(error => {console.error(error); server.close(); process.exitCode = 1;});

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'release/docs-navigation');
fs.mkdirSync(output, {recursive: true});
(async () => {
    const browser = await chromium.launch({headless: true, executablePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
    const report = [];
    try {
        for (const width of [1440, 390, 320]) {
            for (const theme of ['light', 'dark']) {
                const page = await browser.newPage({viewport: {width, height: 1000}});
                await page.goto(process.env.DOCS_URL || 'http://127.0.0.1:8873/docs/imaging.html');
                await page.evaluate(theme => {document.documentElement.dataset.theme = theme;}, theme);
                if (width < 960) {
                    await page.locator('.primary-toggle').first().click();
                }
                await page.locator('.docs-sidebar-home').waitFor({state: 'visible'});
                const metrics = await page.evaluate(() => {
                    const sidebar = document.querySelector('.bd-sidebar-primary');
                    const links = [...sidebar.querySelectorAll('.bd-sidenav > li > a')];
                    return {
                        captions: sidebar.querySelectorAll('.caption').length,
                        duplicateHome: sidebar.querySelectorAll('.bd-sidenav__home-link').length,
                        labels: links.map(link => link.textContent.trim()),
                        offsets: links.map(link => Math.round(link.getBoundingClientRect().left)),
                        lineHeights: links.map(link => link.getBoundingClientRect().height),
                        overflow: document.documentElement.scrollWidth > innerWidth,
                        active: [...sidebar.querySelectorAll('li.current > a, li.active > a')].map(link => link.getAttribute('href'))
                    };
                });
                assert.equal(metrics.captions, 5);
                assert.equal(metrics.duplicateHome, 0);
                assert.equal(new Set(metrics.offsets).size, 1);
                assert(metrics.lineHeights.every(height => height <= 40));
                assert.equal(metrics.overflow, false);
                assert(metrics.active.includes('#'));
                assert(metrics.labels.includes('设备设置'));
                assert(!metrics.labels.some(label => label.endsWith('页面')));
                await page.locator('.docs-sidebar-home').scrollIntoViewIfNeeded();
                await page.screenshot({path: path.join(output, 'navigation-' + width + '-' + theme + '.png')});
                const search = page.locator('.bd-sidebar-primary .search-button-field');
                if (await search.isVisible()) {
                    await search.click();
                } else {
                    await page.keyboard.press('Escape');
                    await page.keyboard.press('Control+k');
                }
                await page.locator('#pst-search-dialog[open]').waitFor({state: 'visible'});
                await page.keyboard.press('Escape');
                report.push({width, theme, passed: true, metrics});
                await page.close();
            }
        }
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        console.log('PASS: navigation alignment, five groups, active page, native search; desktop/mobile, light/dark');
    } finally {
        await browser.close();
    }
})().catch(error => {console.error(error); process.exitCode = 1;});

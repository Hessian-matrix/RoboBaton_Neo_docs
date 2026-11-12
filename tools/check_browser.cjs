const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('fs');
const path = require('path');
const http = require('http');
const assert = require('assert');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'release', 'deployment-2026-11-11-original');
fs.mkdirSync(output, { recursive: true });
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json'};
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^[/]+/, '') || 'index.html';
  if (!JSON.parse(fs.readFileSync(path.join(root,'site-manifest.json'))).includes(name)) {res.writeHead(404); return res.end();}
  res.setHeader('Content-Type', types[path.extname(name)] || 'text/plain');
  res.end(fs.readFileSync(path.join(root,'tmp/site',name)));
});
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.SITE_URL || `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const errors=[], failures=[], comparisons=[];
  try {
    const page = await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => {if(r.status()>=400)failures.push([r.url(),r.status()]);});
    for (const width of [1440,390,320]) {
      await page.setViewportSize({width,height:1000});
      for (const filename of ['index.html','quick-start.html']) {
        await page.goto(base+filename,{waitUntil:'networkidle'});
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
        assert.equal(await page.locator('nav[aria-label=主导航] a').last().getAttribute('href'),'docs/');
        const target=filename==='index.html'?page.locator('.hero'):page.locator('body');
        const screenshot=await target.screenshot({animations:'disabled'});
        fs.writeFileSync(path.join(output,`${filename}-${width}.png`),screenshot);
        if(process.env.ORIGINAL_URL){
          const original=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
          await original.goto(process.env.ORIGINAL_URL+filename,{waitUntil:'networkidle'});
          const originalTarget=filename==='index.html'?original.locator('.hero'):original.locator('body');
          const originalShot=await originalTarget.screenshot({animations:'disabled'});
          const equal=digest(screenshot)===digest(originalShot);
          comparisons.push({filename,width,pixelIdentical:equal});
          await original.close();
          assert(equal,`Visual mismatch: ${filename} ${width}`);
        }
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(base+'index.html',{waitUntil:'networkidle'});
    await page.getByRole('button',{name:'裸机',exact:true}).click();
    assert((await page.locator('#variant-weight').innerText()).includes('8.69'));
    await page.getByRole('button',{name:'带壳',exact:true}).click();
    assert((await page.locator('#variant-weight').innerText()).includes('13.86'));
    for(const mode of ['usb','tf','pins']) {
      await page.locator('[data-interface-view='+mode+']').click();
      assert.equal(await page.locator('.port-showcase').getAttribute('data-mode'),mode);
    }
    await page.locator('#capabilities').screenshot({path:path.join(output,'interface.png')});
    await page.locator('.demo-options summary').click();
    await page.locator('#progress').fill('72');
    assert.equal(await page.locator('#percent').innerText(),'72%');
    await page.getByRole('button',{name:'重置轨迹视角'}).click();
    assert.equal(await page.locator('#percent').innerText(),'0%');
    await page.goto(base+'quick-start.html',{waitUntil:'networkidle'});
    await page.locator('#computer-os').selectOption('win10');
    assert(await page.locator('#system-driver').isVisible());
    await page.locator('#computer-os').selectOption('linux');
    assert((await page.locator('#system-description').innerText()).includes('cdc_ncm'));
    await page.evaluate(()=>{window.calls=[];window.fetch=async(u,o)=>{window.calls.push([u,o.method,o.credentials]);return {type:'opaque'}}});
    await page.locator('#check-button').click();
    await page.waitForFunction(()=>document.querySelector('#check-result').dataset.state==='success');
    assert.deepEqual(await page.evaluate(()=>window.calls),[['http://192.168.11.1/','GET','omit']]);
    await page.locator('#device-address').fill('bad');
    await page.locator('#check-button').click();
    assert.equal((await page.evaluate(()=>window.calls)).length,1);
    await page.locator('#device-address').fill('192.168.11.2');
    assert.equal(await page.locator('#open-device-link').getAttribute('href'),'http://192.168.11.2/');
    await page.evaluate(()=>{window.fetch=async()=>{throw new TypeError('blocked')}});
    await page.locator('#check-button').click();
    await page.waitForFunction(()=>document.querySelector('#check-result').dataset.state==='warning');
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    const report={base,comparisons,errors,failures,interactions:'PASS',networkProbe:'mocked; no physical device claim'};
    fs.writeFileSync(path.join(output,process.env.SITE_URL?'browser-live.json':'browser-local.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});

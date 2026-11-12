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
    assert.equal(await page.locator('#computer-os').count(),0);
    assert((await page.locator('#connect').innerText()).includes('仅较旧版本的 Windows'));
    assert.equal(await page.locator('#connect .legacy-driver a').getAttribute('href'),'docs/installation.html#windows-usb-driver');
    assert.equal(await page.locator('#check-button').count(),0);
    await page.evaluate(()=>{window.calls=[];window.fetch=(...args)=>{window.calls.push(args);throw new Error('Unexpected probe')}});
    await page.locator('#step-tab-2').click();
    await page.locator('#device-address').fill('bad');
    assert.equal(await page.locator('#open-device-link').getAttribute('href'),null);
    assert.equal(await page.locator('#open-device-link').getAttribute('aria-disabled'),'true');
    await page.locator('#device-address').fill('192.168.46.1');
    assert.equal(await page.locator('#open-device-link').getAttribute('href'),'http://192.168.46.1/');
    assert.equal(await page.locator('#open-device-link').getAttribute('aria-disabled'),null);
    assert.deepEqual(await page.evaluate(()=>window.calls),[]);
    assert.equal(await page.locator('#device-frame').getAttribute('src'),null);
    for(const invalid of ['192.168.46.1:0','192.168.46.1:65536','192.168.46.1:','192.168.46.1:abc','256.168.46.1','192.168.46.1:80/path']){
      await page.locator('#device-address').fill(invalid);
      assert(await page.locator('#connect-device').isDisabled(),invalid);
      assert.equal(await page.locator('#open-device-link').getAttribute('href'),null);
    }
    for(const port of [1,65535,46002]){
      await page.locator('#device-address').fill('192.168.46.1:'+port);
      assert.equal(await page.locator('#open-device-link').getAttribute('href'),'http://192.168.46.1:'+port+'/');
      assert(await page.locator('#connect-device').isEnabled());
    }
    let deviceRequests=0;
    await page.route('http://192.168.46.1:46002/**',route=>{deviceRequests++;return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><h1>Mock Neo</h1><button onclick="this.textContent=String(1+Number(this.textContent))">0</button></body></html>'})});
    await page.locator('#connect-device').click();
    const device=page.frameLocator('#device-frame');
    await device.getByRole('button',{name:'0',exact:true}).click();
    assert.equal(await device.getByRole('button').innerText(),'1');
    assert.equal(deviceRequests,1);
    for(const width of [1440,900,600,390,320]){
      await page.setViewportSize({width,height:1000});
      const positions=[];
      for(const step of [1,2,3]){
        await page.locator('#step-tab-'+step).click();
        positions.push(await page.evaluate(step=>{
          const box=selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {x:r.x,y:r.y+scrollY,width:r.width,height:r.height}};
          return {visual:box(step===1?'#connect .quick-visual':'#device-preview'),title:box(step===1?'#connect h2':step===2?'#device-connect-panel h2':'#start-vio h2'),footer:box('#chapter-program')};
        },step));
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      }
      for(const position of positions.slice(1))for(const part of ['visual','title','footer'])for(const axis of (part==='visual'?['x','y','width','height']:['x','y'])){
        assert(Math.abs(position[part][axis]-positions[0][part][axis])<1,JSON.stringify({width,part,axis,positions}));
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#step-tab-3').click();
    assert(await page.locator('#device-frame').isVisible());
    assert(await page.locator('#start-vio').isVisible());
    assert(await page.locator('#device-connect-panel').isHidden());
    await device.getByRole('button',{name:'1',exact:true}).click();
    assert.equal(await device.getByRole('button').innerText(),'2');
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:1000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(output,'step-three-'+width+'.png')});
    }
    await page.locator('#step-tab-1').click();
    assert(await page.locator('#device-frame').isHidden());
    await page.locator('#step-tab-2').click();
    assert.equal(await device.getByRole('button').innerText(),'2');
    assert.equal(deviceRequests,1,'step changes must preserve iframe session');
    await page.locator('#step-tab-2').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#step-tab-3').getAttribute('aria-selected'),'true');
    await page.keyboard.press('ArrowLeft');
    assert(await page.locator('#device-connect-panel').isVisible());
    assert.equal(await page.locator('#device-frame').getAttribute('src'),'http://192.168.46.1:46002/');
    await page.locator('#expand-device').click();
    assert.equal(await page.locator('#expand-device').getAttribute('aria-expanded'),'true');
    await page.locator('#expand-device').click();
    await page.locator('#device-address').fill('192.168.11.1');
    assert.equal(await page.locator('#device-frame').getAttribute('src'),null);
    assert(await page.locator('#device-frame').isHidden());
    await page.locator('#step-tab-1').click();
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.locator('#toggle-connection-animation').click();
    assert.equal(await page.locator('#toggle-connection-animation').getAttribute('aria-pressed'),'true');
    const phases=await page.evaluate(()=>{
      const svg=document.querySelector('.connection-illustration'),animations=svg.getAnimations({subtree:true});
      const sample=time=>{animations.forEach(a=>{a.pause();a.currentTime=time});return {plug:getComputedStyle(svg.querySelector('.usb-plug')).transform,cable:getComputedStyle(svg.querySelector('.usb-cable path')).d,status:getComputedStyle(svg.querySelector('.usb-screen-status')).opacity}};
      return {count:animations.length,start:sample(0),connected:sample(3500)};
    });
    assert(phases.count>=7);
    assert.notEqual(phases.start.plug,phases.connected.plug);
    assert.notEqual(phases.start.cable,phases.connected.cable);
    assert.equal(phases.start.status,'0');assert.equal(phases.connected.status,'1');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert(await page.locator('#toggle-connection-animation').isHidden());
    assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);
    const report={base,comparisons,errors,failures,interactions:'PASS',networkProbe:'user-initiated iframe tested with mock; no physical device claim'};
    fs.writeFileSync(path.join(output,process.env.SITE_URL?'browser-live.json':'browser-local.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report));
  } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});

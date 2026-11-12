const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),vm=require('vm');
const root=path.resolve(__dirname,'..'),site=path.join(root,'tmp/site'),out=path.join(root,'release/integration-guide');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';const file=path.resolve(site,name);if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file))});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const errors=[],failures=[],external=[];
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.url())});page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url())});
 await page.goto(base+'integration.html',{waitUntil:'networkidle'});
 await page.locator('#integration-next').click();
 await page.locator('#integration-language').selectOption('python-local');
 await page.locator('#integration-address').fill('192.168.46.1:46002');
 await page.locator('#integration-next').click();
 await page.waitForFunction(()=>document.querySelector('#generated-code').textContent.includes('http://192.168.46.1:46002'));
 assert((await page.locator('#run-command').innerText()).endsWith(' odometry'));
 const python=await page.locator('#generated-code').innerText();assert(python.includes('from client import Device'));
 const downloadPromise=page.waitForEvent('download');await page.locator('#download-code').click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'receive.py');
 fs.mkdirSync(path.join(root,'tmp/integration-check'),{recursive:true});await download.saveAs(path.join(root,'tmp/integration-check/receive.py'));
 await page.locator('#integration-tab-2').click();
 await page.locator('#integration-language').selectOption('javascript');await page.locator('#integration-data').selectOption('gray_jpeg');await page.locator('#integration-next').click();
 const js=await page.locator('#generated-code').innerText();new vm.Script(js);assert(js.includes("|| 'gray_jpeg'"));assert(js.includes('192.168.46.1:46002'));assert((await page.locator('#run-command').innerText()).endsWith(' gray_jpeg'));
 await page.locator('.result-guide > summary').click();assert(await page.locator('#verification-intro').isVisible());assert((await page.locator('#verification-intro').innerText()).includes('图像'));assert(await page.locator('#code-view').isVisible());
 await page.locator('#integration-tab-2').click();await page.locator('#integration-address').fill('192.168.46.1:65536');assert(await page.locator('#integration-next').isDisabled());await page.locator('#integration-tab-3').click();assert.equal(await page.locator('#integration-tab-2').getAttribute('aria-selected'),'true');
 await page.locator('#integration-address').fill('192.168.46.1');assert(await page.locator('#integration-next').isEnabled());
 await page.locator('#integration-tab-1').click();await page.locator('[data-transport=serial]').click();await page.locator('#integration-next').click();assert(await page.locator('#usb-settings').isHidden());assert(await page.locator('#serial-settings').isVisible());
 await page.locator('#integration-port').fill('/dev/ttyUSB0');await page.locator('#integration-baud').fill('115200');await page.locator('#integration-next').click();assert((await page.locator('#run-command').innerText()).includes('/dev/ttyUSB0 --baud 115200'));assert.equal(await page.locator('#filename').innerText(),'serial_pose.py');
 fs.writeFileSync(path.join(root,'tmp/integration-check/serial_pose.py'),await page.locator('#generated-code').innerText());
 assert(await page.locator('#verification-intro').isVisible());assert((await page.locator('#coordinate-note').innerText()).includes('MAVLink'));assert(await page.locator('#code-view').isVisible());
 for(const transport of ['usb','serial'])for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});await page.locator('#integration-tab-1').click();await page.locator('[data-transport='+transport+']').click();
   for(let step=1;step<=3;step++){
     await page.locator('#integration-tab-'+step).click();
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),transport+' '+width+' '+step);
     await page.screenshot({path:path.join(out,transport+'-'+width+'-step'+step+'.png'),fullPage:true});
   }
 }
 await page.goto(base+'integration.html?transport=usb&language=javascript',{waitUntil:'networkidle'});assert.equal(await page.locator('#integration-language').inputValue(),'javascript');
 await page.locator('#integration-tab-1').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#integration-tab-2').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('[role=tab]').count(),3);await page.keyboard.press('End');assert.equal(await page.locator('#integration-tab-3').getAttribute('aria-selected'),'true');await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#integration-tab-1').getAttribute('aria-selected'),'true');for(const language of ['browser','python']){await page.locator('#integration-tab-2').click();await page.locator('#integration-language').selectOption(language);await page.locator('#integration-tab-3').click();assert(await page.locator('#browser-runner').isVisible());assert(await page.locator('#result-view').isHidden());await page.locator('#integration-next').click();assert(await page.locator('#browser-runner').isHidden());}assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({errors,failures,external,layouts:18,download:'PASS',validation:'PASS',realDevice:false},null,2));console.log('PASS: USB/serial, pose/image, Python/Node.js, address/baud validation, download, keyboard and 18 responsive views; no device requests');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});

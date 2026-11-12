const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert'),vm=require('vm');
const root=path.resolve(__dirname,'..'),site=path.join(root,'tmp/site'),out=path.join(root,'release/lesson-guide');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';const file=path.resolve(site,name);if(!file.startsWith(site+path.sep)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);return res.end()}res.setHeader('Content-Type',name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.js')?'text/javascript':name.endsWith('.json')?'application/json':name.endsWith('.css')?'text/css':'application/octet-stream');res.end(fs.readFileSync(file))});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port+'/';
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const errors=[],failures=[],external=[];
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(r.url())});page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('blob:'))external.push(r.url())});
 const layouts=[];
 for(const filename of ['robot-mounting.html','calibration-guide.html']){
  await page.goto(base+filename,{waitUntil:'networkidle'});
  if(filename==='robot-mounting.html'){
   await page.locator('#robot-variant').selectOption('bare');assert((await page.locator('#dimension-summary').innerText()).includes('40 × 20 × 19.5'));
   await page.locator('#lesson-tab-2').click();await page.locator('#robot-platform').selectOption('drone');await page.locator('#robot-location').selectOption('rear');assert((await page.locator('#mount-recommendation').innerText()).includes('后部'));
   await page.locator('#lesson-tab-3').click();await page.locator('#robot-frame').selectOption('FRD');await page.locator('#offset-x').fill('25');assert((await page.locator('#offset-description').innerText()).includes('0.25 m'));assert((await page.locator('#offset-description').innerText()).includes('下'));
   await page.locator('#offset-x').fill('');assert((await page.locator('#offset-description').innerText()).includes('有效数值'));await page.locator('#offset-x').fill('12');
  }else{
   await page.locator('#calibration-reason').selectOption('missing');assert((await page.locator('#calibration-advice').innerText()).includes('重新标定'));
   await page.locator('#lesson-tab-2').click();await page.locator('#tag-size').fill('45');assert((await page.locator('#tag-size-result').innerText()).includes('4.5 cm'));
   await page.locator('#lesson-tab-3').click();await page.locator('#calibration-motion').selectOption('distance');assert((await page.locator('#motion-advice').innerText()).includes('距离'));
  }
  const count=await page.locator('[role=tab]').count();
  for(const width of [1440,390,320]){
   await page.setViewportSize({width,height:1000});let baseline=null;
   for(let step=1;step<=count;step++){
    await page.locator('#lesson-tab-'+step).click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),filename+' '+width+' '+step);
    const box=await page.locator('#lesson-panel').boundingBox();if(baseline!==null)assert(Math.abs(box.height-baseline)<1,'stable lesson height');baseline=box.height;
    await page.screenshot({path:path.join(out,filename+'-'+width+'-'+step+'.png'),fullPage:true});layouts.push([filename,width,step]);
   }
  }
 }
 await page.locator('#lesson-next').click();await page.waitForURL('**/quick-start.html#start-vio');
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);assert.deepEqual(external,[]);
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({errors,failures,external,layouts:layouts.length,validation:'PASS',realDevice:false},null,2));console.log('PASS: mounting dimensions, positions, coordinates, calibration guidance, 21 responsive views and tutorial completion')
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
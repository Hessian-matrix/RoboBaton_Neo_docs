const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'..'),base=process.env.PREVIEW_URL||'http://127.0.0.1:8873/';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const results=[],errors=[];const output=path.join(root,'release/video-locales');fs.mkdirSync(output,{recursive:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
  const pairs=new Map();
  for(const locale of ['', 'zh/'])for(const name of ['positioning','imaging','mount-settings','flight-page','recording','calibration','device-settings','maintenance']){
   await page.goto(base+locale+'docs/'+name+'.html');
   for(const video of await page.locator('article video').all()){
    const result=await video.evaluate(async v=>{
     v.preload='auto';v.load();await new Promise((resolve,reject)=>{v.addEventListener('loadedmetadata',resolve,{once:true});v.addEventListener('error',()=>reject(Error('Video failed')), {once:true});setTimeout(()=>reject(Error('Metadata timeout')),20000)});
     await new Promise((resolve,reject)=>{v.addEventListener('seeked',resolve,{once:true});v.currentTime=Math.min(2,v.duration/2);setTimeout(()=>reject(Error('Seek timeout')),15000)});
     return {src:v.currentSrc,duration:v.duration,width:v.videoWidth,height:v.videoHeight,track:v.querySelector('track').srclang};
    });
    const filename=new URL(result.src).pathname.split('/').pop();assert.equal(result.track,locale?'zh-CN':'en');
    if(locale){const peer=pairs.get(filename);assert(peer);assert(Math.abs(peer.duration-result.duration)<.12,filename);assert.equal(result.width,peer.width);assert.equal(result.height,peer.height);assert.notEqual(peer.src,result.src);}
    else pairs.set(filename,result);
    results.push({locale,page:name,...result});
   }
  }
  for(const width of [320,390,1440])for(const locale of ['', 'zh/']){
   await page.setViewportSize({width,height:950});await page.goto(base+locale+'docs/positioning.html#vio-control');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
   await page.locator('#vio-control').screenshot({path:path.join(output,(locale?'zh':'en')+'-'+width+'.png')});
   await page.locator('.locale-switch a:not([aria-current])').click();
   assert.equal(new URL(page.url()).hash,'#vio-control');
   assert.equal(await page.locator('html').getAttribute('lang'),locale?'en':'zh-CN');
  }
  for(const locale of ['', 'zh/']){
   await page.setViewportSize({width:1280,height:900});await page.goto(base+locale+'robot-mounting.html');await page.locator('[data-lesson-step="2"]').click();
   const v=page.locator('#mount-workflow-video');await v.evaluate(v=>v.load());await page.waitForFunction(()=>document.querySelector('#mount-workflow-video').readyState>=2);
   assert(Math.abs(await v.evaluate(v=>v.duration)-21.48)<.1);
   await v.evaluate(v=>{v.pause();v.currentTime=12;});await page.waitForTimeout(500);
   await page.screenshot({path:path.join(output,'mount-'+(locale?'zh':'en')+'.png')});
   await page.locator('.locale-switch a:not([aria-current])').click();
   await page.waitForFunction(()=>{const v=document.querySelector('#mount-workflow-video');return v && v.readyState>=2 && Math.abs(v.currentTime-12)<.2 && v.paused;});
  }
  assert.equal(pairs.size,24);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'browser-report.json'),JSON.stringify({passed:true,results,errors},null,2));console.log('PASS: 48 decoded videos, paired duration/dimensions, 6 responsive language switches, 2 mounting videos');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

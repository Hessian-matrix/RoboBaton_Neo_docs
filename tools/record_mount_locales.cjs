const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const {server,mock}=require('./record_web_tutorials.cjs');
const root=path.resolve(__dirname,'..');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{for(const language of ['zh','en']){
  const dir=path.join(root,'tmp/mount-film-'+language);fs.mkdirSync(dir,{recursive:true});
  const page=await browser.newPage({viewport:{width:1280,height:800}});await mock(page,base);
  await page.goto(base+'/?lang='+language);await page.locator('#mountTab').click();await page.waitForTimeout(500);
  const actions=[];
  for(let frame=0;frame<172;frame++){
   const start=Date.now();
   if(frame===28){await page.locator('#mountRobot').selectOption('drone');actions.push([frame,'robot','drone']);}
   if(frame===56){await page.locator('#mountRobot').selectOption('car');await page.locator('#mountBodyLength').fill('300');actions.push([frame,'robot','car','length',300]);}
   if(frame===84){await page.locator('#mountNumber3').fill('0.12');actions.push([frame,'x',0.12]);}
   if(frame===108){await page.locator('#mountNumber2').fill('15');actions.push([frame,'yaw',15]);}
   if(frame===136){await page.locator('#mountSave').click();actions.push([frame,'save']);}
   if(frame===152){await page.locator('#mountRead').click();actions.push([frame,'read']);}
   await page.screenshot({path:path.join(dir,'frame-'+String(frame).padStart(3,'0')+'.jpg'),type:'jpeg',quality:94});
   await page.waitForTimeout(Math.max(0,125-(Date.now()-start)));
  }
  fs.writeFileSync(path.join(dir,'capture.json'),JSON.stringify({language,actions,frames:172,duration:21.48,realDevice:false},null,2));await page.close();console.log('PASS mount film '+language);
 }}finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

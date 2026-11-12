const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=path.join(root,'release/integration-layout');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let n=new URL(req.url,'http://localhost').pathname;if(n.endsWith('/'))n+='index.html';const f=path.join(root,'tmp/site',n);if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{const p=await b.newPage({reducedMotion:'reduce'}),results=[];for(const width of [1280,390,320]){
 await p.setViewportSize({width,height:1000});await p.goto('http://127.0.0.1:'+server.address().port+'/integration.html',{waitUntil:'networkidle'});
 const measurements=[];for(const transport of ['usb','serial','usb']){await p.locator('[data-transport='+transport+']').click();assert(await p.locator(transport==='usb'?'#serial-art':'#usb-art').isHidden());assert(await p.locator(transport==='usb'?'#usb-art':'#serial-art').isVisible());
 if(transport==='serial'){for(const pin of ['1','2','3','4','5','6']){await p.locator('[data-wire="'+pin+'"]').click();assert.equal(await p.locator('[data-wire="'+pin+'"]').getAttribute('aria-pressed'),'true');assert(await p.locator('.wire-active').count()>0);assert.equal(await p.locator('.wiring-detail').count(),0);}await p.locator('[data-wire="3"]').click();}
 measurements.push(await p.evaluate(()=>{const r=document.querySelector('#integration-panel').getBoundingClientRect(),a=document.querySelector('.integration-actions').getBoundingClientRect();return {height:r.height,actionY:a.top-r.top};}));
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('#integration-panel').screenshot({path:path.join(out,width+'-'+transport+'.png')});}
 assert(Math.max(...measurements.map(x=>x.height))-Math.min(...measurements.map(x=>x.height))<1,'card height shifts');assert(Math.max(...measurements.map(x=>x.actionY))-Math.min(...measurements.map(x=>x.actionY))<1,'actions shift');results.push({width,measurements});
 }
 for(const width of [1440,1040,768,600,390,320]){
 await p.setViewportSize({width,height:1000});await p.goto('http://127.0.0.1:'+server.address().port+'/integration.html',{waitUntil:'networkidle'});
 const variants=[];
 for(const transport of ['usb','serial'])for(const language of ['browser','python','python-local','javascript'])for(const data of ['odometry','gray_jpeg']){
 await p.locator('#integration-tab-1').click();await p.locator('[data-transport='+transport+']').click();await p.locator('#integration-tab-2').click();await p.locator('#integration-language').selectOption(language);if(transport==='usb')await p.locator('#integration-data').selectOption(data);
 for(const step of [1,2,3]){await p.locator('#integration-tab-'+step).click();const m=await p.evaluate(()=>{const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {y:r.y,h:r.height}};return {card:rect('#integration-panel'),title:rect('#integration-title'),actions:rect('.integration-actions'),overflow:document.documentElement.scrollWidth>innerWidth}});assert(!m.overflow);variants.push(m);}
 }
 for(const key of ['card','title','actions'])for(const dim of ['y','h'])assert(Math.max(...variants.map(m=>m[key][dim]))-Math.min(...variants.map(m=>m[key][dim]))<1,width+' '+key+' '+dim+' shifts across options');
 results.push({width,variants:variants.length,stable:true});
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(results,null,2));console.log('PASS: USB/serial visibility, equal card heights and action baselines, plus all transport/language/data/step combinations at six widths');}finally{await b.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});

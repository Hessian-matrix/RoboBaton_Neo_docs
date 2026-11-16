const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=path.join(root,'release/integration-layout');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let n=new URL(req.url,'http://localhost').pathname;if(n.endsWith('/'))n+='index.html';const f=path.join(root,'tmp/site',n);if(!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.json':'application/json'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{const p=await b.newPage({reducedMotion:'reduce'}),results=[];for(const width of [1280,390,320]){
 await p.setViewportSize({width,height:1000});await p.goto('http://127.0.0.1:'+server.address().port+'/integration.html',{waitUntil:'networkidle'});
 const measurements=[];for(const transport of ['usb','serial','usb']){await p.locator('[data-transport='+transport+']').click();assert(await p.locator(transport==='usb'?'#serial-art':'#usb-art').isHidden());assert(await p.locator(transport==='usb'?'#usb-art':'#serial-art').isVisible());
 if(transport==='serial'){for(const pin of ['1','2','3','4','5','6']){await p.locator('[data-wire="'+pin+'"]').click();assert.equal(await p.locator('[data-wire="'+pin+'"]').getAttribute('aria-pressed'),'true');assert(await p.locator('.wire-active').count()>0);assert.equal(await p.locator('.wiring-detail').count(),0);}await p.locator('[data-wire="3"]').click();}
 if(transport==='serial'){
  assert(await p.locator('.wiring-orientation').isVisible());
  assert((await p.locator('.wiring-orientation').innerText()).includes('TF 卡槽在左，6pin 在右；上 6 ↓ 下 1'));
  assert((await p.locator('.wiring-orientation').innerText()).includes('不是线束插头的线端视图'));
  assert.equal(await p.locator('.wiring-heading a').getAttribute('href'),'docs/connect-serial.html');
  assert.deepEqual(await p.locator('.wiring-pins button').evaluateAll(buttons=>buttons.map(button=>button.dataset.wire)),['6','5','4','3','2','1']);
  const terminals=await p.locator('.wiring-map g[data-wire-part]').evaluateAll(groups=>groups.filter(group=>group.querySelector('circle[cx="141"]')).map(group=>({id:group.dataset.wirePart,y:Number(group.querySelector('circle').getAttribute('cy'))})));
  assert.deepEqual(terminals,[{id:'6',y:65},{id:'5',y:102},{id:'4',y:139},{id:'3',y:176},{id:'2',y:213},{id:'1',y:250}]);
  for(const {id,y} of terminals){const lines=await p.locator('.wiring-map g[data-wire-part="'+id+'"] path').evaluateAll(paths=>paths.map(item=>item.getAttribute('d')));assert(lines.some(line=>line.startsWith('M154 '+y)),'wire does not originate from pin '+id);}
 }
 measurements.push(await p.evaluate(()=>{const r=document.querySelector('#integration-panel').getBoundingClientRect(),a=document.querySelector('.integration-actions').getBoundingClientRect();return {height:r.height,actionY:a.top-r.top};}));
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('#integration-panel').screenshot({path:path.join(out,width+'-'+transport+'.png')});}
 assert(Math.max(...measurements.map(x=>x.height))-Math.min(...measurements.map(x=>x.height))<1,'card height shifts '+JSON.stringify({width,measurements}));assert(Math.max(...measurements.map(x=>x.actionY))-Math.min(...measurements.map(x=>x.actionY))<1,'actions shift');results.push({width,measurements});
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

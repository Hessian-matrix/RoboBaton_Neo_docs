const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core'),fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=process.env.MODEL_TEST_OUTPUT||path.join(root,'release/unified-enclosure');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';const p=path.join(root,'tmp/site',name);if(!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});try{
 const p=await b.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.SITE_URL||'http://127.0.0.1:'+server.address().port+'/',{waitUntil:'networkidle'});await p.waitForFunction(()=>window.neoCadStatus?.ready);
 for(const width of [1440,320]){await p.setViewportSize({width,height:1000});for(const mode of ['pins','usb','tf','pins']){
  await p.locator('[data-interface-view='+mode+']').click();assert.equal(await p.locator('.port-showcase').getAttribute('data-mode'),mode);
  assert(await p.locator(mode==='pins'?'#pin-callout':mode==='usb'?'#computer-callout':'#tf-callout').isVisible());
  await p.locator('.port-showcase').screenshot({path:path.join(out,width+'-'+mode+'.png')});
 }assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 assert.deepEqual(errors,[]);console.log('PASS: shared enclosure; pin/USB/TF transitions, return to opaque shell, desktop/mobile, no JS errors');
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});

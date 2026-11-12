// Run after build_site.py. Local or SITE_URL; artifacts stay in release/.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.MODEL_TEST_OUTPUT||path.join(root,'release/cad-v2'));fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{let name=new URL(req.url,'http://localhost').pathname;if(name.endsWith('/'))name+='index.html';const p=path.join(root,'tmp/site',name);if(!fs.existsSync(p)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html; charset=utf-8'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.SITE_URL||`http://127.0.0.1:${server.address().port}/`;const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const p=await b.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(base,{waitUntil:'networkidle'});await p.waitForFunction(()=>window.neoCadStatus?.ready);
const state=await p.evaluate(()=>window.neoCadStatus);assert(state.meshes>100);assert(Math.abs(state.bounds[0]-19.9666)<.01);assert(Math.abs(state.bounds[1]-41.0005)<.01);assert(Math.abs(state.bounds[2]-18.0962)<.01);
const canvas=p.locator('#product-model');let views=0;
for(const variant of ['bare','case']){await p.locator(`[data-variant=${variant}]`).click();await canvas.focus();
 for(const [tilt,down] of [['top',0],['side',19],['bottom',38]]){
  for(let k=0;k<40;k++)await p.keyboard.press('ArrowUp');for(let k=0;k<down;k++)await p.keyboard.press('ArrowDown');
  for(let i=0;i<18;i++){for(let k=0;k<3;k++)await p.keyboard.press('ArrowRight');
   const ink=await canvas.evaluate(c=>{const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let j=0;j<a.length;j+=4)if(a[j+3]>200&&Math.min(a[j],a[j+1],a[j+2])<160)n++;return n;});assert(ink>700,`${variant}/${tilt}/${i}: empty model (${ink})`);views++;
   if(i===0||i===9)await canvas.screenshot({path:path.join(out,`${variant}-${tilt}-${i}.png`)});
  }
 }
}
await p.locator('[data-variant=bare]').click();await canvas.focus();for(let i=0;i<40;i++)await p.keyboard.press('ArrowUp');for(let i=0;i<11;i++)await p.keyboard.press('ArrowDown');await p.locator('.hero').screenshot({path:path.join(out,'hero.png')});
await p.setViewportSize({width:320,height:850});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await canvas.screenshot({path:path.join(out,'mobile.png')});
const box=await canvas.boundingBox(),before=await canvas.evaluate(c=>c.toDataURL());await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+75,box.y+box.height/2+40,{steps:8});await p.mouse.up();assert.notEqual(before,await canvas.evaluate(c=>c.toDataURL()));
// Asset download failure must retain the depth-tested model and usable controls.
const fallback=await b.newPage();await fallback.route('**/product-v2.glb',route=>route.abort());await fallback.goto(base,{waitUntil:'networkidle'});await fallback.waitForFunction(()=>window.neoCadStatus?.error);await fallback.locator('[data-variant=bare]').click();assert(await fallback.locator('#product-model').evaluate(c=>c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((x,i)=>i%4===3&&x>200)));await fallback.close();
assert.deepEqual(errors,[]);const result={passed:true,views,state,mobileWidth:320,assetFailureFallback:true};fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(`PASS: ${views} CAD/enclosure views, top/side/underside, geometry bounds, mobile drag, asset fallback, no JS errors`);
}finally{await b.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1});

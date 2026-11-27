const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'..'),out=path.join(root,'release/docs-v2-20261127');
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage();const results=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  for(const locale of ['en','zh'])for(const slug of ['recording-tools','imaging','flight-page','recording','install-tf','maintenance','sdk','scope'])for(const width of [1440,390,320])for(const theme of ['light','dark']){
   await page.setViewportSize({width,height:960});
   await page.goto('http://127.0.0.1:8874/'+(locale==='zh'?'zh/':'')+'docs/'+slug+'.html');
   await page.evaluate(t=>{document.documentElement.dataset.theme=t;},theme);
   const data=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,title:document.querySelector('h1')?.innerText,links:[...document.querySelectorAll('.locale-switch a')].map(a=>a.href)}));
   assert(data.title);assert(data.scroll<=width+1,JSON.stringify({locale,slug,width,data}));assert.equal(data.links.length,2);
   results.push({locale,slug,width,theme,...data});
   if(['recording-tools','imaging'].includes(slug)&&[1440,390].includes(width)&&theme==='light')await page.screenshot({path:path.join(out,locale+'-'+slug+'-'+width+'.png'),fullPage:true});
  }
  await page.goto('http://127.0.0.1:8874/docs/recording-tools.html');
  await page.locator('.locale-switch a[hreflang="zh-CN"]').click();assert(page.url().endsWith('/zh/docs/recording-tools.html'));
  await page.locator('.locale-switch a[hreflang="en"]').click();assert(page.url().endsWith('/docs/recording-tools.html'));
  assert.equal(errors.length,0,errors.join('; '));
  fs.writeFileSync(path.join(out,'layout-report.json'),JSON.stringify({realDevice:false,results,errors},null,2));
  console.log('PASS: '+results.length+' locale/page/viewport/theme layouts and bidirectional language switching');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});

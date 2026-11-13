const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const types={'.js':'text/javascript','.html':'text/html; charset=utf-8'};
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://localhost').pathname;const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
server.listen(0,'127.0.0.1',()=>{
 const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--no-first-run','--no-default-browser-check','--use-angle=swiftshader','--enable-unsafe-swiftshader','--hide-scrollbars','--user-data-dir='+path.join(root,'tmp/tf-render-profile'),'--window-size=960,600','--virtual-time-budget=5000','--screenshot='+path.join(root,'source/_static/manual/tf-insertion.png'),'http://127.0.0.1:'+server.address().port+'/tools/tf-model.html'],{windowsHide:true,stdio:'pipe'});
 let output='';chrome.stderr.on('data',chunk=>{output+=chunk;});chrome.on('error',error=>{console.error(error);server.close();process.exitCode=1;});chrome.on('exit',code=>{server.close();if(code){console.error(output);process.exitCode=code;}else console.log('Rendered product-introduction model with 15 x 11 mm card and 8 top contacts');});
});

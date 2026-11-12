(function(){
const $=id=>document.getElementById(id);let session=null,key='',current=null,count=0,last=null,imageURL=null,stamp=0,run=0;
const box=document.createElement('div');box.id='browser-runner';box.hidden=true;box.innerHTML='<div class="runner-top"><strong>JavaScript · 浏览器验证</strong><span id="runner-count">0 条有效数据</span></div><p id="runner-status" role="status">点击运行，读取设备真实数据。</p><div class="runner-actions"><button type="button" id="runner-start">连接并运行</button><button type="button" id="runner-stop" disabled>停止</button></div><div class="runner-position"><span>X <b id="runner-x">—</b></span><span>Y <b id="runner-y">—</b></span><span>Z <b id="runner-z">—</b></span></div><img id="runner-image" alt="设备返回的灰度图像" hidden><pre id="runner-output">尚未收到数据</pre><details><summary>运行代码</summary><pre id="runner-code"></pre></details>';
document.querySelector('.integration-visual').append(box);
function stop(){run++;const pending=session;$('runner-stop').disabled=true;if(!pending){$('runner-start').disabled=false;return;}pending.stop();$('runner-start').disabled=true;pending.done.finally(()=>{if(session===pending){session=null;$('runner-start').disabled=false;}});}
function reset(){count=0;last=null;$('runner-count').textContent='0 条有效数据';$('runner-output').textContent='尚未收到数据';for(const a of ['x','y','z'])$('runner-'+a).textContent='—';$('runner-image').hidden=true;if(imageURL)URL.revokeObjectURL(imageURL);imageURL=null;}
function options(){return {transport:current.serial?'serial':'usb',base:current.base,channel:current.image?'gray_jpeg':'odometry',baud:Number(current.baud)};}
function code(){return 'const session = NeoReceive.start(\n  '+JSON.stringify(options(),null,2).replace(/\n/g,'\n  ')+',\n  data => console.log(data),\n  status => console.log(status)\n);\n\n// 停止接收\n// session.stop();';}
window.NeoRunner={configure(c){current=c;const k=JSON.stringify([c.serial,c.base,c.image,c.baud]);if(key!==k){stop();reset();key=k;$('runner-status').textContent='点击运行，读取设备真实数据。';}box.hidden=!(c.enabled&&(c.step===3||c.step===4));if(!c.enabled||c.step<3)stop();if(c.enabled){$('runner-code').textContent=code();box.querySelector('.runner-position').hidden=c.image;}},code};
$('runner-start').onclick=async()=>{
 if(session)return;reset();const token=++run;$('runner-start').disabled=true;$('runner-stop').disabled=false;stamp=-Infinity;
 let decoding=false;
 session=NeoReceive.start(options(),async data=>{
  if(data.kind==='image'){
   if(decoding||token!==run)return;decoding=true;
   try{const bitmap=await createImageBitmap(new Blob([data.data],{type:'image/jpeg'}));bitmap.close();}
   catch(e){if(token===run){stop();$('runner-status').textContent='图像解码失败，请检查设备输出';}return;}
   finally{decoding=false;}
  }
  if(token!==run)return;count++;last=data;$('runner-count').textContent=count+' 条有效数据';$('runner-status').textContent='已收到真实'+(data.kind==='image'?'图像':'位姿')+' · '+new Date().toLocaleTimeString();
  if(performance.now()-stamp<100)return;stamp=performance.now();
  if(data.kind==='image'){if(imageURL)URL.revokeObjectURL(imageURL);imageURL=URL.createObjectURL(new Blob([data.data],{type:'image/jpeg'}));$('runner-image').src=imageURL;$('runner-image').hidden=false;$('runner-output').textContent=JSON.stringify({header:data.header,jpeg_bytes:data.data.length},null,2);}
  else{const p=data.pose?.position||data.position;for(const a of ['x','y','z'])$('runner-'+a).textContent=p[a].toFixed(3)+' m';$('runner-output').textContent=JSON.stringify(data,null,2);}
 },text=>{if(token===run)$('runner-status').textContent=text;});
 await session.done;if(token===run){session=null;$('runner-start').disabled=false;$('runner-stop').disabled=true;}
};
$('runner-stop').onclick=()=>{stop();$('runner-status').textContent=count?'已停止 · 保留最后一次真实结果':'已停止 · 尚未收到有效数据';};
window.addEventListener('pagehide',stop);document.addEventListener('visibilitychange',()=>{if(document.hidden&&session){stop();$('runner-status').textContent='页面已隐藏，接收已停止';}});
})();

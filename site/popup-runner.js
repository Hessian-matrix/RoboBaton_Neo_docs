(()=>{
'use strict';
const box=document.createElement('div');box.id='popup-runner';box.hidden=true;
box.innerHTML='<div class="runner-top"><strong id="popup-title"></strong><span id="popup-count">0 条</span></div><p id="popup-status" role="status">点击连接，在设备弹窗中允许读取位姿。</p><div class="runner-actions"><button id="popup-start">连接并运行</button><button id="popup-stop" disabled>停止</button></div><div class="runner-position"><span>X <b id="popup-x">—</b></span><span>Y <b id="popup-y">—</b></span><span>Z <b id="popup-z">—</b></span></div><p id="popup-engine"></p><pre id="popup-output">尚未收到数据</pre><details><summary>运行代码</summary><pre id="popup-code"></pre></details>';
document.querySelector('.integration-visual').append(box);
const $=id=>document.getElementById(id),labels={python:'Python',cpp:'C++',rust:'Rust'};
let config,key,win,worker,session,expected,timer,closeTimer,duration,epoch=0,count=0,ready=false,pending=null,busy=false,serial=0;
const requests=new Map();
function halt(message){epoch++;clearTimeout(timer);clearTimeout(duration);clearInterval(closeTimer);if(win&&!win.closed){win.postMessage({type:'stop',session},expected);win.close();}win=null;worker?.terminate();worker=null;for(const r of requests.values()){clearTimeout(r.timer);r.reject(Error('已停止'));}requests.clear();ready=false;busy=false;pending=null;$('popup-start').disabled=false;$('popup-stop').disabled=true;if(message)$('popup-status').textContent=message;}
function reset(){count=0;$('popup-count').textContent='0 条';$('popup-output').textContent='尚未收到数据';$('popup-engine').textContent='';for(const a of ['x','y','z'])$('popup-'+a).textContent='—';}
function call(data){return new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>{requests.delete(id);reject(Error('语言运行超时，请重试。'));},data.type==='init'?90000:5000);requests.set(id,{resolve,reject,timer});worker.postMessage({...data,id});});}
async function process(){if(!ready||busy||!pending)return;busy=true;const token=epoch;try{while(pending&&token===epoch){const packet=pending;pending=null;const r=await call({type:'pose',packet});if(token!==epoch)return;const p=r.result?.position_m;if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('语言结果无效');count++;$('popup-count').textContent=count+' 条';p.forEach((v,i)=>$('popup-'+['x','y','z'][i]).textContent=v.toFixed(4)+' m');$('popup-output').textContent=JSON.stringify({header:packet.header,...r.result},null,2);$('popup-status').textContent=labels[config.language]+' 已输出真实位姿';}}catch(e){if(token===epoch)halt(e.message);}finally{if(token===epoch)busy=false;}}
window.NeoPopupRunner={configure(c){const k=JSON.stringify([c.base,c.language,c.enabled]);if(k!==key){halt();reset();key=k;$('popup-status').textContent='点击连接，在设备弹窗中允许读取位姿。';}config=c;box.hidden=!(c.enabled&&c.step===3);if(box.hidden)halt();$('popup-title').textContent=labels[c.language]+' · 网页运行';$('popup-code').textContent=window.NeoExampleLanguages?.sources[c.language]||'';}};
$('popup-start').onclick=async()=>{
 halt();reset();expected=config.base;session=Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 // Open synchronously in the user gesture; do not await runtime downloads first.
 win=window.open(expected+'/examples.html?relay=1&parent='+encodeURIComponent(location.origin)+'&session='+session,'neo_pose_'+session,'popup,width=540,height=620');
 if(!win){$('popup-status').textContent='浏览器拦截了连接弹窗，请允许本站弹窗后重试。';return;}
 const token=epoch;$('popup-start').disabled=true;$('popup-stop').disabled=false;$('popup-status').textContent='请在设备弹窗中允许连接；正在加载 '+labels[config.language]+'…';
 timer=setTimeout(()=>{if(token===epoch)halt('设备连接页未响应。当前设备可能尚未安装配套网页，请更新设备应用网页后重试。');},15000);
 duration=setTimeout(()=>{if(token===epoch)halt('本次验证结束（120 秒），已保留结果。');},120000);
 closeTimer=setInterval(()=>{if(win?.closed)halt('设备窗口已关闭，接收已停止。');},500);
 worker=new Worker('examples-worker.js');worker.onmessage=({data:m})=>{const r=requests.get(m.id);if(!r)return;requests.delete(m.id);clearTimeout(r.timer);m.error?r.reject(Error(m.error)):r.resolve(m);};worker.onerror=()=>{if(token===epoch)halt('语言运行环境加载失败，请检查网络后重试。');};
 try{const r=await call({type:'init',language:config.language});if(token!==epoch)return;ready=true;$('popup-engine').textContent=r.engine;void process();}catch(e){if(token===epoch)halt(e.message);}
};
window.addEventListener('message',e=>{
 const m=e.data;if(!win||e.source!==win||e.origin!==expected||m?.source!=='neo-pose-relay'||m.session!==session)return;
 if(m.type==='ready'){clearTimeout(timer);$('popup-status').textContent='设备窗口已就绪，请点击“允许读取位姿”。';}
 else if(m.type==='connected'){$('popup-status').textContent='已连接，等待有效位姿与语言运行环境。';}
 else if(m.type==='stopped')halt(m.message||'设备连接已停止。');
 else if(m.type==='pose'){const p=m.packet?.pose?.position,q=m.packet?.pose?.orientation;if(!p||!q||![p.x,p.y,p.z,q.w,q.x,q.y,q.z].every(Number.isFinite))return;pending=m.packet;void process();}
});
$('popup-stop').onclick=()=>halt('已停止，保留最后结果。');window.addEventListener('pagehide',()=>halt());
})();

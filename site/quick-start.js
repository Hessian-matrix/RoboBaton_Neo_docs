(()=>{
const input=document.getElementById('device-address'),result=document.getElementById('check-result'),link=document.getElementById('open-device-link'),button=document.getElementById('connect-device'),frame=document.getElementById('device-frame'),placeholder=document.getElementById('device-placeholder'),expand=document.getElementById('expand-device'),section=document.getElementById('open-device'),label=document.getElementById('preview-address');
let activeUrl=null;
function address(){
 const match=input.value.trim().match(/^([0-9]+.[0-9]+.[0-9]+.[0-9]+)(?::([0-9]+))?$/);
 if(!match)return null;
 const parts=match[1].split('.');
 if(!parts.every(x=>String(Number(x))===x&&Number(x)>=0&&Number(x)<=255))return null;
 const port=match[2];
 if(port!==undefined&&(!Number.isInteger(Number(port))||Number(port)<1||Number(port)>65535))return null;
 return 'http://'+parts.join('.')+(port!==undefined?':'+Number(port):'')+'/';
}
function reset(){frame.removeAttribute('src');frame.hidden=true;placeholder.hidden=false;expand.hidden=true;section.classList.remove('preview-expanded');expand.setAttribute('aria-expanded','false');expand.textContent='展开预览';activeUrl=null;label.textContent='设备网页';button.textContent='连接设备'}
function update(){
 const url=address();if(activeUrl&&url!==activeUrl)reset();button.disabled=!url;
 if(url){link.href=url;link.removeAttribute('aria-disabled');result.textContent='输入设备地址后点击连接，在预览区操作设备。';result.dataset.state='idle'}
 else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');result.textContent='请输入有效的 IP 或 IP:端口，例如 192.168.46.1:46002；端口范围为 1–65535。';result.dataset.state='warning'}
}
function connect(){const url=address();if(!url){update();return}activeUrl=url;label.textContent=url;placeholder.hidden=true;frame.hidden=false;expand.hidden=false;frame.src=url;button.textContent='重新连接';result.dataset.state='idle';result.textContent=location.protocol==='https:'?'正在打开设备网页。HTTPS 页面内嵌 HTTP 设备可能被浏览器拦截；若预览空白，请使用“新窗口打开”。':'正在打开设备网页。看到 Neo 操作界面后即可操作；若预览空白，请检查连接或在新窗口打开。'}
button.addEventListener('click',connect);input.addEventListener('input',update);
input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();connect()}});
expand.addEventListener('click',()=>{const expanded=section.classList.toggle('preview-expanded');expand.setAttribute('aria-expanded',String(expanded));expand.textContent=expanded?'收起预览':'展开预览'});
update();
})();
(()=>{
 const button=document.getElementById('toggle-connection-animation'),illustration=document.querySelector('.connection-illustration');
 button.addEventListener('click',()=>{const paused=illustration.classList.toggle('animation-paused');button.setAttribute('aria-pressed',String(paused));button.textContent=paused?'播放动画':'暂停动画'});
})();
(()=>{
 const first=document.getElementById('connect'),shared=document.getElementById('open-device'),second=document.getElementById('device-connect-panel'),third=document.getElementById('start-vio'),tabs=[...document.querySelectorAll('.step-tabs [role="tab"]')];
 const hashes=['connect','open-device','start-vio'];
 function select(step,changeHash=false){
  first.hidden=step!==1;shared.hidden=step===1;second.hidden=step!==2;third.hidden=step!==3;
  tabs.forEach((tab,index)=>{tab.setAttribute('aria-selected',String(index===step-1));tab.tabIndex=index===step-1?0:-1});
  shared.dataset.step=String(step);
  if(changeHash)history.replaceState(null,'','#'+hashes[step-1]);
 }
 document.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>select(Number(button.dataset.step),true)));
 tabs.forEach((tab,index)=>tab.addEventListener('keydown',event=>{
  let next;if(event.key==='ArrowRight')next=(index+1)%3;else if(event.key==='ArrowLeft')next=(index+2)%3;else if(event.key==='Home')next=0;else if(event.key==='End')next=2;else return;
  event.preventDefault();select(next+1,true);tabs[next].focus();
 }));
 function fromHash(){const hash=location.hash.slice(1);select(hash==='access-device'?2:Math.max(1,hashes.indexOf(hash)+1))}
 window.addEventListener('hashchange',fromHash);fromHash();
})();

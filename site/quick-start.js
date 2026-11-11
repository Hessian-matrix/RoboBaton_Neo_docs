(()=>{
const form=document.getElementById('device-check'),input=document.getElementById('device-address'),button=document.getElementById('check-button'),result=document.getElementById('check-result'),link=document.getElementById('open-device-link');
let controller=null,serial=0;
function address(){const parts=input.value.trim().split('.');if(parts.length!==4||parts.some(x=>!x||String(Number(x))!==x||!Number.isInteger(Number(x))||Number(x)<0||Number(x)>255))return null;return 'http://'+parts.join('.')+'/'}
function message(text,state='idle'){result.textContent=text;result.dataset.state=state}
function update(){serial++;if(controller)controller.abort();button.disabled=false;button.textContent='检测连接';const url=address();if(url){link.href=url;link.removeAttribute('aria-disabled');message('地址已更新，点击检测连接。')}else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');message('请输入有效的 IPv4 地址，例如 192.168.11.1。','warning')}}
input.addEventListener('input',update);
form.addEventListener('submit',async e=>{e.preventDefault();const url=address();if(!url){update();input.focus();return}const id=++serial;controller=new AbortController();const current=controller;button.disabled=true;button.textContent='检测中…';message('正在请求 '+url+'，请留意浏览器的本地网络访问提示。');let timedOut=false;const timer=setTimeout(()=>{timedOut=true;current.abort()},6000);
try{const response=await fetch(url,{method:'GET',mode:'no-cors',credentials:'omit',cache:'no-store',redirect:'error',signal:current.signal});if(id!==serial)return;if(response.type==='opaque'||response.ok){message('该地址有 HTTP 响应。点击打开，确认是否为 Neo 设备页面。','success')}else{message('该地址有响应，但网页返回 HTTP '+response.status+'。请直接打开检查设备服务。','warning')}}catch(error){if(id!==serial)return;message(timedOut?'检测超时，暂时无法确认设备是否在线。请直接打开页面，并检查下方连接提示。':location.protocol==='https:'?'浏览器未能完成检测。HTTPS 页面访问 HTTP 设备可能受安全策略或本地网络权限限制；这不代表设备离线，请直接打开设备页面。':'浏览器未能完成检测，可能是连接问题或本地网络权限限制。请直接打开设备页面，并检查下方连接提示。','warning')}finally{clearTimeout(timer);if(id===serial){button.disabled=false;button.textContent='重新检测';controller=null}}});
})();

(()=>{
const select=document.getElementById('computer-os');
const systems={win11:['无需安装驱动','等待系统识别 USB 网卡，然后检测设备连接。','查看网卡：设备管理器 → 网络适配器'],win10:['需要 NCM 驱动','先安装匹配设备的驱动，再检测连接。','查看网卡：设备管理器 → 网络适配器'],mac:['通常无需安装驱动','连接后等待 USB 网络接口出现，再检测连接。','查看网卡：系统设置 → 网络'],linux:['使用系统 NCM 驱动','系统需启用 cdc_ncm，识别 USB 网卡后检测连接。','查看网卡：网络设置，或运行 ip link']};
function show(){const item=systems[select.value];document.getElementById('system-title').textContent=item[0];document.getElementById('system-description').textContent=item[1];document.getElementById('system-check').textContent=item[2];document.getElementById('system-driver').hidden=select.value!=='win10';document.getElementById('system-limit').hidden=select.value!=='win10'}
const platform=navigator.platform||'';if(/Mac/i.test(platform))select.value='mac';else if(/Linux/i.test(platform)&&!/Android/i.test(navigator.userAgent))select.value='linux';
select.addEventListener('change',show);show();
})();

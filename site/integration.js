(()=>{
'use strict';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
let step=1,transport=query.get('transport')==='serial'?'serial':'usb',examples=null,generated='',filename='receive.py';
if(['python','cpp','rust'].includes(query.get('language'))) $('integration-language').value=query.get('language');
if(location.hostname==='127.0.0.1'||location.hostname==='localhost') $('integration-access').value='direct';
const tabs=[...document.querySelectorAll('[role=tab]')],titles=['选择连接方式','配置你的接收程序','运行并查看结果'];
function origin(){const parts=$('integration-address').value.trim().split(':');if(parts.length>2)return null;const ip=parts[0].split('.');if(ip.length!==4||!ip.every(x=>/^[0-9]+$/.test(x)&&String(Number(x))===x&&Number(x)<=255))return null;if(parts.length===2&&(!/^[0-9]+$/.test(parts[1])||Number(parts[1])<1||Number(parts[1])>65535))return null;return 'http://'+parts[0]+(parts.length===2?':'+Number(parts[1]):'')}
function valid(){if(transport==='usb')return Boolean(origin());return (['browser','python'].includes($('integration-language').value)||new RegExp('^(COM[1-9][0-9]*|/dev/[a-zA-Z0-9_./-]+)$').test($('integration-port').value.trim()))&&/^[0-9]+$/.test($('integration-baud').value)&&Number($('integration-baud').value)>0&&Number($('integration-baud').value)<=2147483647}
function settings(){return {serial:transport==='serial',image:transport==='usb'&&$('integration-data').value==='gray_jpeg',language:$('integration-language').value==='python-local'?'python':$('integration-language').value}}
function createCode(){
 if(!valid())return;
 const {serial,image,language}=settings(),name={python:'Python',cpp:'C++',rust:'Rust'}[language];
 const serialPython=serial&&language==='python',supported=!serial&&!image;
 $('device-example-entry').hidden=true;
 $('run-command').hidden=true;$('run-steps').replaceChildren();
 if(serialPython){
  generated=NeoRunner.code();filename='serial_pose.py';
  $('run-intro').textContent='加载 Python 后连接 USB 转 TTL 模块，在浏览器中查看位姿。';
  $('run-note').textContent='选择串口后开始接收，60 秒后自动停止。';
  $('dependency-note').textContent='Python 在浏览器中运行，首次加载需要联网。串口授权需要电脑 Chrome / Edge。';
 }else{
  generated=examples?.online?.[language]||'';filename='pose.'+{python:'py',cpp:'cpp',rust:'rs'}[language];
  $('run-intro').textContent=supported?'点击左侧连接，在弹窗中允许读取；'+name+' 在本页运行并显示结果。':'当前 '+name+' 在线示例支持 USB / HTTP 位姿。';
  $('run-note').textContent=supported?'首次使用需设备包含配套连接页。连接后保留弹窗，结果显示在本页。':'请在前两步选择 USB 和 VIO 位姿；当前选择尚无对应的在线示例。';
  $('device-example-link').href=(origin()||'http://192.168.11.1')+'/examples.html?language='+language;
  $('device-example-link').textContent='在设备网页运行 '+name+' →';
  $('dependency-note').textContent=language==='python'?'设备网页通过 HTTP 接收数据，交给浏览器中的 Python 执行；首次加载 Python 需要联网，无需安装。':'设备网页通过 HTTP 接收数据，交给 '+name+' 编译的 WebAssembly 执行。左侧为对应源码，无需安装编译器，不支持在线修改后编译。';
 }
 $('filename').textContent=filename;$('generated-code').textContent=generated;
 $('code-status').textContent=generated?'':'示例正在加载，请稍候。';
 $('full-guide').href='docs/api-examples.html';
}
function result(){
 const {serial,image}=settings();$('pose-result').hidden=image;$('image-result').hidden=!image;
 $('sample-output').textContent=serial?'position_m: [0.12, 0.03, 0.08]\nquaternion_wxyz: [1, 0, 0, 0]\n同时检查 frame_id / child_frame_id':'pose.position: {x: 0.12, y: 0.03, z: 0.08}\npose.orientation: {x: 0, y: 0, z: 0, w: 1}\nheader.seq: "1201"';
 $('verification-intro').textContent=image?'打开程序生成的图像文件，确认收到的是真实相机画面。':'平缓移动相机，对照程序输出，逐项确认。';
 const checks=image?['当前目录出现 neo-latest.jpg。','图像能打开，内容与相机所见一致。','重新运行后，图像和帧序号更新。']:['收到的是位姿数据，而不只是心跳。','位置与姿态随实际运动变化。','已核对坐标系、单位和参考点。'];
 $('verify-list').replaceChildren(...checks.map(text=>{const label=document.createElement('label'),box=document.createElement('input');box.type='checkbox';label.append(box,document.createTextNode(text));return label}));
 $('troubleshooting').textContent=serial?'检查 TX→RX、共地、3.3 V 电平和两端波特率；确认 VIO 初始化完成且未在搜索飞控。':image?'检查设备地址、USB 网卡和程序错误；429 表示流连接过多，请关闭不需要的连接。':'检查设备地址、USB 网卡和 VIO 初始化状态。能收到心跳不代表定位有效；空位姿不能当作零位姿。';
 $('coordinate-note').textContent=serial?'MAVLink 2 ODOMETRY（331），位置单位米，q 顺序 w/x/y/z。输出已应用安装补偿。':image?'这里接收灰度 JPEG。位姿和图像需分别订阅，按设备有效时间戳关联；需要彩色请查图像接口文档。':'HTTP 位姿以 IMU 为参考，位置单位米，四元数字段为 x/y/z/w。序号保持字符串，不能先转为浮点数。';
}
function render(){
 const browser=transport==='serial'&&$('integration-language').value==='python';
 $('http-access-settings').hidden=true;
 $('connector-guide').hidden=true;
 $('browser-port').hidden=!browser;$('integration-port').hidden=browser;document.querySelector('label[for=integration-port]').hidden=browser;
 NeoRunner.configure({enabled:browser,python:$('integration-language').value==='python',step,serial:transport==='serial',base:origin(),connector:$('integration-access').value==='connector',image:transport==='usb'&&$('integration-data').value==='gray_jpeg',baud:$('integration-baud').value});
 document.querySelectorAll('[data-transport]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.transport===transport)));
 tabs.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===step-1));b.tabIndex=i===step-1?0:-1});
 $('integration-panel').setAttribute('aria-labelledby','integration-tab-'+step);
 $('integration-counter').textContent='0'+step+' / 03';$('integration-title').textContent=titles[step-1];
 document.querySelectorAll('[data-content]').forEach(p=>p.hidden=Number(p.dataset.content)!==step);
 $('usb-settings').hidden=transport!=='usb';$('serial-settings').hidden=transport!=='serial';
 $('usb-art').toggleAttribute('hidden',transport!=='usb');$('serial-art').hidden=transport!=='serial';
 $('route-label').textContent=transport==='usb'?'USB · HTTP API':'串口 · MAVLink 2';$('visual-caption').textContent=transport==='usb'?'位姿与图像分别使用独立的 HTTP 数据流。':'接收 ODOMETRY 位姿；图像请使用 USB。';
 const popup=transport==='usb'&&$('integration-data').value==='odometry';NeoPopupRunner.configure({enabled:popup,step,base:origin(),language:$('integration-language').value});$('connection-art').hidden=step>2;$('code-view').hidden=step!==3||browser||popup;$('result-view').hidden=true;
 $('integration-back').disabled=step===1;$('integration-next').textContent=step===3?'重新选择接入方式':'下一步 →';
 $('integration-next').disabled=step===2&&!valid();$('settings-error').textContent=valid()?'':transport==='usb'?'请输入有效 IP 或 IP:端口，端口范围 1–65535。':'请填写有效串口名和正整数波特率，以设备实际配置为准。';
 if(step===3){createCode();if(!browser&&!examples) $('code-status').textContent='示例正在加载；若加载失败请刷新重试。'}
 if(step===3){result();if(browser){$('verification-intro').textContent='左侧只显示本次从设备收到的结果，移动设备观察变化。';$('coordinate-note').textContent=transport==='serial'?'位置单位米，姿态顺序 w/x/y/z；以输出 frame_id 与 child_frame_id 核对坐标系。':'位置单位米，四元数为 x/y/z/w；HTTP 位姿以 IMU 为参考。';$('verify-list').replaceChildren();}}
}
function go(next){if(next>2&&!valid()){step=2;render();return}step=next;render()}
 document.querySelectorAll('[data-transport]').forEach(b=>b.addEventListener('click',()=>{transport=b.dataset.transport;render()}));
 tabs.forEach((b,i)=>{b.addEventListener('click',()=>go(i+1));b.addEventListener('keydown',e=>{let n;if(e.key==='ArrowRight')n=(i+1)%3;else if(e.key==='ArrowLeft')n=(i+2)%3;else if(e.key==='Home')n=0;else if(e.key==='End')n=2;else return;e.preventDefault();go(n+1);tabs[step-1].focus()})});
 $('integration-next').addEventListener('click',()=>go(step===3?1:step+1));$('integration-back').addEventListener('click',()=>go(Math.max(1,step-1)));
 ['integration-access','integration-address','integration-data','integration-language','integration-port','integration-baud'].forEach(id=>$(id).addEventListener('input',render));
 $('copy-code').addEventListener('click',async()=>{if(!generated)return;try{await navigator.clipboard.writeText(generated);$('code-status').textContent='代码已复制。'}catch{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents($('generated-code'));selection.removeAllRanges();selection.addRange(range);$('code-status').textContent='浏览器未允许自动复制，已选中代码，请按 Ctrl+C 或使用下载。'}});
 $('download-code').addEventListener('click',()=>{if(!generated)return;const url=URL.createObjectURL(new Blob([generated],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('code-status').textContent='已生成 '+filename+'。'});
 render();fetch('integration-examples.json?v=three-languages-1').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>{examples=data;render()}).catch(()=>{$('code-status').textContent='示例加载失败，请刷新页面重试。';$('copy-code').disabled=true;$('download-code').disabled=true});
})();

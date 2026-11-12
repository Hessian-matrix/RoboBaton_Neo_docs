(()=>{
'use strict';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
let step=1,transport=query.get('transport')==='serial'?'serial':'usb',examples=null,generated='',filename='receive.py';
if(['javascript','python','python-local','browser'].includes(query.get('language'))) $('integration-language').value=query.get('language');
const tabs=[...document.querySelectorAll('[role=tab]')],titles=['选择连接方式','配置你的接收程序','运行并查看结果'];
function origin(){const parts=$('integration-address').value.trim().split(':');if(parts.length>2)return null;const ip=parts[0].split('.');if(ip.length!==4||!ip.every(x=>/^[0-9]+$/.test(x)&&String(Number(x))===x&&Number(x)<=255))return null;if(parts.length===2&&(!/^[0-9]+$/.test(parts[1])||Number(parts[1])<1||Number(parts[1])>65535))return null;return 'http://'+parts[0]+(parts.length===2?':'+Number(parts[1]):'')}
function valid(){if(transport==='usb')return Boolean(origin());return (['browser','python'].includes($('integration-language').value)||new RegExp('^(COM[1-9][0-9]*|/dev/[a-zA-Z0-9_./-]+)$').test($('integration-port').value.trim()))&&/^[0-9]+$/.test($('integration-baud').value)&&Number($('integration-baud').value)>0&&Number($('integration-baud').value)<=2147483647}
function settings(){return {serial:transport==='serial',image:transport==='usb'&&$('integration-data').value==='gray_jpeg',language:$('integration-language').value==='python-local'?'python':$('integration-language').value}}
function createCode(){
 if(!valid())return;
 if(['browser','python'].includes($('integration-language').value)){
  generated=NeoRunner.code();filename=$('integration-language').value==='python'?'browser-receive.py':'browser-receive.js';$('filename').textContent=filename;$('generated-code').textContent=generated;
  $('run-intro').textContent=$('integration-language').value==='python'?'先加载 Python，再连接设备；结果由浏览器内的 Python 输出。':transport==='serial'?'点击左侧按钮，选择 USB 转 TTL 模块。':'点击左侧按钮，从填写的设备地址读取真实数据。';
  $('run-steps').replaceChildren();$('run-command').hidden=true;
  $('run-note').textContent='先在设备页启动 VIO 并完成初始化。验证只接收，60 秒后自动停止。';
  $('dependency-note').textContent=transport==='serial'?'无需 Python 或 Node.js。浏览器会请求串口授权；转换模块需支持设定的波特率。':'当前固件 HTTP 流未开放 CORS；从产品站连接可能被浏览器阻止。可切换串口进行网页验证，或从设备同源页面运行接收器。';
  $('full-guide').href='docs/api-examples.html';return;
 }
 $('run-command').hidden=false;
 if(!examples)return;
 const {serial,image,language}=settings(),channel=image?'gray_jpeg':'odometry';
 generated=serial?examples.serial:examples[language];filename=serial?'serial_pose.py':language==='python'?'receive.py':'receive.cjs';
 if(!serial){generated=generated.replaceAll('http://192.168.11.1',origin());if(image)generated=generated.replace("else 'odometry'","else 'gray_jpeg'").replace("|| 'odometry'","|| 'gray_jpeg'");}
 $('filename').textContent=filename;$('generated-code').textContent=generated;$('code-status').textContent='';
 $('run-intro').textContent=serial?'在连接串口接收器的电脑上运行。':'在连接 Neo USB 网络的电脑上运行。';
 $('run-steps').replaceChildren(...(serial?['安装 Python 3 和接收库。','下载左侧代码，保存为 '+filename+'。','在该文件所在目录运行下面的命令。']:['准备与设备固件配套的 cv-610-pub 应用源码。','下载左侧代码，放在应用仓库根目录。','在仓库根目录打开终端并运行。']).map(text=>{const li=document.createElement('li');li.textContent=text;return li}));
 $('run-command').textContent=serial?'python -m pip install pymavlink pyserial\npython serial_pose.py '+$('integration-port').value.trim()+' --baud '+Number($('integration-baud').value):(language==='python'?'python receive.py ':'node receive.cjs ')+origin()+' '+channel;
 $('run-note').textContent=serial?'按 Ctrl+C 停止接收；程序不会修改飞控参数。':'示例接收 10 条业务消息后退出。'+(image?'每帧覆盖当前目录的 neo-latest.jpg，运行前请确认没有同名文件需保留。':'订阅不会启动 VIO，也不会停止 VIO。');
 $('dependency-note').textContent=serial?'串口示例依赖 pymavlink 和 pyserial；接收器需支持当前实际波特率。':language==='python'?'Python 使用标准库，并导入应用 tools/http-api/client.py 及配套模块。':'Node.js 18+ 使用应用 calibration/calibration-js/browser/public/http-stream.js 及配套模块。';
 $('full-guide').href=serial?'docs/serial-pose.html':'docs/api-examples.html#api-'+language;
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
 const browser=['browser','python'].includes($('integration-language').value);
 $('integration-port').hidden=browser;document.querySelector('label[for=integration-port]').hidden=browser;
 NeoRunner.configure({enabled:browser,python:$('integration-language').value==='python',step,serial:transport==='serial',base:origin(),image:transport==='usb'&&$('integration-data').value==='gray_jpeg',baud:$('integration-baud').value});
 document.querySelectorAll('[data-transport]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.transport===transport)));
 tabs.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===step-1));b.tabIndex=i===step-1?0:-1});
 $('integration-panel').setAttribute('aria-labelledby','integration-tab-'+step);
 $('integration-counter').textContent='0'+step+' / 03';$('integration-title').textContent=titles[step-1];
 document.querySelectorAll('[data-content]').forEach(p=>p.hidden=Number(p.dataset.content)!==step);
 $('usb-settings').hidden=transport!=='usb';$('serial-settings').hidden=transport!=='serial';
 $('usb-art').toggleAttribute('hidden',transport!=='usb');$('serial-art').hidden=transport!=='serial';
 $('route-label').textContent=transport==='usb'?'USB · HTTP API':'串口 · MAVLink 2';$('visual-caption').textContent=transport==='usb'?'位姿与图像分别使用独立的 HTTP 数据流。':'接收 ODOMETRY 位姿；图像请使用 USB。';
 $('connection-art').hidden=step>2;$('code-view').hidden=step!==3||browser;$('result-view').hidden=true;
 $('integration-back').disabled=step===1;$('integration-next').textContent=step===3?'重新选择接入方式':'下一步 →';
 $('integration-next').disabled=step===2&&!valid();$('settings-error').textContent=valid()?'':transport==='usb'?'请输入有效 IP 或 IP:端口，端口范围 1–65535。':'请填写有效串口名和正整数波特率，以设备实际配置为准。';
 if(step===3){if(browser||examples)createCode();else $('code-status').textContent='示例正在加载；若加载失败请刷新重试。'}
 if(step===3){result();if(browser){$('verification-intro').textContent='左侧只显示本次从设备收到的结果，移动设备观察变化。';$('coordinate-note').textContent=transport==='serial'?'位置单位米，姿态顺序 w/x/y/z；以输出 frame_id 与 child_frame_id 核对坐标系。':'位置单位米，四元数为 x/y/z/w；HTTP 位姿以 IMU 为参考。';$('verify-list').replaceChildren();}}
}
function go(next){if(next>2&&!valid()){step=2;render();return}step=next;render()}
 document.querySelectorAll('[data-transport]').forEach(b=>b.addEventListener('click',()=>{transport=b.dataset.transport;render()}));
 tabs.forEach((b,i)=>{b.addEventListener('click',()=>go(i+1));b.addEventListener('keydown',e=>{let n;if(e.key==='ArrowRight')n=(i+1)%3;else if(e.key==='ArrowLeft')n=(i+2)%3;else if(e.key==='Home')n=0;else if(e.key==='End')n=2;else return;e.preventDefault();go(n+1);tabs[step-1].focus()})});
 $('integration-next').addEventListener('click',()=>go(step===3?1:step+1));$('integration-back').addEventListener('click',()=>go(Math.max(1,step-1)));
 ['integration-address','integration-data','integration-language','integration-port','integration-baud'].forEach(id=>$(id).addEventListener('input',render));
 $('copy-code').addEventListener('click',async()=>{if(!generated)return;try{await navigator.clipboard.writeText(generated);$('code-status').textContent='代码已复制。'}catch{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents($('generated-code'));selection.removeAllRanges();selection.addRange(range);$('code-status').textContent='浏览器未允许自动复制，已选中代码，请按 Ctrl+C 或使用下载。'}});
 $('download-code').addEventListener('click',()=>{if(!generated)return;const url=URL.createObjectURL(new Blob([generated],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('code-status').textContent='已生成 '+filename+'，请在电脑上运行。'});
 render();fetch('integration-examples.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>{examples=data;render()}).catch(()=>{$('code-status').textContent='示例加载失败，请刷新页面重试。';$('copy-code').disabled=true;$('download-code').disabled=true});
})();

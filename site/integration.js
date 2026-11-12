(()=>{
'use strict';
const $=id=>document.getElementById(id),query=new URLSearchParams(location.search);
let step=1,transport=query.get('transport')==='serial'?'serial':'usb',examples=null,generated='',filename='receive.py';
if(['python'].includes(query.get('language'))) $('integration-language').value=query.get('language');
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
  generated=examples?.quick_test||'';filename='neo_quick_test.py';
  $('run-intro').textContent='左侧为完整 Python 示例，复制或下载后，可自己运行，也可交给 AI 完成。';
  $('run-note').textContent='仅用 Python 标准库，无需 pip。电脑需要 Python 3.8+；不修改板卡。';
  $('dependency-note').textContent='左侧单文件已包含协议解析和客户端，无其他文件依赖。AI 必须运行在连接设备的电脑上；云端聊天沙箱不能访问局域网。默认读取位置和图像，两路不是同步配对。';
  $('run-command').hidden=true;
  $('run-command').textContent='python neo_quick_test.py --address '+origin()+' --channel '+$('integration-data').value+' --count 3 --seconds 15 --output neo-results';
 }
 $('ai-test-actions').hidden=serial;
 $('manual-command').textContent=$('run-command').textContent;
 $('ai-prompt-text').textContent=(examples?.ai_prompt||'提示词正在加载…').replaceAll('http://192.168.11.1',origin()||'http://192.168.11.1').replace('--channel both','--channel '+$('integration-data').value)+'\n'+String.fromCharCode(96).repeat(3)+'python\n'+generated+'\n'+String.fromCharCode(96).repeat(3)+'\n';

 $('filename').textContent=filename;$('generated-code').textContent=generated;
 $('code-status').textContent=generated?'':'示例正在加载，请稍候。';
 $('full-guide').href='docs/api-examples.html';
}
function result(){
 const {serial,image}=settings();$('pose-result').hidden=image;$('image-result').hidden=!image;
 $('sample-output').textContent=serial?'position_m: [0.12, 0.03, 0.08]\nquaternion_wxyz: [1, 0, 0, 0]\n同时检查 frame_id / child_frame_id':'pose.position: {x: 0.12, y: 0.03, z: 0.08}\npose.orientation: {x: 0, y: 0, z: 0, w: 1}\nheader.seq: "1201"';
 $('verification-intro').textContent=image?'打开程序生成的图像文件，确认收到的是真实相机画面。':'平缓移动相机，对照程序输出，逐项确认。';
 const checks=image?['本次结果目录出现 image-001.jpg 和 report.json。','图像能打开，内容与相机所见一致。','重新运行后，图像和帧序号更新。']:['收到的是位姿数据，而不只是心跳。','位置与姿态随实际运动变化。','已核对坐标系、单位和参考点。'];
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
 const popup=false;NeoPopupRunner.configure({enabled:popup,step,base:origin(),language:$('integration-language').value});$('connection-art').hidden=step>2;$('code-view').hidden=step!==3||browser||popup;$('result-view').hidden=true;
 $('integration-back').disabled=step===1;$('integration-next').textContent=step===3?'重新选择接入方式':'下一步 →';
 $('integration-next').disabled=step===2&&!valid();$('settings-error').textContent=valid()?'':transport==='usb'?'请输入有效 IP 或 IP:端口，端口范围 1–65535。':'请填写有效串口名和正整数波特率，以设备实际配置为准。';
 createCode();
 if(step===3){if(!browser&&!examples) $('code-status').textContent='示例正在加载；若加载失败请刷新重试。'}
 if(step===3){result();if(browser){$('verification-intro').textContent='左侧只显示本次从设备收到的结果，移动设备观察变化。';$('coordinate-note').textContent=transport==='serial'?'位置单位米，姿态顺序 w/x/y/z；以输出 frame_id 与 child_frame_id 核对坐标系。':'位置单位米，四元数为 x/y/z/w；HTTP 位姿以 IMU 为参考。';$('verify-list').replaceChildren();}}
}
function go(next){if(next>2&&!valid()){step=2;render();return}step=next;render()}
 document.querySelectorAll('[data-transport]').forEach(b=>b.addEventListener('click',()=>{transport=b.dataset.transport;render()}));
 tabs.forEach((b,i)=>{b.addEventListener('click',()=>go(i+1));b.addEventListener('keydown',e=>{let n;if(e.key==='ArrowRight')n=(i+1)%3;else if(e.key==='ArrowLeft')n=(i+2)%3;else if(e.key==='Home')n=0;else if(e.key==='End')n=2;else return;e.preventDefault();go(n+1);tabs[step-1].focus()})});
 $('integration-next').addEventListener('click',()=>go(step===3?1:step+1));$('integration-back').addEventListener('click',()=>go(Math.max(1,step-1)));
 ['integration-access','integration-address','integration-data','integration-language','integration-port','integration-baud'].forEach(id=>$(id).addEventListener('input',render));
 $('copy-code').addEventListener('click',async()=>{if(!generated)return;try{await navigator.clipboard.writeText(generated);$('code-status').textContent='代码已复制。'}catch{const selection=window.getSelection(),range=document.createRange();range.selectNodeContents($('generated-code'));selection.removeAllRanges();selection.addRange(range);$('code-status').textContent='浏览器未允许自动复制，已选中代码，请按 Ctrl+C 或使用下载。'}});
 $('download-code').addEventListener('click',()=>{if(!generated)return;const url=URL.createObjectURL(new Blob([generated],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('code-status').textContent='已生成 '+filename+'。'});
 $('copy-ai-prompt').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('ai-prompt-text').textContent);$('ai-copy-status').textContent='已复制提示词和完整代码，可直接粘贴给本机 AI。';}catch{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([$('ai-prompt-text').textContent],{type:'text/plain;charset=utf-8'}));a.download='neo-ai-prompt.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('ai-copy-status').textContent='浏览器未允许复制，已下载含完整代码的提示词文件。';}});
 ['manual','ai'].forEach(mode=>$('method-'+mode).addEventListener('click',()=>{['manual','ai'].forEach(m=>{$('method-'+m).setAttribute('aria-pressed',String(m===mode));$(m==='manual'?'manual-run-panel':'ai-run-panel').hidden=m!==mode;});$('ai-copy-status').textContent='';}));
 $('copy-run-command').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('manual-command').textContent);$('ai-copy-status').textContent='运行命令已复制。';}catch{$('ai-copy-status').textContent='请手动选择并复制上方命令。';}});

 const HELP_DIALOG_CSS="#integration-help{box-sizing:border-box;width:calc(100% - 32px);max-width:560px;max-height:calc(100dvh - 32px);padding:0;border:1px solid #d6e4db;border-radius:16px;background:#fbfdfb;color:#355c49;box-shadow:0 18px 65px #14372926;overflow:hidden}\n#integration-help::backdrop{background:rgba(20,42,32,.28)}.help-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 22px;border-bottom:1px solid #dce7df}.help-dialog-head h2{margin:0;font-size:20px}.help-dialog-head button{border:0;background:transparent;color:inherit;font-size:28px;line-height:1;width:36px;height:36px;border-radius:8px;cursor:pointer}.help-dialog-head button:hover{background:#edf3ef}.help-dialog-body{padding:6px 22px 20px;overflow:auto;max-height:calc(100dvh - 140px);font-size:14px;line-height:1.8;overscroll-behavior:contain}.help-dialog-body h3{font-size:15px;margin:20px 0 6px}.help-dialog-body a{color:#397d63}.help-dialog-body .verify-list{display:grid;gap:10px}.help-dialog-body label{display:flex;align-items:flex-start;gap:8px}.help-dialog-body input{margin-top:6px}.help-dialog-body [hidden]{display:none!important}\n";
 const help=$('integration-help'),helpHome=help.parentElement;help.addEventListener('close',()=>helpHome.append(help));
 document.querySelectorAll('[data-help]').forEach(button=>button.addEventListener('click',()=>{const results=button.dataset.help==='results';$('help-title').textContent=results?'结果与排查':'示例说明';$('help-dependencies').hidden=results;$('help-results').hidden=!results;if(window.parent!==window){try{const host=window.parent.document;if(!host.getElementById('neo-help-dialog-style')){const style=host.createElement('style');style.id='neo-help-dialog-style';style.textContent=HELP_DIALOG_CSS;host.head.append(style);}host.body.append(help);}catch{}}help.showModal();}));
 $('help-close').addEventListener('click',()=>help.close());
 help.addEventListener('click',e=>{if(e.target!==help)return;const r=help.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)help.close();});
 render();fetch('integration-examples.json?v=ai-flow-2').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json()}).then(data=>{examples=data;render()}).catch(()=>{$('code-status').textContent='示例加载失败，请刷新页面重试。';$('copy-code').disabled=true;$('download-code').disabled=true;$('copy-ai-prompt').disabled=true});
})();

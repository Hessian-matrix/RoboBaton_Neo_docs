(()=>{
'use strict';
const box=document.querySelector('[data-example-workbench]');if(!box)return;
const $=s=>box.querySelector(s),address=$('#example-address'),channel=$('#example-channel');let code='',prompt='';
function origin(){try{const raw=address.value.trim(),u=new URL(raw.includes('://')?raw:'http://'+raw);if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.pathname!=='/'||u.search||u.hash||!/^([0-9]{1,3}\.){3}[0-9]{1,3}$/.test(u.hostname))return null;return u.origin;}catch{return null;}}
function update(){const base=origin();$('[data-example-command]').textContent=base?'python neo_quick_test.py --address '+base+' --channel '+channel.value+' --count 3 --seconds 15 --output neo-results':'请输入有效设备 IP 或 HTTP 地址';$('[data-copy-command]').disabled=!base;$('[data-copy-ai]').disabled=!base||!code||!prompt;}
function download(text,name){const a=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function copy(text,name,status){try{await navigator.clipboard.writeText(text);status.textContent='已复制'+name+'。';}catch{download(text,name==='完整代码'?'neo_quick_test.py':'neo-instructions.txt');status.textContent='浏览器未允许复制，已下载相同内容。';}}
box.querySelectorAll('[data-mode]').forEach(button=>button.onclick=()=>{const mode=button.dataset.mode;box.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));box.querySelectorAll('[data-panel]').forEach(p=>p.hidden=p.dataset.panel!==mode);$('[data-run-status]').textContent='';});
$('[data-copy-code]').onclick=()=>copy(code,'完整代码',$('[data-code-status]'));
$('[data-copy-command]').onclick=()=>copy($('[data-example-command]').textContent,'运行命令',$('[data-run-status]'));
$('[data-copy-ai]').onclick=()=>{if(!origin()||!code||!prompt)return;const ticks=String.fromCharCode(96).repeat(3);copy(prompt.replaceAll('http://192.168.11.1',origin()).replace('--channel both','--channel '+channel.value)+'\n'+ticks+'python\n'+code+'\n'+ticks+'\n','提示词和完整代码',$('[data-run-status]'));};
address.addEventListener('input',update);channel.addEventListener('change',update);update();
Promise.all(['_static/neo_quick_test.py','_static/example-prompt.txt'].map(async path=>{const r=await fetch(path);if(!r.ok)throw Error('HTTP '+r.status);return r.text();})).then(values=>{[code,prompt]=values;$('[data-example-code]').textContent=code;$('[data-copy-code]').disabled=false;update();}).catch(()=>{$('[data-example-code]').textContent='示例未能加载，请刷新或使用下载 .py。';$('[data-code-status]').textContent='加载失败，复制功能暂不可用。';});
})();

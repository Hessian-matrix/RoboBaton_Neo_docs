import * as T from './three.module.js';
import {createEnclosure,lightProduct} from './enclosure-model.js?v=dfc7a1e200a6';

const canvas=document.getElementById('interface-model');
const stage=canvas.closest('.port-showcase'),host=canvas.parentElement;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setClearColor(0x000000,0);
renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
renderer.outputColorSpace=T.SRGBColorSpace;
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new T.Scene();
const camera=new T.OrthographicCamera(-40,40,32,-32,.1,500);
camera.up.set(0,0,1); // Keep the body horizontal and the lens upright.
lightProduct(scene);
const model=new T.Group();scene.add(model);
const enclosure=createEnclosure();enclosure.position.set(0,-9,11.2);model.add(enclosure);
const shell=enclosure.material;
function mat(color){return new T.MeshLambertMaterial({color,side:T.DoubleSide})}
const metal=mat(0xbcc8c0),dark=mat(0x203b2d),gold=mat(0xced9c9);
function mesh(g,m,parent=model){const o=new T.Mesh(g,m);parent.add(o);return o}
// Side-entry direction confirmed by the user arrow: long side near the lens end.
const tfAssembly=new T.Group();scene.add(tfAssembly);tfAssembly.visible=true; tfAssembly.rotation.z=-Math.PI/2;tfAssembly.position.set(-12,-9,-4.1);
const cardMaterial=mat(0x263b32,.9);
const card=mesh(new T.BoxGeometry(11,15,1),cardMaterial,tfAssembly);card.position.set(0,-18,0);
const cardStripe=mesh(new T.BoxGeometry(9,3,.08),mat(0x719381),card);cardStripe.position.set(0,-3,.54);
const cardTip=mesh(new T.BoxGeometry(8,.4,.1),gold,card);cardTip.position.set(0,6.5,-.52);
// Shared enclosure already contains the TF slot.
const arrow=new T.ArrowHelper(new T.Vector3(0,1,0),new T.Vector3(0,-25,0),10,0x628c72,2,1);tfAssembly.add(arrow);card.visible=false;arrow.visible=false;
let tfAnimation=0;
function insertCard(){const id=++tfAnimation,start=performance.now();card.position.y=-18;arrow.visible=true;function step(now){if(id!==tfAnimation||mode!=='tf')return;const t=reduced.matches?1:Math.min(1,Math.max(0,(now-start-350)/1500)),k=t*t*(3-2*t);card.position.y=-18+25.5*k;arrow.visible=t<1;draw();if(t<1)requestAnimationFrame(step)}step(start)}
let mode='pins',azimuth=.82,elevation=.48,animation=0;
const pinLabel=document.getElementById('pin-callout'),computer=document.getElementById('computer-callout');
const line=document.getElementById('port-leader-path'),dot=document.getElementById('port-leader-dot');
const ns='http://www.w3.org/2000/svg'; const pinColors=['#a66b2b','#8966ac','#338b99','#3974b4','#738174','#be6358'];
const pinLines=Array.from({length:6},()=>{const path=document.createElementNS(ns,'path'),circle=document.createElementNS(ns,'circle');circle.setAttribute('r','2');line.parentElement.append(path,circle);return {path,circle}});
function draw(){
 const radius=110;camera.position.set(Math.sin(azimuth)*radius,Math.cos(azimuth)*radius,Math.sin(elevation)*radius);camera.lookAt(0,2,0);camera.updateMatrixWorld();renderer.render(scene,camera);
 const a=canvas.getBoundingClientRect(),b=stage.getBoundingClientRect(),mobile=b.width<650,facing=Math.cos(azimuth)>0;
 function project(x,z){const p=new T.Vector3(x,22.25,z).project(camera);return {x:a.left-b.left+(p.x+1)*a.width/2,y:a.top-b.top+(1-p.y)*a.height/2}}
 line.style.display=dot.style.display=mode==='usb'&&facing?'':'none';
 pinLines.forEach(({path,circle},i)=>{
  path.style.display=circle.style.display=mode==='pins'&&facing?'':'none';
  if(mode!=='pins')return;
  const q=project(-3.5+i*1.4,-2.7),row=pinLabel.querySelectorAll('.pin-callout-list p')[i].getBoundingClientRect();
  const ex=row.left-b.left-10,ey=row.top-b.top+row.height/2;
  // Separate each physical contact before fanning out to the corresponding label.
  const elbow=mobile?ex-14-(5-i)*5:Math.max(q.x+16,ex-65);
  const d=mobile?'M '+q.x+' '+q.y+' L '+elbow+' '+(q.y+20+i*5)+' L '+elbow+' '+ey+' L '+ex+' '+ey:'M '+q.x+' '+q.y+' L '+(q.x+15)+' '+q.y+' L '+elbow+' '+ey+' L '+ex+' '+ey;
  path.setAttribute('d',d);path.style.stroke=pinColors[i];circle.style.fill=pinColors[i];circle.setAttribute('cx',q.x);circle.setAttribute('cy',q.y);
 });
 if(mode==='usb'){
  const q=project(0,2.2),art=computer.querySelector('svg').getBoundingClientRect(),ex=art.left-b.left+art.width*(computer.dataset.target==='phone'?94:43)/280,ey=art.top-b.top+art.height*.6;
  line.setAttribute('d','M '+q.x+' '+q.y+' C '+(q.x+45)+' '+q.y+' '+(ex-45)+' '+ey+' '+ex+' '+ey);dot.setAttribute('cx',q.x);dot.setAttribute('cy',q.y);
 }
}
function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);const view=29;camera.left=-view*w/h;camera.right=view*w/h;camera.top=view;camera.bottom=-view;camera.updateProjectionMatrix();draw()}
new ResizeObserver(resize).observe(host);

const tfCallout=document.getElementById('tf-callout');
function changeView(next){
 viewElapsed=0;usbElapsed=0;
 if(next==='usb'){usbAuto=!reduced.matches;updateUsbPlay();setUsbTarget('computer')}
 tfAnimation++;mode=next;stage.dataset.mode=mode;document.querySelectorAll('[data-interface-view]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.interfaceView===mode)));
 canvas.setAttribute('aria-label','Neo 三维接口示意；当前展示'+(mode==='pins'?'6pin接口':mode==='usb'?'Type-C通过USB虚拟网卡连接电脑或兼容手机':'TF卡插入动作示意'));
 pinLabel.hidden=mode!=='pins';computer.hidden=mode!=='usb';tfCallout.hidden=mode!=='tf';card.visible=mode==='tf';arrow.visible=mode==='tf';
 // Reveal the seated card through a translucent housing, not a fabricated machined cutout.
 shell.transparent=mode==='tf';shell.opacity=mode==='tf'?.34:1;shell.depthWrite=mode!=='tf';
 const fromA=azimuth,fromE=elevation,toA=mode==='tf'?-1.05:mode==='pins'?.82:.52,toE=mode==='tf'?.58:mode==='pins'?.48:.7,start=performance.now(),id=++animation;
 function step(now){if(id!==animation)return;const t=reduced.matches?1:Math.min(1,(now-start)/850),k=t*t*(3-2*t);azimuth=fromA+(toA-fromA)*k;elevation=fromE+(toE-fromE)*k;draw();if(t<1)requestAnimationFrame(step);else if(mode==='tf')insertCard()}step(start);
}
 document.querySelectorAll('[data-interface-view]').forEach(button=>button.onclick=()=>{viewElapsed=0;if(mode!==button.dataset.interfaceView)changeView(button.dataset.interfaceView)});
document.fonts.ready.then(resize);resize();




let viewElapsed=0,usbElapsed=0;
let usbAuto=!reduced.matches;

function updateUsbPlay(){stage.dataset.usbPaused=String(!usbAuto)}
function setUsbTarget(target){computer.dataset.target=target;computer.querySelectorAll('[data-usb-target]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.usbTarget===target)));computer.querySelector('.usb-method').textContent=target==='phone'?'USB OTG · NCM / RNDIS*':'USB 数据线 · NCM / RNDIS';draw()}
computer.querySelectorAll('[data-usb-target]').forEach(b=>b.onclick=()=>{viewElapsed=0;usbElapsed=0;usbAuto=false;updateUsbPlay();setUsbTarget(b.dataset.usbTarget)});

let usbVisible=false;new IntersectionObserver(entries=>{usbVisible=entries[0].isIntersecting}).observe(stage);
let lastViewTick=performance.now();
setInterval(()=>{
 const now=performance.now(),dt=Math.min(500,now-lastViewTick);lastViewTick=now;
 if(!usbVisible||document.hidden||reduced.matches)return;
 viewElapsed+=dt;
 if(mode==='usb'&&usbAuto){usbElapsed+=dt;if(usbElapsed>=4500){usbElapsed=0;setUsbTarget(computer.dataset.target==='phone'?'computer':'phone')}}
 if(viewElapsed>=(mode==='usb'?10000:6000))changeView(mode==='pins'?'usb':mode==='usb'?'tf':'pins');
},100);
reduced.addEventListener('change',()=>{if(reduced.matches){usbAuto=false;updateUsbPlay()}});updateUsbPlay();

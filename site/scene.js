'use strict';
// Geometry adapted from visualization/public/robot-frame.js deviceModel().
// No product clients or device controls are imported into this prototype.
(()=>{
const $=id=>document.getElementById(id), canvas=$('scene');
let ctx=canvas.getContext('2d');
const productCanvas=$('product-model'),productCtx=productCanvas.getContext('2d');
let productAngle=-.55,productElevation=.6,productDrag=null;
const vision=document.createElement('canvas');vision.width=256;vision.height=160;
const vc=vision.getContext('2d'),imu=$('imu'),ic=imu.getContext('2d');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let playing=!reduced.matches,progress=0,angle=-.55,elevation=.6,width=1,height=1,visible=true,lastTime=0,drag=null,variant='case';
const TAU=Math.PI*2, duration=32, colors=['#3e7d62','#de874b','#638ab0'];
function position(t){const u=t*TAU/24;return [2.3*Math.sin(u)+.25*Math.sin(3*u),.3*Math.sin(2*u),1.6*Math.cos(u)];}
function sample(t){
 const p=position(t),a=position(t-.01),b=position(t+.01);
 const velocity=b.map((v,i)=>(v-a[i])/.02),acc=b.map((v,i)=>(v-2*p[i]+a[i])/.0001);
 const yaw=Math.atan2(velocity[0],velocity[2]);
 const yawAt=s=>{const a=position(s-.01),b=position(s+.01);return Math.atan2(b[0]-a[0],b[2]-a[2])};
 const d=yawAt(t+.01)-yawAt(t-.01),rate=Math.atan2(Math.sin(d),Math.cos(d))/.02;
 // Camera-aligned illustrative body frame: X right, Y down, Z forward.
 return {p,yaw,acc:[acc[0]*Math.cos(yaw)-acc[2]*Math.sin(yaw),-acc[1]-9.81,acc[0]*Math.sin(yaw)+acc[2]*Math.cos(yaw)],gyro:[0,-rate,0]};
}
const route=Array.from({length:241},(_,i)=>position(i/10));
function rotate(v,yaw){return [v[0]*Math.cos(yaw)+v[2]*Math.sin(yaw),v[1],-v[0]*Math.sin(yaw)+v[2]*Math.cos(yaw)];}
function project(p){const x=p[0]*Math.cos(angle)-p[2]*Math.sin(angle),z=p[0]*Math.sin(angle)+p[2]*Math.cos(angle),s=Math.min(width/7.7,height/6.2);return [width*.5+x*s,height*.47+(z*Math.sin(elevation)-p[1]*Math.cos(elevation))*s,z*Math.cos(elevation)+p[1]*Math.sin(elevation)];}
function stroke(points,color,lw=1,dash=[]){ctx.beginPath();points.forEach((p,i)=>{const q=project(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.setLineDash(dash);ctx.stroke();ctx.setLineDash([]);}
// Millimetres, optical centre reference, matching the installation-page PCB model.
let faces=[];
function face(points,color){faces.push({points,color})}
function box(c,s,color){const v=Array.from({length:8},(_,i)=>[c[0]+(i&1?.5:-.5)*s[0],c[1]+(i&2?.5:-.5)*s[1],c[2]+(i&4?.5:-.5)*s[2]]);[[0,1,3,2],[4,6,7,5],[0,4,5,1],[2,3,7,6],[0,2,6,4],[1,5,7,3]].forEach(f=>face(f.map(i=>v[i]),color));}
function cylinder(c,r,h,color){const ring=z=>Array.from({length:32},(_,i)=>[c[0]+r*Math.cos(i/32*TAU),c[1]+r*Math.sin(i/32*TAU),z]),a=ring(c[2]-h/2),b=ring(c[2]+h/2);face(a,color);face(b,color);for(let i=0;i<32;i++)face([a[i],a[(i+1)%32],b[(i+1)%32],b[i]],color);}
box([0,9,-10],[20,40,1.2],'#4e8d79');
box([0,25.5,-6.7],[7.5,6.5,6.6],'#b8c4cc');box([0,28.9,-6.7],[5.8,.4,4.2],'#33464f');
box([0,-1,-8.6],[14,18,1.6],'#354950');
cylinder([0,0,-5.3],6.2,6.8,'#45525a');cylinder([0,0,-.4],7,3,'#566672');cylinder([0,0,2],6.3,4,'#334750');
cylinder([0,0,4.05],5.4,.04,'#83beca');cylinder([0,0,4.1],3.6,.04,'#24576c');cylinder([-1.4,-1.4,4.15],1.5,.04,'#c4f3ff');
for(const x of [-8.5,8.5])for(const y of [-9.5,27.5]){cylinder([x,y,-9.3],1.1,.04,'#d3c799');cylinder([x,y,-9.2],.6,.04,'#294a43');}
for(const c of [[-5,12,-8.7],[5,8,-8.7],[-5,21,-8.7],[5,-6,-8.7]])box(c,[2.5,3.5,1.4],'#34464a');
box([0,12,-13.9],[7,7,2.8],'#435660');
const bareFaces=faces;faces=[];
// Enclosure dimensions from the user's Neo dimension sheet:
// 43.8 x 23.8 x 21.6 mm including lens; shell 12.4 mm, lens offset 12.9 mm.
function enclosure(){
 const ring=[];const radius=3.1;
 for(const [x,y,start] of [[8.8,27.8,0],[-8.8,27.8,Math.PI/2],[-8.8,-9.8,Math.PI],[8.8,-9.8,Math.PI*1.5]]){
  for(let j=0;j<=8;j++){const a=start+j/8*Math.PI/2;ring.push([x+radius*Math.cos(a),y+radius*Math.sin(a)]);}
 }
 const bottom=ring.map(p=>[...p,-17.4]),seam=ring.map(p=>[...p,-15.9]),top=ring.map(p=>[...p,-5]);
 face(bottom,'#3f6753');face(top,'#759b83');
 for(let i=0;i<ring.length;i++){const j=(i+1)%ring.length;face([bottom[i],bottom[j],seam[j],seam[i]],'#3d6250');const shade=Math.round(92+12*Math.cos(i/ring.length*TAU));face([seam[i],seam[j],top[j],top[i]],`rgb(${shade-25},${shade+17},${shade-10})`);}
}
enclosure();
cylinder([0,0,-3.4],5.8,3.2,'#374c46');cylinder([0,0,-.5],6.3,2.6,'#435b51');cylinder([0,0,2.1],7,2.6,'#597363');cylinder([0,0,3.65],6.4,1.1,'#344f46');
cylinder([0,0,4.21],5.3,.02,'#8ebcb5');cylinder([0,0,4.24],4.35,.02,'#244d50');cylinder([-1.2,-1.2,4.27],1.35,.02,'#cee7da');
const portFaceStart=faces.length;
box([0,30.92,-9.2],[9,.18,3.8],'#bcc8c0');box([0,31.04,-9.2],[7,.12,2.3],'#324b43');
box([0,30.92,-14],[11,.18,3.5],'#bbc6be');box([0,31.04,-14],[9,.12,2.3],'#314d42');
const contactStart=faces.length;
for(let i=0;i<6;i++)box([-3.5+i*1.4,31.12,-14],[.45,.08,1.4],'#ced9c9');
const contactFaces=faces.splice(contactStart);
const connectorFaces=faces.splice(portFaceStart);
box([11.93,22,-12.5],[.12,2.6,3.5],'#324e40');box([11.99,17,-9.5],[.12,1.3,1.3],'#e4c58b');
const tfSlotStart=faces.length;
box([11.94,0,-15.3],[.1,12.5,2.3],'#81998a');box([12.01,0,-15.3],[.1,11.5,1.3],'#203b2d');
const tfSlotFaces=faces.splice(tfSlotStart);
const caseFaces=faces;faces=bareFaces;
function model(projector){
 const geometry=variant==='case'?[...caseFaces,...connectorFaces,...contactFaces,...tfSlotFaces]:bareFaces;
 const projected=geometry.map(f=>({color:f.color,points:f.points.map(projector)}));
 drawNeoDepthModel(ctx,projected,width,height);
}
// Place the synthetic image on a real plane in camera space, not a screen overlay.
// This shares the exact focal length / principal point used by imagePoint().
function fieldOfView(cameraProject){
 const w=vision.width,h=vision.height,d=1.4,f=w*.65;
 const ray=(u,v)=>[(u-w/2)*d/f,-(v-h*.55)*d/f,d];
 const corners=[[0,0],[w,0],[w,h],[0,h]].map(([u,v])=>cameraProject(ray(u,v)));
 const apex=cameraProject([0,0,0]);
 ctx.save();
 for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];ctx.beginPath();ctx.moveTo(apex[0],apex[1]);ctx.lineTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.closePath();ctx.fillStyle='#75ad9020';ctx.fill();}
 const [a,b,,e]=corners;
 ctx.save();ctx.globalAlpha=.85;
 ctx.transform((b[0]-a[0])/w,(b[1]-a[1])/w,(e[0]-a[0])/h,(e[1]-a[1])/h,a[0],a[1]);
 ctx.drawImage(vision,0,0);ctx.restore();
 ctx.strokeStyle='#609e7b';ctx.lineWidth=1.1;ctx.beginPath();corners.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.closePath();ctx.stroke();
 ctx.lineWidth=.8;ctx.strokeStyle='#78a98b99';for(const p of corners){ctx.beginPath();ctx.moveTo(apex[0],apex[1]);ctx.lineTo(p[0],p[1]);ctx.stroke();}
 const top=corners.reduce((a,b)=>a[1]<b[1]?a:b);
 ctx.font='10px Segoe UI, Microsoft YaHei, sans-serif';ctx.fillStyle='#3e7d62';ctx.fillText('相机视野',Math.max(5,Math.min(width-62,top[0])),Math.max(65,top[1]-9));
 ctx.restore();
}
function drawMain(s,t,productOnly=false){
 ctx.clearRect(0,0,width,height);const stage=productOnly?0:2;
 if(stage<2){
  // Product close-up, same board and lens proportions as the product UI.
  const scale=Math.min(width/80,height/66),yaw=angle+1.65+Math.sin(t*.3)*.05;
  const proj=v=>{const x=v[0],y=v[1]-9,z=v[2]+4;const u=x*Math.cos(yaw)-y*Math.sin(yaw),d=x*Math.sin(yaw)+y*Math.cos(yaw);return [width*.51+u*scale,height*.48+(d*Math.sin(elevation)-z*Math.cos(elevation))*scale,d*Math.cos(elevation)+z*Math.sin(elevation)]};
  ctx.beginPath();ctx.ellipse(width*.53,height*.77,width*.23,14,0,0,TAU);ctx.fillStyle='#3e7d620b';ctx.fill();
  model(proj);
  drawProductDimensions(ctx,proj,width,height,variant);
 }else{
  for(let n=-3;n<=3;n++){stroke([[n,-.7,-3],[n,-.7,3]],'#d9e7de',.7);stroke([[-3,-.7,n],[3,-.7,n]],'#d9e7de',.7)}
  stroke(route,'#bdd5c5',1,[3,5]);
  const count=Math.floor(t/24*240);stroke([...route.slice(0,count+1),s.p],'#3e7d62',2.5);
  stroke([[s.p[0],-.7,s.p[2]],s.p],'#a4c2ae',1,[3,4]);
  const cameraProject=v=>project(rotate(v,s.yaw).map((n,i)=>n+s.p[i]));
  fieldOfView(cameraProject);
  const modelProject=v=>cameraProject([v[0]*.018,-v[1]*.018,(v[2]-4.2)*.018]);
  model(modelProject);
 }
}
// Fixed synthetic world landmarks, reprojected through the moving camera.
const landmarks=Array.from({length:240},(_,i)=>{const a=i*2.39996,r=3.4+(i%7)*.32;return [Math.cos(a)*r,((i*17)%31)/10-1.2,Math.sin(a)*r]});
function imagePoint(p,s,w,h){const dx=p[0]-s.p[0],dy=p[1]-s.p[1],dz=p[2]-s.p[2],x=dx*Math.cos(s.yaw)-dz*Math.sin(s.yaw),z=dx*Math.sin(s.yaw)+dz*Math.cos(s.yaw);if(z<.25)return null;const f=w*.65;return [w/2+x*f/z,h*.55-dy*f/z,z];}
function drawVision(s,t){
 const w=vision.width,h=vision.height;vc.clearRect(0,0,w,h);vc.fillStyle='#edf2ef';vc.fillRect(0,0,w,h);
 const prev=sample(t-.13);
 vc.strokeStyle='#d2ded5';vc.lineWidth=.7;
 // Segments form a synthetic room-like environment, not a recorded image.
 for(let i=0;i<landmarks.length;i+=4){const a=imagePoint(landmarks[i],s,w,h),b=imagePoint(landmarks[i+1],s,w,h);if(a&&b&&Math.abs(a[0]-b[0])<w*.7){vc.beginPath();vc.moveTo(a[0],a[1]);vc.lineTo(b[0],b[1]);vc.stroke()}}
 let count=0;for(const point of landmarks){const q=imagePoint(point,s,w,h);if(!q||q[0]<6||q[0]>w-6||q[1]<6||q[1]>h-6)continue;const before=imagePoint(point,prev,w,h);if(before){vc.beginPath();vc.moveTo(before[0],before[1]);vc.lineTo(q[0],q[1]);vc.strokeStyle='#65a28388';vc.stroke()}vc.strokeStyle='#3e7d62';vc.strokeRect(q[0]-2,q[1]-2,4,4);count++;}
 vc.fillStyle='#f8fbf9df';vc.fillRect(4,4,55,15);vc.font='8px Segoe UI, sans-serif';vc.fillStyle='#50735d';vc.fillText(count+' features',8,14);
}
function drawImu(t){
 const w=imu.clientWidth,h=imu.clientHeight;ic.clearRect(0,0,w,h);ic.fillStyle='#f7faf8';ic.fillRect(0,0,w,h);
 const rows=[{key:'acc',name:'去重力加速度 m/s²',min:-2,max:2},{key:'gyro',name:'角速度 rad/s',min:-2,max:2}];
 rows.forEach((r,row)=>{const left=row*w/2,plotWidth=w/2-12;ic.fillStyle='#617d69';ic.font='8px Segoe UI, Microsoft YaHei, sans-serif';ic.fillText(r.name,left+4,10);const y=v=>18+(r.max-v)/(r.max-r.min)*(h-24);
  ic.strokeStyle='#dae6de';ic.lineWidth=.6;ic.beginPath();ic.moveTo(left+4,y(0));ic.lineTo(left+plotWidth,y(0));ic.stroke();
  for(let axis=0;axis<3;axis++){ic.beginPath();for(let i=0;i<=64;i++){const value=sample(t-3+i/64*3)[r.key][axis]+(r.key==='acc'&&axis===1?9.81:0);const x=left+i/64*(plotWidth-4)+4;i?ic.lineTo(x,y(value)):ic.moveTo(x,y(value))}ic.strokeStyle=colors[axis];ic.lineWidth=1;ic.setLineDash(axis===2?[3,2]:[]);ic.stroke();ic.setLineDash([])}
 });
}
function draw(){const t=progress*24,s=sample(t);drawVision(s,t);drawMain(s,t);drawImu(t);$('sample-time').textContent=t.toFixed(2)+' s';}
function drawProduct(){
 const saved={ctx,width,height,angle,elevation};
 ctx=productCtx;width=productCanvas.clientWidth;height=productCanvas.clientHeight;angle=productAngle;elevation=productElevation;
 drawMain(sample(0),0,true);
 ({ctx,width,height,angle,elevation}=saved);
}
function sync(){$('progress').value=Math.round(progress*100);$('percent').textContent=Math.round(progress*100)+'%';$('play').textContent=playing?'Ⅱ':'▷';$('play').setAttribute('aria-label',playing?'暂停轨迹演示':'播放轨迹演示');canvas.dataset.phase='2';}
function resize(){const dpr=Math.min(devicePixelRatio||1,2);for(const c of [canvas,imu,productCanvas]){const r=c.getBoundingClientRect();c.width=Math.round(r.width*dpr);c.height=Math.round(r.height*dpr);c.getContext('2d').setTransform(dpr,0,0,dpr,0,0)}width=canvas.clientWidth;height=canvas.clientHeight;draw();drawProduct();}
$('play').onclick=()=>{playing=!playing;sync()};
$('progress').oninput=()=>{progress=Number($('progress').value)/100;playing=false;sync();draw()};
$('reset').onclick=()=>{progress=0;angle=-.55;elevation=.6;sync();draw()};
document.querySelectorAll('[data-variant]').forEach(button=>button.onclick=()=>{
 variant=button.dataset.variant;
 document.querySelectorAll('[data-variant]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 $('variant-size').innerHTML=variant==='case'?'43.8 × 23.8 × 21.6 <small>mm</small>':'40 × 20 × 19.5 <small>mm</small>';
 $('variant-weight').innerHTML=variant==='case'?'13.86 <small>g · 带壳</small>':'8.69 <small>g · 裸机</small>';
 for(const id of ["variant-size","variant-weight"]){const a=document.createElement("a");a.className="footnote-ref";a.href="#spec-notes";a.setAttribute("aria-label","查看规格说明");a.textContent="*";$(id).append(a)} sync();draw();drawProduct();
});
$('explore-motion').addEventListener('click',()=>{playing=!reduced.matches;sync();draw()});
productCanvas.onpointerdown=e=>{productDrag=[e.clientX,e.clientY];productCanvas.setPointerCapture(e.pointerId);productCanvas.classList.add('dragging')};
productCanvas.onpointermove=e=>{if(!productDrag)return;productAngle+=(e.clientX-productDrag[0])*.01;productElevation=Math.max(.2,Math.min(1.2,productElevation+(e.clientY-productDrag[1])*.006));productDrag=[e.clientX,e.clientY];drawProduct()};
productCanvas.onpointerup=productCanvas.onpointercancel=()=>{productDrag=null;productCanvas.classList.remove('dragging')};
productCanvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();productAngle+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;productElevation=Math.max(.2,Math.min(1.2,productElevation+(e.key==='ArrowUp'?.08:e.key==='ArrowDown'?-.08:0)));drawProduct()};

canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId);canvas.classList.add('dragging')};
canvas.onpointermove=e=>{if(!drag)return;angle+=(e.clientX-drag[0])*.01;elevation=Math.max(.2,Math.min(1.2,elevation+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY];draw()};
canvas.onpointerup=canvas.onpointercancel=()=>{drag=null;canvas.classList.remove('dragging')};
canvas.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();angle+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;elevation=Math.max(.2,Math.min(1.2,elevation+(e.key==='ArrowUp'?.08:e.key==='ArrowDown'?-.08:0)));draw()};
const resizeObserver=new ResizeObserver(resize);resizeObserver.observe($('experience'));resizeObserver.observe($('product-view'));new IntersectionObserver(e=>{visible=e[0].isIntersecting}).observe(canvas);
reduced.addEventListener('change',()=>{if(reduced.matches){playing=false;sync()}});
function frame(time){const dt=Math.min((time-lastTime)/1000,.05);lastTime=time;if(playing&&visible&&!document.hidden){progress=(progress+dt/duration)%1;sync();draw()}requestAnimationFrame(frame)}
// Independent interface explorer reuses the same enclosure geometry.
const ports=null; // Interface model has its own WebGL renderer in port-scene.js.
if(ports){
 let yaw=-.32,tilt=.28,held=null,portMode='pins',selectedPin=3,transitionId=0;
 const pinInfo=[['EXPOSURE_OUT','曝光同步输出 · 1.8 V'],['TRIGGER_IN','触发输入 · 1.8 V · 从机模式'],['UART_TX','接飞控 RX · 3.3 V TTL'],['UART_RX','接飞控 TX · 3.3 V TTL'],['GND','与飞控、电源共地'],['VIN','接 3.3–5 V 稳压电源正极']];
 document.querySelectorAll('[data-pin]').forEach(button=>button.onclick=()=>{selectedPin=Number(button.dataset.pin);document.querySelectorAll('[data-pin]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));const info=pinInfo[selectedPin-1];$('pin-description').replaceChildren();const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=selectedPin+' · '+info[0];detail.textContent=info[1];$('pin-description').append(title,detail);renderPorts()});
 const pc=ports.getContext('2d');
 function renderPorts(){
  const w=ports.clientWidth,h=ports.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  ports.width=Math.round(w*dpr);ports.height=Math.round(h*dpr);pc.setTransform(dpr,0,0,dpr,0,0);
  const compact=w<520;const scale=compact?Math.min(w/65,h/100):Math.min(w/115,h/62);
  const projectPort=v=>{const x=v[0],y=v[1]-9,z=v[2]+4,u=x*Math.cos(yaw)-y*Math.sin(yaw),d=x*Math.sin(yaw)+y*Math.cos(yaw);return [w*(compact?.5:.29)+u*scale,h*(compact?.29:.48)+(d*Math.sin(tilt)-z*Math.cos(tilt))*scale,d*Math.cos(tilt)+z*Math.sin(tilt)]};
  pc.clearRect(0,0,w,h);
  const oldCtx=ctx,oldVariant=variant;ctx=pc;variant='case';
  // A separate rendering style for the interface close-up: no polygon edge seams.
  const drawFaces=fs=>fs.map(f=>({...f,screen:f.points.map(projectPort)})).sort((a,b)=>a.screen.reduce((s,p)=>s+p[2],0)/a.screen.length-b.screen.reduce((s,p)=>s+p[2],0)/b.screen.length).forEach(f=>{const ys=f.screen.map(p=>p[1]);const g=pc.createLinearGradient(0,Math.min(...ys),0,Math.max(...ys)+1);g.addColorStop(0,f.color);g.addColorStop(1,f.color);pc.beginPath();f.screen.forEach((p,i)=>i?pc.lineTo(p[0],p[1]):pc.moveTo(p[0],p[1]));pc.closePath();pc.fillStyle=g;pc.fill()});
  drawFaces(caseFaces);
  const front=projectPort([0,32,-14])[2]>projectPort([0,30,-14])[2];
  if(front){drawFaces(connectorFaces);drawFaces(contactFaces)}
  ctx=oldCtx;variant=oldVariant;
  if(portMode==='pins'){
   const definitions=['1  EXPOSURE_OUT · 1.8 V','2  TRIGGER_IN · 1.8 V','3  TX → 飞控 RX','4  RX ← 飞控 TX','5  GND · 共地','6  VIN · 3.3–5 V'];
   const q=projectPort([0,31.18,-14]);
   pc.strokeStyle='#86a491';pc.lineWidth=1;pc.beginPath();pc.moveTo(q[0],q[1]);pc.lineTo(compact?30:w*.6,q[1]);pc.lineTo(compact?30:w*.63,h*(compact?.64:.32));pc.stroke();
   pc.font='12px Segoe UI, Microsoft YaHei, sans-serif';
   definitions.forEach((line,i)=>{pc.fillStyle=i===selectedPin-1?'#315f45':'#728c79';pc.fillText(line,compact?45:w*.65,h*(compact?.64:.32)+i*25)});
  }else{
   const q=projectPort([0,31.18,-9.2]),x=w*(compact?.3:.69),y=h*(compact?.68:.35),cw=w*(compact?.4:.25),ch=h*(compact?.16:.26);
   pc.strokeStyle='#88a692';pc.lineWidth=2;pc.beginPath();pc.moveTo(q[0],q[1]);pc.bezierCurveTo(w*.55,q[1]+35,w*.58,y+ch*.6,x,y+ch*.6);pc.stroke();
   pc.fillStyle='#f0f5f1';pc.strokeStyle='#7d9b88';pc.lineWidth=1.2;pc.beginPath();pc.roundRect(x,y,cw,ch,7);pc.fill();pc.stroke();pc.beginPath();pc.moveTo(x-8,y+ch+12);pc.lineTo(x+cw+8,y+ch+12);pc.lineTo(x+cw,y+ch);pc.lineTo(x,y+ch);pc.closePath();pc.stroke();
   pc.textAlign='center';pc.font='14px Segoe UI, Microsoft YaHei, sans-serif';pc.fillStyle='#4c745b';pc.fillText('电脑',x+cw/2,y+ch*.55);pc.font='11px Segoe UI, Microsoft YaHei, sans-serif';pc.fillText('USB 数据 + 供电',w*(compact?.5:.67),h*(compact?.96:.78));pc.textAlign='left';
  }
 }
 function clearSelection(){document.querySelectorAll('[data-port-view]').forEach(b=>b.setAttribute('aria-pressed','false'))}
 ports.onpointerdown=e=>{transitionId++;held=[e.clientX,e.clientY];ports.setPointerCapture(e.pointerId)};
 ports.onpointermove=e=>{if(!held)return;yaw+=(e.clientX-held[0])*.012;tilt=Math.max(-1.4,Math.min(1.4,tilt+(e.clientY-held[1])*.009));held=[e.clientX,e.clientY];clearSelection();renderPorts()};
 ports.onpointerup=ports.onpointercancel=()=>held=null;
 ports.onkeydown=e=>{transitionId++;if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();yaw+=e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0;tilt=Math.max(-1.4,Math.min(1.4,tilt+(e.key==='ArrowUp'?.1:e.key==='ArrowDown'?-.1:0)));clearSelection();renderPorts()};
 function selectPort(mode,button){
  portMode=mode;const fromYaw=yaw,fromTilt=tilt,toYaw=mode==='usb'?-.65:-.32,toTilt=mode==='usb'?.72:.28;
  $('usb-port-info').hidden=mode!=='usb';$('pin-port-info').hidden=mode!=='pins';clearSelection();button.setAttribute('aria-pressed','true');
  const token=++transitionId,start=performance.now(),duration=reduced.matches?0:750;
  function tick(now){if(token!==transitionId)return;const t=duration?Math.min(1,(now-start)/duration):1,k=t*t*(3-2*t);yaw=fromYaw+(toYaw-fromYaw)*k;tilt=fromTilt+(toTilt-fromTilt)*k;renderPorts();if(t<1)requestAnimationFrame(tick)}tick(start);
 }
 document.querySelectorAll('[data-port-view]').forEach(button=>button.onclick=()=>selectPort(button.dataset.portView,button));
 new ResizeObserver(renderPorts).observe(ports);renderPorts();
}
sync();resize();requestAnimationFrame(frame);
})();






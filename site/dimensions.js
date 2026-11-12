'use strict';
function drawProductDimensions(ctx,project,width,height,variant){
 const isCase=variant==='case',length=isCase?43.8:40,bodyWidth=isCase?23.8:20,startY=isCase?-12.9:-11,bottom=isCase?-17.4:-15.3,half=bodyWidth/2;
 const center=project([0,9,-6]);
 function dimension(start,end,offset,text){
  const a=project(start.map((n,i)=>n+offset[i])),b=project(end.map((n,i)=>n+offset[i]));
  ctx.save();ctx.lineWidth=.8;ctx.strokeStyle='#83a58e';
  ctx.setLineDash([2,3]);for(const [p,q] of [[project(start),a],[project(end),b]]){ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.stroke()}ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();
  const dx=b[0]-a[0],dy=b[1]-a[1],norm=Math.hypot(dx,dy)||1;let nx=-dy/norm,ny=dx/norm;
  const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;if((mx-center[0])*nx+(my-center[1])*ny<0){nx=-nx;ny=-ny}
  for(const p of [a,b]){ctx.beginPath();ctx.moveTo(p[0]-nx*3,p[1]-ny*3);ctx.lineTo(p[0]+nx*3,p[1]+ny*3);ctx.stroke()}
  ctx.font=(width<340?'9':'11')+'px Segoe UI, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const tw=ctx.measureText(text).width;
  const tx=Math.max(tw/2+4,Math.min(width-tw/2-4,mx+nx*(Math.abs(nx)>.65?tw/2+9:14))),ty=Math.max(12,Math.min(height-16,my+ny*15));
  ctx.lineWidth=4;ctx.strokeStyle='#f6faf7';ctx.strokeText(text,tx,ty);ctx.fillStyle='#50775e';ctx.fillText(text,tx,ty);ctx.restore();
 }
 dimension([half,startY,bottom],[half,startY+length,bottom],[6,0,0],length+' mm');
 dimension([-half,startY+length,bottom],[half,startY+length,bottom],[0,7,0],bodyWidth+' mm');
 // V2 CAD envelope height differs from the nominal product specification.
 // Do not present the nominal height as a measured dimension of this CAD mesh.
 if(isCase)dimension([half,startY,bottom],[half,startY,4.2],[7,-5,0],'21.6 mm');
 const a=project([-7,0,4.2]),b=project([7,0,4.2]);
 ctx.save();ctx.strokeStyle='#b4916d';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.lineTo(b[0]+19,b[1]-32);ctx.stroke();
 ctx.fillStyle='#987450';ctx.font=(width<340?'9':'11')+'px Segoe UI, sans-serif';ctx.fillText('Ø 14 mm',Math.max(5,Math.min(width-65,b[0]+10)),Math.max(12,b[1]-39));ctx.restore();
 document.getElementById('product-model').setAttribute('aria-label',isCase?'带壳设备：长43.8、宽23.8、含镜头总高21.6、镜头外径14毫米，可拖动旋转':'裸机：长40、宽20、含镜头总高19.5、镜头外径14毫米，可拖动旋转');
}

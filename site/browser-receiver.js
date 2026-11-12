/* Public receive-only protocol adapter. No configuration commands or writes. */
(function(root){
'use strict';
const utf8=new TextDecoder('utf-8',{fatal:true});
function pose(p,q){return p.every(Number.isFinite)&&q.every(Number.isFinite)&&Math.abs(Math.hypot(...q)-1)<.03;}
function crc(bytes,extra){let c=65535;for(const b of [...bytes,extra]){let t=b^(c&255);t^=(t<<4)&255;c=((c>>8)^(t<<8)^(t<<3)^(t>>4))&65535;}return c;}
class MAVLink{
 constructor(deliver){this.deliver=deliver;this.bytes=new Uint8Array();this.bad=0;}
 push(chunk){const data=new Uint8Array(this.bytes.length+chunk.length);data.set(this.bytes);data.set(chunk,this.bytes.length);let at=0;
  while(at<data.length){if(data[at]!==253&&data[at]!==254){at++;continue;}const v2=data[at]===253,header=v2?10:6;if(data.length-at<header)break;const n=data[at+1],signed=v2&&(data[at+2]&1),length=header+n+2+(signed?13:0);if(data.length-at<length)break;
   const frame=data.subarray(at,at+length),id=v2?frame[7]|frame[8]<<8|frame[9]<<16:frame[5];
   if(v2&&id===331){if(frame[2]&~1)throw Error('MAVLink 含不支持的扩展标志');const expected=frame[header+n]|frame[header+n+1]<<8;if(crc(frame.subarray(1,header+n),91)!==expected){this.bad++;at++;continue;}
    if(n<230)throw Error('ODOMETRY 数据长度不足');const d=new DataView(frame.buffer,frame.byteOffset+header,n),p=[8,12,16].map(o=>d.getFloat32(o,true)),q=[20,24,28,32].map(o=>d.getFloat32(o,true));
    if(!pose(p,q))throw Error('ODOMETRY 位姿不是有效有限值或单位四元数');
    this.deliver({kind:'pose',position:{x:p[0],y:p[1],z:p[2]},orientation:{w:q[0],x:q[1],y:q[2],z:q[3]},time_usec:d.getBigUint64(0,true).toString(),frame_id:d.getUint8(228),child_frame_id:d.getUint8(229),packet_seq:frame[4],system_id:frame[5],component_id:frame[6],crc_errors:this.bad,signed:Boolean(signed)});
   }at+=length;
  }this.bytes=data.slice(at);if(this.bytes.length>300)throw Error('串口接收缓冲超限');
 }
}
// Bounded RBH1 reassembly, matching the public 40-byte little-endian contract.
class RBH1{
 constructor(deliver){this.deliver=deliver;this.bytes=new Uint8Array();this.messages=new Map();this.last=new Map();}
 push(chunk){const bytes=new Uint8Array(this.bytes.length+chunk.length);bytes.set(this.bytes);bytes.set(chunk,this.bytes.length);let at=0;
  while(bytes.length-at>=40){const d=new DataView(bytes.buffer,at),ch=d.getUint16(8,true),fmt=d.getUint16(10,true),flags=d.getUint32(12,true),seq=d.getBigUint64(16,true),total=d.getUint32(24,true),offset=d.getUint32(28,true),size=d.getUint32(32,true);
   if(d.getUint32(0,true)!==0x31484252||d.getUint16(4,true)!==1||d.getUint16(6,true)!==40||d.getUint32(36,true)!==0||![0,2,6].includes(ch)||![1,7].includes(fmt)||flags&~3||!total||total>1100000||!size||size>65536||offset+size>total||Boolean(flags&1)!==(offset===0)||Boolean(flags&2)!==(offset+size===total))throw Error('RBH1 数据头或分片无效');
   if(bytes.length-at<40+size)break;
   let m=this.messages.get(ch);if(flags&1){if(m||seq<1n||seq<=(this.last.get(ch)||0n))throw Error('数据序号重复或倒退');m={data:new Uint8Array(total),used:0,seq,fmt};this.messages.set(ch,m);}
   if(!m||m.used!==offset||m.seq!==seq||m.fmt!==fmt||m.data.length!==total)throw Error('数据分片不连续');m.data.set(bytes.subarray(at+40,at+40+size),offset);m.used+=size;at+=40+size;
   if(flags&2){this.messages.delete(ch);this.last.set(ch,seq);this.deliver({channel:ch,format:fmt,sequence:seq.toString(),data:m.data});}
  }this.bytes=bytes.slice(at);if(this.bytes.length>65576)throw Error('HTTP 接收缓冲超限');
 }
 finish(){if(this.bytes.length||this.messages.size)throw Error('HTTP 数据帧被截断');}
}
function httpDecoder(channel,deliver,state){let ready=false,last=null;const id=channel==='odometry'?2:6,format=id===2?1:7;
 return new RBH1(record=>{
  if(record.channel===0){if(record.format!==1)throw Error('控制通道格式错误');const m=JSON.parse(utf8.decode(record.data));
   if(m.type==='metadata'){const c=m.stream?.channels;if(ready||m.stream?.source?.type!=='live'||!Array.isArray(c)||c.length!==1||c[0].id!==id||c[0].name!==channel||c[0].format!==format)throw Error('设备数据通道与请求不一致');if(id===6&&(m.config?.encoding!=='jpeg'||m.config?.pixel_format!=='mono8'))throw Error('设备图像不是灰度 JPEG');ready=true;state('已连接，等待有效数据');}
   else if(m.type==='error')throw Error(m.error?.code||m.code||'设备报告数据流错误');
   else if(m.type==='channel_state')state('设备状态：'+String(m.state));
   else if(m.type==='end')throw Error('设备结束数据流');return;
  }
  if(!ready||record.channel!==id||record.format!==format)throw Error('未收到通道信息或数据格式不匹配');
  if(id===2){const m=JSON.parse(utf8.decode(record.data));if(typeof m.header?.seq!=='string'||!(/^[1-9][0-9]*$/).test(m.header.seq))throw Error('位姿序号无效');if(m.pose===null){state('已连接，定位尚未有效；请在设备页完成 VIO 初始化');return;}const p=m.pose?.position,q=m.pose?.orientation;if(!p||!q||!pose([p.x,p.y,p.z],[q.w,q.x,q.y,q.z]))throw Error('设备返回无效位姿');deliver({kind:'pose',...m});}
  else{const b=record.data;if(b.length<8)throw Error('JPEG 帧长度不足');const n=new DataView(b.buffer,b.byteOffset,b.byteLength).getUint32(0,true);if(n<1||n>508||4+n>=b.length)throw Error('JPEG 帧头无效');const m=JSON.parse(utf8.decode(b.subarray(4,4+n))),jpeg=b.slice(4+n);if(typeof m.header?.seq!=='string'||!(/^[1-9][0-9]*$/).test(m.header.seq)||!m.random_access||jpeg[0]!==255||jpeg[1]!==216||jpeg.at(-2)!==255||jpeg.at(-1)!==217)throw Error('JPEG 数据无效');const seq=BigInt(m.header.seq);if(last!==null&&seq<=last)throw Error('JPEG 序号倒退');last=seq;deliver({kind:'image',header:m.header,data:jpeg});}
 });
}
function start(options,ondata,onstate=()=>{}){
 let port,reader,closed=false,timer,watch,resolveDone;const abort=new AbortController(),done=new Promise(r=>resolveDone=r);
 const stop=()=>{if(closed)return;closed=true;clearTimeout(timer);clearTimeout(watch);abort.abort();reader?.cancel().catch(()=>{});};
 const status=text=>{if(!closed)onstate(text);};
 const alive=()=>{clearTimeout(watch);watch=setTimeout(()=>{status('接收超时：请检查连接、波特率和设备输出');stop();},15000);};
 // requestPort is called synchronously from the user's click (user activation).
 let portRequest;
 if(options.transport==='serial'){
  if(!globalThis.isSecureContext||!navigator.serial){queueMicrotask(()=>{status('当前浏览器不支持网页串口，请使用电脑 Chrome / Edge，并通过 HTTPS 或 localhost 打开');stop();resolveDone();});return {stop,done};}
  portRequest=navigator.serial.requestPort();
 }
 (async()=>{try{
  status(options.transport==='serial'?'请选择 USB 转 TTL 模块':'正在连接设备');
  if(options.transport==='serial'){port=await portRequest;if(closed)return;const baud=Number(options.baud);if(!Number.isInteger(baud)||baud<1||baud>2147483647)throw Error('波特率无效');await port.open({baudRate:baud,dataBits:8,stopBits:1,parity:'none',flowControl:'none'});if(closed)return;reader=port.readable.getReader();status('串口已打开，等待 MAVLink 2 位姿');const parser=new MAVLink(ondata);alive();timer=setTimeout(()=>{status('验证结束（60 秒）');stop();},60000);
   while(!closed){const {value,done}=await reader.read();if(done)break;alive();parser.push(value);}if(!closed)status('串口已断开');
  }else{
   const url=new URL(options.base);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('设备地址无效');const channel=options.channel;if(!['odometry','gray_jpeg'].includes(channel))throw Error('请选择位姿或灰度图像');alive();
   let endpoint=url.origin+'/api/stream?channels='+channel;
   if(options.connector){
    status('正在连接电脑工具，请允许浏览器访问本地网络');
    const health=await fetch('http://127.0.0.1:18765/health',{signal:abort.signal,cache:'no-store',credentials:'omit'});
    const info=await health.json();if(!health.ok||info.product!=='neo-connect'||info.version!=='1.0.0')throw Error('电脑连接工具版本不匹配，请重新下载');
    endpoint='http://127.0.0.1:18765/api/stream?channels='+channel+'&device='+encodeURIComponent(url.origin);
    status('连接工具已就绪，正在读取设备');
   }
   const r=await fetch(endpoint,{signal:abort.signal,cache:'no-store',credentials:'omit'});if(!r.ok){let detail={};try{detail=await r.json()}catch{}const hints={DEVICE_UNREACHABLE:'无法连接设备，请检查 USB 网络和设备地址（当前设备为 192.168.46.1，默认端口 80）',DEVICE_HTTP_ERROR:'设备返回 HTTP '+detail.device_status,DEVICE_PROTOCOL_MISMATCH:'设备未返回公开 RBH1 数据流，请核对服务版本和端口',CONNECTOR_BUSY:'连接工具正在使用，请先停止其他接收页面',INVALID_DEVICE_OR_CHANNEL:'请输入设备的局域网 IPv4 地址和正确端口'};throw Error(hints[detail.code]||'设备返回 HTTP '+r.status);}if(r.headers.get('content-type')?.split(';')[0]!=='application/vnd.robobaton.stream')throw Error('设备未返回 RBH1 数据流');reader=r.body.getReader();const parser=httpDecoder(channel,ondata,status);timer=setTimeout(()=>{status('验证结束（60 秒）');stop();},60000);
   while(!closed){const {value,done}=await reader.read();if(done){parser.finish();status('设备已关闭数据流');break;}alive();parser.push(value);}
  }
 }catch(e){if(!closed)status(e.name==='NotFoundError'?'未选择串口':e.name==='TypeError'&&options.transport!=='serial'?(options.connector?'浏览器未能读取电脑连接工具：请在当前电脑打开工具，并允许本地网络访问，然后重试。':'浏览器未能读取设备：请检查地址与网络；设备未允许跨域时，请选择电脑连接工具。'):e.message||'接收失败');}
 finally{stop();if(reader){await reader.cancel().catch(()=>{});reader.releaseLock();}if(port)await port.close().catch(()=>{});resolveDone();}})();
 return {stop,done};
}
const api={start,MAVLink,RBH1,httpDecoder,crc};if(typeof module!=='undefined')module.exports=api;else root.NeoReceive=api;
})(globalThis);

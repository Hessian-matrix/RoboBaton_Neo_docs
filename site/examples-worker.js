/* Only runtime download uses the network here. Device transport stays same-origin. */
importScripts('examples-languages.js');
let language,python,instance,packet,current,result;
self.onmessage=async({data:m})=>{
 try{
  if(m.type==='init'){
   language=m.language;
   if(language==='python'){
    const base='https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
    importScripts(base+'pyodide.js');python=await loadPyodide({indexURL:base});
    python.runPython(NeoExampleLanguages.sources.python);
    self.postMessage({id:m.id,engine:'Python '+python.runPython('__import__("sys").version.split()[0]')+' · Pyodide 0.27.7'});
   }else if(language==='cpp'||language==='rust'){
    const bytes=Uint8Array.from(atob(NeoExampleLanguages.wasm[language]),c=>c.charCodeAt(0));
    const imports={env:{neo_read_pose:pointer=>{if(!current)return 0;new Float64Array(instance.exports.memory.buffer,pointer,7).set(current);return 1;},neo_write_pose:pointer=>{const v=Array.from(new Float64Array(instance.exports.memory.buffer,pointer,10));if(v.some(x=>!Number.isFinite(x)))throw Error('语言输出包含非有限数');result={position_m:v.slice(0,3),quaternion_wxyz:v.slice(3,7),position_mm:v.slice(7,10)};}}};
    ({instance}=await WebAssembly.instantiate(bytes,imports));
    self.postMessage({id:m.id,engine:(language==='cpp'?'C++':'Rust')+' · WebAssembly'});
   }else throw Error('不支持的语言');
  }else if(m.type==='pose'){
   packet=m.packet;result=null;
   if(language==='python'){
    let output='';python.setStdout({batched:s=>{output+=s+'\n';}});
    python.globals.set('neo_packet',JSON.stringify(packet));
    result=JSON.parse(python.runPython('receive(neo_packet)'));
    self.postMessage({id:m.id,result,output});
   }else{
    const {position:p,orientation:q}=packet.pose;current=[p.x,p.y,p.z,q.w,q.x,q.y,q.z];
    if(instance.exports.run_step()!==1||!result)throw Error('语言未输出结果');
    current=null;self.postMessage({id:m.id,result,output:JSON.stringify(result)});
   }
  }else throw Error('不支持的操作');
 }catch(error){self.postMessage({id:m.id,error:error.message||String(error)});}
};

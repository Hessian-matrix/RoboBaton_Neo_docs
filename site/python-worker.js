/* Python runs locally in this worker. Only runtime files are fetched from the CDN. */
let python;
self.onmessage=async({data:m})=>{
 try{
  if(m.type==='init'){
   const base='https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
   importScripts(base+'pyodide.js');
   python=await loadPyodide({indexURL:base});
   python.runPython(m.code);
   self.postMessage({id:m.id,result:python.version});
  }else{
   let output='';python.setStdout({batched:s=>{output+=s+'\n';}});
   python.globals.set('neo_packet',m.packet);
   const result=python.runPython('receive(neo_packet)');
   self.postMessage({id:m.id,result:JSON.parse(result),output});
  }
 }catch(e){self.postMessage({id:m.id,error:String(e.message||e)});}
};

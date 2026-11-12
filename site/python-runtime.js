(function(){
const code=`import json

# raw comes from the browser's read-only device adapter.
# This function runs in Python (Pyodide), inside your browser.
def receive(raw):
    data = json.loads(raw)
    if data["kind"] == "pose":
        p = data.get("pose", data)["position"]
        data["position_m"] = [p["x"], p["y"], p["z"]]
    result = json.dumps(data, ensure_ascii=False, indent=2)
    print(result)
    return result
`;
let worker=null,ready=null,next=0;const pending=new Map();
function dispose(){if(worker)worker.terminate();worker=null;ready=null;for(const item of pending.values()){clearTimeout(item.timer);item.reject(Error('Python 运行已取消'));}pending.clear();}
function request(message,timeout){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{dispose();reject(Error('Python 加载或执行超时，请重试'));},timeout);pending.set(id,{resolve,reject,timer});worker.postMessage({...message,id});});}
window.NeoPython={code,dispose,prepare(){if(ready)return ready;worker=new Worker('python-worker.js');worker.onmessage=({data:m})=>{const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);if(m.error)p.reject(Error(m.error));else p.resolve(m);};worker.onerror=()=>dispose();ready=request({type:'init',code},90000).catch(e=>{dispose();throw e;});return ready;},process(data){const packet=data.kind==='image'?{kind:'image',header:data.header,jpeg_bytes:data.data.length}:data;return request({type:'receive',packet:JSON.stringify(packet)},5000);}};
})();

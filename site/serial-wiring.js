// Pin numbers match the published Neo 6-pin interface. Logical terminal view,
// not a mating-face drawing: adapter terminal order varies by manufacturer.
const host=document.getElementById('serial-art');
if(host){
const pins=[['1','曝光同步','不接：EXPOSURE_OUT 是 1.8 V 曝光同步输出，本次串口接收不用。'],['2','外部触发','不接：TRIGGER_IN 是 1.8 V 触发输入，本次串口接收不用。'],['3','TX → RX','Neo 3 · UART_TX → USB 转 TTL 模块 RX。模块通过 USB 接电脑。'],['4','RX ← TX','可选：Neo 4 · UART_RX ← 模块 TX。只接收位姿时此线不接；双向通信才连接。'],['5','GND 共地','Neo 5 · GND 同时接模块 GND 和独立电源负极 −，三者共地。'],['6','VIN 供电','Neo 6 · VIN 接独立稳压电源正极 +（3.3–5 V，以硬件标注为准）。模块 VCC 不接。']];
host.innerHTML='<div class="wiring-heading"><strong>Neo · 设备背视接线</strong><a href="docs/connect-serial.html" target="_blank" rel="noopener noreferrer">核对实物针序 ↗</a></div><p class="wiring-orientation"><strong>TF 卡槽在左，6pin 在右；上 6 ↓ 下 1。</strong><span>从设备背面看，不是线束插头的线端视图。</span></p><svg class="wiring-map" viewBox="0 0 500 290" role="img" aria-label="设备背视，TF卡槽在左、6pin在右；从上到下6 VIN、5 GND、4 RX、3 TX、2触发、1曝光。3接模块RX；4可选接模块TX；5共地；6接独立电源正极。">'+
'<rect class="wiring-device" x="8" y="12" width="155" height="266" rx="12"/><text class="wire-title" x="85" y="39" text-anchor="middle">Neo 背面</text>'+
'<rect class="wiring-device" x="320" y="138" width="172" height="148" rx="12"/><text class="wire-title" x="406" y="159" text-anchor="middle">USB 转 TTL</text><text x="406" y="180" text-anchor="middle">3.3 V 信号 · VCC 不接</text><text x="406" y="127" text-anchor="middle">电脑 USB</text><path class="wiring-usb" d="M406 130V138"/>'+
[['6','VIN',65],['5','GND',102],['4','RX',139],['3','TX',176],['2','触发',213],['1','曝光',250]].map(([id,label,y])=>'<g data-wire-part="'+id+'"><text x="28" y="'+(y+6)+'">'+label+'</text><circle cx="141" cy="'+y+'" r="13"/><text x="141" y="'+(y+6)+'" text-anchor="middle">'+id+'</text></g>').join('')+
'<g data-wire-part="1"><path d="M154 250H220"/><text x="232" y="256">不接</text></g><g data-wire-part="2"><path d="M154 213H220"/><text x="232" y="219">不接</text></g>'+
'<g data-wire-part="3"><path d="M154 176H290V235H335m-10-5 10 5-10 5"/><text x="350" y="241">RX</text></g><g data-wire-part="4" class="optional-wire"><path d="M154 139H300V205H335"/><path d="m164 134-10 5 10 5"/><text x="350" y="211">TX（可选）</text></g>'+
'<rect class="wiring-supply" x="320" y="12" width="172" height="98" rx="10"/><text class="wire-title" x="406" y="35" text-anchor="middle">独立电源 · 3.3–5 V</text>'+
'<g data-wire-part="5"><path d="M154 102H278V94H335M278 102V265H335"/><circle cx="278" cy="102" r="3"/><text x="350" y="271">GND</text><text x="350" y="100">−</text></g>'+
'<g data-wire-part="6"><path d="M154 65H335"/><text x="350" y="71">+</text></g></svg>'+
'<div class="wiring-pins" aria-label="高亮端子线路，与上图从上到下顺序一致">'+pins.slice().reverse().map(([id,label])=>'<button type="button" data-wire="'+id+'" aria-label="'+id+' '+label+'" title="'+label+'" aria-pressed="false">'+id+'</button>').join('')+'</div>';
function select(id){host.querySelectorAll('[data-wire]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wire===id)));host.querySelectorAll('[data-wire-part]').forEach(g=>{g.classList.toggle('wire-active',g.dataset.wirePart===id);g.classList.toggle('wire-muted',g.dataset.wirePart!==id)});}
host.querySelectorAll('[data-wire]').forEach(b=>b.onclick=()=>select(b.dataset.wire));select('3');
}

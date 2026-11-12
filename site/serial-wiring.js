// Pin numbers match the published Neo 6-pin interface. Logical terminal view,
// not a mating-face drawing: adapter terminal order varies by manufacturer.
const host=document.getElementById('serial-art');
if(host){
const pins=[['1','曝光同步','不接：EXPOSURE_OUT 是 1.8 V 曝光同步输出，本次串口接收不用。'],['2','外部触发','不接：TRIGGER_IN 是 1.8 V 触发输入，本次串口接收不用。'],['3','TX → RX','Neo 3 · UART_TX → USB 转 TTL 模块 RX。模块通过 USB 接电脑。'],['4','RX ← TX','可选：Neo 4 · UART_RX ← 模块 TX。只接收位姿时此线不接；双向通信才连接。'],['5','GND 共地','Neo 5 · GND 同时接模块 GND 和独立电源负极 −，三者共地。'],['6','VIN 供电','Neo 6 · VIN 接独立稳压电源正极 +（3.3–5 V，以硬件标注为准）。模块 VCC 不接。']];
host.innerHTML='<div class="wiring-heading"><strong>Neo · 6pin 接线</strong><span>按端子编号连接</span></div><svg class="wiring-map" viewBox="0 0 500 290" role="img" aria-label="6pin 接线：1、2不接；3接模块RX；4可选接模块TX；5接模块GND和电源负极；6接电源正极。">'+
'<rect class="wiring-device" x="8" y="12" width="155" height="266" rx="12"/><text class="wire-title" x="85" y="39" text-anchor="middle">Neo 6pin</text>'+
'<rect class="wiring-device" x="320" y="48" width="172" height="152" rx="12"/><text class="wire-title" x="406" y="73" text-anchor="middle">USB 转 TTL</text><text x="406" y="94" text-anchor="middle">3.3 V 信号 · VCC 不接</text><text x="406" y="22" text-anchor="middle">电脑 USB</text><path class="wiring-usb" d="M406 29V48"/>'+
[['1','曝光',65],['2','触发',102],['3','TX',139],['4','RX',176],['5','GND',213],['6','VIN',250]].map(([id,label,y])=>'<g data-wire-part="'+id+'"><text x="28" y="'+(y+6)+'">'+label+'</text><circle cx="141" cy="'+y+'" r="13"/><text x="141" y="'+(y+6)+'" text-anchor="middle">'+id+'</text></g>').join('')+
'<g data-wire-part="1"><path d="M154 65H220"/><text x="232" y="71">不接</text></g><g data-wire-part="2"><path d="M154 102H220"/><text x="232" y="108">不接</text></g>'+
'<g data-wire-part="3"><path d="M154 139H300V125H335m-10-5 10 5-10 5"/><text x="350" y="131">RX</text></g><g data-wire-part="4" class="optional-wire"><path d="M154 176H290V157H335"/><path d="m164 171-10 5 10 5"/><text x="350" y="163">TX（可选）</text></g>'+
'<rect class="wiring-supply" x="320" y="215" width="172" height="70" rx="10"/><text class="wire-title" x="406" y="238" text-anchor="middle">独立电源 · 3.3–5 V</text>'+
'<g data-wire-part="5"><path d="M154 213H276V190H335M276 213V273H335"/><circle cx="276" cy="213" r="3"/><text x="350" y="195">GND</text><text x="350" y="279">−</text></g>'+
'<g data-wire-part="6"><path d="M154 250H235V253H335"/><text x="350" y="259">+</text></g></svg>'+
'<div class="wiring-pins" aria-label="高亮端子线路">'+pins.map(([id,label])=>'<button type="button" data-wire="'+id+'" aria-label="'+id+' '+label+'" title="'+label+'" aria-pressed="false">'+id+'</button>').join('')+'</div>';
function select(id){host.querySelectorAll('[data-wire]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.wire===id)));host.querySelectorAll('[data-wire-part]').forEach(g=>{g.classList.toggle('wire-active',g.dataset.wirePart===id);g.classList.toggle('wire-muted',g.dataset.wirePart!==id)});}
host.querySelectorAll('[data-wire]').forEach(b=>b.onclick=()=>select(b.dataset.wire));select('3');
}

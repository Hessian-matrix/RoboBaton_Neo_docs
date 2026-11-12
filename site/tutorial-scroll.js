(()=>{
const embedded=new URLSearchParams(location.search).get('embedded')==='1'&&window.parent!==window;
const destinations={'integration.html':'chapter-program','robot-mounting.html':'chapter-mounting','calibration-guide.html':'chapter-calibration','quick-start.html':'connect'};
if(embedded){
 document.documentElement.classList.add('tutorial-embedded');
 let last=0;
 function size(){const main=document.querySelector('main');if(!main)return;const height=Math.ceil(main.getBoundingClientRect().height);if(height&&height!==last){last=height;parent.postMessage({type:'neo-chapter-height',height},location.origin)}}
 const observer=new ResizeObserver(size);observer.observe(document.querySelector('main'));window.addEventListener('load',size);size();
 function navigate(url){const target=new URL(url,location.href);const name=target.pathname.split('/').pop();if(target.origin!==location.origin||!destinations[name])return false;parent.postMessage({type:'neo-chapter-go',target:destinations[name],hash:target.hash},location.origin);return true}
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(link&&navigate(link.href)){event.preventDefault();return}const next=event.target.closest('#lesson-next');if(next){const data=JSON.parse(document.getElementById('lesson-data').textContent),tabs=[...document.querySelectorAll('[data-lesson-step]')];if(tabs.at(-1).getAttribute('aria-selected')==='true'&&navigate(data.next)){event.preventDefault();event.stopImmediatePropagation()}}},true);
}else{
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  const frame=[...document.querySelectorAll('.chapter-frame')].find(f=>f.contentWindow===event.source);if(!frame)return;
  if(event.data?.type==='neo-chapter-height'&&Number.isFinite(event.data.height)&&event.data.height>100&&event.data.height<20000)frame.style.height=event.data.height+'px';
  if(event.data?.type==='neo-chapter-go'&&Object.values(destinations).includes(event.data.target)){
   const id=event.data.target==='connect'&&['#open-device','#start-vio','#connect'].includes(event.data.hash)?event.data.hash.slice(1):event.data.target;
   location.hash=id;
  }
 });
}
})();
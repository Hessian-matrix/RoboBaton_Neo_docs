(()=>{
const section=document.getElementById('applications');if(!section)return;
const reduced=matchMedia('(prefers-reduced-motion:reduce)');
const movers=['flight','rover'].map(key=>({path:document.getElementById('app-'+key+'-path'),object:section.querySelector('[data-mover='+key+']'),trail:section.querySelector('[data-trail='+key+']')}));
let visible=false,elapsed=0,last=0,frame=0;
function render(t){movers.forEach((m,i)=>{const len=m.path.getTotalLength(),fraction=reduced.matches?.68:Math.min(1,(t%(i?11000:14000))/(i?9000:12000)),point=m.path.getPointAtLength(len*fraction);m.object.setAttribute('transform','translate('+point.x+' '+point.y+')');m.trail.style.strokeDasharray=len;m.trail.style.strokeDashoffset=len*(1-fraction)})}
function tick(now){frame=0;if(!visible||document.hidden||reduced.matches)return;if(last)elapsed+=Math.min(100,now-last);last=now;render(elapsed);frame=requestAnimationFrame(tick)}
function sync(){cancelAnimationFrame(frame);last=0;section.classList.toggle('is-visible',visible&&!document.hidden);if(reduced.matches)render(0);else if(visible&&!document.hidden)frame=requestAnimationFrame(tick)}
new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()},{threshold:.08}).observe(section);document.addEventListener('visibilitychange',sync);reduced.addEventListener('change',sync);render(8000);
})();

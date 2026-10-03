export const NEWS_DWELL_MS=7000;
export const NEWS_TRANSITION_MS=1000;

export function startNewsCarousel(el:HTMLElement,count:number){
  let timer:ReturnType<typeof setTimeout>|undefined,frame=0,paused=false,hover=false,focused=false,visible=false;
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const clear=()=>{clearTimeout(timer);timer=undefined};
  const cancel=()=>{cancelAnimationFrame(frame);frame=0;el.style.scrollSnapType=''};
  const schedule=()=>{clear();if(count>1&&!paused&&!hover&&!focused&&visible&&!document.hidden&&!motion.matches)timer=setTimeout(()=>select((Math.round(el.scrollLeft/Math.max(el.clientWidth,1))+1)%count),NEWS_DWELL_MS)};
  const select=(index:number)=>{
    clear();cancel();
    const from=el.scrollLeft,to=Math.max(0,Math.min(count-1,index))*el.clientWidth;
    if(motion.matches){el.scrollTo({left:to,behavior:'instant'});schedule();return}
    el.style.scrollSnapType='none';
    const start=performance.now();
    const tick=(now:number)=>{const t=Math.min(1,(now-start)/NEWS_TRANSITION_MS);const eased=t*t*(3-2*t);el.scrollTo({left:from+(to-from)*eased,behavior:'instant'});if(t<1)frame=requestAnimationFrame(tick);else{frame=0;el.style.scrollSnapType='';schedule()}};
    frame=requestAnimationFrame(tick);
  };
  const enter=()=>{hover=true;clear()};
  const leave=()=>{hover=false;schedule()};
  const focus=()=>{focused=true;clear()};
  const blur=(e:FocusEvent)=>{if(!el.parentElement?.contains(e.relatedTarget as Node)){focused=false;schedule()}};
  const interrupt=()=>{cancel();clear()};
  const scrolled=()=>{if(!frame)schedule()};
  const changed=()=>{cancel();schedule()};
  const host=el.parentElement!;
  host.addEventListener('mouseenter',enter);host.addEventListener('mouseleave',leave);
  host.addEventListener('focusin',focus);host.addEventListener('focusout',blur);
  el.addEventListener('pointerdown',interrupt);el.addEventListener('wheel',interrupt,{passive:true});el.addEventListener('scroll',scrolled,{passive:true});
  document.addEventListener('visibilitychange',changed);motion.addEventListener('change',changed);
  const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(!visible)cancel();schedule()},{threshold:.5});observer.observe(el);
  const resize=new ResizeObserver(()=>{cancel();schedule()});resize.observe(el);
  return {select,setPaused(value:boolean){paused=value;if(value)cancel();schedule()},destroy(){clear();cancel();observer.disconnect();resize.disconnect();host.removeEventListener('mouseenter',enter);host.removeEventListener('mouseleave',leave);host.removeEventListener('focusin',focus);host.removeEventListener('focusout',blur);el.removeEventListener('pointerdown',interrupt);el.removeEventListener('wheel',interrupt);el.removeEventListener('scroll',scrolled);document.removeEventListener('visibilitychange',changed);motion.removeEventListener('change',changed)}};
}

import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {startNewsCarousel} from './news-carousel';
let reduced=false;
beforeEach(()=>{
  vi.useFakeTimers();vi.stubGlobal('performance',{now:()=>Date.now()});
  vi.stubGlobal('requestAnimationFrame',(fn:(time:number)=>void)=>setTimeout(()=>fn(Date.now()),16));
  vi.stubGlobal('cancelAnimationFrame',clearTimeout);
  vi.stubGlobal('document',Object.assign(new EventTarget(),{hidden:false}));
  vi.stubGlobal('matchMedia',()=>Object.assign(new EventTarget(),{matches:reduced}));
  vi.stubGlobal('IntersectionObserver',class{constructor(private callback:Function){}observe(){this.callback([{isIntersecting:true}])}disconnect(){}});
  vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
});
afterEach(()=>{reduced=false;vi.useRealTimers();vi.unstubAllGlobals()});
function fixture(count=2){
  const host=Object.assign(new EventTarget(),{contains:()=>false});
  const el=Object.assign(new EventTarget(),{parentElement:host,style:{scrollSnapType:''},clientWidth:600,scrollLeft:0,scrollTo({left}:{left:number}){this.scrollLeft=left}});
  const controller=startNewsCarousel(el as unknown as HTMLElement,count);
  return {el,host,controller};
}
it('waits seven seconds, animates for one second and wraps to the first story',()=>{
  const {el,controller}=fixture();vi.advanceTimersByTime(6999);expect(el.scrollLeft).toBe(0);
  vi.advanceTimersByTime(501);expect(el.scrollLeft).toBeGreaterThan(200);expect(el.scrollLeft).toBeLessThan(400);
  vi.advanceTimersByTime(524);expect(el.scrollLeft).toBe(600);
  vi.advanceTimersByTime(8024);expect(el.scrollLeft).toBe(0);controller.destroy();
});
it('pauses on hover and with the explicit pause control, and cleans up timers',()=>{
  const {el,host,controller}=fixture();host.dispatchEvent(new Event('mouseenter'));vi.advanceTimersByTime(15000);expect(el.scrollLeft).toBe(0);
  host.dispatchEvent(new Event('mouseleave'));controller.setPaused(true);vi.advanceTimersByTime(15000);expect(el.scrollLeft).toBe(0);
  controller.setPaused(false);vi.advanceTimersByTime(8024);expect(el.scrollLeft).toBe(600);
  controller.destroy();expect(vi.getTimerCount()).toBe(0);
});
it('does not autoplay a single story or when reduced motion is enabled',()=>{
  const single=fixture(1);vi.advanceTimersByTime(20000);expect(single.el.scrollLeft).toBe(0);single.controller.destroy();
  reduced=true;const multiple=fixture();vi.advanceTimersByTime(20000);expect(multiple.el.scrollLeft).toBe(0);
  multiple.controller.select(1);expect(multiple.el.scrollLeft).toBe(600);multiple.controller.destroy();
});

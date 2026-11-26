import { mountThreeMenu } from './menu-screen-core.js';
import { catalogPortrait } from './catalog-portrait.js';
import { menuAircraft } from './menu-aircraft.js';
import { createMenuArtworkWarmup } from './image-loading.js';

export { supportsMenu } from './menu-screen-core.js';

export function mountMenuScreen(device,page,send,interactive,setSection){
  const canvas=device.display.input,reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const className=canvas.className;
  const attrs=['style','role','aria-label','aria-modal','tabindex'].map(key=>[key,canvas.getAttribute(key)]);
  return mountThreeMenu(device, {
    page,region:page,anchor:canvas,progressiveEntry:true,prepareArtwork:createMenuArtworkWarmup({renderer:device.three}),
    visible:()=>page.isConnected&&!page.closest('[hidden]')&&!document.hidden,
    ownsOutput:()=>canvas.parentElement===page,
    layout:()=>({rect:page.getBoundingClientRect(),density:devicePixelRatio||1,
      safeBottom:parseFloat(getComputedStyle(page).paddingBottom)||0}),
    reducedMotion:()=>reduced.matches,now:()=>performance.now(),
    requestFrame:callback=>requestAnimationFrame(callback),cancelFrame:id=>cancelAnimationFrame(id),
    onLayout(update){const observer=new ResizeObserver(update);observer.observe(page);return ()=>observer.disconnect();},
    take(){
      page.append(canvas);canvas.className='three-menu-screen';
      canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;pointer-events:auto;outline:0';
    },
    release(){
      device.home.append(canvas);canvas.className=className;
      for(const [key,value] of attrs){if(value===null)canvas.removeAttribute(key);else canvas.setAttribute(key,value);}
    },
    focus:()=>canvas.focus({preventScroll:true}),
    begin:(w,h,refresh)=>device.display.begin(page,w,h,refresh),
    openPortrait:(refresh,request)=>catalogPortrait(device,page,refresh,request),
    openAircraft:(scene,refresh,request,available,options)=>menuAircraft(device,page,scene,refresh,request,available,options),
  },send,interactive,setSection);
}


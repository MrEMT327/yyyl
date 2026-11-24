import {loadFighterPackages} from '../../three/aircraft/fighter-packages.js';
import {createSortieView} from './sortie-view.js';
import {showSortieOnOutput} from './sortie-loading-core.js';

export function showThreeSortie({screen,stageName='作战区域',aircraftId,resourceCount=5,onDismiss}){
  const canvas=screen.display.input;
  const previous=document.activeElement,root=document.createElement('div');
  root.className='sortie-loading three-sortie-loading';root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','出击准备');
  root.style.cssText='position:fixed;inset:0;z-index:2147483000;margin:0;padding:0;border:0;display:block;background:transparent;touch-action:none;overscroll-behavior:contain';
  document.body.append(root);document.documentElement.classList.add('sortie-loading-active');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)'),events=new AbortController(),options={signal:events.signal};
  const host={
    view:(device,id,label,redraw)=>createSortieView(device,root,id,label,redraw),
    now:()=>performance.now(),hidden:()=>document.hidden,motionPreference:reduced,
    requestFrame:callback=>requestAnimationFrame(callback),cancelFrame:id=>cancelAnimationFrame(id),
    loadAircraft:id=>loadFighterPackages({pilotIds:[id]}),
    describe:value=>canvas.setAttribute('aria-label',value),setModel:()=>{root.dataset.hangar='model';},
    failed(){root.dataset.sortieState='failed';canvas.focus({preventScroll:true});},
    close(restoreFocus){
      root.remove();if(!document.querySelector('.sortie-loading'))document.documentElement.classList.remove('sortie-loading-active');
      if(restoreFocus&&previous?.isConnected)previous.focus({preventScroll:true});
    },
    bind({keys,visible,modeChange,redraw,start,end,cancel}){
      const observer=new ResizeObserver(()=>redraw());observer.observe(root);
      for(const key of ['keydown','keyup'])window.addEventListener(key,keys,{...options,capture:true});
      for(const key of ['click','pointerdown','pointerup','pointermove'])root.addEventListener(key,event=>event.stopPropagation(),options);
      canvas.addEventListener('pointerdown',event=>{start(event.clientX,event.clientY);canvas.setPointerCapture(event.pointerId);},options);
      canvas.addEventListener('pointerup',event=>end(event.clientX,event.clientY),options);
      canvas.addEventListener('pointercancel',cancel,options);
      screen.three.domElement.addEventListener('webglcontextrestored',()=>redraw(),options);
      document.addEventListener('visibilitychange',visible,options);reduced.addEventListener('change',modeChange,options);
      root.dataset.hangar='image';canvas.focus({preventScroll:true});
      document.fonts?.load('16px PsdPopup').then(redraw,()=>{});
      return ()=>{events.abort();observer.disconnect();};
    },
  };
  return showSortieOnOutput({screen,stageName,aircraftId,resourceCount,onDismiss,host});
}

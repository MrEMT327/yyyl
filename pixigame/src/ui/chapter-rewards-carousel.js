import {attachRecruitStripDrag} from './recruit-strip-drag.js';

const bound=new WeakSet();

// Native touch scrolling and desktop drag both settle on the centered node.
// A detached strip cannot change a later modal after a snapshot refresh.
export function bindChapterRewardCarousel(host,onSelect) {
  const strip=host.querySelector('[data-chapter-reward-strip]');
  if(!strip)return;
  if(!bound.has(strip)) {
    bound.add(strip);
    let timer=0,pointerDown=false;
    const schedule=()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{
        if(pointerDown||!strip.isConnected||!host.contains(strip)||strip.closest('[inert]'))return;
        const bounds=strip.getBoundingClientRect(),center=bounds.left+bounds.width/2;
        const tabs=[...strip.querySelectorAll('[role="tab"]')];
        const nearest=tabs.reduce((best,tab)=>{
          const rect=tab.getBoundingClientRect(),distance=Math.abs(rect.left+rect.width/2-center);
          return !best||distance<best.distance?{tab,distance}:best;
        },null)?.tab;
        if(nearest&&nearest.getAttribute('aria-selected')!=='true')onSelect(nearest.dataset.rewardKey,false);
      },180);
    };
    strip.addEventListener('scroll',schedule,{passive:true});
    strip.addEventListener('pointerdown',()=>{pointerDown=true;});
    const release=()=>{pointerDown=false;schedule();};
    strip.addEventListener('pointerup',release);
    strip.addEventListener('pointercancel',release);
    strip.addEventListener('lostpointercapture',release);
    strip.addEventListener('pointerleave',event=>{
      if(pointerDown&&event.pointerType==='mouse'&&!strip.hasPointerCapture(event.pointerId))release();
    });
    strip.addEventListener('click',event=>{
      const tab=event.target.closest?.('[role="tab"][data-reward-key]');
      if(!tab||!strip.contains(tab))return;
      event.stopPropagation();
      if(tab.getAttribute('aria-selected')!=='true')onSelect(tab.dataset.rewardKey,event.detail===0);
    });
    strip.addEventListener('keydown',event=>{
      const tab=event.target.closest?.('[role="tab"][data-reward-key]');
      if(!tab||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const tabs=[...strip.querySelectorAll('[role="tab"]')],index=tabs.indexOf(tab);
      const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:Math.max(0,Math.min(tabs.length-1,index+(event.key==='ArrowLeft'?-1:1)));
      event.preventDefault();event.stopPropagation();
      if(next!==index)onSelect(tabs[next].dataset.rewardKey,true);
    });
    attachRecruitStripDrag(strip);
  }
  const selected=strip.querySelector('[role="tab"][aria-selected="true"]');
  if(selected){
    const stripRect=strip.getBoundingClientRect(),cardRect=selected.getBoundingClientRect();
    strip.scrollLeft+=cardRect.left+cardRect.width/2-(stripRect.left+stripRect.width/2);
  }
}

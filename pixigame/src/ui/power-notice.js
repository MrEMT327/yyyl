import {POWER_NOTICE_DURATION,powerNoticeFrames,powerNoticePose,powerNoticeCount} from './power-notice-motion.js';
const compact=new Intl.NumberFormat('zh-CN',{useGrouping:false,notation:'compact',maximumFractionDigits:1});
const number=value=>Math.abs(value)>=1000000?compact.format(value):value.toLocaleString('zh-CN', {useGrouping:false});

// Presentation only; values come from committed before/after snapshots.
export function createPowerNotice(root) {
  const document=root.ownerDocument,view=document.defaultView;
  let node=null,timer=null,frame=null,context=null,base=0,lastAfter=0,lastAt=-Infinity;
  const key=()=>`${root.dataset.tab||''}:${root.dataset.subpage||''}:${root.querySelector('.pl-modal-host [data-modal-type]')?.dataset.modalType||''}`;
  function stopMotion(){view.clearTimeout(timer);if(frame!==null)view.cancelAnimationFrame(frame);frame=null;node?.getAnimations().forEach(a=>a.cancel());}
  function clear(){stopMotion();node?.remove();node=null;timer=null;context=null;lastAt=-Infinity;}
  function place(){
    if(!node)return;
    if(root.hidden||!root.isConnected||context!==key()){clear();return;}
    const {width,height}=root.getBoundingClientRect();
    node.style.setProperty('--power-unit',`${width/1080}px`);
    // Reference CombatTipParent: centre anchor, +200 design units upward.
    Object.assign(node.style,{left:'50%',top:`${height/2-width*200/1080}px`,maxWidth:`${Math.max(0,width-32)}px`});
  }
  const observer=new view.MutationObserver(place),host=root.querySelector('.pl-modal-host');
  if(host)observer.observe(host,{childList:true,subtree:true});
  observer.observe(root,{attributes:true,attributeFilter:['data-tab','data-subpage','hidden']});
  const resize=new view.ResizeObserver(place);resize.observe(root);
  const hide=()=>{if(document.hidden)clear();};document.addEventListener('visibilitychange',hide);
  return {
    show(before,after){
      if(!Number.isFinite(before)||!Number.isFinite(after)||root.hidden||!root.isConnected)return;
      before=Math.round(before);after=Math.round(after);if(before===after)return;
      const now=view.performance.now();
      if(context!==key()||now-lastAt>800||lastAfter!==before)clear();
      if(!node)base=before;
      context=key();lastAt=now;lastAfter=after;
      const delta=after-base;
      if(!delta){clear();return;}
      if(!node){
        node=document.createElement('div');node.className='action-power-notice';
        node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');
        node.innerHTML='<span class="power-notice-line" aria-hidden="true"><span class="power-notice-label">战力</span><b class="power-notice-total"></b><strong class="power-notice-delta"></strong></span>';
        root.append(node);
      }
      stopMotion();
      const count=node.querySelector('.power-notice-total'),change=node.querySelector('.power-notice-delta');
      node.dataset.direction=delta>0?'up':'down';
      change.textContent=`${delta>0?'+':'−'}${number(Math.abs(delta))}`;
      node.setAttribute('aria-label',`战力 ${after.toLocaleString('zh-CN', {useGrouping:false})}，${delta>0?'提升':'降低'} ${Math.abs(delta).toLocaleString('zh-CN', {useGrouping:false})}`);
      place();
      const reduced=view.matchMedia('(prefers-reduced-motion: reduce)').matches;
      count.textContent=number(reduced?after:base);count.style.scale='1';
      if(!reduced){
        node.animate(powerNoticeFrames(root.getBoundingClientRect().width),{duration:POWER_NOTICE_DURATION,fill:'forwards',easing:'linear'});
        const from=base,to=after;
        const tick=time=>{
          if(!node)return;
          const elapsed=time-now;
          count.textContent=number(powerNoticeCount(from,to,elapsed));
          count.style.scale=String(powerNoticePose(elapsed/1000).pulse);
          if(elapsed<POWER_NOTICE_DURATION)frame=view.requestAnimationFrame(tick);
        };
        frame=view.requestAnimationFrame(tick);
      }
      timer=view.setTimeout(clear,reduced?1800:POWER_NOTICE_DURATION);
    },
    clear,
    destroy(){clear();observer.disconnect();resize.disconnect();document.removeEventListener('visibilitychange',hide);},
  };
}

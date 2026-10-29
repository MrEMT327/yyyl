// The former reward-tip motion is reserved for real power changes. Resource
// receipts belong to the modal flow and are never presented by this controller.
export function createPowerNotice(root) {
  let node=null,timer=null,context=null,total=0;
  const key=()=>`${root.dataset.tab||''}:${root.dataset.subpage||''}:${root.querySelector('.pl-modal-host [data-modal-type]')?.dataset.modalType||''}`;
  function clear(){clearTimeout(timer);node?.getAnimations().forEach(a=>a.cancel());node?.remove();node=null;timer=null;context=null;total=0;}
  function place(){
    if(!node)return;
    if(root.hidden||!root.isConnected||context!==key()){clear();return;}
    const width=root.getBoundingClientRect().width;
    Object.assign(node.style,{left:'50%',top:`${width*500/1080}px`,maxWidth:`${Math.max(0,width-32)}px`});
  }
  const observer=new MutationObserver(place),host=root.querySelector('.pl-modal-host');
  if(host)observer.observe(host,{childList:true,subtree:true});
  observer.observe(root,{attributes:true,attributeFilter:['data-tab','data-subpage','hidden']});
  const resize=new ResizeObserver(place);resize.observe(root);
  const hide=()=>{if(document.hidden)clear();};document.addEventListener('visibilitychange',hide);
  return {
    show(before,after){
      if(!Number.isFinite(before)||!Number.isFinite(after)||root.hidden||!root.isConnected)return;
      const delta=Math.round(after)-Math.round(before);if(!delta)return;
      if(context!==key())clear();context=key();total+=delta;
      if(!total){clear();return;}
      if(!node){node=document.createElement('div');node.className='action-power-notice';node.setAttribute('role','status');node.setAttribute('aria-live','polite');node.setAttribute('aria-atomic','true');root.append(node);}
      node.textContent=`战力 ${total>0?'+':'−'}${Math.abs(total).toLocaleString('zh-CN')}`;place();
      clearTimeout(timer);node.getAnimations().forEach(a=>a.cancel());
      const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if(!reduced){
        const travel=root.getBoundingClientRect().width*150/1080;
        node.animate(Array.from({length:61},(_,i)=>{const t=i/60,u=Math.max(0,t-.5);return {offset:t,translate:`0 ${-travel*(3*t*t-2*t*t*t)}px`,opacity:16*u*u*u-12*u*u+1};}),{duration:1000,fill:'forwards'});
      }
      timer=setTimeout(clear,reduced?1800:1000);
    },
    clear,
    destroy(){clear();observer.disconnect();resize.disconnect();document.removeEventListener('visibilitychange',hide);},
  };
}

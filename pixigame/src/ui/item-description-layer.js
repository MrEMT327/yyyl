import { itemDescriptionModel } from './item-description-model.js';
import { rewardItemSlot } from './reward-item-slot.js';
import './item-description-layer.css';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function itemDescriptionMarkup(model) {
  const artwork=model.image?`<img src="${escape(model.image)}" alt="" draggable="false">`:'';
  return `<section class="item-description-dialog" role="dialog" aria-modal="true" aria-labelledby="item-description-title" aria-describedby="item-description-copy" tabindex="-1">
    <button type="button" class="item-description-close" aria-label="关闭道具详情"></button>
    <h2 id="item-description-title" class="item-description-title">${escape(model.name)}</h2>
    <header>${rewardItemSlot({...model,artwork,showQuantity:false,inspectable:false},{escape})}<p>持有数量：<strong>${model.count===null?'—':model.count.toLocaleString('zh-CN', {useGrouping:false})}</strong></p></header>
    <div class="item-description-body"><p id="item-description-copy">${escape(model.description)}</p></div>
  </section>`;
}

// One top layer works over lobby dialogs, reward receipts and combat results.
// Source DOM is retained, including focus, scroll and unconfirmed selections.
export function createItemDescriptionLayer({container,getSnapshot}) {
  const host=document.createElement('div');host.className='game-item-description-layer';host.hidden=true;
  container.append(host);
  let opener=null,retained=[],pointerStart=null;
  const close=()=>{
    if(host.hidden)return;
    host.hidden=true;host.replaceChildren();
    for(const [node,inert] of retained)node.inert=inert;
    retained=[];
    if(opener?.isConnected)opener.focus?.({preventScroll:true});
    opener=null;
  };
  const open=(item,source=document.activeElement)=>{
    if(!host.hidden)close();
    opener=source;
    const rect=container.getBoundingClientRect();
    Object.assign(host.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px'});
    host.innerHTML=itemDescriptionMarkup(itemDescriptionModel(item,getSnapshot()));host.hidden=false;
    retained=[...container.children].filter(node=>node!==host).map(node=>[node,node.inert]);
    for(const [node]of retained)node.inert=true;
    host.querySelector('.item-description-close').focus({preventScroll:true});
  };
  const fromTarget=target=>{
    let node=target.closest?.('[data-item-inspect]');
    const slot=node?.closest('.reward-item-slot');
    if(slot){if(!slot.hasAttribute('data-item-inspect'))return null;node=slot;}
    if(!node||!container.contains(node)||host.contains(node))return null;
    return node;
  };
  const inspect=(event,node)=>{
    event.preventDefault();event.stopImmediatePropagation();
    open({itemId:node.dataset.itemId,name:node.dataset.itemName,
      image:node.querySelector('img')?.getAttribute('src'),description:node.dataset.itemDescription,
      qualityRank:node.dataset.qualityKnown==='false'?undefined:Number(node.dataset.psdQuality),
      qualityKnown:node.dataset.qualityKnown!=='false'},node);
  };
  const click=event=>{const node=fromTarget(event.target);if(node)inspect(event,node);};
  // Disabled claim buttons may contain a reward preview. Pointer-up remains
  // available on that icon even when the enclosing claim cannot be clicked.
  const pointerDown=event=>{pointerStart={node:fromTarget(event.target),x:event.clientX,y:event.clientY};};
  const pointerUp=event=>{
    const node=fromTarget(event.target),start=pointerStart;pointerStart=null;
    if(node&&node===start?.node&&Math.hypot(event.clientX-start.x,event.clientY-start.y)<10&&node.closest('button:disabled'))inspect(event,node);
  };
  const keydown=event=>{
    if(!host.hidden){
      if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();close();}
      else if(event.key==='Tab'){event.preventDefault();event.stopImmediatePropagation();host.querySelector('.item-description-close').focus();}
      return;
    }
    if(event.key==='Enter'||event.key===' '){const node=fromTarget(event.target);if(node)inspect(event,node);}
  };
  host.addEventListener('click',event=>{if(event.target===host||event.target.closest('.item-description-close')){event.stopPropagation();close();}});
  const containScroll=event=>{event.stopPropagation();if(!event.target.closest('.item-description-body'))event.preventDefault();};
  host.addEventListener('wheel',containScroll,{passive:false});host.addEventListener('touchmove',containScroll,{passive:false});
  container.addEventListener('click',click,true);container.addEventListener('pointerdown',pointerDown,true);container.addEventListener('pointerup',pointerUp,true);
  window.addEventListener('keydown',keydown,true);
  const resize=()=>{if(!host.hidden){const r=container.getBoundingClientRect();Object.assign(host.style,{left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}};
  window.addEventListener('resize',resize);
  const observer=new ResizeObserver(resize);observer.observe(container);
  return {open,close,destroy(){close();observer.disconnect();container.removeEventListener('click',click,true);container.removeEventListener('pointerdown',pointerDown,true);container.removeEventListener('pointerup',pointerUp,true);window.removeEventListener('keydown',keydown,true);window.removeEventListener('resize',resize);host.remove();}};
}

import {createDrawGate,prepareDrawGate,DRAW_GATE_DURATION_MS} from './draw-gate.js';
import {drawPresentationPlan,advanceDrawPresentation} from './draw-presentation-plan.js';
import {trapModalTab} from './peripheral-focus.js';
import {createResearchCharge,startResearchCharge,prepareResearchDraw,researchDrawTiming,revealResearchCard} from './research-draw.js';
import './draw-presentation.css';

export function createDrawPresentation(root, sound = () => {}) {
  const states=new WeakMap(),sounded=new WeakMap();
  let active=null;
  const document=root.ownerDocument,view=document.defaultView;
  function clear() {
    if(!active)return;
    sound(null);
    clearTimeout(active.timer);
    active.motions.forEach(m=>m.cancel());
    active.media.removeEventListener('change',active.preference);
    active.overlay?.remove();
    active.backdrop.inert=false;active.backdrop.classList.remove('draw-summary-covered');
    active.host.querySelectorAll('.draw-review-all,.draw-card-review').forEach(n=>n.remove());
    root.removeEventListener('click',active.click,true);
    root.removeEventListener('keydown',active.key,true);
    active=null;
  }
  function show(receipt,snapshot) {
    const plan=drawPresentationPlan(receipt,snapshot);
    if(!plan)return false;
    if(active?.receipt===receipt && active.backdrop.isConnected)return true;
    clear();
    const host=root.querySelector('.pl-modal-host'),dialog=host?.querySelector('.pl-modal');
    if(!dialog)return true;
    const backdrop=dialog.closest('.pl-modal-backdrop');
    const nodes=plan.kind==='research'?[dialog.querySelector('.research-awakening-result')]:[...dialog.querySelectorAll('.rr-result-slot')];
    if(plan.kind==='recruit'&&!nodes.length)nodes.push(...dialog.querySelectorAll('.pl-rewards-grid>.pl-reward-item'));
    if(!nodes.length||nodes.some(n=>!n))return true;
    const media=view.matchMedia('(prefers-reduced-motion: reduce)');
    const reduced=media.matches;
    let flow=states.get(receipt)||{phase:reduced?(plan.kind==='research'?'spotlight':'summary'):'opening',cursor:0,review:false,instant:reduced};
    const state=active={receipt,host,dialog,backdrop,nodes,overlay:null,timer:null,click:null,key:null,motions:[],media,preference:null,preventDismissUntil:0};
    const remember=()=>states.set(receipt,flow);
    const cue=(step,key)=>{
      if(flow.review)return;
      const seen=sounded.get(receipt)||new Set();if(seen.has(step))return;
      seen.add(step);sounded.set(receipt,seen);sound(key);
    };
    const button=(text,action,cls='')=>{const b=document.createElement('button');b.type='button';b.className=`draw-control ${cls}`;b.dataset.drawAction=action;b.textContent=text;return b;};
    function summarize() {
      state.overlay?.remove();state.overlay=null;backdrop.inert=false;backdrop.classList.remove('draw-summary-covered');
      // Results already watched in the spotlight finish on their item face;
      // the rest perform their conversion once when the summary becomes visible.
      nodes.forEach(node=>{if(node.dataset.conversionSeen==='true')node.classList.add('is-conversion-complete');});
      if(plan.kind==='research'){
        const confirm=dialog.querySelector('.research-close')||dialog.querySelector('[data-action="close"]');
        clear();confirm?.click();return;
      }
      if(plan.kind==='recruit'&&!dialog.querySelector('.draw-review-all')) {
        const review=button('逐张回看','review','draw-review-all');
        dialog.querySelector('.pl-modal-heading')?.insertBefore(review,dialog.querySelector('.pl-close'));
        nodes.forEach((node,index)=>{const b=button('查看','card','draw-card-review');b.dataset.drawIndex=String(index);b.setAttribute('aria-label',`查看第${index+1}项结果`);node.append(b);});
      }
      (dialog.querySelector('.recruit-result-confirm,.research-close')||dialog.querySelector('.pl-close'))?.focus({preventScroll:true});
    }
    function render() {
      clearTimeout(state.timer);state.motions.forEach(m=>m.cancel());state.motions=[];remember();
      if(flow.phase==='summary'){if(plan.kind!=='research')cue('summary','reward');summarize();return;}
      const chargeOrigin=state.overlay?.querySelector('.research-draw-back')?.getBoundingClientRect();
      let researchCard=null;
      state.overlay?.remove();
      backdrop.inert=true;backdrop.classList.add('draw-summary-covered');
      const overlay=document.createElement('section');state.overlay=overlay;
      overlay.className=`draw-stage is-${flow.phase}`;overlay.dataset.drawStage=flow.phase;
      overlay.dataset.drawKind=plan.kind;
      if(flow.instant)overlay.classList.add('is-instant');
      if(plan.kind==='research')overlay.dataset.rank=String(plan.entries[0].rank);
      overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',plan.title);overlay.tabIndex=-1;
      const head=document.createElement('header');head.className='draw-stage-heading';
      const title=document.createElement('h2');title.textContent=plan.title;head.append(title);
      if(plan.kind!=='research'||flow.phase==='opening')head.append(button('跳过','skip','draw-skip'));
      overlay.append(head);
      const body=document.createElement('div');body.className='draw-stage-body';overlay.append(body);
      const footer=document.createElement('footer');footer.className='draw-stage-footer';overlay.append(footer);
      if(flow.phase==='opening') {
        if(plan.kind==='research'){
          const charge=createResearchCharge(document,plan.entries[0].rank);body.append(charge);
          const label=document.createElement('p');label.className='draw-opening-label';label.textContent='正在解析科技';body.append(label);
          footer.append(button('点击任意位置跳过动画','skip','draw-primary'));
          prepareResearchDraw(document).then(loaded=>{
            if(active!==state||state.overlay!==overlay||flow.phase!=='opening')return;
            if(!loaded){flow={...advanceDrawPresentation(flow,'next',plan),instant:true};render();return;}
            charge.classList.add('is-ready');cue('opening','drawCharge');
            state.motions.push(...startResearchCharge(charge,plan.entries[0].rank));
            state.timer=setTimeout(()=>{if(active===state&&state.overlay===overlay){flow=advanceDrawPresentation(flow,'next',plan);render();}},researchDrawTiming(plan.entries[0].rank).reveal);
          });
        }else{
        const gate=createDrawGate(document);overlay.prepend(gate);
        const label=document.createElement('p');label.textContent='正在招募';label.className='draw-opening-label';body.append(label);
        footer.append(button('揭晓','next','draw-primary'));
        if(!reduced)prepareDrawGate(document).then(loaded=>{
          if(active!==state || state.overlay!==overlay || flow.phase!=='opening')return;
          if(!loaded){flow=advanceDrawPresentation(flow,'next',plan);render();return;}
          gate.classList.add('is-ready');cue('opening','drawCharge');
          state.timer=setTimeout(()=>{if(active===state && flow.phase==='opening'){flow=advanceDrawPresentation(flow,'next',plan);render();}},DRAW_GATE_DURATION_MS);
        });
        }
      } else {
        const order=flow.review?plan.entries.map(e=>e.index):plan.featured,index=order[flow.cursor];
        const entry=plan.entries[index];overlay.dataset.rank=String(entry.rank);
        if(plan.entries.length>1){const count=document.createElement('span');count.className='draw-stage-count';count.textContent=flow.review?`${flow.cursor+1} / ${plan.entries.length}`:`${index+1} / ${plan.entries.length}`;head.insertBefore(count,head.lastChild);}
        const card=nodes[index]?.cloneNode(true);if(card){
          if(entry.converted&&!flow.review)nodes[index].dataset.conversionSeen='true';
          if(entry.converted)card.classList.remove('is-conversion-complete');
          card.querySelectorAll('.draw-card-review,.research-close').forEach(n=>n.remove());
          card.removeAttribute('id');card.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));
          card.classList.add('draw-spotlight');card.style.animation='none';
          card.querySelectorAll('.phc-reveal').forEach(n=>{n.classList.remove('phc-reveal');n.style.animation='none';});
          // Expand ten-pull thumbnails into the full dossier during reveal/review.
          card.querySelectorAll('.phc-compact').forEach(n=>n.classList.remove('phc-compact'));
          body.append(card);
          if(plan.kind==='research')researchCard=card;
        }
        if(entry.isNew){const badge=document.createElement('span');badge.className='draw-new';badge.textContent=plan.kind==='research'?'首次觉醒':'首次获得';body.prepend(badge);}
        const primary=button(plan.kind==='research'?'点击空白处关闭':flow.cursor+1<order.length?'继续':'查看结果','next','draw-primary');
        if(plan.kind==='research')primary.setAttribute('aria-label','确定');
        footer.append(primary);
      }
      host.append(overlay);
      if(flow.phase==='spotlight')cue(`card:${flow.cursor}`,plan.kind==='research'?'drawReveal':Number(overlay.dataset.rank)>=3?'rareReveal':'boxReveal');
      if(researchCard)state.motions=revealResearchCard(researchCard,{instant:flow.instant||media.matches,rank:plan.entries[0].rank,origin:chargeOrigin});
      (plan.kind==='research'?overlay:overlay.querySelector('.draw-primary'))?.focus({preventScroll:true});
    }
    state.click=event=>{
      const target=event.target.closest?.('[data-draw-action]');
      const researchBlank=plan.kind==='research'&&state.overlay?.contains(event.target)&&(!target)&&(flow.phase==='opening'||event.target===state.overlay||event.target.classList.contains('draw-stage-body'));
      if((!target||!host.contains(target))&&!researchBlank)return;
      event.preventDefault();event.stopPropagation();
      // A double tap that skips the charge must not also dismiss its result.
      if(plan.kind==='research'&&flow.phase==='spotlight'&&view.performance.now()<state.preventDismissUntil)return;
      const action=researchBlank?(flow.phase==='opening'?'skip':'next'):target.dataset.drawAction;
      if(plan.kind==='research'&&flow.phase==='opening'&&action==='skip')state.preventDismissUntil=view.performance.now()+300;
      flow=action==='card'?{phase:'spotlight',cursor:Number(target.dataset.drawIndex),review:true}:advanceDrawPresentation(flow,action,plan);
      render();
    };
    state.key=event=>{
      if(!state.overlay)return;
      if(plan.kind==='research'&&event.target===state.overlay&&(event.key==='Enter'||event.key===' ')){
        event.preventDefault();event.stopPropagation();state.overlay.querySelector('.draw-primary')?.click();return;
      }
      if(event.key==='Tab'){trapModalTab(event,state.overlay);event.stopPropagation();}
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();flow=advanceDrawPresentation(flow,'skip',plan);render();}
    };
    state.preference=()=>{if(media.matches&&active===state){flow=plan.kind==='research'?{...flow,phase:'spotlight',cursor:0,instant:true}:{...flow,phase:'summary'};render();}};
    media.addEventListener('change',state.preference);
    root.addEventListener('click',state.click,true);root.addEventListener('keydown',state.key,true);
    render();return true;
  }
  return {show,clear};
}

import { createRewardReveal } from './reward-reveal.js';
import { resourceIcon } from './resource-icons.js';
const quiet = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const accent = [{filter:'brightness(1)'},{filter:'brightness(1.45)',offset:.35},{filter:'brightness(1)'}];

// One controller per lobby. Rebuilding markup must never replay a receipt.
export function createLobbyStateFeedback(root, sound = () => {}) {
  let previous = null;
  const reveal = createRewardReveal(root,sound);
  const mergeEffects = new Set();
  function clearMerge() { for (const dispose of mergeEffects) dispose(); }
  function mergeMotion(node, frames, options, temporary = false) {
    const animation = node.animate(frames, options);
    const dispose = () => { animation.cancel(); if(temporary)node.remove(); mergeEffects.delete(dispose); };
    mergeEffects.add(dispose);
    animation.finished.then(dispose, dispose);
  }
  const readyStates = new Map();
  const pendingUnlocks=new Set(),pendingStars=new Set();
  let progression=null;
  function progressionFeedback(snapshot) {
    const next={unlocked:[...(snapshot.weapons||[]),...(snapshot.aircraft||[])].filter(x=>x.owned).map(x=>x.id),stages:(snapshot.stages||[]).filter(x=>x.unlocked).map(x=>String(x.index)),stars:(snapshot.starRewards?.modes||[]).flatMap(m=>m.items.filter(x=>x.claimable).map(x=>`${m.id}:${x.id}`))};
    if(progression){
      for(const id of next.unlocked)if(!progression.unlocked.includes(id))pendingUnlocks.add(id);
      for(const id of next.stages)if(!progression.stages.includes(id))pendingUnlocks.add(`stage:${id}`);
      for(const id of next.stars)if(!progression.stars.includes(id))pendingStars.add(id);
    }
    progression=next;
    root.querySelectorAll('.eq-card,.ref-catalog-card,.lc-chapter').forEach(node=>{
      const id=node.classList.contains('lc-chapter')?`stage:${node.dataset.index}`:node.dataset.id;
      if(pendingUnlocks.has(id)){pendingUnlocks.delete(id);pulse(node);if(!quiet())node.animate(accent,{duration:500});}
    });
    root.querySelectorAll('[data-action="claimStarReward"]').forEach(node=>{
      const key=`${node.dataset.mode}:${node.dataset.id}`;
      if(pendingStars.has(key)){pendingStars.delete(key);pulse(node.closest('.bc-star-reward'));}
    });
  }
  function captureMaterials() {
    return [...root.querySelectorAll('.workshop-cost [data-cost-resource]')].slice(0,2)
      .map(node => ({type:node.dataset.costResource,rect:node.getBoundingClientRect()}));
  }
  function complete(action,payload,result,materials,before,after) {
    clearMerge();
    if(action==='claimTask'){
      const node=[...root.querySelectorAll('[data-action="claimTask"]')].find(n=>n.dataset.id===payload.id);
      if(node){node.textContent='✓ 已领取';pulse(node);}
    }
    // Receipt reveals own their transforms; don't start a competing pulse.
    if(result.earnedCore && !root.querySelector('.research-result'))pulse(root.querySelector('.research-awaken.is-ace>span'));
    if(action==='synthesizeWeapon'||action==='synthesizeAll') {
      const changed = (after?.weapons || []).filter(w => w.qualityRank > (before?.weapons.find(old=>old.id===w.id)?.qualityRank ?? w.qualityRank));
      const target=[...root.querySelectorAll('.workshop-scene-slot:not(.is-result),.ref-warehouse .eq-card')]
        .find(node=>changed.some(w=>w.id===node.dataset.id));
      if(!target || quiet())return;
      const end=target.getBoundingClientRect(),bounds=root.getBoundingClientRect();
      if(!end.width)return;
      const x=end.left+end.width/2,y=end.top+end.height/2;
      (materials || []).forEach(({type,rect},i)=>{
        if(!rect.width)return;
        const icon=document.createElement('span');
        icon.innerHTML=resourceIcon(type); // Fresh SVG IDs preserve gradients.
        icon.className='action-resource-flight';icon.setAttribute('aria-hidden','true');
        Object.assign(icon.style,{left:`${x-bounds.left-10}px`,top:`${y-bounds.top-10}px`});
        root.appendChild(icon);
        mergeMotion(icon,[{transform:`translate(${rect.left+rect.width/2-x}px,${rect.top+rect.height/2-y}px) scale(1)`,opacity:1},{transform:'translate(0,0) scale(.35)',opacity:0}],{duration:380,delay:i*50,fill:'both',easing:'ease-in'},true);
      });
      mergeMotion(target,[
        {boxShadow:'inset 0 0 0 0 #ffe18a00'},
        {boxShadow:'inset 0 0 0 2px #ffe18a',offset:.4},
        {boxShadow:'inset 0 0 0 0 #ffe18a00'},
      ],{duration:380,delay:430});
      const caption=target.querySelector('[data-growth-stat]');
      if(caption){
        mergeMotion(caption,[{opacity:0},{opacity:1}],{duration:220,delay:580,fill:'backwards'});
      }
    }
  }
  function pulse(node) {
    if(!node || quiet())return;
    node.animate(accent,{duration:260,easing:'ease-out'});
  }
  function ready() {
    root.querySelectorAll('.pl-modal-host [data-action="claimTask"],.pl-modal-host [data-action="claimSignIn"],.pl-modal-host [data-action="claimPatrol"],.pl-modal-host [data-action="claimActivity"],.pl-modal-host [data-action="claimAchievement"]').forEach(node=>{
      const key=`${node.dataset.action}:${node.dataset.id||''}`;
      const enabled=!node.disabled;
      if(enabled && readyStates.get(key)!==true){
        pulse(node);
        const chest=node.matches('.dc-chest')?node.querySelector('img'):null;
        if(chest&&!quiet())chest.animate(accent,{duration:1500,iterations:2,easing:'ease-out'});
      }
      readyStates.set(key,enabled);
    });
  }
  function taskPage() {
    const node=root.querySelector('.pl-modal-host .dc-task-list,.pl-modal-host .dc-scroll,.pl-modal-host .lc-task-list');
    if(node && !quiet())node.animate([{opacity:.45},{opacity:1}],{duration:170});
  }
  function selection(selector) { pulse(root.querySelector(selector)); }
  function counters(snapshot) {
    const current = {power:snapshot.power,attack:snapshot.combatStats?.attack,hp:snapshot.combatStats?.maxHp};
    const old = previous; previous = current;
    if (!old || quiet()) return;
    for (const [key,selector,prefix] of [['power','.lobby-power b',''],['attack','.ag-pilot-stats>span:first-child b,.eq-stat-row span:first-child b',''],['hp','.ag-pilot-stats>span:last-child b,.eq-stat-row span:last-child b','']]) {
      const node=root.querySelector(selector), from=old[key], to=current[key];
      if(!node || !Number.isFinite(from) || !Number.isFinite(to) || from===to)continue;
      const started=performance.now();
      node.animate(accent,{duration:420});
      const frame=now=>{
        if(!node.isConnected)return;
        const t=Math.min(1,(now-started)/360);
        const label=node.closest('.eq-stat-row')?(key==='attack'?'攻击 ':'耐久 '):prefix;
        node.textContent=label+Math.round(from+(to-from)*(1-(1-t)**3)).toLocaleString('zh-CN');
        if(t<1)requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }
  }
  function research(id) {
    const card=[...root.querySelectorAll('.research-card')].find(n=>n.dataset.id===id);
    const scroller=root.querySelector('.research-scroll');
    if(!card || !scroller)return;
    const a=card.getBoundingClientRect(),b=scroller.getBoundingClientRect();
    if(a.top<b.top || a.bottom>b.bottom)scroller.scrollTo({top:scroller.scrollTop+a.top-b.top-(b.height-a.height)/2,behavior:quiet()?'instant':'smooth'});
    card.focus({preventScroll:true});
    if(!quiet()) {
      const glow=document.createElement('span');
      glow.className='research-state-glow';
      glow.setAttribute('aria-hidden','true');
      glow.style.cssText='position:absolute;inset:3px;pointer-events:none;background:linear-gradient(90deg,transparent,#ffdb6e66);border:1px solid #ffdb6e;';
      card.appendChild(glow);
      const motion=glow.animate([{clipPath:'inset(0 100% 0 0)',opacity:.8},{clipPath:'inset(0 0 0 0)',opacity:.6,offset:.65},{clipPath:'inset(0 0 0 0)',opacity:0}],{duration:500});
      const timer=setTimeout(()=>glow.remove(),650);
      const clean=()=>{clearTimeout(timer);glow.remove();};
      motion.finished.then(clean,clean);
    }
  }
  return {counters,result:reveal.show,clearResult:reveal.clear,clear:()=>{reveal.clear();clearMerge();},research,ready,taskPage,selection,complete,progressionFeedback,captureMaterials};
}

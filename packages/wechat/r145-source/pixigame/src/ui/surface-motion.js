import {UI_EASE} from './ui-motion-plan.js';

const quiet = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Animate stable mounts, never a timer-driven re-render of their contents.
export function enterSurface(node) {
  if (!node || quiet()) return [];
  node.getAnimations().filter(a=>a.id.startsWith('ui-page')).forEach(a=>a.cancel());
  const animations=[];
  const play=(target,keys,options)=>{target.getAnimations().filter(a=>a.id==='ui-page').forEach(a=>a.cancel());const a=target.animate(keys,options);a.id='ui-page';animations.push(a);};
  play(node,[{opacity:.35},{opacity:1}],
    {duration:260,easing:UI_EASE});
  const viewport=node.getBoundingClientRect();
  const cards=[...node.querySelectorAll('.ag-grid>.ag-card,.ws-grid>.eq-card,.wc-item-wrap,.fc-grid .wc-item,.fc-skill-row,.research-card,.rc-preview-card,.store-category')]
    .filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.bottom>viewport.top&&r.top<viewport.bottom;}).slice(0,12);
  cards.forEach((card,i)=>play(card,[{opacity:.25},{opacity:1}],
    {duration:220,delay:Math.min(i,7)*28,fill:'backwards',easing:UI_EASE}));
  return animations;
}

// Main tabs have independent entrances for their visible groups.
export function enterLobbyTab(root,body,tab) {
  const width=body.clientWidth;
  if(!width||quiet())return [];

  const animations=[];
  const play=(target,keys,options)=>{
    if(!target?.animate)return;
    const animation=target.animate(keys,{easing:UI_EASE,fill:'backwards',...options});
    animation.id='ui-page-main';
    animations.push(animation);
  };
  const slide=(selector,x,y,{duration=300,stagger=0}={})=>{
    const keys=[{translate:`${x}px ${y}px`},{translate:'0px 0px'}];
    root.querySelectorAll(selector).forEach((target,index)=>{
      // Keep the element's resting layout and any pressed-state transform.
      play(target,keys,{duration,delay:index*stagger,composite:'add'});
    });
  };
  const side=Math.round(width*.65);
  const lower=Math.round(width*.55);

  switch(tab){
    case 'assembly':
      slide('.eq-inventory, .ag-toolbar, .eq-inventory-toolbar',0,Math.round(width*1.15),{duration:350});
      slide('.ag-position, .ag-weapon, .ag-catalog, .eq-mount, .eq-catalog-row',side,0);
      slide('.ag-pilot-card, .eq-stat-row',-side,0);
      slide('.pl-header .lobby-page-title',0,-side);
      break;
    case 'shop':
      slide('.shop-scroll [data-shop-section]',-width,0,{duration:200,stagger:50});
      break;
    case 'battle':
      slide('.psd-hit-patrol, .psd-hit-start, .psd-hit-backpack',0,lower);
      slide('.psd-hit-tasks',-side,0);
      slide('.psd-hit-switch-pilot',side,0);
      break;
    case 'research':
      slide('.research-scroll, .research-footer',0,lower,{duration:350});
      break;
    case 'supply':
      play(body.querySelector('.recruit-feature-visual'),
        [{scale:1.18,opacity:.25},{scale:1,opacity:1}],{duration:350});
      slide('.recruit-collection, .rc-footer',0,lower);
      break;
  }
  return animations;
}

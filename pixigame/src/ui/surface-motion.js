const quiet = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Animate stable mounts, never a timer-driven re-render of their contents.
export function enterSurface(node) {
  if (!node || quiet()) return [];
  node.getAnimations().filter(a=>a.id.startsWith('ui-page')).forEach(a=>a.cancel());
  const animations=[];
  const play=(target,keys,options)=>{target.getAnimations().filter(a=>a.id==='ui-page').forEach(a=>a.cancel());const a=target.animate(keys,options);a.id='ui-page';animations.push(a);};
  play(node,[{opacity:.35},{opacity:1}],
    {duration:260,easing:'cubic-bezier(.16,1,.3,1)'});
  const viewport=node.getBoundingClientRect();
  const cards=[...node.querySelectorAll('.ag-grid>.ag-card,.ws-grid>.eq-card,.wc-item-wrap,.fc-grid .wc-item,.fc-skill-row,.research-card,.rc-preview-card,.store-category')]
    .filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.bottom>viewport.top&&r.top<viewport.bottom;}).slice(0,12);
  cards.forEach((card,i)=>play(card,[{opacity:.25},{opacity:1}],
    {duration:220,delay:Math.min(i,7)*28,fill:'backwards',easing:'cubic-bezier(.16,1,.3,1)'}));
  return animations;
}


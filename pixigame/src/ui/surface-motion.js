const quiet = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
// Animate stable mounts, never a timer-driven re-render of their contents.
export function enterSurface(node, direction = 1) {
  if (!node || quiet()) return [];
  node.getAnimations().filter(a=>a.id.startsWith('ui-page')).forEach(a=>a.cancel());
  const animations=[];
  const play=(target,keys,options)=>{const a=target.animate(keys,options);a.id='ui-page';animations.push(a);};
  play(node,[{opacity:.35,translate:`${direction * 12}px 0`},{opacity:1,translate:'0 0'}],
    {duration:260,easing:'cubic-bezier(.16,1,.3,1)'});
  const viewport=node.getBoundingClientRect();
  const cards=[...node.querySelectorAll('.ag-grid>.ag-card,.ws-grid>.eq-card,.wc-item-wrap,.fc-grid .wc-item,.fc-skill-row,.research-card,.rc-preview-card,.store-category')]
    .filter(n=>{const r=n.getBoundingClientRect();return r.width&&r.bottom>viewport.top&&r.top<viewport.bottom;}).slice(0,12);
  cards.forEach((card,i)=>play(card,[{opacity:.25,translate:'0 9px'},{opacity:1,translate:'0 0'}],
    {duration:220,delay:Math.min(i,7)*28,fill:'backwards',easing:'cubic-bezier(.16,1,.3,1)'}));
  return animations;
}

export function exitModal(host, root) {
  const old = host.firstElementChild;
  if (!old || quiet()) return;
  // The real dialog closes immediately. Its inert visual copy cannot retain
  // focus, intercept a pointer, or delay restoring background controls.
  root.querySelectorAll('.surface-exit-copy').forEach(n => n.remove());
  const copy = old.cloneNode(true);
  copy.classList.add('surface-exit-copy');
  copy.inert = true; copy.setAttribute('aria-hidden','true');
  copy.querySelectorAll('[id],[data-action],[role]').forEach(n=>{
    n.removeAttribute('id'); n.removeAttribute('data-action'); n.removeAttribute('role');
  });
  copy.removeAttribute('data-action');
  root.appendChild(copy);
  const animation = copy.animate([{opacity:1},{opacity:0}],{duration:140,fill:'forwards'});
  const dialog = copy.querySelector('.pl-modal');
  dialog?.animate([{scale:'1'},{scale:'.97'}],{duration:140,fill:'forwards'});
  dialog?.animate([{translate:'0 0'},{translate:'0 6px'}],{duration:140,fill:'forwards',composite:'add'});
  const timer = setTimeout(()=>copy.remove(),200);
  animation.finished.then(()=>{clearTimeout(timer);copy.remove();},()=>{clearTimeout(timer);copy.remove();});
}

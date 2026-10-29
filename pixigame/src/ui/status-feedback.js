export const stealthOpacity = remaining => remaining>0 ? .16+.84*(1-Math.min(1,remaining)) : 1;
export const barrierOpacity = remaining => .2+.8*Math.max(0,Math.min(1,remaining));
export function revealChoiceCards(root, start = performance.now()) {
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const cards=[];const walk=n=>{if(n.__fixedCardId)cards.push(n);else n.children?.forEach(walk);};walk(root);
  const frame=now=>{
    let running=false;
    cards.forEach((card,i)=>{
      if(card.destroyed||!card.parent||card.__entryCancelled)return;
      const t=Math.max(0,Math.min(1,(now-start-i*45)/170));card.alpha=.3+.7*t;running ||= t<1;
    });
    if(running)requestAnimationFrame(frame);
  };frame(performance.now());
}

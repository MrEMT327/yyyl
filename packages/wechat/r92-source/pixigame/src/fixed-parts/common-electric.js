// Project combat tuning: the scatterer is a target-gated sustained sector;
// the lightning cannon remains a discrete, longer-reaching chain attack.
export const ELECTRIC_TUNING=Object.freeze({
  scatter:Object.freeze({damage:5,interval:.1,range:650,halfAngle:Math.PI/6,targets:5}),
  lightning:Object.freeze({damage:12,interval:.24,initialRange:900,chainRange:240,branchChance:.18,upgradedBranchChance:.30}),
});

export function scatterTargets(origin,targets,{range=650,halfAngle=Math.PI/6,limit=5}={}){
  const seen=new Set(),eligible=[];
  for(const target of targets){
    if(target.dead||seen.has(target.id)||![target.x,target.y].every(Number.isFinite))continue;
    seen.add(target.id);
    const dx=target.x-origin.x,forward=origin.y-target.y,radius=Math.max(0,target.radius||0),distance=Math.hypot(dx,forward);
    if(forward<0||distance>range+radius)continue;
    const margin=Math.asin(Math.min(1,radius/Math.max(.0001,distance)));
    if(Math.atan2(Math.abs(dx),forward)>halfAngle+margin)continue;
    eligible.push({target,distance});
  }
  eligible.sort((a,b)=>a.distance-b.distance||String(a.target.id).localeCompare(String(b.target.id)));
  return eligible.slice(0,limit).map(entry=>entry.target);
}

// Independent stable arc noise, without consuming gameplay randomness.
export function electricArcSeed(visual){
  const key=String(visual.id??'electric');let hash=2166136261;
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619);
  return (hash>>>0)/4294967296;
}

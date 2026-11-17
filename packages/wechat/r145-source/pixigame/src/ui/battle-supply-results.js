// A view of the existing draw receipt, in draw order. Repeated weapon names
// can represent different upgrades and must remain separate rows.
export function supplyResultRows(rewards) {
  return rewards.map(card=>{
    const star=Math.max(1,Number(card.star)||1);
    const passive=Number(card.nativeSkillId??card.id)>=11000000;
    const tier=passive?0:Math.min(2,Math.floor((star-1)/3));
    return {card,name:card.weaponName||card.name,description:card.description||'武器强化',
      breakthrough:Boolean(card.opensBreakthrough),
      tier,lit:passive?star:(star-1)%3+1,
      marks:passive?Math.max(star,Number(card.raw?.MaxStar)||2):3};
  });
}

export function supplyResultLayout(count) {
  const height=count>=5?138:count===4?160:184,gap=20;
  const total=count*height+Math.max(0,count-1)*gap;
  return {x:36,width:528,height,gap,top:Math.max(242,624-total/2),buttonY:1068};
}

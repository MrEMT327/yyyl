export const ENERGY_PROFILES=Object.freeze({
 prism:Object.freeze({interval:1,damage:45,range:10000,width:30}),
 tesla:Object.freeze({interval:.3,damage:20,range:2000,width:37.5}),
});
export function energyInterval(itemId,has,tactic,charge,jitter=0){
 const base=itemId==='prism'?(has('S1')?.85:1):.3-jitter;
 const tuning=itemId==='prism'?(tactic==='T3'?.75:tactic==='T4'?1.3:1):(tactic==='T3'?.75:tactic==='T4'?1.4:1);
 return base*tuning/(1+.3*charge);
}
export function energyShot(itemId,has,tactic,round,height,random){
 const p=ENERGY_PROFILES[itemId],scale=height/4600,prism=itemId==='prism';
 const damage=p.damage*(prism?1:(has('S1')?.65:.4)+random()*(has('S1')?.55:.8))
   *(prism?(tactic==='T1'?.85:['T2','T3'].includes(tactic)?.8:tactic==='T4'?1.35:1):(tactic==='T2'?.8:tactic==='T4'?1.5:1));
 const widthScale=prism?(has('S2')?1.35:1)*(tactic==='T2'?1.7:1):Math.pow(damage/p.damage,.7);
 return {energy:true,itemId,round,damage,range:p.range*scale*(prism?1:(.3+random()*.8)*(has('S2')?1.25:1)*(tactic==='T2'?1.4:1)),
  width:p.width*scale*widthScale,hitWidth:p.width*scale*(prism?widthScale:Math.max(1,widthScale)),height,
  spread:prism?(tactic==='T1'?(round%2?1:-1)*12*Math.PI/180:0):(random()*2-1)*(tactic==='T1'?15:40)*Math.PI/180,
  splitChance:prism?0:tactic==='T3'?0:.13*(tactic==='T1'?.5:1),
  a1:has('A1'),a2:has('A2'),b1:has('B1'),b2:has('B2'),c1:has('C1'),c2:has('C2'),tactic};
}

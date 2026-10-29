import catalog from './native-economy-catalog.json' with {type:'json'};
import { isRosterPilot } from './native-pilot-roster.js';

const pilots=new Map(catalog.pilots.filter(row=>!row.closed&&isRosterPilot(row.id)).map(row=>[row.id,row]));
export const PILOT_CREDIT_COST=3;
export function pilotAtMaxStar(progression,id) {
  const row=pilots.get(id),owned=progression.pilots.find(p=>p.id===id&&p.active);
  return Boolean(row&&owned&&owned.star>=Math.max(...row.stages.map(s=>s.star)));
}
export function pilotCreditReward(amount,sourcePilotId) {
  return {type:'pilotCredits',name:'满星重复积分',amount,creditsAdded:amount,
    ...(sourcePilotId?{sourcePilotId}:{})};
}
// Mutates only the caller's planned inventory / progression copies. The caller
// must commit creditsAdded to pilotSupply in the SAME storage transaction.
// Fragment composition retains manual activation; boxes and gifts activate.
export function grantPilotCards(inventory,progression,id,amount,{activate=false}={}) {
  const row=pilots.get(id);
  if(!row||!Number.isSafeInteger(amount)||amount<1)throw Error('驾驶员同名卡奖励无效');
  let owned=progression.pilots.find(p=>p.id===id),isNew=false,copies=amount;
  if(activate&&!owned?.active){
    isNew=true;copies--;
    if(owned)Object.assign(owned,{active:true,star:row.defaultStar});
    else {owned={id,active:true,star:row.defaultStar,equipped:false};progression.pilots.push(owned);}
    // Fill an empty sortie slot on activation without replacing a selected pilot.
    if(!progression.pilots.some(pilot=>pilot.active&&pilot.equipped))owned.equipped=true;
  }
  const converted=pilotAtMaxStar(progression,id),creditsAdded=converted?copies:0,copiesAdded=converted?0:copies;
  if(copiesAdded){
    const balance=(inventory.items[id]||0)+copiesAdded;
    if(!Number.isSafeInteger(balance))throw Error('驾驶员同名卡数量超限');
    inventory.items[id]=balance;
  }
  return {isNew,copiesAdded,creditsAdded,stars:owned?.active?owned.star:row.defaultStar};
}

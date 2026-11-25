import {recurringProgressGate} from '../replica/pilot-supply-reward-policy.js';

export const DAILY_TABS=Object.freeze([
  {id:'signin',label:'签到'}, {id:'daily',label:'每日'},
  {id:'weekly',label:'每周'}, {id:'achievements',label:'成就'},
]);

export function isDailyTabAvailable(snapshot,period){
  if(period==='signin'){
    const signIn=snapshot.signIn;
    return Boolean(signIn&&(signIn.gate?.reached!==false||signIn.canClaim===true));
  }
  if(period==='daily'||period==='weekly'||period==='achievements'){
    const supply=snapshot.pilotSupply;
    return supply?.taskGate?.reached!==false||Boolean(supply.clockRollback&&
      (supply.development||recurringProgressGate(snapshot.replicaCampaign??{}).reached));
  }
  return false;
}

export function availableDailyTabs(snapshot){
  return DAILY_TABS.filter(tab=>isDailyTabAvailable(snapshot,tab.id));
}

export function resolveDailyPeriod(snapshot,period){
  if(isDailyTabAvailable(snapshot,period))return period;
  const tabs=availableDailyTabs(snapshot);
  const ready=tabs.find(tab=>hasReady(snapshot,tab.id));
  return ready?.id??tabs.find(tab=>tab.id==='daily')?.id??tabs[0]?.id;
}

export function dailyTabUnlockMessage(period){
  return recurringProgressGate(undefined,period==='signin'?'signin':'tasks').reason;
}

function readyCount(s,period) {
  const supply=s.pilotSupply;
  if(!supply)return (s.tasks||[]).filter(t=>t.type===period&&t.claimable).length
    +(s.activity?.[period]?.items||[]).filter(t=>t.claimable).length;
  const track=period==='weekly'?supply.week:supply.activity;
  const rewards=track?.milestones??[track],tasks=period==='weekly'?supply.week?.tasks:supply.tasks;
  return rewards.filter(row=>row?.canClaim).length+(tasks||[]).filter(task=>task.canClaim).length;
}
export const hasReady=(s,id)=>!s.rewardPending && !s.rewardBusy && (id==='signin'?s.signIn?.canClaim:id==='achievements'?s.achievements?.items?.some(t=>t.claimable):readyCount(s,id)>0);


export const DAILY_TABS=Object.freeze([
  {id:'signin',label:'签到'}, {id:'daily',label:'每日'},
  {id:'weekly',label:'每周'}, {id:'achievements',label:'成就'},
]);

function readyCount(s,period) {
  const supply=s.pilotSupply;
  if(!supply)return (s.tasks||[]).filter(t=>t.type===period&&t.claimable).length
    +(s.activity?.[period]?.items||[]).filter(t=>t.claimable).length;
  const rewards=period==='weekly'
    ?(supply.week.milestones||[supply.week])
    :(supply.activity.milestones||[supply.activity]);
  return rewards.filter(row=>row?.canClaim).length
    +(period==='weekly'?(supply.week.tasks||[]).filter(task=>task.canClaim).length:supply.tasks.filter(task=>task.canClaim).length);
}
export const hasReady=(s,id)=>!s.rewardPending && !s.rewardBusy && (id==='signin'?s.signIn?.canClaim:id==='achievements'?s.achievements?.items?.some(t=>t.claimable):readyCount(s,id)>0);


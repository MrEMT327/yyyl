export function formatPatrolDuration(value) {
  const seconds=Number.isFinite(value)?Math.max(0,Math.floor(value)):0;
  return [Math.floor(seconds/3600),Math.floor(seconds/60)%60,seconds%60].map(part=>String(part).padStart(2,'0')).join(':');
}

export function patrolClockState(patrol={}) {
  const elapsed=Math.max(0,Math.floor((Number(patrol.storedMinutes)||0)*60+1e-7));
  const threshold=Number(patrol.claimThresholdSeconds??patrol.intervalSeconds??600);
  const cap=Number(patrol.capHours??8)*3600;
  if(!patrol.unlocked)return {status:'locked',home:patrol.lockReason||'未开启',label:'巡逻时间',time:'—'};
  if(patrol.clockRollback)return {status:'error',home:'时间异常',label:'巡逻时间',time:'—'};
  if(patrol.nativeSettlementPending)return {status:'unavailable',home:'暂不可领取',label:'巡逻时间',time:'—'};
  if(elapsed>=cap)return {status:'full',home:'收益已满',label:'巡逻时间',time:formatPatrolDuration(cap)};
  if(elapsed<threshold){
    const time=formatPatrolDuration(threshold-elapsed);
    return {status:'waiting',home:time,label:'下次收益',time};
  }
  return {status:'ready',home:'可领取',label:'巡逻时间',time:formatPatrolDuration(elapsed)};
}

export function refreshPatrolClocks(root,snapshot) {
  const clock=patrolClockState(snapshot.patrol);
  for(const node of root.querySelectorAll('[data-patrol-clock]')){
    const text=clock[node.dataset.patrolClock];
    if(node.textContent!==text)node.textContent=text;
    node.dataset.patrolStatus=clock.status;
  }
}

export function patrolRenderSignature(snapshot) {
  const patrol={...snapshot.patrol};delete patrol.storedMinutes;
  return JSON.stringify({...snapshot,patrol,patrolClockStatus:patrolClockState(snapshot.patrol).status});
}

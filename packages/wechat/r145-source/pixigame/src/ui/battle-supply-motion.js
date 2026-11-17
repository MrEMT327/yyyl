// Presentation only: the reward is still selected by planBattleSupply.
export const SUPPLY_RING = [
  [0,0],[1,0],[2,0],[3,0],[4,0],[4,1],[4,2],[4,3],
  [4,4],[3,4],[2,4],[1,4],[0,4],[0,3],[0,2],[0,1],
];
export function supplyLanding(supply) {
  const matches=SUPPLY_RING.map((_,i)=>i).filter(i=>i%supply.slots.length===supply.winnerIndex);
  // Vary the matching presentation cell, never reroll the actual reward.
  let hash=0;
  for(const char of supply.chestId||'')hash=(hash*31+char.charCodeAt(0))>>>0;
  return matches[hash%matches.length];
}
const schedules=new Map();
function stepSchedule(steps){
  if(schedules.has(steps))return schedules.get(steps);
  const tail=[.19,.27,.37,.48],intervals=Array.from({length:steps},(_,i)=>{
    if(i>=steps-4)return tail[i-(steps-4)];
    const t=i/Math.max(1,steps-5);
    if(t<.18)return .13-(.13-.045)*t/.18;
    if(t<.65)return .045;
    return .045+.11*((t-.65)/.35)**2;
  });
  const total=intervals.reduce((a,b)=>a+b,0);let elapsed=0;
  const times=intervals.map(interval=>(elapsed+=interval)/total);times[times.length-1]=1;
  schedules.set(steps,times);return times;
}
export function supplyMotion(supply, now) {
  const target = supplyLanding(supply);
  if (supply.phase !== 'rolling') return {index:supply.phase === 'ready' ? target : -1, step:-1};
  const t = Math.max(0,Math.min(1,(now-supply.startedAt)/supply.durationMs));
  const steps=48+target,schedule=stepSchedule(steps);
  let step=0;while(step<steps&&t>=schedule[step])step++;
  return {index:step%16,step,tail:step>=steps-4};
}

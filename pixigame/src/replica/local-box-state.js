import { LOCAL_ECONOMY_POLICY, economyTime } from './local-economy-policy.js';

export function localBoxState(raw, time) {
  economyTime(time);
  if (raw === undefined) return {version:1,lastSeen:time,boxes:Object.fromEntries([3,4].map(id=>[id,{nextFreeAt:0,qualityMisses:0,sMisses:0}]))};
  const state=structuredClone(raw);
  if(state.version!==1||!Number.isSafeInteger(state.lastSeen)||state.lastSeen<0||!state.boxes)throw Error('本地宝箱记录无效，旧记录未覆盖');
  for(const id of [3,4]){
    const row=state.boxes[id];
    if(!row||['nextFreeAt','qualityMisses','sMisses'].some(key=>!Number.isSafeInteger(row[key])||row[key]<0))
      throw Error('本地宝箱计数无效，旧记录未覆盖');
  }
  return state;
}

export function localBoxSnapshot(gear, time=Date.now()) {
  const state=localBoxState(gear?.localBoxState,time),clockBlocked=time<state.lastSeen;
  return Object.fromEntries([3,4].map(id=>{
    const row=state.boxes[id];
    return [id,{...row,ruleSource:'local-equipment-box-v1',nativePityKnown:false,nativeFreeScheduleKnown:false,clockBlocked,freeAvailable:!clockBlocked&&time>=row.nextFreeAt,
      freeHours:LOCAL_ECONOMY_POLICY.boxFreeHours[id],
      qualityRemaining:Math.max(1,LOCAL_ECONOMY_POLICY.boxQualityPity[id]-row.qualityMisses),
      sRemaining:id===3?Math.max(1,LOCAL_ECONOMY_POLICY.advancedSPity-row.sMisses):null,
      label:LOCAL_ECONOMY_POLICY.label}];
  }));
}

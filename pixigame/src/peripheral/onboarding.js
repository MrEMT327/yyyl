// Native guide groups. This state records teaching, never grants rewards or unlocks.
export const GUIDE_GROUPS = Object.freeze([1, 4, 6, 8, 9, 14]);
export function normalizeOnboarding(value, legacy = {}) {
  if (value?.version === 1) return {version:1, completed:[...new Set((value.completed || []).filter(id=>GUIDE_GROUPS.includes(id)))]};
  const completed=[];
  const runs=(legacy.replicaResults||[]).filter(r=>!r.trial);
  if(runs.some(r=>r.clock>0)||legacy.replicaCampaign?.highestCleared>=0)completed.push(1);
  if(runs.some(r=>r.level>1)||legacy.replicaCampaign?.highestCleared>=0)completed.push(4);
  if(legacy.research?.aceDraws>0)completed.push(6);
  if(legacy.equipment?.draws>0)completed.push(8);
  const items=legacy.equipment?.items||[];
  if(items.some(i=>i.equipped))completed.push(9);
  if(items.some(i=>i.level>1))completed.push(14);
  return {version:1,completed};
}
export function completeGuide(value, id) {
  const state=normalizeOnboarding(value);
  if(GUIDE_GROUPS.includes(id)&&!state.completed.includes(id))state.completed.push(id);
  return state;
}
export function guideFinished(s,id){return s.onboarding?.completed?.includes(id)===true;}
export function reachedGuideProgress(campaign={}, chapter, wave=0) {
  // Only contiguous clears advance the native current chapter. Debug access
  // and the currently selected chapter are not progression evidence.
  const cleared=new Set(campaign.clearedChapterIds||[]);
  let current=1;while(cleared.has(current))current++;
  return current>chapter||current===chapter&&Number(campaign.passedWaves?.[chapter]||0)>=wave;
}
export function battleOnboarding(s,chapterId,trial=false){
  return {movement:!trial&&chapterId===1&&!guideFinished(s,1),firstChoice:!trial&&!guideFinished(s,4)};
}
export function nextLobbyGuide(s, dismissed=[]) {
  if(!s.onboarding||s.rewardBusy||s.rewardPending)return null;
  const pending=id=>!guideFinished(s,id)&&!dismissed.includes(id);
  if(pending(6)&&s.research?.canAce)return {group:6};
  const gearOpen=reachedGuideProgress(s.replicaCampaign,2);
  const items=s.equipment?.items||[];
  const wearable=items.find(i=>!i.equipped&&!s.equipment?.slots?.[i.type])||items.find(i=>!i.equipped);
  if(pending(9)&&gearOpen&&wearable)return {group:9,uid:wearable.uid};
  const box=s.nativeAcquisition?.equipmentBoxes?.find(b=>b.id===4);
  if(pending(8)&&reachedGuideProgress(s.replicaCampaign,2,4)&&box?.quotes?.some(q=>q.count===1&&q.canDraw))return {group:8,pool:'basic'};
  const upgrade=items.find(i=>i.equipped&&i.canUpgrade);
  if(pending(14)&&gearOpen&&upgrade)return {group:14,uid:upgrade.uid};
  return null;
}

// Draft selections never mutate inventory. The equipment service validates the
// same revision and material identities again when the player confirms.
export const emptyGearMerge = revision => ({revision,targetId:null,materialIds:[],tokens:0});
export function gearMergeDraft(gear,selection){
  const draft=selection||emptyGearMerge(gear.revision),target=gear.items.find(i=>i.uid===draft.targetId);
  const option=target?.merge,stale=draft.revision!==gear.revision;
  const materialIds=(draft.materialIds||[]).filter(id=>option?.candidates.includes(id));
  const tokens=Math.min(draft.tokens||0,option?.tokens||0);
  return {target,option,materialIds,tokens,stale,
    ready:!stale&&Boolean(option?.required)&&materialIds.length+tokens===option.required};
}
export function pickGearMergeItem(gear,selection,id){
  let draft=selection?.revision===gear.revision?structuredClone(selection):emptyGearMerge(gear.revision);
  const item=gear.items.find(i=>i.uid===id);if(!item)return {selection:draft,message:'装备已变化，请重新选择'};
  if(draft.targetId===id)return {selection:emptyGearMerge(gear.revision)};
  if(draft.materialIds.includes(id))return {selection:{...draft,materialIds:draft.materialIds.filter(uid=>uid!==id)}};
  if(!draft.targetId)return {selection:{...draft,targetId:id}};
  const {option}=gearMergeDraft(gear,draft);
  if(!option?.candidates.includes(id))return {selection:draft,message:'该装备不符合材料要求'};
  if(draft.materialIds.length+draft.tokens>=option.required)return {selection:draft,message:'材料已选满'};
  return {selection:{...draft,materialIds:[...draft.materialIds,id]},...(option.any&&option.protectedIds?.includes(id)?{message:'已选同名保留件；确认后会消耗，降阶仅返通用材料。'}:{})};
}
export function removeGearMergeMaterial(gear,selection,index){
  if(index===0||selection?.revision!==gear.revision)return emptyGearMerge(gear.revision);
  const next=structuredClone(selection),material=index-1;
  if(material<next.materialIds.length)next.materialIds.splice(material,1);
  else next.tokens=Math.max(0,next.tokens-1);
  return next;
}

// Presentation records are derived from committed snapshots only. They never
// grant, consume or equip anything, including when skipped or shown again.
const kinds=['guns','skins','pilots'];
const labels={guns:'武器',skins:'战机',pilots:'驾驶员'};
const clone=value=>value==null?value:structuredClone(value);
export const feedbackKindLabel=kind=>labels[kind]||'';
export function collectionFeedbackRecords(before,after,{includePilots=true,stars=true}={}) {
  const records=[];
  for(const kind of kinds){
    if(kind==='pilots'&&!includePilots)continue;
    const previous=new Map((before?.replicaCollection?.[kind]||[]).map(row=>[Number(row.id),row]));
    for(const row of after?.replicaCollection?.[kind]||[]){
      const old=previous.get(Number(row.id));
      if(!old||!row.owned)continue;
      if(!old.owned)records.push({type:'collection',operation:'unlock',kind,id:row.id,before:clone(old),after:clone(row)});
      else if(stars&&Number(row.star)>Number(old.star))records.push({type:'collection',operation:'star',kind,id:row.id,before:clone(old),after:clone(row)});
    }
  }
  return records;
}
export function gearMergeFeedbackRecord(before,after,action,result) {
  if(!result?.ok||!['gearMerge','gearBatch'].includes(action))return null;
  const oldItems=new Map((before?.equipment?.items||[]).map(row=>[row.uid,row]));
  const results=(after?.equipment?.items||[]).flatMap(row=>{
    const old=oldItems.get(row.uid);
    return old&&Number(row.quality)>Number(old.quality)?[{before:clone(old),after:clone(row)}]:[];
  });
  if(!results.length)return null;
  const remaining=new Set((after?.equipment?.items||[]).map(row=>row.uid));
  return {type:action==='gearBatch'?'mergeBatch':'merge',results,materials:clone((before?.equipment?.items||[]).filter(row=>!remaining.has(row.uid)))};
}
export function progressionFeedbackRecords(before,after) {
  if(!before)return [];
  const records=[],from=Number(before.accountExperience?.level),to=Number(after?.accountExperience?.level);
  if(Number.isSafeInteger(from)&&Number.isSafeInteger(to)&&from>=1&&to>from)records.push({type:'level',from,to});
  // Use the actual unlocked flag, rather than duplicating a chapter threshold.
  if(before.patrol?.unlocked===false&&after?.patrol?.unlocked===true)records.push({type:'feature',feature:'patrol',name:'巡逻',description:'离线获得资源'});
  return records;
}
export function committedFeedbackRecords({before,after,action,payload={},result}) {
  if(!result?.ok||['gearPreview','onboardingComplete','fleetRecruitSeen'].includes(action))return [];
  const isRecruit=action==='recruit'||result.recruitPool==='pilot'||Boolean(result.recruitToken);
  // The approved recruitment card/NEW reveal already presents pilot unlocks.
  const collection=collectionFeedbackRecords(before,after,{includePilots:!isRecruit,stars:!isRecruit});
  const merge=gearMergeFeedbackRecord(before,after,action,result);
  return [...collection,...(merge?[merge]:[]),...progressionFeedbackRecords(before,after)];
}
export function feedbackAttributes(record,attributeNames={}) {
  const parse=stage=>new Map((stage?.attributes||[]).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),Number(line.slice(at+1))];}));
  const from=parse(record.before?.stage),to=parse(record.after?.stage);
  return [...to].filter(([,value])=>Number.isFinite(value)).map(([key,value])=>({key,label:attributeNames[key]||key,from:from.get(key),to:value,suffix:key.endsWith('%')?'%':''}));
}
export function feedbackSkills(record) {
  const previous=record.before?.stage?.skills||[];
  // The weapon's initial-carry passive and base attack share the same name.
  // On star-up show only changed text; unlock shows one base attack per name.
  const changed=(record.after?.stage?.skills||[]).filter(skill=>record.operation!=='star'||!previous.some(old=>old.id===skill.id&&old.description===skill.description));
  const seen=new Set();
  return changed.filter(skill=>{if(seen.has(skill.name))return false;seen.add(skill.name);return true;});
}
export const cleanFeedbackText=value=>String(value??'').replace(/<[^>]*>/g,'').replace(/^[^·]{1,4}\s*·\s*/, '');
export function mergeFeedbackFeatures(pair) {
  const prior=new Set((pair.before.features||[]).map(row=>row.key+':'+row.text));
  return (pair.after.features||[]).filter(row=>!prior.has(row.key+':'+row.text)).map(row=>cleanFeedbackText(row.text));
}

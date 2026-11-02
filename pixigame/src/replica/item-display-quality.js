import catalog from './native-economy-catalog.json' with {type:'json'};
import acquisition from './native-acquisition-catalog.json' with {type:'json'};
import equipment from '../peripheral/equipment-reference-data.json' with {type:'json'};
import {NATIVE_AIRCRAFT_SKINS} from './native-aircraft-skins.js';
import {NATIVE_PILOT_SKINS} from './native-pilot-roster.js';

export const ITEM_QUALITY_TIERS=Object.freeze([
  ['普通','gray'],['优秀','green'],['精良','blue'],['史诗','purple'],['传说','gold'],['神话','red'],
].map(([name,color],rank)=>Object.freeze({rank,name,color})));
const units=new Map([...catalog.guns,...catalog.skins,...catalog.pilots].map(row=>[row.id,row]));
const items=new Map(acquisition.items.map(row=>[row.id,row]));
const drops=new Map(acquisition.drops.map(row=>[row.drop_id,row]));
const gear=new Map(equipment.equip.map(row=>[row.ID,row]));
const planes=new Map(Object.entries(NATIVE_AIRCRAFT_SKINS).map(([id,appearance])=>[appearance,Number(id)]));
const pilots=new Map(Object.entries(NATIVE_PILOT_SKINS).map(([id,appearance])=>[appearance,Number(id)]));
const resourceIds={coins:1,coin:1,diamonds:2,diamond:2,stamina:4,energy:4,cores:135,core:135,experience:3};
const legacyResources={weaponParts:2,aircraftShards:2,pilotCredits:3};
const positiveId=value=>/^\d+$/.test(String(value))&&Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):null;
const rankValue=value=>['number','string'].includes(typeof value)&&String(value)!==''&&Number.isInteger(Number(value))&&Number(value)>=0&&Number(value)<=5?Number(value):null;
const tier=(rank,extra={})=>({qualityRank:rank,qualityName:ITEM_QUALITY_TIERS[rank].name,qualityKnown:true,...extra});

// Identity precedes appearance: pilot-01 is both a pilot and an aircraft art
// key. Native receipt IDs are authoritative and must not be discarded.
export function rewardNativeItemId(reward={}) {
  for(const id of [reward.nativeItemId,reward.nativeId,reward.nativeRow?.id]){const value=positiveId(id);if(value)return value;}
  const id=reward.id??reward.itemId,type=reward.type||reward.kind;
  if(Object.hasOwn(resourceIds,type))return resourceIds[type];
  if(type==='gearKey')return reward.pool==='basic'?113:reward.pool==='advanced'?112:null;
  if(type==='gearBlueprint')return ({1:105,2:106,3:107,4:109,5:108})[Number(reward.gearType)]||null;
  const numeric=positiveId(id);if(numeric)return numeric;
  if(type==='pilot'||type==='pilots')return pilots.get(id)||null;
  if(type==='aircraft'||type==='skins')return planes.get(id)||null;
  return null;
}
export function nativeItemDisplayQuality(id) {
  id=Number(id);
  const equipped=gear.get(id);
  if(equipped){const rank=Math.floor(equipped.quality/10)-1,bonus=equipped.quality%10;return tier(rank,{source:'equipment',quality:equipped.quality,qualityName:ITEM_QUALITY_TIERS[rank].name+(bonus?'+'+bonus:'')});}
  const row=units.get(id)||items.get(id)||drops.get(id);
  const quality=id===3132505?50:row?.quality;
  if(![10,20,30,40,50,60].includes(quality))return null;
  return tier(quality/10-1,{source:units.has(id)?'collection':drops.has(id)?'drop-group':'item',quality});
}
export function rewardDisplayQuality(reward={},presentation={},known={}) {
  const type=reward.type||reward.kind,explicit=rankValue(reward.qualityRank);
  // A committed gear receipt must keep its awarded tier after that equipment
  // is merged/upgraded in the warehouse. Collection units have fixed tiers.
  if(['gear','equipment'].includes(type)&&explicit!==null)return tier(explicit,{source:'receipt',qualityName:reward.qualityName||ITEM_QUALITY_TIERS[explicit].name});
  const canonical=nativeItemDisplayQuality(rewardNativeItemId(reward));
  if(canonical)return canonical;
  if(Object.hasOwn(legacyResources,type))return tier(legacyResources[type],{source:'project-resource'});
  for(const [value,source]of [[presentation.qualityRank,'presentation'],[explicit,'receipt'],[known.qualityRank,'legacy-item']]){
    const rank=rankValue(value);if(rank!==null)return tier(rank,{source,qualityName:presentation.qualityName||reward.qualityName||ITEM_QUALITY_TIERS[rank].name});
  }
  return {qualityRank:0,qualityName:'未标注',qualityKnown:false,source:'unspecified'};
}

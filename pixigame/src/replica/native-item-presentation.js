import { nativePilotFragment, nativePilotFragmentName } from './native-pilot-fragments.js';
import { MATERIAL_REPLACEMENTS } from './native-material-replacements.js';
import { projectItemIcon } from '../ui/project-item-icons.js';
import { RESOURCE_ICONS } from '../ui/resource-icons.js';
import { GEAR_PARTS } from '../peripheral/equipment-system.js';
import catalog from './native-economy-catalog.json' with {type:'json'};
import acquisition from './native-acquisition-catalog.json' with {type:'json'};
import { nativeCollectionDisplayName } from './native-collection-names.js';
import { nativeCollectionArt } from './native-collection-art.js';
import { collectionQualityRank } from './native-quality.js';
import { nativeGearPresentation, nativeItemDisplayName } from './native-item-names.js';
import { equipmentBlueprintArtPath, equipmentArtPath, equipmentArtFamily } from './equipment-art.js';
import { researchBlueprintArt } from './research-blueprint-art.js';
const base=import.meta.env?.BASE_URL||'/';
const units=new Map([...catalog.guns,...catalog.skins,...catalog.pilots].map(row=>[row.id,row]));
const items=new Map(acquisition.items.map(row=>[row.id,row]));
export function nativeItemArt(id) {
  const money=({1:'coins',2:'diamonds',4:'stamina',135:'cores'})[id];
  if(money)return RESOURCE_ICONS[money].url;
  const supply=projectItemIcon(id);
  if(supply)return supply;
  const part=GEAR_PARTS.find(part=>part.blueprintId===Number(id));
  if(part)return base+equipmentBlueprintArtPath(part.id);
  const research=researchBlueprintArt(id);
  if(research)return research;
  const gear=nativeGearPresentation(id);
  if(gear)return base+equipmentArtPath(gear.art);
  const fragment=nativePilotFragment(id),unit=units.get(fragment?.pilotId??Number(id));
  if(unit)return nativeCollectionArt(unit);
  return null;
}

export function nativeItemPresentation(id) {
  id=Number(id);
  const unit=units.get(id),gear=nativeGearPresentation(id),part=GEAR_PARTS.find(row=>row.blueprintId===id);
  const fragment=nativePilotFragment(id);
  const name=nativeItemDisplayName(id)||nativePilotFragmentName(id)||nativeCollectionDisplayName(id)||unit?.name||catalog.itemNames[id]||items.get(id)?.note;
  const researchBlueprint=id>=801&&id<=811;
  const replacement=MATERIAL_REPLACEMENTS[id];
  const description=replacement?`可在背包按1:1兑换为${nativeItemDisplayName(replacement)||catalog.itemNames[replacement]||items.get(replacement)?.note||'当前可用材料'}。`
    :part?`用于强化${part.name}，与金币一同消耗。`
    :researchBlueprint?'用于对应科研升级，与金币一同消耗。可通过巡逻、快速巡逻、章节奖励与每日商店获得。'
    :id===112?'开启高级装备箱时消耗。'
    :id===113?'开启普通装备箱时消耗。'
    :id===903?'在每日成长补给领取；开启时自选一种装备图纸。'
    :id===934?'通关第8章并完成每周5天满活跃，可在每周成长补给领取；开启时自选一件史诗装备。'
    :fragment?`${fragment.cost}个碎片合成对应驾驶员同名卡；每日和每周成长补给可定向选择已拥有、未满星驾驶员的碎片。`
    :id===925?'在背包中开启，获得驾驶员或同名卡。'
    :id===926?'50 个碎片合成 1 个角色箱。'
    :unit?catalog.guns.some(row=>row.id===id)?'高级装备箱随机获得；首次解锁武器，重复获得用于升星。':catalog.pilots.some(row=>row.id===id)?'用于对应驾驶员激活或升星；满星后库存同名卡可在背包转换积分。':catalog.skins.some(row=>row.id===id&&!row.closed)?'高级装备箱随机获得；首次解锁飞机，重复获得同名卡用于升星。':'用于对应收藏的激活或升星。':undefined;
  return {name,image:nativeItemArt(id),pilotFragment:Boolean(fragment),qualityRank:unit?collectionQualityRank(unit.quality):gear?.qualityRank??(items.has(id)?collectionQualityRank(items.get(id).quality):undefined),qualityName:gear?.qualityName,description};
}

// Resolve persisted receipts by canonical ID, without changing their quantities.
export function nativeRewardPresentation(reward) {
  const type=reward.type||reward.kind;
  if(type==='gear'||type==='equipment') {
    const id=reward.nativeItemId??reward.nativeId??reward.id;
    if(nativeGearPresentation(id))return nativeItemPresentation(id);
    const family=equipmentArtFamily(reward.family)??equipmentArtFamily(reward.art)??equipmentArtFamily(reward.image);
    const gear=family==null?null:nativeGearPresentation(family+10);
    if(gear)return {name:gear.name,image:base+equipmentArtPath(family)};
  }
  const id=reward.nativeItemId??(type==='gearKey'?(reward.pool==='basic'?113:reward.pool==='advanced'?112:null)
    :type==='gearBlueprint'?GEAR_PARTS.find(part=>part.type===Number(reward.gearType))?.blueprintId
    :!type||['nativeItem','native-item','item','aircraft','pilot','weapon','guns','skins','pilots'].includes(type)?reward.id??reward.itemId:null);
  return /^\d+$/.test(String(id))?nativeItemPresentation(id):{};
}

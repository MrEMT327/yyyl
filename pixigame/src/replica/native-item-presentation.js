import { nativePilotFragment, nativePilotFragmentName } from './native-pilot-fragments.js';
import { MATERIAL_REPLACEMENTS } from './native-material-replacements.js';
import { projectItemIcon } from '../ui/project-item-icons.js';
import { RESOURCE_ICONS } from '../ui/resource-icons.js';
import { GEAR_PARTS } from '../peripheral/equipment-system.js';
import catalog from './native-economy-catalog.json' with {type:'json'};
import acquisition from './native-acquisition-catalog.json' with {type:'json'};
import { nativeCollectionDisplayName } from './native-collection-names.js';
import { nativeCollectionArt } from './native-collection-art.js';
import { nativeItemDisplayQuality, rewardNativeItemId } from './item-display-quality.js';
import { nativeGearPresentation, nativeItemDisplayName } from './native-item-names.js';
import { equipmentBlueprintArtPath, equipmentArtPath, equipmentArtFamily } from './equipment-art.js';
import { researchBlueprintArt } from './research-blueprint-art.js';
const base=import.meta.env?.BASE_URL||'/';
const units=new Map([...catalog.guns,...catalog.skins,...catalog.pilots].map(row=>[row.id,row]));
const items=new Map(acquisition.items.map(row=>[row.id,row]));
export function nativeItemArt(id) {
  const group=({10010007:'equipment-blueprints',10010008:'research-blueprints'})[id];
  if(group)return base+'art/project-material-groups-v1/'+group+'.svg';
  const signin=({111:'quantum-key',3132505:'epic-glove-chip'})[id];
  if(signin)return `${base}art/project-signin-icons-v1/${signin}.png`;
  if(Number(id)===110)return projectItemIcon(113);
  if(Number(id)===129)return RESOURCE_ICONS.weaponParts.url;
  if(Number(id)===151)return `${base}art/project-ui-icons-v1/skill-drone.png`;
  if(Number(id)===153)return `${base}art/weapon-drones-v1/drone-parts-v1.png`;
  if([10010007,10010008].includes(Number(id)))return projectItemIcon(903);
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
  const displayQuality=nativeItemDisplayQuality(id);
  const replacement=MATERIAL_REPLACEMENTS[id];
  const description=id===3132505?'旧签到遗留芯片，已停用并从库存清理。':replacement?`可在背包按1:1兑换为${nativeCollectionDisplayName(replacement)||catalog.itemNames[replacement]||items.get(replacement)?.note||'当前可用材料'}。`
    :part?`用于强化${part.name}，与金币一同消耗。`
    :id===10010007?'随机获得五种装备部位图纸中的一种。'
    :id===10010008?'随机获得十一种科研图纸中的一种。'
    :researchBlueprint?'用于对应科研升级，与金币一同消耗。可通过巡逻、快速巡逻、章节奖励与每日商店获得。'
    :id===112?'开启高级装备箱时消耗。'
    :id===113?'开启普通装备箱时消耗。'
    :id===903?'在每日成长补给领取；开启时自选一种装备图纸。'
    :id===934?'通关第8章并完成每周5天满活跃，可在每周成长补给领取；开启时自选一件史诗装备。'
    :fragment?'旧版驾驶员材料已停用，重新进入游戏后自动折算为同名卡和钻石。'
    :id===925?'在背包中开启，获得驾驶员或同名卡。'
    :id===926?'50 个碎片合成 1 个角色箱。'
    :unit?catalog.guns.some(row=>row.id===id)?'高级装备箱随机获得；首次解锁武器，重复获得用于升星。':catalog.pilots.some(row=>row.id===id)?'用于对应驾驶员激活或升星；满星后库存同名卡可在背包转换积分。':catalog.skins.some(row=>row.id===id&&!row.closed)?'高级装备箱随机获得；首次解锁飞机，重复获得同名卡用于升星。':'用于对应收藏的激活或升星。':undefined;
  return {nativeItemId:id,name,image:nativeItemArt(id),pilotFragment:Boolean(fragment),qualityRank:displayQuality?.qualityRank,qualityName:gear?.qualityName||displayQuality?.qualityName,qualityKnown:Boolean(displayQuality),description};
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
  const id=rewardNativeItemId(reward);
  if(id)return nativeItemPresentation(id);
  const resource=RESOURCE_ICONS[type];
  return resource?{name:({weaponParts:'武器零件',aircraftShards:'通用飞机碎片'})[type],image:resource.url}:{};
}

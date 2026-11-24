import { itemDescriptionModel } from './item-description-model.js';
import { nativeItemPresentation } from '../replica/native-item-presentation.js';
import { rewardDisplayQuality } from '../replica/item-display-quality.js';
import { nativePilotFragment } from '../replica/native-pilot-fragments.js';

export const BACKPACK_TABS = Object.freeze([
  { id: 'all', label: '道具' },
]);

const quantity = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
export const exactCount = value => quantity(value).toLocaleString('zh-CN', {useGrouping:false});
export const itemQuality = item => Number.isInteger(item.qualityRank) && item.qualityRank >= 0 && item.qualityRank <= 5 ? item.qualityRank : 0;
const resourceQuality = id => rewardDisplayQuality({type:id}).qualityRank;
// A read-only projection of canonical balances: no placeholder items or grants.
export function backpackItems(snapshot) {
  const wallet = snapshot.wallet || {};
  if(snapshot.nativeAcquisition) {
    const rows=snapshot.nativeAcquisition.materials.filter(row=>![1,2,4].includes(Number(row.id))&&!nativePilotFragment(row.id)).map(row=>{
      const presentation=nativeItemPresentation(row.id);
      return {
        id:'native:'+row.id,nativeId:row.id,name:presentation.name||row.name,count:row.count,
        category:'materials',image:presentation.image,pilotFragment:presentation.pilotFragment,
        qualityRank:presentation.qualityRank??row.qualityRank??0,
        qualityName:presentation.qualityName,qualityKnown:presentation.qualityKnown,
        description:itemDescriptionModel({nativeItemId:row.id},snapshot).description,
      };
    });
    return rows;
  }
  const materials = [
    { id: 'aircraftShards', name: '通用飞机碎片', symbol: 'shard', description: '在装备界面强化战机，提升攻击与耐久。' },
    { id: 'weaponParts', name: '武器零件', symbol: 'parts', description: '在改装间强化武器，或补足升星所缺的专属碎片。' },
    { id: 'cores', name: '科技星核', symbol: 'core', description: '在天赋界面进行王牌觉醒。' },
  ].map(item => ({ ...item, category: 'materials', count: quantity(wallet[item.id]),qualityRank:resourceQuality(item.id) }));
  const fragments = (snapshot.workshop?.items || []).map(item => ({
    id: `fragment:${item.id}`, name: `${item.name}碎片`, category: 'materials',
    count: quantity(item.fragments), weaponId: item.id,qualityRank:itemQuality(item),
    qualityKnown:Number.isInteger(item.qualityRank)&&item.qualityRank>=0&&item.qualityRank<=5,
    description: `用于【${item.name}】升星，优先于通用零件消耗。`,
  }));
  return [...materials, ...fragments].filter(item => item.count > 0);
}

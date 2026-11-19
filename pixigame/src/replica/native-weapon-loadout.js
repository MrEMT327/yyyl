import catalog from './native-economy-catalog.json' with {type:'json'};
import {validateWeaponSkillSlots} from './native-weapon-skill-slots.js';

export const nativeWeaponType=id=>catalog.guns.find(row=>row.id===id)?.weaponType||0;
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);

/** Single canonical adapter for lobby, persistence and battle admission.
 * PlayerData.Level is separate from Role.Level and never changes combat stats.
 * Legacy global slots are archived, then partitioned into native weapon types.
 * Local migration/default policy is explicit; server default-fill was not captured. */
export function normalizeNativeWeaponLoadout(value,guns) {
  const playerLevel=value.playerLevel??1;
  if(!Number.isSafeInteger(playerLevel)||playerLevel<1)throw Error('账号等级无效');
  let useWeaponMap=value.useWeaponMap;
  if(useWeaponMap===undefined){
    const selected=guns.filter(row=>row.equipped);
    if(selected.length!==1)throw Error('旧武器出战记录必须包含一把主武器');
    useWeaponMap={0:selected[0].id,1:0};
  }
  if(!record(useWeaponMap)||Object.keys(useWeaponMap).some(key=>!['0','1'].includes(key)))throw Error('武器出战槽无效');
  const mainWeaponId=useWeaponMap[0];
  if(!Number.isSafeInteger(mainWeaponId)||!guns.some(row=>row.id===mainWeaponId&&row.active))throw Error('出战武器未激活');
  // Keep the old save shape and clear its second slot without touching ownership.
  const deployed={0:mainWeaponId,1:0};
  const weaponSkillMap={};
  if(value.weaponSkillMap!==undefined){
    if(!record(value.weaponSkillMap))throw Error('武器技能配置无效');
    for(const [type,slots] of Object.entries(value.weaponSkillMap)){
      const id=Number(type);
      if(String(id)!==type||!catalog.guns.some(row=>row.weaponType===id))throw Error('武器技能类型无效');
      weaponSkillMap[type]=validateWeaponSkillSlots(slots,guns,nativeWeaponType,id);
    }
  }
  let weaponSkillMigration=value.weaponSkillMigration;
  if(value.weaponSkillMap===undefined&&value.weaponSkillSlots!==undefined){
    const legacy=value.weaponSkillSlots;
    if(!Array.isArray(legacy)||legacy.length!==2||legacy.some(id=>id!==0&&(!Number.isSafeInteger(id)||!guns.some(row=>row.id===id&&row.active))))
      throw Error('旧武器技能记录无效');
    weaponSkillMigration={version:1,legacySlots:legacy.slice()};
    for(const id of legacy){
      if(!id)continue;
      const type=nativeWeaponType(id),slots=weaponSkillMap[type]||=[0,0];
      if(!slots.includes(id)){const index=slots.indexOf(0);if(index>=0)slots[index]=id;}
    }
  }
  // New families start with an OWNED source only. Explicit empty configurations
  // remain empty, so removing a skill cannot silently restore it next load.
  for(const gun of guns.filter(row=>row.active)){
    const type=nativeWeaponType(gun.id);
    if(!type)throw Error('武器类型缺失');
    if(!Object.hasOwn(weaponSkillMap,type)){
      const base=guns.find(row=>row.active&&nativeWeaponType(row.id)===type&&catalog.guns.find(item=>item.id===row.id)?.skinNumber===0);
      weaponSkillMap[type]=[base?.id||gun.id,0];
    }
  }
  if(weaponSkillMigration!==undefined){
    if(weaponSkillMigration?.version!==1||!Array.isArray(weaponSkillMigration.legacySlots)||weaponSkillMigration.legacySlots.length!==2
      ||weaponSkillMigration.legacySlots.some(id=>!Number.isSafeInteger(id)||id<0))throw Error('旧技能迁移记录无效');
    weaponSkillMigration={version:1,legacySlots:weaponSkillMigration.legacySlots.slice()};
  }
  return {playerLevel,useWeaponMap:deployed,weaponSkillMap,...(weaponSkillMigration?{weaponSkillMigration}:{})};
}

/** Only the equipped weapon's type supplies star skills to a sortie. */
export function battleWeaponSkillSources(value,guns){
  const loadout=normalizeNativeWeaponLoadout(value,guns);
  const type=nativeWeaponType(loadout.useWeaponMap[0]);
  return (loadout.weaponSkillMap[type]||[]).filter(Boolean);
}

export function selectNativeWeapon(value,id,slot){
  if(slot!==undefined&&slot!==0)throw Error('只能携带一把出战武器');
  if(!value.guns.some(row=>row.id===id&&row.active))throw Error('原版武器尚未拥有');
  return {0:id,1:0};
}

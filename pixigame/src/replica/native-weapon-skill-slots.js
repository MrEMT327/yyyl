/** Native WeaponSkillSourceData: two source IDs belonging to ONE weapon type.
 * Empty slots are valid, including slot zero. Sources are unique by ID,
 * so a base weapon and its same-type variant can be equipped together. */
export function validateWeaponSkillSlots(raw,guns,typeOf,weaponType) {
  if(!Number.isSafeInteger(weaponType)||weaponType<=0||!Array.isArray(raw)||raw.length!==2)
    throw Error('武器类型或技能槽无效');
  const used=new Set();
  for(const id of raw){
    if(id===0)continue;
    if(!Number.isSafeInteger(id)||typeOf(id)!==weaponType||!guns.some(row=>row.id===id&&row.active)||used.has(id))
      throw Error('技能来源未激活、类型不符或重复装配');
    used.add(id);
  }
  return raw.slice();
}

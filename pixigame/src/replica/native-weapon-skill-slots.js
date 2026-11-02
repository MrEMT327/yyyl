export function validateWeaponSkillSlots(raw,guns,groupOf) {
  const slots=raw===undefined?[guns.find(row=>row.equipped)?.id||20101,0]:raw;
  if(!Array.isArray(slots)||slots.length!==2||slots[0]===0)throw Error('武器需要一个主技能和一个副技能槽');
  const used=new Set();
  for(const id of slots){
    if(id===0)continue;
    const group=groupOf(id);
    if(!Number.isSafeInteger(id)||!group||!guns.some(row=>row.id===id&&row.active)||used.has(group))throw Error('武器技能未激活或重复装配');
    used.add(group);
  }
  return slots.slice();
}

// Aircraft and pilots share selection rules; native transactions retain their own kind.
export function fleetSkillSelection({kind='pilot',bank,selectedSkillSlot,selectedSkillId,revision,helpers:h,skillIcon,button}) {
  const e=h.escape,owned=bank.skills.filter(skill=>skill.owned);
  const slot=Number.isInteger(selectedSkillSlot)&&selectedSkillSlot>=0&&selectedSkillSlot<bank.slots.length?selectedSkillSlot:null;
  const selected=owned.find(skill=>skill.id===selectedSkillId)||(slot!==null?owned.find(skill=>skill.id===bank.slots[slot]):null);
  const rich=text=>e(text||'').replace(/([+-]?\d+(?:\.\d+)?%)/g,'<strong>$1</strong>');
  const rows=owned.map(skill=>{
    const chosen=skill.id===selected?.id,installed=Number.isInteger(skill.slot)&&skill.slot>=0;
    const extra=`data-kind="${e(kind)}" data-id="${e(skill.id)}"`;
    return `<article class="pcs-row${chosen?' is-selected':''}" data-skill-id="${e(skill.id)}" data-skill-slot="${skill.slot}">
      <button type="button" class="pcs-preview" data-action="fleetSkillPreview" ${extra} aria-label="查看${e(skill.name)}技能预览">${skillIcon(skill)}</button>
      <button type="button" class="pcs-choice" data-action="fleetSkillChoose" ${extra} aria-pressed="${chosen}" aria-label="选择${e(skill.name)}">
        <span class="pcs-row-heading"><span class="pcs-name">${e(skill.name)}</span>${installed?'<span class="pcs-status">已装备</span>':''}</span>
        <span class="pcs-description">${rich(skill.description)}</span>
      </button>
    </article>`;
  }).join('');
  if(!owned.length)return {rows,action:'',slot};
  if(slot===null||!selected)return {rows,action:button('fleetSkillEquip','装备',
    `data-kind="${e(kind)}" data-id="${e(selected?.id||'')}" data-slot="${slot??''}" data-revision="${revision}" data-skill-ready="false"`,'pcs-submit',true),slot};
  const removing=selected.slot===slot;
  // Native UISkinSkillWearItem uses Equip / Unequip, not numbered operation copy.
  const label=removing?'卸下':'装备';
  const action=button(removing?'fleetSkillRemove':'fleetSkillEquip',label,
    `data-kind="${e(kind)}" data-id="${e(selected.id)}" data-slot="${slot}" data-revision="${revision}"`,'pcs-submit');
  return {rows,action,slot};
}
export const pilotSkillSelection=fleetSkillSelection;

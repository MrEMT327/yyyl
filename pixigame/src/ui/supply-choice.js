// Reuse the equipment picker's keyboard, focus, dismissal and change/value contract.
// The menu stays inside the modal flow so a long roster cannot escape its frame.
export function supplyChoice({id,label,attribute,rows,selected,disabled=false,status,image,count},h) {
  const e=h.escape,base=import.meta.env?.BASE_URL||'/';
  const art=row=>h.img(image?image(row):row.image,'','cs-choice-art');
  const copy=row=>`<span class="cs-choice-copy"><strong>${e(row.name)}</strong><small>${e(status(row))}</small></span>`;
  return `<div class="eq-choice cs-choice" data-choice-inline>
    <button type="button" class="eq-choice-trigger psd-button" ${attribute} value="${selected?.id??''}" aria-label="${e(label)}：${e(selected?.name||'暂无可选内容')}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${e(id)}" ${disabled?'disabled':''}>
      ${selected?art(selected)+copy(selected):'<span>暂无可选内容</span>'}<span class="cs-choice-tail">${count?`<b>×${h.number(count)}</b>`:''}<img class="eq-choice-chevron" src="${base}art/equipment-controls-v1/chevron-down.svg" alt=""></span>
    </button>
    <div class="eq-choice-menu cs-choice-menu" id="${e(id)}" role="listbox" aria-label="${e(label)}" hidden>
      ${rows.map(row=>`<button type="button" class="eq-choice-option psd-option" role="option" data-equipment-option="${row.id}" aria-label="${e(row.name)}，${e(status(row))}" aria-selected="${row.id===selected?.id}" tabindex="${row.id===selected?.id?'0':'-1'}" ${!row.selectable?'disabled':''}>${art(row)}${copy(row)}<span class="cs-choice-check" aria-hidden="true">✓</span></button>`).join('')}
    </div>
  </div>`;
}

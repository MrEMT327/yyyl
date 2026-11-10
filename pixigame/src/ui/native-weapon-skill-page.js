import {nativeWeaponElement} from '../replica/native-weapon-element.js';
import './weapon-skill-elements.css';
import './skill-element-backgrounds.css';
import {nativeWeaponGroupId} from '../replica/native-weapon-groups.js';
import {nativeCollectionArt} from '../replica/native-collection-art.js';
import {nativeWeaponSkillArt} from '../replica/native-weapon-skill-art.js';
import {emptySlotMark} from './psd-empty-slot.js';
import {projectIcon} from './project-ui-art.js';
import './native-weapon-skill-page.css';

const elementAttributes=(row,rows)=>{
  const element=nativeWeaponElement(row,rows);
  return element?`data-skill-element="${element.key}"`:'';
};

// Catalog shortcuts use the same saved skill slots and picker as the skill page.
export function nativeWeaponCatalogSlots(snapshot,selected,e){
  const c=snapshot.replicaCollection,slots=c.weaponSkillMap[selected.weaponType]||[0,0];
  return `<div class="wg-slots wg-catalog-slots" aria-label="${e(selected.name)}类型技能槽">${slots.map((id,index)=>{
    const row=c.guns.find(row=>row.id===id),url=row&&nativeWeaponSkillArt(row);
    return `<div class="wg-slot-wrap"><button type="button" class="wg-skill-slot" ${row?elementAttributes(row,c.guns):''} data-action="nativeWeaponSkillSlot" data-id="${selected.id}" data-slot="${index}" aria-label="技能位置${index+1}，${e(row?.name||'空闲')}"><b>${index+1}</b>${url?`<img class="weapon-skill-icon native-weapon-skill-icon" src="${e(url)}" alt="${e(row.name)}技能" draggable="false">`:emptySlotMark('wg-empty')}</button></div>`;
  }).join('')}</div>`;
}

export function nativeWeaponSkillPage({snapshot:s,selectedId,selectedSkillSlot=-1,helpers:h}) {
  const e=h.escape,c=s.replicaCollection,rows=c.guns;
  const selected=rows.find(row=>String(row.id)===String(selectedId))||rows.find(row=>row.id===c.useWeaponMap[0])||rows[0];
  const type=selected.weaponType,slots=c.weaponSkillMap[type]||[0,0];
  const slot=[0,1].includes(selectedSkillSlot)?selectedSkillSlot:-1;
  const bases=rows.filter(row=>nativeWeaponGroupId(row)===row.id);
  const sources=rows.filter(row=>row.weaponType===type&&row.owned&&row.stage.skills.length);
  const art=row=>{const url=row&&nativeWeaponSkillArt(row);return url?`<img class="weapon-skill-icon native-weapon-skill-icon" src="${e(url)}" alt="${e(row.name)}技能" draggable="false">`:'';};
  const plain=value=>String(value??'').replace(/<[^>]*>/g,'');
  const button=(action,label,attrs='',cls='')=>`<button type="button" class="wc-button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
  const operation=(id,index)=>`data-action="nativeWeaponSkillEquip" data-id="${id}" data-slot="${index}" data-weapon-type="${type}" data-revision="${c.revision}"`;
  const sourceList=()=>sources.length?`<div class="wg-source-list">${sources.map(row=>{
    // Native WeaponSkillItem offers takeoff for any fitted source, even when
    // the user is currently picking a different slot. It removes wearIndex.
    const fitted=slots.indexOf(row.id),skill=row.stage.skills.at(-1),remove=fitted>=0;
    return `<article class="wg-source-row${remove?' is-equipped':''}">
      <button type="button" class="wg-source-art" ${elementAttributes(row,c.guns)} data-action="nativeSkillPreview" data-kind="guns" data-id="${row.id}" aria-label="查看${e(row.name)}技能详情">${art(row)}${fitted>=0?`<b class="wg-equipped">${fitted+1}</b>`:''}</button>
      <div class="wg-source-copy"><h3>${e(plain(skill.name||row.name))}</h3><p>${e(plain(skill.description))}</p></div>
      <button type="button" class="wc-button wg-source-action" ${operation(remove?0:row.id,remove?fitted:slot)} aria-label="${remove?'卸下':'装备'}${e(row.name)}技能${remove?`（位置${fitted+1}）`:`至位置${slot+1}`}">${remove?'卸下':'装备'}</button>
    </article>`;
  }).join('')}</div>`:'<div class="wg-empty-state" role="status"><p>暂无可携带的技能</p></div>';
  return `<section class="ref-catalog ref-catalog-weapon wc-page wg-skill-page" data-catalog-kind="weapon" data-catalog-mode="skills" data-weapon-type="${type}" aria-label="武器技能">
    <div class="wc-hero"><h1 class="wc-page-title">技能</h1><button type="button" class="wg-weapon-art" data-action="nativeWeaponPreview" data-mode="base" data-id="${selected.id}" aria-label="查看${e(selected.name)}技能"><img src="${e(nativeCollectionArt(selected,'default'))}" alt="${e(selected.name)}" draggable="false"></button>
    <div class="wg-slots" aria-label="${e(selected.name)}类型技能槽">${slots.map((id,index)=>{const row=rows.find(row=>row.id===id);return `<div class="wg-slot-wrap"><button type="button" class="wg-skill-slot${slot===index?' is-selected':''}" ${row?elementAttributes(row,c.guns):''} data-action="nativeWeaponSkillSlot" data-id="${selected.id}" data-slot="${index}" aria-pressed="${slot===index}" aria-label="技能位置${index+1}，${e(row?.name||'空闲')}"><b>${index+1}</b>${row?art(row):emptySlotMark('wg-empty')}${slot===index?'<i class="fc-browse-corners" aria-hidden="true"></i>':''}</button></div>`;}).join('')}</div>
    </div><header class="wc-heading"><h2>技能列表</h2></header>
    <div class="wc-scroll wg-skill-scroll" data-catalog-scroll="weapon:skills:${type}:${slot<0?'types':'sources'}">${slot<0?`<div class="wc-grid wc-skill-grid">${bases.map(base=>`<button type="button" class="wc-skill${base.weaponType===type?' is-selected':''}" data-action="nativeWeaponSkillBrowse" data-id="${base.id}" aria-label="浏览${e(base.name)}类型技能"><span class="wc-skill-art" ${elementAttributes(base,c.guns)}>${art(base)}${base.weaponType===type?'<i class="fc-browse-corners" aria-hidden="true"></i>':''}</span><span class="wc-skill-name">${e(base.name)}</span></button>`).join('')}</div>`:sourceList()}</div>
    <nav class="wc-footer" aria-label="武器子页面">${button(slot<0?'catalogBack':'nativeWeaponSkillBrowse','',slot<0?'aria-label="返回装备"':`data-id="${selected.id}" aria-label="返回技能列表"`,'wc-back')}<span></span>${button('catalogMode',`${projectIcon('nav-equipment','wc-tab-icon')}<span>武器</span>`,'data-mode="list" aria-pressed="false"','wc-mode')}${button('catalogMode',`${projectIcon('nav-skill','wc-tab-icon')}<span>技能</span>`,'data-mode="skills" aria-pressed="true"','wc-mode is-active')}</nav></section>`;
}

import {nativeWeaponGroupId} from '../replica/native-weapon-groups.js';
import {nativeCollectionArt} from '../replica/native-collection-art.js';
import {nativeWeaponSkillArt} from '../replica/native-weapon-skill-art.js';
import {emptySlotMark} from './psd-empty-slot.js';
import {projectIcon} from './project-ui-art.js';
import './native-weapon-skill-page.css';

export function nativeWeaponSkillPage({snapshot:s,selectedId,selectedSkillSlot=0,helpers:h}) {
  const e=h.escape,c=s.replicaCollection,rows=c.guns,slots=c.weaponSlots;
  const slot=[0,1].includes(selectedSkillSlot)?selectedSkillSlot:0;
  const bases=rows.filter(row=>nativeWeaponGroupId(row)===row.id);
  const art=row=>{
    const url=row&&nativeWeaponSkillArt(row);
    return url?`<img class="weapon-skill-icon native-weapon-skill-icon" src="${e(url)}" alt="${e(row.name)}技能" draggable="false">`:'';
  };
  const selected=rows.find(row=>row.id===slots[slot])||rows.find(row=>String(row.id)===String(selectedId))||rows.find(row=>row.equipped)||rows[0];
  const source=base=>rows.find(row=>row.owned&&slots.includes(row.id)&&nativeWeaponGroupId(row)===base.id)||rows.find(row=>row.owned&&row.id===base.id)||rows.find(row=>row.owned&&nativeWeaponGroupId(row)===base.id)||base;
  const button=(action,label,attrs='',cls='')=>`<button type="button" class="wc-button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
  return `<section class="ref-catalog ref-catalog-weapon wc-page wg-skill-page" data-catalog-kind="weapon" data-catalog-mode="skills" aria-label="武器技能">
    <div class="wc-hero"><h1 class="wc-page-title">技能</h1><button type="button" class="wg-weapon-art" data-action="nativeWeaponPreview" data-mode="base" data-id="${selected.id}" aria-label="查看${e(selected.name)}技能"><img src="${e(nativeCollectionArt(selected,'default'))}" alt="${e(selected.name)}" draggable="false"></button>
    <div class="wg-slots" aria-label="武器技能槽">${slots.map((id,index)=>{const row=rows.find(row=>row.id===id);return `<div class="wg-slot-wrap"><button type="button" class="wg-skill-slot${slot===index?' is-selected':''}" data-action="nativeWeaponSkillSlot" data-slot="${index}" aria-pressed="${slot===index}" aria-label="技能位置${index+1}，${e(row?.name||'空闲')}"><b>${index+1}</b>${row?art(row):emptySlotMark('wg-empty')}${slot===index?'<i class="fc-browse-corners" aria-hidden="true"></i>':''}</button>${index===1&&id?`<button type="button" class="wg-remove" data-action="nativeWeaponSkillEquip" data-id="0" data-slot="1" data-revision="${c.revision}" aria-label="卸下第二个武器技能">×</button>`:''}</div>`;}).join('')}</div>
    <p class="wg-note">武器上阵技能生效</p></div><header class="wc-heading"><h2>技能列表</h2></header>
    <div class="wc-scroll" data-catalog-scroll="weapon:skills"><div class="wc-grid wc-skill-grid">${bases.map(base=>{const row=source(base),equipped=slots.findIndex(id=>id&&nativeWeaponGroupId(rows.find(r=>r.id===id))===base.id);return `<button type="button" class="wc-skill${equipped===slot?' is-selected':''}${row.owned?'':' is-locked'}" data-action="nativeWeaponSkillEquip" data-id="${row.id}" data-slot="${slot}" data-revision="${c.revision}" aria-label="装配${e(base.name)}技能${row.owned?'':'，未激活'}"><span class="wc-skill-art">${art(base)}${equipped===slot?'<i class="fc-browse-corners" aria-hidden="true"></i>':''}${equipped>=0?`<b class="wg-equipped">${equipped+1}</b>`:''}${row.owned?'':projectIcon('lock','wc-lock')}</span><span class="wc-skill-name">${e(base.name)}</span></button>`;}).join('')}</div></div>
    <nav class="wc-footer" aria-label="武器子页面">${button('catalogBack','返回','aria-label="返回装备"','wc-back')}<span></span>${button('catalogMode',`${projectIcon('nav-equipment','wc-tab-icon')}<span>武器</span>`,'data-mode="list" aria-pressed="false"','wc-mode')}${button('catalogMode',`${projectIcon('skill-tab','wc-tab-icon')}<span>技能</span>`,'data-mode="skills" aria-pressed="true"','wc-mode is-active')}</nav></section>`;
}

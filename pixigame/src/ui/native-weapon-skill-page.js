import {nativeWeaponGroupId} from '../replica/native-weapon-groups.js';
import {nativeCollectionArt} from '../replica/native-collection-art.js';
import {nativeWeaponSkillArt} from '../replica/native-weapon-skill-art.js';
import {emptySlotMark} from './psd-empty-slot.js';
import {projectIcon} from './project-ui-art.js';
import './native-weapon-skill-page.css';

export function nativeWeaponSkillPage({snapshot:s,selectedId,selectedSkillSlot=-1,helpers:h}) {
  const e=h.escape,c=s.replicaCollection,rows=c.guns;
  const selected=rows.find(row=>String(row.id)===String(selectedId))||rows.find(row=>row.id===c.useWeaponMap[0])||rows[0];
  const type=selected.weaponType,slots=c.weaponSkillMap[type]||[0,0];
  const slot=[0,1].includes(selectedSkillSlot)?selectedSkillSlot:-1;
  const bases=rows.filter(row=>nativeWeaponGroupId(row)===row.id);
  const sources=rows.filter(row=>row.weaponType===type&&row.owned&&row.stage.skills.length);
  const art=row=>{const url=row&&nativeWeaponSkillArt(row);return url?`<img class="weapon-skill-icon native-weapon-skill-icon" src="${e(url)}" alt="${e(row.name)}技能" draggable="false">`:'';};
  const button=(action,label,attrs='',cls='')=>`<button type="button" class="wc-button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
  const operation=(id,index)=>`data-action="nativeWeaponSkillEquip" data-id="${id}" data-slot="${index}" data-weapon-type="${type}" data-revision="${c.revision}"`;
  return `<section class="ref-catalog ref-catalog-weapon wc-page wg-skill-page" data-catalog-kind="weapon" data-catalog-mode="skills" data-weapon-type="${type}" aria-label="武器技能">
    <div class="wc-hero"><h1 class="wc-page-title">技能</h1><button type="button" class="wg-weapon-art" data-action="nativeWeaponPreview" data-mode="base" data-id="${selected.id}" aria-label="查看${e(selected.name)}技能"><img src="${e(nativeCollectionArt(selected,'default'))}" alt="${e(selected.name)}" draggable="false"></button>
    <div class="wg-slots" aria-label="${e(selected.name)}类型技能槽">${slots.map((id,index)=>{const row=rows.find(row=>row.id===id);return `<div class="wg-slot-wrap"><button type="button" class="wg-skill-slot${slot===index?' is-selected':''}" data-action="nativeWeaponSkillSlot" data-id="${selected.id}" data-slot="${index}" aria-pressed="${slot===index}" aria-label="技能位置${index+1}，${e(row?.name||'空闲')}"><b>${index+1}</b>${row?art(row):emptySlotMark('wg-empty')}${slot===index?'<i class="fc-browse-corners" aria-hidden="true"></i>':''}</button>${id?`<button type="button" class="wg-remove" ${operation(0,index)} aria-label="卸下技能${index+1}">×</button>`:''}</div>`;}).join('')}</div>
    <p class="wg-note">${e(selected.name)}上阵时，该类型技能生效</p></div><header class="wc-heading"><h2>${slot<0?'技能列表':e(selected.name)+' · 选择技能'}</h2>${slot>=0?button('nativeWeaponSkillBrowse','返回类型',`data-id="${selected.id}"`,'wg-browse-back'):''}</header>
    <div class="wc-scroll" data-catalog-scroll="weapon:skills:${type}:${slot<0?'types':'sources'}"><div class="wc-grid wc-skill-grid">${slot<0?bases.map(base=>`<button type="button" class="wc-skill${base.weaponType===type?' is-selected':''}" data-action="nativeWeaponSkillBrowse" data-id="${base.id}" aria-label="浏览${e(base.name)}类型技能"><span class="wc-skill-art">${art(base)}${base.weaponType===type?'<i class="fc-browse-corners" aria-hidden="true"></i>':''}</span><span class="wc-skill-name">${e(base.name)}</span></button>`).join(''):sources.map(row=>{const fitted=slots.indexOf(row.id);return `<button type="button" class="wc-skill${fitted===slot?' is-selected':''}" ${operation(row.id,slot)} aria-label="装配${e(row.name)}技能"><span class="wc-skill-art">${art(row)}${fitted===slot?'<i class="fc-browse-corners" aria-hidden="true"></i>':''}${fitted>=0?`<b class="wg-equipped">${fitted+1}</b>`:''}</span><span class="wc-skill-name">${e(row.stage.skills.at(-1)?.name||row.name)}</span></button>`;}).join('')||'<p class="wc-empty">暂无已激活的同类型技能</p>'}</div></div>
    <nav class="wc-footer" aria-label="武器子页面">${button('catalogBack','返回','aria-label="返回装备"','wc-back')}<span></span>${button('catalogMode',`${projectIcon('nav-equipment','wc-tab-icon')}<span>武器</span>`,'data-mode="list" aria-pressed="false"','wc-mode')}${button('catalogMode',`${projectIcon('skill-tab','wc-tab-icon')}<span>技能</span>`,'data-mode="skills" aria-pressed="true"','wc-mode is-active')}</nav></section>`;
}

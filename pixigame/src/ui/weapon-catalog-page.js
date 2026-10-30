import { equippedSlots } from './equipment-labels.js';
import { projectIcon } from './project-ui-art.js';
import { weaponCatalogSkills } from './weapon-catalog-skills.js';
import { weaponSkillArtwork } from './weapon-skill-art.js';
import iconCrops from './psd-choice-icon-crops.json' with { type: 'json' };
import { weaponThemeArt, legacyWeaponThemeArt } from './weapon-theme-art.js';
import './weapon-catalog-page.css';

const QUALITIES = ['普通', '优秀', '稀有', '史诗', '传说', '神话'];
const rankOf = item => Math.max(0, Math.min(5, Math.floor(Number(item.qualityRank) || 0)));
const sprite = projectIcon;
const stars = rank => `<span class="wc-stars" aria-hidden="true">${Array.from({length:5},(_,index)=>sprite('star',index < rank ? '' : 'is-icon-muted')).join('')}</span>`;
function artwork(weapon, helpers, extra = '') {
  // The theme images are already complete, transparent icons. The legacy
  // crop coordinates only apply to the older weapon-original artwork.
  const themed = weaponThemeArt(weapon.id) || legacyWeaponThemeArt(weapon.id);
  const crop = themed ? null : iconCrops[weapon.appearance || weapon.id]?.crop;
  const style = crop ? ` style="--crop-left:${-crop[0]/crop[2]*100}%;--crop-top:${-crop[1]/crop[3]*100}%;--crop-width:${100/crop[2]}%;--crop-height:${100/crop[3]}%;--crop-aspect:${crop[2]/crop[3]}"` : '';
  return `<span class="wc-art ${extra}"${style}><span>${helpers.thumbnail(weapon.id)}</span></span>`;
}
export { artwork as catalogWeaponArtwork };

// Reference layout with project PSD frames and original project artwork.
export function weaponCatalogPage({snapshot = {}, selectedId, skillTab = false, helpers}) {
  const {escape:e} = helpers;
  const skillArtwork = helpers.weaponSkillArtwork || weaponSkillArtwork;
  const weapons = snapshot.weapons || [];
  const weapon = weapons.find(item => item.id === selectedId) || weapons.find(item => item.owned) || weapons[0];
  if (!weapon) return '<section class="ref-catalog ref-catalog-weapon wc-page"><p class="wc-empty">暂无武器</p></section>';
  const action = (name,label,attrs='',cls='') => `<button type="button" class="wc-button ${cls}" data-action="${name}" ${attrs}>${label}</button>`;
  const items = weapons.map(item => {
    const selected = item.id === weapon.id, fitted = equippedSlots(snapshot,item.id).length > 0;
    const attrs = `data-id="${e(item.id)}" data-kind="weapon"`;
    const label = `${e(item.name)}，${QUALITIES[rankOf(item)]}${item.owned ? '' : '，未解锁'}${fitted ? '，已装备' : ''}`;
    if (skillTab) {
      const illustration = skillArtwork(item);
      return `<button type="button" class="wc-skill${selected ? ' is-selected' : ''}" data-action="catalogSelect" ${attrs} aria-pressed="${selected}" aria-label="浏览${e(item.name)}技能"><span class="wc-skill-art">${illustration}${selected ? sprite('check','wc-selected') : ''}</span><span class="wc-skill-name">${e(item.name)}</span></button>`;
    }
    return `<div class="wc-item-wrap${selected ? ' is-selected' : ''}"><button type="button" class="wc-item${item.owned ? '' : ' is-locked'}" data-psd-quality="${rankOf(item)}" data-action="catalogSelect" ${attrs} aria-pressed="${selected}" aria-label="${label}">${artwork(item,helpers)}${stars(rankOf(item))}${selected ? sprite('check','wc-selected') : ''}${!item.owned ? sprite('lock','wc-lock') : ''}</button>${selected ? action(item.owned ? fitted?'weapon':'catalogEquipWeapon' : 'catalogAcquire',item.owned ? fitted?'详情':'装配' : '获取',attrs,'wc-item-action') : `<span class="wc-item-name">${e(item.name)}</span>`}</div>`;
  }).join('');
  return `<section class="ref-catalog ref-catalog-weapon wc-page" data-catalog-kind="weapon" data-catalog-mode="${skillTab ? 'skills' : 'list'}" data-weapon-id="${e(weapon.id)}" aria-label="武器目录">
    <div class="wc-hero"><h1 class="wc-page-title">${skillTab ? '技能' : '武器'}</h1><button type="button" class="wc-hero-art" data-action="${skillTab ? 'catalogSkill' : weapon.owned ? 'weapon' : 'weaponInfo'}" data-skill="base" data-id="${e(weapon.id)}" aria-label="查看${e(weapon.name)}详情">${skillTab ? skillArtwork(weapon) : artwork(weapon,helpers)}</button><div class="wc-hero-tools" aria-label="${e(weapon.name)}技能预览">${action('catalogSkill','基础',`data-id="${e(weapon.id)}" data-skill="base" aria-label="查看${e(weapon.name)}基础攻击"`)}${action('catalogGrowth','成长',`data-id="${e(weapon.id)}" aria-label="查看${e(weapon.name)}局内成长"`)}</div></div>
    <header class="wc-heading"><h2>${skillTab ? '技能列表' : '武器列表'}</h2></header>
    <div class="ref-catalog-scroll wc-scroll" data-catalog-scroll="weapon:${skillTab ? 'skills' : 'list'}"><div class="wc-grid${skillTab ? ' wc-skill-grid' : ''}">${items}</div></div>
    <nav class="wc-footer" aria-label="武器子页面">${action('catalogBack','返回','aria-label="返回装备"','wc-back')}<span class="wc-footer-space" aria-hidden="true"></span>${action('catalogMode',`${sprite('nav-equipment','wc-tab-icon')}<span>武器</span>`,`data-mode="list" aria-pressed="${!skillTab}"`,skillTab ? 'wc-mode' : 'wc-mode is-active')}${action('catalogMode',`${sprite('skill-tab','wc-tab-icon')}<span>技能</span>`,`data-mode="skills" aria-pressed="${skillTab}"`,skillTab ? 'wc-mode is-active' : 'wc-mode')}</nav>
  </section>`;
}

export function weaponCatalogSkillDetail({weapon,key,helpers}) {
  if (!weapon) return null;
  const skill = weaponCatalogSkills(weapon).find(item => item.key === key);
  if (!skill) return null;
  const {escape:e} = helpers;
  const category = skill.kind === 'base' ? '' : skill.kind === 'tuning' ? '战斗调校' : `进化阶段 ${skill.stage}`;
  return {title:skill.name,content:`<article class="wc-skill-detail"><div class="wc-skill-detail-head"><div class="wc-skill-detail-art">${weaponSkillArtwork(weapon)}</div><div><h3>${e(weapon.name)}</h3>${category ? `<p>${e(category)}</p>` : ''}</div></div><p class="wc-skill-description">${e(skill.summary || skill.description)}</p>${skill.note ? `<p class="wc-skill-note">${e(skill.note)}</p>` : ''}${skill.kind === 'base' ? '' : '<p class="wc-skill-timing">选取后仅本局生效。</p>'}</article>`};
}

export function weaponCatalogGrowthDetail({weapon,helpers}) {
  if (!weapon) return null;
  const {escape:e} = helpers, skills = weaponCatalogSkills(weapon);
  const group = (kind,title) => `<details class="wc-growth-section"><summary>${title}</summary>${skills.filter(s=>s.kind===kind).map(skill=>`<div class="wc-growth-rule"><h5>${e(skill.name)}</h5><p>${e(skill.summary || skill.description)}</p>${skill.note ? `<small>${e(skill.note)}</small>` : ''}</div>`).join('')}</details>`;
  return {title:'局内成长',content:`<article class="wc-skill-detail wc-growth-detail"><h3>${e(weapon.name)}</h3>${group('tuning','调校')}${group('evolution','进化')}<p class="wc-skill-timing">选取后仅本局生效。</p></article>`};
}

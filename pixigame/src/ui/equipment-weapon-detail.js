import { equippedSlots, slotLabel } from './equipment-labels.js';
import { weaponEquipControls } from './weapon-equip-controls.js';
import { resourceIcon } from './resource-icons.js';
import { supplyWeaponArt } from './supply-visuals.js';
import './equipment-weapon-detail.css';

const QUALITY_NAMES = ['普通', '优秀', '稀有', '史诗', '传说', '神话'];
const QUALITY_COLORS = ['#b6cbdc', '#8ce0b0', '#8bd7ff', '#d2a7f4', '#f2ce7f', '#ffa6b8'];
const COST_ICONS = { coins: resourceIcon('coin'), weaponParts: resourceIcon('parts') };
const finiteValue = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))
  ? Number(value) : null;
const textValue = value => typeof value === 'string' ? value.trim() : '';
const statNumber = value => value.toLocaleString('zh-CN', { maximumFractionDigits: 2 });

export function equipmentWeaponDialog({title,content,quality=0}, {escape:e}) {
  const rank=Math.max(0,Math.min(5,Math.floor(Number(quality)||0)));
  return `<div class="pl-modal-backdrop weapon-detail-backdrop" data-action="dismiss"><section class="pl-modal weapon-detail-modal" data-detail-layout="equipment-reference-psd" data-weapon-quality="${rank}" data-modal-type="weapon" data-modal-kind="weapon" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title" tabindex="-1"><header class="pl-modal-heading"><h2 id="lobby-modal-title">${e(title)}</h2></header><button type="button" class="pl-close" data-action="close" aria-label="关闭武器详情"></button><div class="pl-modal-content">${content}</div></section></div>`;
}

// UI_EquipDetail layout only; surfaces use our PSD assets and actions stay canonical.
export function equipmentWeaponDetail({ snapshot, weapon, selectedSlot, helpers, readonly = false, requireSlotSelection = false }) {
  const { escape: e, number: n, thumbnail, button } = helpers;
  if (!weapon) return '<div class="equipment-weapon-detail"><p>暂无武器资料</p></div>';

  const rankValue = finiteValue(weapon.qualityRank);
  const rank = rankValue === null ? null : Math.max(0, Math.min(5, Math.floor(rankValue)));
  const level = finiteValue(weapon.level), maxLevel = finiteValue(weapon.maxLevel);
  const damage = finiteValue(weapon.damage ?? weapon.stats?.damage);
  const interval = finiteValue(weapon.interval ?? weapon.stats?.interval);
  const nextDamage = finiteValue(weapon.nextDamage);
  const fitted = equippedSlots(snapshot, weapon.id);
  const status = fitted.includes('W1') ? '本机专武' : fitted.length ? `已装备 · ${fitted.map(slotLabel).join(' / ')}`
    : weapon.owned ? '未装备' : '未解锁';
  const levelText = level === null ? '—' : `Lv.${n(level)}${maxLevel === null ? '' : ` / ${n(maxLevel)}`}`;
  const description = textValue(weapon.normal) || textValue(weapon.description);
  const coinCost = finiteValue(weapon.cost?.coins), partCost = finiteValue(weapon.cost?.weaponParts);
  const hasCost = coinCost !== null && coinCost >= 0 && partCost !== null && partCost >= 0;
  const showGrowth = !readonly && weapon.owned;
  const showNext = showGrowth && hasCost && damage !== null && nextDamage !== null && nextDamage > damage;
  const canUpgrade = Boolean(weapon.owned && weapon.canUpgrade && hasCost);
  const reachedLimit = weapon.cost === null;
  const upgradeLabel = reachedLimit ? '等级上限' : !hasCost ? '暂不可强化' : '升级';
  const equipHelpers={...helpers,button:(action,label,cls,attrs='',disabled=false)=>button(action,action==='equipWeapon'&&weapon.owned?'装备':action==='unequipWeapon'?'卸下':label,cls,`${attrs} aria-label="${e(label)}"`,disabled)};
  const resourceCost = (key, label, amount) => {
    const balance = finiteValue(snapshot.wallet?.[key]);
    const unlimited = key === 'coins' && snapshot.wallet?.unlimited;
    return `<span class="equipment-weapon-detail__cost${!unlimited && balance !== null && balance < amount ? ' is-short' : ''}" aria-label="${label} ${n(amount)}">${COST_ICONS[key]}<strong>${n(amount)}</strong></span>`;
  };
  const growth = !showGrowth ? '' : hasCost
    ? `<div class="equipment-weapon-detail__costs" role="group" aria-label="强化消耗">${resourceCost('coins', '金币', coinCost)}${resourceCost('weaponParts', '强化零件', partCost)}</div>`
    : `<p class="equipment-weapon-detail__limit">${e(reachedLimit ? textValue(weapon.levelLimitMessage) || '已达当前等级上限' : '暂不可强化')}</p>`;

  return `<div class="equipment-weapon-detail${readonly ? ' is-readonly' : ''}" data-weapon-id="${e(weapon.id)}" style="--weapon-detail-quality:${QUALITY_COLORS[rank ?? 0]}">
    <div class="equipment-weapon-detail__scroll">
    <header class="equipment-weapon-detail__hero">
      <div class="equipment-weapon-detail__preview" data-psd-quality="${rank ?? 0}" role="img" aria-label="${e(weapon.name || '武器')}${rank === null ? '' : `，${QUALITY_NAMES[rank]}`}预览">${supplyWeaponArt(weapon,thumbnail)}</div>
      <div class="equipment-weapon-detail__identity"><span class="equipment-weapon-detail__level">${levelText}</span><span class="equipment-weapon-detail__status">${e(status)}</span>${showGrowth?button('openWorkshop',rank>=5?'已满星':'升星','wc-button equipment-weapon-detail__star',`data-kind="weapon" data-id="${e(weapon.id)}" data-mode="quality"`,rank>=5):''}</div>
    </header>
    <section class="equipment-weapon-detail__stats"><h3>装备技能</h3><dl class="equipment-weapon-detail__attributes" aria-label="武器属性">
      ${damage !== null && damage >= 0 ? `<div><dt>基础伤害</dt><dd><span>${statNumber(damage)}</span>${showNext ? `<span class="equipment-weapon-detail__increase" aria-label="强化后 ${statNumber(nextDamage)}"><span aria-hidden="true">→</span> ${statNumber(nextDamage)}</span>` : ''}</dd></div>` : ''}
      ${interval !== null && interval > 0 ? `<div><dt>攻击间隔</dt><dd>${statNumber(interval)} 秒</dd></div>` : ''}
    </dl>${description?`<p class="equipment-weapon-detail__skill-description">${e(description)}</p>`:''}</section></div>
    <footer class="equipment-weapon-detail__footer">${growth}
    ${readonly ? button('close','返回','equipment-weapon-detail__back') : `<div class="equipment-weapon-detail__actions">${weaponEquipControls({ snapshot, weapon, selectedSlot, helpers:equipHelpers, showStatus: false, requireSlotSelection })}${weapon.owned ? button('upgrade', e(upgradeLabel), 'equipment-weapon-detail__upgrade', `data-kind="weapon" data-id="${e(weapon.id)}"`, !canUpgrade) : ''}</div>`}
    </footer>
  </div>`;
}

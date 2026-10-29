import { chapterPreviewBackground } from '../replica/chapter-presentation.js';
// Layout adapters for the supplied screen references. All item data and actions
// still belong to the existing peripheral system.
import { slotLabel, equippedSlots } from './equipment-labels.js';
import { workshopReferencePage } from './workshop-reference-page.js';
export const REFERENCE_QUALITY = ['普通', '优秀', '稀有', '史诗', '传说', '神话'];
const COLORS = ['#8fa6b3', '#57bc73', '#439bde', '#a861d6', '#e7b741', '#df625f'];
const valueId = value => typeof value === 'object' ? value?.itemId || value?.id : value;

export function referenceItemCard(item, ctx, { action = 'weapon', selected = false, equipped = false, quality = item.qualityRank || 0 } = {}) {
  const { escape: e, icon, thumbnail } = ctx.helpers;
  equipped ||= equippedSlots(ctx.snapshot, item.id).length > 0;
  return `<button type="button" class="ref-item ${equipped ? 'is-equipped' : ''} ${selected ? 'is-selected' : ''} ${!item.owned ? 'is-locked' : ''}" data-action="${action}" data-id="${e(item.id)}" style="--ref-quality:${COLORS[quality] || COLORS[0]}" aria-label="${e(item.name)}${equipped ? '，已装备' : ''}">
    <span class="ref-item-level">Lv.${item.level || 1}</span>${thumbnail(item.id) || icon('weapon')}
    <span class="ref-item-stars" aria-label="${REFERENCE_QUALITY[quality]}">${[0, 1, 2, 3, 4].map(n => `<i class="${n < quality ? 'is-earned' : ''}">${icon('star')}</i>`).join('')}</span>
    ${equipped ? '<span class="ref-item-equipped">已装备</span>' : ''}${!item.owned ? icon('lock', 'ref-item-lock') : ''}<strong>${e(item.name)}</strong></button>`;
}

export function referenceEquipmentPage(ctx) {
  const { snapshot: s, sortDescending = true } = ctx;
  const { escape: e, number: n, icon, thumbnail, button, asset } = ctx.helpers;
  const a = s.aircraft.find(a => a.id === s.aircraftId), p = s.pilots.find(p => p.id === s.pilotId);
  const equipped = id => Object.values(s.loadout).some(value => valueId(value) === id);
  const items = s.weapons.filter(w => w.owned).sort((a,b) => (sortDescending ? b.qualityRank - a.qualityRank : a.qualityRank - b.qualityRank) || b.level - a.level || a.id.localeCompare(b.id));
  return `<section class="ref-equipment">
    <div class="ref-equipment-hero" style="--ref-hangar:url('${asset('hangar')}')">
      <div class="ref-equipment-grid"></div><div class="ref-equipment-ring"></div>
      <div class="ref-equipment-model pl-live-model">${h.preview?.(a?.id,{name:a?.name})||h.thumbnail(a?.id)}</div>
      ${['W1','W2','W3','W4','W5','W6'].map((slot, i) => {
        const innate = i < 2, id = innate ? a?.weaponId : valueId(s.loadout[slot]), w = s.weapons.find(w => w.id === id);
        return `<button type="button" class="ref-mount ref-mount-${slot.toLowerCase()} ${innate ? 'is-innate' : ''} ${w ? 'is-filled' : ''}" data-action="${innate ? 'innateInfo' : 'slot'}" data-slot="${slot}" data-id="${e(id)}" aria-label="${slotLabel(slot)} ${innate ? '本机专武' : '通用挂点'} ${e(w?.name || '空闲')}"><small>${slotLabel(slot)}</small>${w ? thumbnail(id) : icon('weapon')}<span>${innate ? '本机' : w ? `Lv.${w.level}` : '+'}</span></button>`;
      }).join('')}
      <div class="ref-equipment-stats"><span title="出战基础攻击">${icon('weapon')} ${n(s.combatStats?.attack ?? a?.attack)}</span><span title="出战最大耐久">${icon('heart')} ${n(s.combatStats?.maxHp ?? a?.hp)}</span></div>
      <div class="ref-entry-row">${[['weapon','weapon','武器'],['aircraft','plane','战机'],['pilot','pilot','驾驶员']].map(([kind, symbol, label]) => `<button type="button" data-action="catalog" data-kind="${kind}" aria-label="${label}"><i>${icon(symbol)}</i><strong>${label}</strong></button>`).join('')}</div>
    </div>
    <div class="ref-divider"><button type="button" class="ref-yellow" data-action="sortEquipment">按品质${sortDescending ? '降序' : '升序'}</button><span class="ref-divider-caption">装备</span>${button('openWorkshop', '改装间', 'ref-yellow')}</div>
    <div class="ref-warehouse">${items.length ? `<div class="ref-item-grid">${items.map(w => referenceItemCard(w,ctx,{equipped:equipped(w.id)})).join('')}</div>` : '<div class="ref-empty">暂无可装备武器</div>'}</div>
  </section>`;
}

export function referenceBattlePage(ctx) {
  const { snapshot: s } = ctx, { escape:e,number:n,icon,button,asset } = ctx.helpers;
  const stage = s.stages.find(x => x.index === s.selectedStageIndex) || s.stages[0] || {};
  const index = stage.index || 0, previous = s.stages.find(x => x.index === index - 1), next = s.stages.find(x => x.index === index + 1);
  const claimable = s.tasks?.some(t => t.claimable) || s.signIn?.claimable;
  return `<section class="ref-battle">
    <div class="ref-cockpit"><div class="ref-cockpit-inner"></div>
      <button class="ref-battle-task" type="button" data-action="tasks" aria-label="任务">${icon('mission')}${s.tasks?.some(t => t.claimable) ? '<i class="ref-badge">!</i>' : ''}</button>
      <div class="ref-battle-heading"><h1><em>${index+1}.</em> ${e(stage.name || '碧海前哨')}</h1><span>最高成绩：${e(stage.progressText || (stage.stars ? `已通关 · ${stage.stars}星` : '未通关'))}</span></div>
      <button type="button" class="ref-stage-info" data-action="stages" aria-label="选择关卡">${icon('medal')}</button>
      <button type="button" class="ref-backpack" data-action="backpack" aria-label="背包">${icon('crate')}<span>背包</span></button>
      <div class="ref-island-window"><div class="ref-island-art" style="background-image:${e(chapterPreviewBackground(index))}"></div><div class="ref-island-shadow"></div></div>
      <button type="button" class="ref-chapter-arrow is-prev" data-action="stage" data-index="${previous?.index}" aria-label="上一章" ${!previous || !previous.unlocked ? 'disabled' : ''}>${icon('arrow')}</button>
      <button type="button" class="ref-chapter-arrow is-next" data-action="stage" data-index="${next?.index}" aria-label="下一章" ${!next || !next.unlocked ? 'disabled' : ''}>${icon('arrow')}</button>
      <button type="button" class="ref-idle-reward" data-action="${s.signIn?.claimable ? 'signin' : 'tasks'}">${icon('crate')}${claimable ? '<i class="ref-badge">!</i>' : ''}<span>${claimable ? '待领取' : '每日补给'}</span></button>
    </div>
    <div class="ref-battle-controls">
      ${button('sweep', `${icon(stage.bestCleared || stage.stars > 0 ? 'mission' : 'lock')}<strong>巡逻</strong>`, 'ref-patrol', '', !(stage.bestCleared || stage.stars > 0))}
      ${button('start', `<strong>开始</strong><span>${icon('energy')}×${n(stage.staminaCost ?? 5)}</span>`, 'ref-start', '', stage.unlocked === false)}
      ${button('signin', `${icon('calendar')}<strong>活动</strong>`, 'ref-activities')}
    </div>
    <div class="ref-console-bottom"><span></span><i></i><span></span></div>
  </section>`;
}

export function referenceWorkshopPage(ctx) { return workshopReferencePage(ctx); }
export function referenceMissionsPage(ctx) {
  const {snapshot:s}=ctx,{escape:e,number:n,icon,button}=ctx.helpers;
  const claimable = s.tasks.filter(t => t.claimable).length;
  return `<section class="ref-missions"><div class="ref-missions-overview">${icon('mission')}<div><h1>航线任务</h1><p>${claimable ? `${claimable} 项奖励待领取` : '完成任务，领取航线补给'}</p></div>${button('signin', `${icon('calendar')} 签到`, 'pl-secondary')}</div>${['daily','weekly'].map(kind => `<h2>${kind==='daily'?'每日任务':'每周任务'}<small>${s.tasks.filter(t=>t.type===kind && t.claimed).length} / ${s.tasks.filter(t=>t.type===kind).length} 已领取</small></h2>${s.tasks.filter(t=>t.type===kind).map(t=>`<article class="${t.claimed ? 'is-claimed' : t.claimable ? 'is-claimable' : ''}"><span class="ref-task-icon">${icon(kind==='daily'?'mission':'medal')}</span><div><h3>${e(t.name)}</h3><p>${e(t.description)}</p><div class="ref-task-progress"><progress aria-label="${e(t.name)}进度" max="${t.target}" value="${Math.min(t.progress,t.target)}"></progress><small>${n(Math.min(t.progress,t.target))} / ${n(t.target)}</small></div></div>${button('claimTask',t.claimed?'已领取':t.claimable?'领取':'进行中',t.claimable?'ref-yellow':'ref-small',`data-id="${e(t.id)}"`,!t.claimable)}</article>`).join('')}`).join('')}</section>`;
}

import './patrol-center.css';
import { projectIcon } from './project-ui-art.js';
import { nativeItemArt } from '../replica/native-item-presentation.js';
import { patrolClockState } from './patrol-clock.js';

const resources = [
  {key:'coins', name:'金币', icon:'coin'},
  {key:'weaponParts', name:'强化零件', icon:'parts'},
  {key:'aircraftShards', name:'飞机碎片', icon:'shard'},
];
const button = (action, label, disabled = false, attrs = '') => `<button type="button" class="wc-button pt-button" data-action="${action}" ${attrs}${disabled ? ' disabled' : ''}>${label}</button>`;
const minutes = p => Math.max(0, Number(p.storedMinutes) || 0);
const rateNames={105:'装备图纸',801:'科研图纸',113:'普通箱券',112:'高级箱券'};
const amount = value => Number(value || 0).toLocaleString('zh-CN', {maximumFractionDigits:2});
// Four same-direction copies leave overlap on both sides throughout the scrolling cycle.
const sceneryTiles = '<span></span>'.repeat(4);
const scenery = `<div class="pt-sky" aria-hidden="true"><div class="pt-scenery-track">${sceneryTiles}</div></div>`;
function rewards(values, {icon, number:n}) {
  return `<div class="pt-rewards">${resources.filter(r => values?.[r.key] > 0).map(r => `<div class="pt-reward" aria-label="${r.name} ${n(values[r.key])}">${icon(r.icon)}<b>×${n(values[r.key])}</b></div>`).join('')}</div>`;
}
function nativeArt(item, h) {
  const url = nativeItemArt(item.id);
  return url ? `<img class="pl-icon" src="${h.escape(url)}" alt="" draggable="false">` : '';
}
function nativeRewards(items, h) {
  return `<div class="pt-rewards">${items.map(item=>`<div class="pt-reward" title="${h.escape(item.name)}" aria-label="${h.escape(item.name)} ${h.number(item.amount)}">${nativeArt(item,h)}<b>×${h.number(item.amount)}</b></div>`).join('')}</div>`;
}
const revision = p => `data-revision="${Number(p.revision)}"`;
function nativePreview(items, h) {
  return `<div class="pt-rewards">${items.map(item => {
    const label = `${item.name}${item.random ? ' · 随机种类' : ` · 已有 ${h.number(item.owned)}`}`;
    return `<div class="pt-reward" title="${h.escape(label)}" aria-label="${h.escape(label)}">${nativeArt(item,h)}<span>${h.escape(item.name)}</span></div>`;
  }).join('')}</div>`;
}
function recovery(snapshot) {
  if(snapshot.patrol?.adPending)return `<div class="pt-recovery" role="status"><span>广告已完成，奖励待保存</span>${button('quickPatrolAd','重试保存',snapshot.patrol.adBusy,revision(snapshot.patrol))}</div>`;
  return snapshot.pendingReward?.type === 'patrol' ? `<div class="pt-recovery" role="status"><span>${snapshot.pendingReward.unsaved ? '广告已完成，奖励待保存' : '奖励已记录，等待保存'}</span>${button('recoverDailyRewards', '重试保存')}</div>` : '';
}
export function patrolPanel(snapshot, h) {
  const {escape:e, number:n, icon} = h, p = snapshot.patrol || {};
  const aircraft = snapshot.aircraft?.find(a => a.id === snapshot.aircraftId);
  const stage = snapshot.stages?.find(s => s.index === p.stageIndex);
  const stored = minutes(p), full = p.unlocked && !p.clockRollback && stored >= p.capHours * 60;
  const bonusPercent = p.researchBonus ?? (p.bonus || 0) * 100;
  const clock=patrolClockState(p);
  const available = p.unlocked && !p.clockRollback && Object.values(p.rewards || {}).some(v => v > 0);
  const locked = !p.unlocked, pending = snapshot.rewardPending || p.adBusy || p.adPending;
  return `<section class="pt-panel" aria-label="巡逻收益">
    <div class="pt-scroll" data-patrol-scroll="idle">
      <div class="pt-scene">${scenery}<span class="pt-route">${p.native ? (locked ? e(p.lockReason) : !p.chapterKnown ? '巡逻章节待确认' : `第${n(p.stageIndex + 1)}章${stage?.name ? ` · ${e(stage.name)}` : ''}`) : locked ? '通关第1章开启巡逻' : `第${n(p.stageIndex + 1)}章${stage?.name ? ` · ${e(stage.name)}` : ''}`}</span><div class="pt-aircraft" data-model-view="patrol" data-model-aircraft="${e(aircraft?.id || snapshot.aircraftId || 'pilot-01')}" aria-label="战机横向巡逻"></div></div>
      ${locked ? '' : `<p class="pt-note">${p.compatibility ? '本地每小时收益 · 原版倍率待核实' : p.native ? '每小时收益' : '章节越高，收益越大'}${bonusPercent ? ` · 科技加成 +${amount(bonusPercent)}%` : ''}</p>`}
      <div class="pt-timing" role="group" aria-label="巡逻时间"><span data-patrol-clock="label">${clock.label}</span><strong data-patrol-clock="time">${clock.time}</strong></div>
      <div class="pt-rates" aria-label="每小时收益">${p.native ? p.rateItems.map(r => `<div title="${e(r.name)}" aria-label="${e(r.name)}，${locked?'未开启':amount(r.perHour)+'每小时'}"><span>${nativeArt(r,h)}${e(rateNames[r.id]||r.name)}</span><b>${locked?'—':amount(r.perHour)}</b></div>`).join('') : resources.map(r => `<div><span>${icon(r.icon)}${r.name}</span><b>${locked ? '—' : amount(p.perHour?.[r.key])}<small>/小时</small></b></div>`).join('')}</div>

      ${locked?'':'<h3 class="pt-section-title">累计奖励</h3>'}
      ${p.nativeSettlementPending ? `<p class="pt-empty">${e(locked ? p.lockReason : '奖励暂不可领取')}</p>` : available ? (p.sampleBased?nativeRewards(p.rewardRows,h):rewards(p.rewards, h)) : locked ? '' : `<p class="pt-empty">${p.clockRollback?'设备日期异常，请恢复后领取':'收益积累中 · 每10分钟结算'}</p>`}
      ${p.nativeSettlementPending?'<p class="pt-note">奖励暂不可领取。</p>':''}
      ${p.development?button('devPatrolSample','领取测试奖励',pending,revision(p)):''}
      ${recovery(snapshot)}
    </div>
    <footer class="pt-footer"><p class="pt-limit">${!p.nativeSettlementPending && full ? '收益已满 · ' : ''}${p.nativeSettlementPending?'最长巡逻8小时':`最长巡逻${n(p.capHours || 8)}小时`}</p><div class="pt-actions">${button('patrolQuick', '快速巡逻', (!p.canPreview && locked) || pending)}${button('claimPatrol', '领取', !available || pending,revision(p))}</div></footer>
  </section>`;
}
export function quickPatrolPanel(snapshot, h) {
  const {icon, number:n, escape:e} = h, p = snapshot.patrol || {};
  const pending = snapshot.rewardPending || p.adBusy || p.adPending;
  const staminaMissing = !p.staminaUnlimited && !snapshot.wallet?.unlimited && snapshot.wallet?.stamina < p.quickStamina;
  const unavailable = !p.unlocked || p.native&&!p.quickUnlocked || p.clockRollback || p.nativeSettlementPending;
  const staminaReason = p.sampleBased ? (!p.quickUnlocked?p.quickLockReason:p.clockRollback?'设备日期异常':staminaMissing?'体力不足':'') : p.native ? (!p.quickUnlocked ? p.quickLockReason : p.settlementReason) : !p.unlocked ? '通关第1章开启' : p.clockRollback ? '设备日期异常' : p.quickLeft && staminaMissing ? '体力不足' : '';
  const adReason = p.sampleBased ? (!p.quickUnlocked?p.quickLockReason:p.clockRollback?'设备日期异常':!p.adAvailable?'广告暂未就绪':'') : p.native ? (!p.quickUnlocked ? p.quickLockReason : p.settlementReason) : !p.unlocked ? '通关第1章开启' : p.clockRollback ? '设备日期异常' : p.quickAdLeft && !p.adAvailable ? '广告暂未就绪' : '';
  const staminaOption = `<div><span>剩余 ${p.quickLeft == null ? '—' : n(p.quickLeft)} / ${n(p.quickLimit)} 次</span>${button('quickPatrol', `${icon('energy')}<span>${n(p.quickStamina)} 体力</span>`, unavailable || pending || !p.quickLeft || staminaMissing,revision(p))}${staminaReason ? `<small>${staminaReason}</small>` : ''}</div>`;
  const adOption = `<div><span>剩余 ${p.quickAdLeft == null ? '—' : n(p.quickAdLeft)} / ${p.quickAdLimit == null ? '—' : n(p.quickAdLimit)} 次</span>${button('quickPatrolAd', `${projectIcon('ad-play','pl-icon')}<span>${p.adBusy ? '广告播放中' : p.adError ? '重试广告' : '观看广告'}</span>`, unavailable || pending || !p.quickAdLeft || !p.adAvailable,revision(p))}${adReason ? `<small>${adReason}</small>` : ''}</div>`;
  return `<section class="pt-panel pt-quick" aria-label="快速巡逻">
    <div class="pt-scroll" data-patrol-scroll="quick"><div class="pt-quick-time"><span>立即获得</span><strong>${p.quickDurationKnown || !p.native ? `${n(p.quickHours || 2)}<small>小时巡逻收益</small>` : e(p.quickLabel||'大量巡逻收益')}</strong></div><h3 class="pt-section-title">快速巡逻收益</h3>${p.compatibility?'<p class="pt-note">本地兼容收益 · 时长和发放倍率待原版核实</p>':''}${p.sampleBased ? nativeRewards(p.quickRewardRows,h) : p.native ? (p.chapterKnown ? nativePreview(p.previewItems,h) : '<p class="pt-empty">巡逻章节待确认</p>') : rewards(p.quickRewards, h)}${p.nativeSettlementPending?`<p class="pt-note">奖励暂不可领取</p>`:''}${p.adError ? `<p class="pt-ad-error" role="status">${e(p.adError)}</p>` : ''}${recovery(snapshot)}</div>
    <footer class="pt-footer"><div class="pt-quick-options">${adOption}${staminaOption}</div></footer>
  </section>`;
}
export function patrolRewardsPanel(items, h) {
  return `<div class="pt-result">${items.some(r=>r.nativeItemId)?nativeRewards(items.map(r=>({...r,id:r.nativeItemId||r.id})),h):rewards(Object.fromEntries(items.map(r=>[r.type,r.amount])),h)}${button('close','确定')}</div>`;
}

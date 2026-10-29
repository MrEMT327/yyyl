import { Container } from '../three/display.js';
import { createThreeSurface } from './three-surface.js';
import { drawUiSymbol } from './ui-symbols.js';
import { airframeWeaponStats } from '../fixed-parts/airframe-growth.js';
import { ARSENAL } from '../fixed-parts/airframe-arsenal.js';
import { WEAPON_QUALITIES } from '../fixed-parts/common-weapons.js';
import { commonTuning } from '../fixed-parts/common-tunings.js';
import { fixedWeaponOwnerLabel } from './fixed-upgrade-view.js';
import { drawUpgradeWeaponIcon } from './upgrade-weapon-icon.js';

// APK B1041 UI_SkillSelect: 330 x 806 visible background, mapped from
// 1080 x 2340 to the game's 600 x 1300 safe area. The extra body height uses
// the gap above reroll so full evolution descriptions remain readable.
export const UPGRADE_CARD_SIZE = Object.freeze({ width: 184, height: 512 });
const THEMES = {
  power: { top: '#4388c8', bottom: '#294971', edge: '#8ac7f3', label: '聚能强化', icon: 'power' },
  cadence: { top: '#63a665', bottom: '#365f4d', edge: '#b4dc85', label: '疾速强化', icon: 'cadence' },
  coverage: { top: '#9d68d0', bottom: '#4d3677', edge: '#d2a0ed', label: '扩域强化', icon: 'coverage' },
  'evolve-1': { top: '#328eab', bottom: '#254c72', edge: '#8cdeee', label: '武器进化', icon: 'coverage' },
  'evolve-2': { top: '#7357ad', bottom: '#3b326c', edge: '#c6a9f2', label: '核心进化', icon: 'power' },
  'evolve-3': { top: '#ad684e', bottom: '#653b49', edge: '#f2bb98', label: '终局解放', icon: 'cadence' },
};

// Presentation only: compare this instance's real stats, not the base tuning
// bonus (successive additive upgrades have smaller relative gains).
function upgradePercent(stat) {
  const { before, after } = stat;
  if (!Number.isFinite(before) || !Number.isFinite(after) || before <= 0) return null;
  const delta = (after / before - 1) * 100;
  const magnitude = Math.abs(delta);
  const label = `${stat.label.replace(/^基础/, '')}${delta < 0 ? '缩短' : '提升'}`;
  if (magnitude < 0.000001) return { label: stat.label, value: '保持不变' };
  if (magnitude < 1) return { label, value: '不足 1%' };
  // Keep small gains honest instead of inflating 1–2% to 5%.
  const rounded = magnitude < 5 ? Math.round(magnitude) : Math.round(magnitude / 5) * 5;
  return { label, value: `${rounded}%` };
}

export function upgradeAttackChange(skill,weapon,growth){
  const before=airframeWeaponStats(weapon,growth),nodes=growth.state.nodes[weapon.id]||[];
  const after=airframeWeaponStats(weapon,{state:{nodes:{[weapon.id]:[...nodes,skill.id]}}});
  const pattern=ARSENAL[skill.itemId].pattern;
  if(ARSENAL[skill.itemId].common){
    if(skill.key.startsWith('evolve-'))return `本局武器进化 · ${skill.evolution}`;
    const tuning=commonTuning(ARSENAL[skill.itemId].mechanic,skill.bonus?.includes('上限')?'power':skill.key);
    return `${tuning.stat} ${Number(before[tuning.field].toFixed(3))} → ${Number(after[tuning.field].toFixed(3))}${tuning.unit}`;
  }
  const extra=['cross','helix','blade','orbit'].includes(pattern)?1:0;
  const noun={ring:'脉环',pulse:'光束',beam:'光束',chain:'连锁',orbit:'伴星',swarm:'蜂群',blade:'回旋刃'}[pattern]||'弹幕';
  const unit={ring:'重',pulse:'道',beam:'道',chain:'目标',orbit:'架',blade:'枚',swarm:'枚'}[pattern]||'发';
  if(before.count!==after.count)return `${noun} ${before.count+extra} → ${after.count+extra} ${unit}`;
  if(ARSENAL[skill.itemId].sourceId){
    if(after.pierces!==before.pierces)return `穿透 ${before.pierces} → ${after.pierces} 次`;
    if(after.life!==before.life)return `持续 ${before.life} → ${after.life} 秒`;
    if(after.range!==before.range)return '凝结射程 · 冻结增强';
    if(after.blast!==before.blast)return '爆破范围 · 装药增强';
    return `伤害 ${Number(before.damage.toFixed(1))} → ${Number(after.damage.toFixed(1))}`;
  }
  if(before.rank!==after.rank&&after.rank===3)return '弹道加宽 · 穿透提升';
  return skill.rank>5?'终局形态 · 持续强化':skill.evolution.split('，')[0];
}

// Data stays keyed to the selected instance, even when innate and common
// weapons share an item id. These calculations never step a combat simulation.
export function upgradeCardView(skill, weapon, growth) {
  const entry = ARSENAL[skill.itemId];
  const nodes = growth.state.nodes[weapon.id] || [];
  const before = airframeWeaponStats(weapon, growth);
  const after = airframeWeaponStats(weapon, { state: { nodes: { [weapon.id]: [...nodes, skill.id] } } });
  const key = skill.bonus?.includes('上限') ? 'power' : skill.key;
  // Color is a shared surface treatment, never a quality/type classification.
  const theme = { ...(THEMES[key] || THEMES.power), top:'#344956', bottom:'#192a36', edge:'#bccbd4' };
  const evolving = entry.common && key.startsWith('evolve-');
  const tuning=entry.common&&!evolving?commonTuning(entry.mechanic,key):null;
  if(tuning)theme.label=`${tuning.label}强化`;
  const evolution = nodes.filter(id => /-evolve-[123]$/.test(id)).length;
  const forms = ['基础型', '战术改装', '核心增幅', '终局解放'];
  const stat = evolving
    ? { label: '进化路线', before: forms[evolution], after: forms[Math.min(3,evolution+1)], unit: '', bonus: skill.name.split(' · ').at(-1) }
    : tuning
    ? {label:tuning.stat,before:before[tuning.field],after:after[tuning.field],unit:tuning.unit,bonus:tuning.bonus}
    : key === 'cadence'
    ? { label: '开火间隔', before: before.interval, after: after.interval, unit: '秒', bonus: '间隔缩短 8%' }
    : key === 'coverage'
      ? { label: '攻击宽度', before: before.width, after: after.width, unit: '倍', bonus: '基础范围 +15%' }
      : { label: '基础伤害', before: before.damage, after: after.damage, unit: '', bonus: '基础伤害 +18%' };
  const change = evolving ? null : upgradePercent(stat);
  const descriptions = entry.common
    ? [evolving ? skill.evolution : tuning.description]
    : [skill.evolution, stat.bonus];
  return { itemId: skill.itemId, ownerId: weapon.id, skillId: skill.id, name: entry.name,
    owner: fixedWeaponOwnerLabel(weapon), level: nodes.length + 1, nextLevel: nodes.length + 2,
    quality: WEAPON_QUALITIES[weapon.qualityRank || 0], qualityRank: weapon.qualityRank || 0,
    theme, stat, change, descriptions, effects: evolving ? skill.evolution : entry.common ? '' : skill.evolution,
    terminal: Boolean(skill.terminal), evolving, label: evolving ? theme.label : skill.terminal ? '武器觉醒' : theme.label };
}

function wrap(text, max = 9) {
  const chars = Array.from(String(text || ''));
  const lines = [];
  for (let i = 0; i < chars.length; i += max) lines.push(chars.slice(i, i + max).join(''));
  return lines;
}

export function createUpgradeAttackCard({ skill, weapon, growth }) {
  const { width: w, height: h } = UPGRADE_CARD_SIZE;
  const view = new Container({ label: 'reference-upgrade-card' });
  const model = upgradeCardView(skill, weapon, growth), theme = model.theme;
  const ui = createThreeSurface({ textResolution: 3 }); view.object3D.add(ui.group);
  // Reconstructed from Choose_skills_panel and UI_DankeSkillSelect: a
  // coloured upper field, black title slot, dark text body and cut lower corner.
  ui.panel(0, 4, w, h, { fill: '#060b0f', stroke: null, cut: 12 });
  ui.panel(0, 0, w, h, { fill: '#090e12', stroke: '#05090d', cut: 12 });
  ui.panel(4, 4, w - 8, h - 8, { fill: '#161b20', stroke: theme.edge, cut: 9 });
  ui.panel(5, 5, w - 10, 180, { fill: theme.top, bottomColor: theme.bottom, stroke: null, cut: 6 });
  ui.panel(5, 184, w - 10, 20, { fill: '#363c43', stroke: null, cut: 0 });
  ui.panel(5, 334, w - 10, h - 340, { fill: '#151b22', bottomColor: theme.bottom, stroke: null, cut: 8 });
  const hex = (cx, cy, radius) => Array.from({ length: 7 }, (_, i) => [cx + Math.sin(i * Math.PI / 3) * radius, cy + Math.cos(i * Math.PI / 3) * radius]);
  ui.line(hex(w / 2, 110, 58), '#d3ecff', .14, 3);
  ui.line(hex(w / 2, 110, 48), '#0c2845', .18, 2);
  for (let row = 0; row < 6; row++) for (let col = 0; col < 10; col++) {
    const dot = 2 + row * .32;
    ui.quad(10 + col * 8, h - 10 - row * 8, dot, dot, theme.edge, .025 + row * .005);
  }
  ui.panel(11, 10, w - 22, 29, { fill: '#151d23', stroke: '#e0edf9', cut: 3 });
  ui.text(model.name, w / 2, 25, { size: 20, weight: 900, color: '#f6fcff', maxWidth: w - 29, align: 'center' });
  ui.panel(30, 54, 124, 124, { fill: '#101b28', stroke: '#0d1a26', radius: 7 });
  ui.panel(34, 58, 116, 116, { fill: theme.top, bottomColor: theme.bottom, stroke: theme.edge, radius: 5 });
  ui.line(hex(w / 2, 116, 43), '#d9f0ff', .14, 3);
  // The shared 3D thumbnail target may still be blank when the first choice
  // opens. These category pictograms are always painted and need no asset load.
  drawUpgradeWeaponIcon(ui, model.itemId, 52, 76, 80);
  // Quality is inherited. The separate numeric row tracks actual run levels.
  for (let i = 0; i < 6; i++) drawUiSymbol(ui, 'star', 31 + i * 21, 186, 15, i <= model.qualityRank ? '#ffe077' : '#6b7278');
  ui.text(model.label, w / 2, 228, { size: 21, weight: 900, color: theme.edge, maxWidth: w - 24, align: 'center' });
  ui.text(model.change?.label || model.stat.bonus, w / 2, 263, { size: 19, weight: 800, color: '#f3f7f8', maxWidth: w - 25, align: 'center' });
  ui.text(model.change?.value || model.stat.after, w / 2, 293, { size: 24, weight: 800, color: '#b9ed81', maxWidth: w - 25, align: 'center' });
  let y = model.evolving ? 318 : 328;
  for (const text of model.descriptions.filter(text => model.evolving || text !== model.stat.bonus)) {
    const lines = wrap(text, model.evolving ? 13 : 9);
    for (const line of lines) {
      ui.text(line, w / 2, y, { size: model.evolving ? 12 : 17, weight: 700, color: '#eaf3f8', maxWidth: w - 25, align: 'center' });
      y += model.evolving ? 20 : 28;
    }
  }
  ui.text(model.owner, w / 2, h - 43, { size: 15, weight: 800, color: '#f1f8ff', maxWidth: w - 23, align: 'center' });
  ui.text(`本局 Lv.${model.level} → Lv.${model.nextLevel}`, w / 2, h - 17, { size: 15, weight: 700, color: '#d5e6ef', maxWidth: w - 23, align: 'center' });
  view.cardSnapshot = () => ({ ...model, presentation: 'apk-skill-select', livePreview: false, size: { width: w, height: h } });
  view._disposeVisuals = () => ui.destroy();
  return view;
}

// Talent awakening structure and card identities reference 弹壳战机 1.1.6.
// All costs, modifiers and random weights below are 少女航线 tuning, NOT APK odds.
export const RESEARCH_CORE_INTERVAL = 15;
export const RESEARCH_REFINE_STEPS = 3;
export const RESEARCH_REFINE_COST = 1200;
export const RESEARCH_QUALITY_NAMES = Object.freeze({ 2: '普通', 3: '优秀', 4: '杰出', 5: '史诗', 6: '传说' });
const card = (id, name, quality, maxLevel, icon, perLevel) => Object.freeze({
  id, name, quality, maxLevel, icon, pool: quality <= 4 ? 'normal' : 'ace', perLevel: Object.freeze(perLevel),
});
export const RESEARCH_CARDS = Object.freeze([
  card('51001', '火力', 2, 30, 'tech-firepower', { attackBonus: .01 }),
  card('51002', '机体', 2, 30, 'tech-airframe', { hpFlat: 1 }),
  card('51003', '战地维修', 2, 30, 'tech-repair', { pickupHealFlat: .25 }),
  card('51004', '抗撞装甲', 2, 30, 'tech-collision', { collisionReduction: .003 }),
  card('51005', '弹幕防护', 2, 30, 'tech-projectile', { projectileReduction: .003 }),
  card('53001', '火力', 3, 20, 'tech-firepower', { attackBonus: .01 }),
  card('53002', '机体', 3, 20, 'tech-airframe', { hpFlat: 1.5 }),
  card('53003', '战地维修', 3, 20, 'tech-repair', { pickupHealFlat: .5 }),
  card('53004', '抗撞装甲', 3, 20, 'tech-collision', { collisionReduction: .005 }),
  card('53005', '弹幕防护', 3, 20, 'tech-projectile', { projectileReduction: .005 }),
  card('53006', '升级维修', 3, 20, 'tech-repair', { levelHealFlat: .5 }),
  card('54001', '攻防一体', 4, 10, 'tech-attack-defense', { attackBonus: .005, hpFlat: 1 }),
  card('54002', '精准一击', 4, 3, 'tech-precision', { critChance: .005 }),
  card('54003', '精准强化', 4, 3, 'tech-critical-damage', { critDamageBonus: .05 }),
  card('54004', '战役收益', 4, 5, 'tech-coins', { stageCoinBonus: .03 }),
  card('54005', '维修效率', 4, 5, 'tech-repair', { pickupHealBonus: .03 }),
  card('54006', '升级整备', 4, 5, 'tech-repair', { levelHealRatio: .02 }),
  card('55001', '攻防一体', 5, 10, 'tech-attack-defense', { attackBonus: .01, hpFlat: 2 }),
  card('55002', '强化装甲', 5, 10, 'tech-collision', { attackBonus: .004, hpFlat: 1, collisionReduction: .008 }),
  card('55003', '强化弹幕防护', 5, 10, 'tech-projectile', { attackBonus: .004, hpFlat: 1, projectileReduction: .008 }),
  card('55004', '高级火力', 5, 5, 'tech-firepower', { attackBonus: .02 }),
  card('55005', '高级机体', 5, 5, 'tech-airframe', { hpBonus: .02 }),
  card('55006', '精准一击', 5, 3, 'tech-precision', { critChance: .01 }),
  card('55007', '精准强化', 5, 3, 'tech-critical-damage', { critDamageBonus: .10 }),
  card('55008', '精英猎手', 5, 5, 'tech-boss-hunter', { eliteDamageBonus: .03 }),
  card('55009', '维修增援', 5, 5, 'tech-supply', { repairDropBonus: .05 }),
  card('55010', '巡逻增幅', 5, 5, 'tech-coins', { patrolBonus: .05 }),
  card('55011', '首领猎手', 5, 5, 'tech-boss-hunter', { bossDamageBonus: .02 }),
  card('56001', '高级攻防', 6, 5, 'tech-attack-defense', { attackBonus: .02, hpBonus: .02 }),
  card('56003', '超级精准', 6, 3, 'tech-precision', { critChance: .01, critDamageBonus: .10 }),
  // Preserve the card IDs and saved levels, but permanent research no longer
  // changes the number, odds or timing of this sortie's three-choice cards.
  card('56004', '火力整备', 6, 5, 'tech-firepower', { attackBonus: .005 }),
  card('56005', '弹幕装甲', 6, 5, 'tech-projectile', { projectileReduction: .01 }),
  card('56006', '机体整备', 6, 1, 'tech-airframe', { hpBonus: .015 }),
  card('56007', '起航火力', 6, 1, 'tech-firepower', { attackBonus: .02 }),
  card('56008', '维修准备', 6, 1, 'tech-repair', { pickupHealBonus: .05 }),
]);
// APK tutorial order, with the five excluded enemy-family hunters omitted.
const FIRST_NORMAL = ['51001', '51002', '53006', '51001', '54004', '51002', '53001', '51003', '53002', '51004'];
// APK draw tables prescribe the first 11 ace outcomes before random weights.
// The retained 少女航线 effects use an adapted, save-compatible sequence.
const FIRST_ACE = ['56007', '56008', '55006', '56006', '55002', '55003', '55001', '56004', '55001', '55001', '55002'];
const WEIGHTS = { 2: 55, 3: 30, 4: 15, 5: 85, 6: 15 };
const integer = (v, max = 1e9) => Number.isFinite(Number(v)) ? Math.min(max, Math.max(0, Math.floor(Number(v)))) : 0;
const fail = message => ({ ok: false, message });

export function sanitizeResearch(value) {
  // A missing record is a one-time new-system grant, not a grant on every render.
  if (!value || typeof value !== 'object') return { version: 2, levels: {}, normalDraws: 0, aceDraws: 0, cores: 1, refineProgress: null, revision: 0 };
  const levels = Object.fromEntries(RESEARCH_CARDS.map(c => [c.id, integer(value.levels?.[c.id], c.maxLevel)]));
  const normalDraws = integer(value.normalDraws);
  const normalFinished = RESEARCH_CARDS.filter(c => c.pool === 'normal').every(c => levels[c.id] === c.maxLevel);
  // Defer the one-time conversion until normal cards finish. Round the existing
  // fraction upward; a full converted bar is claimed for free. Explicit zero
  // after claiming prevents the old normal counter from granting it again.
  const refineProgress = !normalFinished ? null : value.refineProgress == null
    ? Math.ceil((normalDraws % RESEARCH_CORE_INTERVAL) * RESEARCH_REFINE_STEPS / RESEARCH_CORE_INTERVAL)
    : integer(value.refineProgress, RESEARCH_REFINE_STEPS);
  return { version: 2, levels, normalDraws, refineProgress,
    aceDraws: integer(value.aceDraws), cores: integer(value.cores), revision: integer(value.revision) };
}

export function researchModifiers(value) {
  const state = sanitizeResearch(value);
  const result = Object.fromEntries([...new Set(RESEARCH_CARDS.flatMap(c => Object.keys(c.perLevel)))].map(key => [key, 0]));
  for (const c of RESEARCH_CARDS) {
    const level = state.levels[c.id] || 0;
    for (const [key, amount] of Object.entries(c.perLevel)) result[key] += key === 'earlyHitHalves' && level ? 2 + level : amount * level;
  }
  return result;
}

export function researchEffectLines(modifiers) {
  const percent = v => `${Number((v * 100).toFixed(2))}%`;
  const labels = { attackBonus: '武器伤害', hpFlat: '基础耐久', hpBonus: '耐久加成', critChance: '暴击率', critDamageBonus: '暴击伤害', pickupHealFlat: '维修拾取恢复', collisionReduction: '冲撞减伤', projectileReduction: '弹幕减伤', levelHealFlat: '升级恢复', stageCoinBonus: '关卡基础金币', patrolBonus: '巡逻收益', pickupHealBonus: '维修拾取加成', levelHealRatio: '升级耐久恢复', eliteDamageBonus: '精英伤害', repairDropBonus: '维修掉落概率', bossDamageBonus: '首领伤害', highTierChoiceChance: '高阶选卡权重', earlyHitHalves: '开局远程减半次数', extraRerolls: '每局免费重抽', openingChoices: '开局额外选卡', preBossRepair: '首领前维修包' };
  const fixed = new Set(['hpFlat', 'pickupHealFlat', 'levelHealFlat', 'earlyHitHalves', 'extraRerolls', 'openingChoices', 'preBossRepair']);
  return Object.entries(modifiers).filter(([, v]) => v > 0).map(([key, v]) => `${labels[key]} +${fixed.has(key) ? Number(v.toFixed(2)) : percent(v)}`);
}

export function normalResearchCost(draws) {
  const n = integer(draws);
  return [100, 150, 200, 250, 300, 400, 500, 600, 700, 800][n] ?? Math.min(1200, 900 + (n - 10) * 25);
}
function candidates(state, pool) { return RESEARCH_CARDS.filter(c => c.pool === pool && (state.levels[c.id] || 0) < c.maxLevel); }

export function researchSnapshot(value, coins = 0) {
  const state = sanitizeResearch(value), normal = candidates(state, 'normal'), ace = candidates(state, 'ace');
  const refining = !normal.length && ace.length > 0;
  const aceLevelsRemaining = ace.reduce((sum, c) => sum + c.maxLevel - (state.levels[c.id] || 0), 0);
  const coresSufficient = refining && state.cores >= aceLevelsRemaining;
  const refineReady = refining && state.refineProgress === RESEARCH_REFINE_STEPS;
  const cost = refining ? refineReady ? 0 : RESEARCH_REFINE_COST : normalResearchCost(state.normalDraws);
  const items = RESEARCH_CARDS.map(c => {
    const level = state.levels[c.id] || 0;
    const effectsAt = lv => researchEffectLines(Object.fromEntries(Object.entries(c.perLevel).map(([k, v]) => [k, k === 'earlyHitHalves' && lv ? 2 + lv : v * lv])));
    return { ...c, level, owned: level > 0, maxed: level === c.maxLevel, qualityName: RESEARCH_QUALITY_NAMES[c.quality],
      effects: effectsAt(level), nextEffects: level === c.maxLevel ? [] : effectsAt(level + 1) };
  }).sort((a, b) => Number(b.owned) - Number(a.owned) || (a.owned ? b.quality - a.quality : 0) || Number(a.id) - Number(b.id));
  return { ...state, cards: items, owned: items.filter(c => c.owned).length,
    effects: researchEffectLines(researchModifiers(state)),
    normalCost: cost, refining, refineReady, refineSteps: RESEARCH_REFINE_STEPS, coresSufficient, aceLevelsRemaining,
    normalFinished: !normal.length, allFinished: !normal.length && !ace.length,
    canNormal: (normal.length > 0 || (refining && !coresSufficient)) && coins >= cost,
    canAce: ace.length > 0 && state.cores >= 1, aceFinished: !ace.length,
    untilCore: refining ? RESEARCH_REFINE_STEPS - state.refineProgress : RESEARCH_CORE_INTERVAL - state.normalDraws % RESEARCH_CORE_INTERVAL,
    poolWeights: { normal: { '普通': 55, '优秀': 30, '杰出': 15 }, ace: { '史诗': 85, '传说': 15 } } };
}

/** Pure plan: caller owns the shared-wallet transaction and persistence. */
export function planResearchDraw(value, { pool, coins, expectedRevision, rng = Math.random } = {}) {
  const state = sanitizeResearch(value);
  if (!['normal', 'ace'].includes(pool)) return fail('请选择觉醒类型');
  if (!Number.isInteger(expectedRevision) || expectedRevision !== state.revision) return fail('科技进度已更新，请重新操作');
  const snap = researchSnapshot(state, coins);
  if (snap.allFinished || (pool === 'ace' && snap.aceFinished)) return fail('该类科技已全部满级');
  if (pool === 'normal' && snap.coresSufficient) return fail('现有星核足够完成王牌科技，请先进行王牌觉醒');
  if (pool === 'normal' && (!Number.isFinite(coins) || coins < snap.normalCost)) return fail('金币不足');
  if (pool === 'ace' && state.cores < 1) return fail(snap.refining ? '星核不足，研制每3步获得1枚' : '星核不足，常规觉醒每15次赠送1枚');
  const next = structuredClone(state);
  let chosen, earnedCore = 0;
  if (pool === 'normal' && snap.refining) {
    if (!snap.refineReady) next.refineProgress++;
    if (next.refineProgress === RESEARCH_REFINE_STEPS) {
      next.refineProgress = 0;
      next.cores++;
      earnedCore = 1;
    }
  } else {
    const eligible = candidates(state, pool), count = pool === 'normal' ? state.normalDraws : state.aceDraws;
    const fixedId = (pool === 'normal' ? FIRST_NORMAL : FIRST_ACE)[count];
    chosen = eligible.find(c => c.id === fixedId);
    if (!chosen) {
      const roll = Number(rng());
      if (!Number.isFinite(roll)) return fail('本次觉醒未完成，请重试');
      // First choose a quality, then choose an eligible card within that quality.
      const groups = [...new Set(eligible.map(c => c.quality))].map(q => ({ q, cards: eligible.filter(c => c.quality === q), weight: WEIGHTS[q] }));
      const total = groups.reduce((s, g) => s + g.weight, 0);
      let cursor = Math.min(1 - Number.EPSILON, Math.max(0, roll)) * total;
      for (const group of groups) {
        if (cursor < group.weight) {
          chosen = group.cards[Math.min(group.cards.length - 1, Math.floor(cursor / group.weight * group.cards.length))];
          break;
        }
        cursor -= group.weight;
      }
      chosen ||= eligible.at(-1);
    }
    next.levels[chosen.id] = (next.levels[chosen.id] || 0) + 1;
    if (pool === 'normal') {
      next.normalDraws++;
      if (next.normalDraws % RESEARCH_CORE_INTERVAL === 0) { next.cores++; earnedCore = 1; }
      // Preserve the final normal draw's partial core progress on this receipt
      // and save, before the first separate refinement action.
      next.refineProgress = sanitizeResearch(next).refineProgress;
    } else { next.aceDraws++; next.cores--; }
  }
  next.revision++;
  return { ok: true, state: next, coins: pool === 'normal' ? coins - snap.normalCost : coins,
    cost: pool === 'normal' ? { coins: snap.normalCost } : { cores: 1 }, earnedCore,
    cardId: chosen?.id || null, previousLevel: chosen ? state.levels[chosen.id] || 0 : null,
    level: chosen ? next.levels[chosen.id] : null, pool,
    refining: pool === 'normal' && snap.refining, refineProgress: next.refineProgress, refineSteps: RESEARCH_REFINE_STEPS,
    message: chosen ? `${chosen.name}${state.levels[chosen.id] ? '升级' : '已觉醒'} · Lv.${next.levels[chosen.id]}`
      : earnedCore ? '星核研制完成 · 星核 ×1' : `星核研制进度 ${next.refineProgress}/${RESEARCH_REFINE_STEPS}` };
}

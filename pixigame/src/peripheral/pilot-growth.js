import { AIRCRAFTS } from '../pilots.js';
import { PERIPHERAL_PILOT_PASSIVES } from './config.js';
import { PILOT_SSR_PITY, PILOT_UR_PITY, recruitMisses, trailingRecruitMisses } from './recruit-tuning.js';

export const PILOT_MAX_STARS = 5;
export const PILOT_DRAW_CHANCE = .2;
export const PILOT_PITY = 10;
export const PILOT_SHARDS = 10;
export const PILOT_OVERFLOW_SHARDS = 30;
const clamp = n => Math.min(5, Math.max(0, Math.floor(Number(n) || 0)));
export const sanitizePilotStars = value => Object.fromEntries(AIRCRAFTS.map(p => [p.id, clamp(value?.[p.id])]));
const pct = n => Number((n * 100).toFixed(1));

export function sanitizePilotRecruit(value = {}, history = [], fallbackTotal = 0) {
  value = value && typeof value === 'object' ? value : {};
  const counter = (key, limit, rarities) => value[key] != null && Number.isFinite(Number(value[key]))
    ? recruitMisses(value[key], limit)
    : trailingRecruitMisses(history, 'pilot', reward => {
      const rarity = AIRCRAFTS.find(p => p.id === reward.id)?.rarity || reward.rarity;
      return rarities.includes(rarity);
    }, limit);
  return { version: 2, pity: recruitMisses(value.pity, PILOT_PITY),
    ssrPity: counter('ssrPity', PILOT_SSR_PITY, ['SSR', 'UR']),
    urPity: counter('urPity', PILOT_UR_PITY, ['UR']),
    totalPulls: Math.min(1e9, Math.max(0, Math.floor(Number(value.totalPulls ?? fallbackTotal) || 0))) };
}

// Milestones strengthen each pilot's own passive, not a shared attack bonus.
export function pilotPassive(id, stars = 0) {
  const base = PERIPHERAL_PILOT_PASSIVES[id];
  if (!base) return { name: '', description: '', modifiers: {} };
  const strength = [1, 1.15, 1.3, 1.6, 1.8, 2.2][clamp(stars)];
  const modifiers = Object.fromEntries(Object.entries(base.modifiers).map(([key, value]) => {
    const scaled = key.endsWith('Multiplier') ? 1 + (value - 1) * strength
      : /Interval|Duration/.test(key) ? value : value * strength;
    return [key, Number(scaled.toFixed(4))];
  }));
  const m = modifiers;
  const descriptions = {
    'pilot-01': `闪避冷却缩短 ${pct(1 - m.dodgeCooldownMultiplier)}%。`,
    'pilot-02': `每 ${m.healInterval} 秒恢复 ${pct(m.healMaxHpRatio)}% 最大耐久。`,
    'pilot-03': `所有已装武器基础伤害提高 ${pct(m.damageMultiplier - 1)}%。`,
    'pilot-04': `经验吸取范围扩大 ${pct(m.pickupRadiusMultiplier - 1)}%。`,
    'pilot-05': `所有已装武器对 Boss 的伤害提高 ${pct(m.bossDamageMultiplier - 1)}%。`,
    'pilot-06': `已装武器攻击有 ${pct(m.critChance)}% 概率暴击，暴击造成 ${pct(1.75 + m.critMultiplierBonus)}% 伤害。`,
    'pilot-07': `当前飞机最大耐久提高 ${pct(m.maxHpMultiplier - 1)}%。`,
    'pilot-08': `本局获得的经验提高 ${pct(m.xpMultiplier - 1)}%。`,
    'pilot-09': `所有受到的伤害降低 ${pct(1 - m.damageTakenMultiplier)}%。`,
    'pilot-10': `每 ${m.shieldInterval} 秒获得相当于最大耐久 ${pct(m.shieldMaxHpRatio)}% 的护盾，持续 ${m.shieldDuration} 秒，不叠加。`,
  };
  return { name: base.name, description: descriptions[id], modifiers };
}

// Independent of the legacy aircraft pool. Ten-pulls advance all counters per draw.
export function planPilotRecruit({ stars, owned, ownedAircraft, pity = 0, ssrPity = 0, urPity = 0, count, firstStar = 0, rng = Math.random }) {
  const nextStars = sanitizePilotStars(stars), roster = new Set(owned), aircraft = new Set(ownedAircraft);
  const recruitedPilots = [], rewards = [];
  let shards = 0, misses = recruitMisses(pity, PILOT_PITY);
  let ssrMisses = recruitMisses(ssrPity, PILOT_SSR_PITY), urMisses = recruitMisses(urPity, PILOT_UR_PITY);
  for (let i = 0; i < count; i++) {
    const guarantee = urMisses >= PILOT_UR_PITY - 1 ? 'ur' : ssrMisses >= PILOT_SSR_PITY - 1 ? 'ssr' : null;
    if (!guarantee && misses < PILOT_PITY - 1 && rng() >= PILOT_DRAW_CHANCE) {
      ssrMisses++; urMisses++;
      misses++; shards += PILOT_SHARDS;
      rewards.push({ id: 'aircraftShards', name: `通用飞机碎片 ×${PILOT_SHARDS}`, type: 'aircraftShards', amount: PILOT_SHARDS, isNew: false });
      continue;
    }
    misses = 0;
    const roll = rng(), rarity = guarantee === 'ur' ? 'UR' : guarantee === 'ssr' ? (roll < 5 / 6 ? 'SSR' : 'UR')
      : roll < .74 ? 'R' : roll < .94 ? 'SR' : roll < .99 ? 'SSR' : 'UR';
    ssrMisses = ['SSR', 'UR'].includes(rarity) ? 0 : ssrMisses + 1;
    urMisses = rarity === 'UR' ? 0 : urMisses + 1;
    const rarityCandidates = AIRCRAFTS.filter(p => p.rarity === rarity);
    // Keep the rarity roll and pity intact while completed pilots make room for
    // unfinished peers. Ownership wins over a malformed stored star count.
    const unfinished = rarityCandidates.filter(p => !roster.has(p.id) || nextStars[p.id] < PILOT_MAX_STARS);
    const candidates = unfinished.length ? unfinished : rarityCandidates;
    const p = candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
    const isNew = !roster.has(p.id), beforeStars = nextStars[p.id];
    const overflow = !isNew && beforeStars === PILOT_MAX_STARS;
    if (isNew) { recruitedPilots.push(p.id); nextStars[p.id] = firstStar===1?1:0; }
    else if (overflow) shards += PILOT_OVERFLOW_SHARDS;
    else nextStars[p.id]++;
    const aircraftIsNew = !aircraft.has(p.id);
    roster.add(p.id); aircraft.add(p.id);
    rewards.push({ id: p.id, pilotId: p.id, pilotName: p.name, isNew, beforeStars, stars: nextStars[p.id],
      name: isNew ? `${p.name} · 解锁` : overflow ? `${p.name} · 满星转碎片 ×${PILOT_OVERFLOW_SHARDS}` : `${p.name} · ${beforeStars} → ${nextStars[p.id]} 星`,
      type: overflow ? 'aircraftShards' : 'pilot', amount: overflow ? PILOT_OVERFLOW_SHARDS : 1,
      rarity: p.rarity, guarantee, aircraftIsNew, aircraftId: p.id });
  }
  return { stars: nextStars, pity: misses, ssrPity: ssrMisses, urPity: urMisses, shards, rewards, recruitedPilots, ownedAircraft: [...aircraft] };
}

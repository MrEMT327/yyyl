import { COMMON_WEAPONS, WEAPON_QUALITIES } from '../fixed-parts/common-weapons.js';
import { QUALITY_FRAGMENT_COSTS, sanitizeWeaponProgress, upgradeCommonWeapon } from '../fixed-parts/common-weapon-progress.js';
import { weaponLevelCap } from '../fixed-parts/weapon-progression-config.js';

const MAX_QUALITY = QUALITY_FRAGMENT_COSTS.length;
const fail = message => ({ ok: false, message });

// The token describes the complete canonical input, rather than a UI-generated
// cost. Any inventory change invalidates an old batch confirmation.
function inventoryToken(progress) {
  return `workshop-v1:${JSON.stringify(progress)}`;
}

export function planWorkshopBatch(value) {
  const initial = sanitizeWeaponProgress(value);
  let progress = initial;
  const steps = [];
  // Stable catalog order resolves ties. Each owned weapon advances at most once.
  const ids = Object.keys(COMMON_WEAPONS).sort((a, b) => initial.weapons[a].qualityRank - initial.weapons[b].qualityRank);
  for (const id of ids) {
    const fromQuality = progress.weapons[id].qualityRank;
    const result = upgradeCommonWeapon(progress, id, 'quality');
    if (!result.ok) continue;
    steps.push({ id, name: COMMON_WEAPONS[id].name, fromQuality, toQuality: result.state.weapons[id].qualityRank,
      cost: result.cost, specific: result.specific, universal: result.universal });
    progress = result.state;
  }
  return { steps, totalSpecific: steps.reduce((sum, step) => sum + step.specific, 0),
    totalUniversal: steps.reduce((sum, step) => sum + step.universal, 0), token: inventoryToken(initial) };
}

export function createWorkshopSnapshot(value, { slots = {}, aircraft = {} } = {}) {
  const progress = sanitizeWeaponProgress(value);
  return { maxQuality: MAX_QUALITY, universalFragments: progress.universalFragments,
    items: Object.values(COMMON_WEAPONS).map(weapon => {
      const record = progress.weapons[weapon.id];
      const cost = QUALITY_FRAGMENT_COSTS[record.qualityRank] || 0;
      const specificCost = Math.min(record.fragments, cost), universalCost = cost - specificCost;
      const preview = upgradeCommonWeapon(progress, weapon.id, 'quality');
      const equippedSlots = Object.entries(slots).filter(([, id]) => id === weapon.id).map(([slot]) => slot);
      const equippedOn = Object.entries(aircraft).flatMap(([aircraftId, fit]) =>
        Object.entries(fit.slots || {}).filter(([, id]) => id === weapon.id).map(([slot]) => ({ aircraftId, slot })));
      return { id: weapon.id, name: weapon.name, modelId: weapon.modelId, color: weapon.color,
        qualityRank: record.qualityRank, qualityName: WEAPON_QUALITIES[record.qualityRank],
        nextQualityRank: record.qualityRank < MAX_QUALITY ? record.qualityRank + 1 : null,
        nextQualityName: WEAPON_QUALITIES[record.qualityRank + 1] || '',
        owned: record.unlocked, equipped: equippedSlots.length > 0, equippedSlots, equippedOn,
        fragments: record.fragments, cost, specificCost, universalCost,
        canSynthesize: preview.ok, reason: preview.ok ? '' : preview.reason,
        currentEffect: `基础伤害 +${record.qualityRank * 2.5}%；等级上限 Lv.${weaponLevelCap(record.qualityRank)}`,
        nextEffect: record.qualityRank < MAX_QUALITY ? `基础伤害 +${(record.qualityRank + 1) * 2.5}%；等级上限 Lv.${weaponLevelCap(record.qualityRank + 1)}` : '' };
    }), batch: planWorkshopBatch(progress) };
}

export function synthesizeWorkshopWeapon(value, id, expectedQualityRank) {
  const progress = sanitizeWeaponProgress(value), weapon = progress.weapons[id];
  if (!weapon?.unlocked) return fail('请先获得完整武器');
  if (!Number.isInteger(expectedQualityRank) || weapon.qualityRank !== expectedQualityRank) {
    return fail('武器品质已变化，请重新选择后合成');
  }
  const result = upgradeCommonWeapon(progress, id, 'quality');
  if (!result.ok) return fail(result.reason);
  return { ok: true, message: `${COMMON_WEAPONS[id].name}已升至 ${result.state.weapons[id].qualityRank} 星 · ${WEAPON_QUALITIES[result.state.weapons[id].qualityRank]}`,
    state: result.state, step: { id, name: COMMON_WEAPONS[id].name, fromQuality: weapon.qualityRank,
      toQuality: result.state.weapons[id].qualityRank, cost: result.cost, specific: result.specific, universal: result.universal } };
}

export function synthesizeWorkshopBatch(value, token) {
  let progress = sanitizeWeaponProgress(value);
  const plan = planWorkshopBatch(progress);
  if (typeof token !== 'string' || token !== plan.token) return fail('仓库材料已变化，请重新查看一键合成方案');
  if (!plan.steps.length) return fail('暂无可合成的武器');
  for (const step of plan.steps) {
    const result = upgradeCommonWeapon(progress, step.id, 'quality');
    if (!result.ok || result.cost !== step.cost || result.specific !== step.specific || result.universal !== step.universal) {
      return fail('合成条件已变化，本次未消耗材料');
    }
    progress = result.state;
  }
  return { ok: true, message: `已为 ${plan.steps.length} 件武器升星，各提升 1 星`, state: progress, ...plan };
}

import balanceConfig from './generated/balance-config.json';

const numberOr = (value, fallback = 1) => (Number.isFinite(Number(value)) ? Number(value) : fallback);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const BALANCE_CONFIG = balanceConfig;
export const BALANCE_GLOBAL = Object.freeze({ ...balanceConfig.global });
export const DIFFICULTIES = Object.freeze(balanceConfig.difficulties.map((entry) => Object.freeze({ ...entry })));
export const DIFFICULTY_MAP = new Map(DIFFICULTIES.map((entry) => [entry.id, entry]));
export const ENEMY_TYPE_MAP = new Map(balanceConfig.enemyTypes.map((entry) => [entry.id, Object.freeze({ ...entry })]));
// Existing chapter-themed relay hull now has a real sniper profile, not scout fallback values.
ENEMY_TYPE_MAP.set('relay', Object.freeze({...ENEMY_TYPE_MAP.get('turret'),id:'relay',label:'狙击中继机',baseHp:30,score:350,xp:3,bulletDamage:18,bulletSpeed:210,collisionDamage:22}));
export const STAGE_BALANCE_MAP = new Map(balanceConfig.stages.map((entry) => [entry.id, Object.freeze({
  ...entry,
  waveWeights: Object.freeze({ ...(entry.waveWeights || {}) }),
})]));
export const WAVE_PATTERN_MAP = new Map(balanceConfig.wavePatterns.map((entry) => [entry.id, Object.freeze({ ...entry })]));
export const BOSS_PATTERN_MAP = new Map(balanceConfig.bossPatterns.map((entry) => [entry.id, Object.freeze({ ...entry })]));

export function getDifficultyBalance(id) {
  return DIFFICULTY_MAP.get(id) || DIFFICULTIES[0];
}

export function getEnemyTypeBalance(id) {
  return ENEMY_TYPE_MAP.get(id) || ENEMY_TYPE_MAP.get('scout');
}

export function getStageBalance(id) {
  return STAGE_BALANCE_MAP.get(id) || balanceConfig.stages[0];
}

export function getWavePatternBalance(id) {
  return WAVE_PATTERN_MAP.get(id) || WAVE_PATTERN_MAP.get('vanguard');
}

export function getBossPatternBalance(id) {
  return BOSS_PATTERN_MAP.get(id) || BOSS_PATTERN_MAP.get('charge');
}

export function getPowerPressure(currentPower, recommendedPower, pressureScale = 1) {
  const rawRatio = clamp(
    Math.max(1, numberOr(currentPower, 1) / Math.max(1, numberOr(recommendedPower, 1))),
    1,
    numberOr(BALANCE_GLOBAL.powerRatioCap, 3),
  );
  const ratio = 1 + (rawRatio - 1) * clamp(numberOr(pressureScale, 1), 0, 1.5);
  return {
    rawRatio,
    ratio,
    enemyHp: ratio ** numberOr(BALANCE_GLOBAL.powerHpExponent, 0.72),
    bossHp: ratio ** numberOr(BALANCE_GLOBAL.powerBossHpExponent, 0.8),
    enemyDamage: ratio ** numberOr(BALANCE_GLOBAL.powerDamageExponent, 0.22),
    bossDamage: ratio ** numberOr(BALANCE_GLOBAL.powerBossDamageExponent, 0.28),
    enemySpeed: ratio ** numberOr(BALANCE_GLOBAL.powerSpeedExponent, 0.08),
    bulletSpeed: ratio ** numberOr(BALANCE_GLOBAL.powerBulletSpeedExponent, 0.08),
    spawnInterval: ratio ** -numberOr(BALANCE_GLOBAL.powerSpawnExponent, 0.16),
    enemyCooldown: ratio ** -numberOr(BALANCE_GLOBAL.powerCooldownExponent, 0.12),
  };
}

/**
 * Estimates the loadout power needed to clear a stage at the selected
 * difficulty. The spreadsheet recommendation is the easy-mode baseline.
 *
 * Clearing pressure combines damage throughput (HP and spawn rate), boss
 * endurance, ordinary barrage attrition, and boss barrage attrition. The
 * calibrated exponent converts that compound pressure back into the game's
 * broadly linear profile-power scale.
 */
export function estimateStagePower(stage, difficultyId = 'easy') {
  const mode = getDifficultyBalance(difficultyId);
  const baseline = getDifficultyBalance('easy');
  const ratio = (value, baselineValue) => (
    Math.max(0.01, numberOr(value, 1)) / Math.max(0.01, numberOr(baselineValue, 1))
  );
  const inverseRatio = (value, baselineValue) => (
    Math.max(0.01, numberOr(baselineValue, 1)) / Math.max(0.01, numberOr(value, 1))
  );
  const components = {
    waveClear: ratio(mode.enemyHp, baseline.enemyHp)
      * inverseRatio(mode.spawnInterval, baseline.spawnInterval),
    bossClear: ratio(mode.bossHp, baseline.bossHp),
    waveSurvival: ratio(mode.enemyDamage, baseline.enemyDamage)
      * ratio(mode.bulletSpeed, baseline.bulletSpeed)
      * inverseRatio(mode.enemyCooldown, baseline.enemyCooldown)
      * ratio(mode.enemySpeed, baseline.enemySpeed) ** 0.35,
    bossSurvival: ratio(mode.bossDamage, baseline.bossDamage)
      * inverseRatio(mode.bossCooldown, baseline.bossCooldown)
      * ratio(mode.bossSpeed, baseline.bossSpeed) ** 0.35,
  };
  const compoundThreat = (
    components.waveClear ** 0.38
    * components.bossClear ** 0.22
    * components.waveSurvival ** 0.25
    * components.bossSurvival ** 0.15
  );
  const eliteFactor = 1 + Math.max(0, numberOr(mode.eliteChance, 0) - numberOr(baseline.eliteChance, 0)) * 0.8;
  const difficultyFactor = Math.max(1, compoundThreat ** 0.55 * eliteFactor);
  const basePower = Math.max(100, numberOr(stage?.recommendedPower, 100));
  const step = stage?.mainlineBalanceVersion ? 50 : 100;
  const recommendedPower = Math.max(100, Math.round(basePower * difficultyFactor / step) * step);
  return Object.freeze({
    recommendedPower,
    basePower,
    difficultyFactor,
    components: Object.freeze(components),
  });
}

export function ratePowerReadiness(currentPower, recommendedPower) {
  const ratio = Math.max(0, numberOr(currentPower, 0)) / Math.max(1, numberOr(recommendedPower, 1));
  if (ratio >= 1.15) {
    return Object.freeze({ id: 'advantage', label: '高于参考', ratio, color: '#78f1a5', detail: '仍需注意配装与走位' });
  }
  if (ratio >= 0.95) {
    return Object.freeze({ id: 'ready', label: '接近参考', ratio, color: '#78f1e5', detail: '参考配装区间，非必胜保证' });
  }
  if (ratio >= 0.82) {
    return Object.freeze({ id: 'strained', label: '略低于参考', ratio, color: '#ffd36e', detail: '可尝试调整配装' });
  }
  if (ratio >= 0.68) {
    return Object.freeze({ id: 'danger', label: '低于参考', ratio, color: '#ff9b62', detail: '建议强化，不限制出击' });
  }
  return Object.freeze({ id: 'blocked', label: '建议强化', ratio, color: '#ff6376', detail: '战力仅供参考，不限制出击' });
}

export function createRunBalance(stage, difficultyId, currentPower) {
  const mode = getDifficultyBalance(difficultyId);
  const estimate = estimateStagePower(stage, difficultyId);
  const pressure = getPowerPressure(
    stage.mainlineBalanceVersion ? 0 : currentPower,
    estimate.recommendedPower,
    mode.powerPressureScale,
  );
  const sourceBossPattern = getBossPatternBalance(stage.pattern);
  const bossPattern = stage.mainlineBalanceVersion ? Object.freeze({ ...sourceBossPattern,
    bulletDamage: numberOr(stage.bossBulletDamage, sourceBossPattern.bulletDamage), movement: 1, cooldown: 1 }) : sourceBossPattern;
  return Object.freeze({
    configVersion: stage.mainlineBalanceVersion || balanceConfig.meta.version,
    currentPower,
    recommendedPower: estimate.recommendedPower,
    baseRecommendedPower: estimate.basePower,
    rawPowerRatio: pressure.rawRatio,
    powerRatio: pressure.ratio,
    enemyHp: numberOr(stage.enemyHp)
      * numberOr(mode.enemyHp)
      * pressure.enemyHp
      * numberOr(BALANCE_GLOBAL.enemyHpScale, 1),
    enemySpeed: numberOr(stage.enemySpeed) * numberOr(mode.enemySpeed) * pressure.enemySpeed,
    enemyDamage: numberOr(stage.enemyDamage) * numberOr(mode.enemyDamage) * pressure.enemyDamage,
    bulletSpeed: numberOr(stage.bulletSpeed) * numberOr(mode.bulletSpeed) * pressure.bulletSpeed,
    spawnInterval: numberOr(stage.spawnInterval) * numberOr(mode.spawnInterval) * pressure.spawnInterval,
    enemyCooldown: numberOr(stage.enemyCooldown) * numberOr(mode.enemyCooldown) * pressure.enemyCooldown,
    waveSize: numberOr(stage.waveSize),
    eliteChance: clamp(numberOr(stage.eliteChance, 0) + numberOr(mode.eliteChance, 0), 0, 0.75),
    eliteHp: numberOr(stage.eliteHp, 4.2),
    bossHp: numberOr(stage.bossHp) * numberOr(mode.bossHp) * pressure.bossHp,
    bossDamage: numberOr(stage.bossDamage) * numberOr(mode.bossDamage) * pressure.bossDamage,
    bossSpeed: numberOr(stage.bossSpeed) * numberOr(mode.bossSpeed) * numberOr(bossPattern.movement),
    bossCooldown: numberOr(stage.bossCooldown) * numberOr(mode.bossCooldown) * pressure.enemyCooldown * numberOr(bossPattern.cooldown),
    bossPattern,
    rewardScale: numberOr(stage.rewardScale) * numberOr(mode.rewardScale),
  });
}

export function weightedWavePattern(stage, stageIndex, elapsed, random = Math.random) {
  const candidates = Object.entries(stage.waveWeights || {})
    .map(([id, weight]) => ({ pattern: WAVE_PATTERN_MAP.get(id), id, weight: Math.max(0, numberOr(weight, 0)) }))
    .filter(({ pattern, weight }) => (
      pattern
      && weight > 0
      && stageIndex >= numberOr(pattern.minStageIndex, 0)
      && elapsed >= numberOr(pattern.minStageSeconds, 0)
    ));
  if (!candidates.length) return 'vanguard';
  const total = candidates.reduce((sum, entry) => sum + entry.weight, 0);
  let roll = random() * total;
  for (const entry of candidates) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return candidates[candidates.length - 1].id;
}

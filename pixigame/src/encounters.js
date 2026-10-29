export const ENEMY_SKILLS = Object.freeze([
  'shot',
  'fan',
  'dash',
  'snipe',
  'laser',
  'wall',
  'mortar',
  'pulse',
]);

const basicShotPattern = (bulletCount, waveCount) => Object.freeze({
  bulletCount,
  waveCount,
  waveInterval: 0.5,
  // Keep every multi-shot volley as a compact half-arc rather than a wide fan.
  spread: bulletCount > 1 ? 0.44 / (bulletCount - 1) : 0,
});

export const BASIC_SHOT_PATTERNS = Object.freeze(
  Array.from({ length: 17 }, (_, stageIndex) => {
    const stage = stageIndex + 1;
    const waveCount = stage <= 5 ? 1 : stage <= 10 ? 2 : stage <= 14 ? 3 : stage <= 16 ? 4 : 5;
    return basicShotPattern(Math.min(5, stage), waveCount);
  }),
);

const encounter = (enemySkillCount, bossMoves) => Object.freeze({
  enemySkillPool: Object.freeze(ENEMY_SKILLS.slice(0, enemySkillCount)),
  bossMoves: Object.freeze(bossMoves.map((phase) => Object.freeze([...phase]))),
});

// Enemy silhouettes are reused, while their skills follow a readable, cumulative
// progression. One new mechanism unlocks every two chapters; from chapter fifteen
// onward all eight core skill mechanisms can appear.
export const STAGE_ENCOUNTERS = Object.freeze([
  encounter(1, [['dash', 'fan'], ['dash', 'fan', 'pulse'], ['dash', 'radial', 'fan']]),
  encounter(1, [['wall', 'fan'], ['wall', 'pulse', 'fan'], ['wall', 'dash', 'pulse']]),
  encounter(2, [['twinLaser', 'fan'], ['twinLaser', 'dash', 'fan'], ['twinLaser', 'radial', 'dash']]),
  encounter(2, [['pincer', 'wave'], ['pincer', 'mortar', 'wave'], ['pincer', 'radial', 'mortar']]),
  encounter(3, [['radial', 'dash'], ['radial', 'laser', 'dash'], ['radial', 'pulse', 'dash']]),
  encounter(3, [['lances', 'fan'], ['lances', 'wall', 'fan'], ['lances', 'radial', 'dash']]),
  encounter(4, [['balanceLaser', 'wall'], ['balanceLaser', 'fan', 'wall'], ['balanceLaser', 'dash', 'radial']]),
  encounter(4, [['venomZones', 'fan'], ['venomZones', 'dash', 'fan'], ['venomZones', 'radial', 'dash']]),
  encounter(5, [['arrowRain', 'lances'], ['arrowRain', 'dash', 'lances'], ['arrowRain', 'radial', 'lances']]),
  encounter(5, [['wall', 'pulse'], ['wall', 'dash', 'pulse'], ['wall', 'radial', 'dash']]),
  encounter(6, [['wave', 'mortar'], ['wave', 'fan', 'mortar'], ['wave', 'radial', 'dash']]),
  encounter(6, [['spiral', 'dash'], ['spiral', 'fan', 'dash'], ['spiral', 'radial', 'mortar']]),
  encounter(7, [['warDash', 'fan'], ['warDash', 'wall', 'fan'], ['warDash', 'radial', 'dash']]),
  encounter(7, [['aegisCross', 'fan'], ['aegisCross', 'wall', 'fan'], ['aegisCross', 'radial', 'dash']]),
  encounter(8, [['underworldMines', 'spiral'], ['underworldMines', 'dash', 'spiral'], ['underworldMines', 'radial', 'wall']]),
  encounter(8, [['tsunami', 'mortar'], ['tsunami', 'fan', 'mortar'], ['tsunami', 'radial', 'dash']]),
  encounter(8, [['thunder', 'lances'], ['thunder', 'wall', 'lances'], ['thunder', 'radial', 'dash', 'thunder']]),
]);

export function getStageEncounter(stageIndex = 0) {
  return STAGE_ENCOUNTERS[Math.max(0, Math.min(STAGE_ENCOUNTERS.length - 1, stageIndex))] || STAGE_ENCOUNTERS[0];
}

export function getEnemyAbility(stageIndex, spawnIndex = 0) {
  const skills = getStageEncounter(stageIndex).enemySkillPool;
  return skills[Math.abs(Math.trunc(spawnIndex)) % skills.length] || 'shot';
}

export function getBasicShotPattern(stageIndex = 0) {
  return BASIC_SHOT_PATTERNS[Math.max(0, Math.min(BASIC_SHOT_PATTERNS.length - 1, stageIndex))];
}

export function getBossMoveDeck(stageIndex, phase = 1) {
  const deck = getStageEncounter(stageIndex).bossMoves[Math.max(0, Math.min(2, phase - 1))];
  return deck || ['fan'];
}

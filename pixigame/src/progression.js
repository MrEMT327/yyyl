export const SKILL_PATH_UNLOCK_ORDER = Object.freeze([
  'split',
  'red',
  'blue',
  'ricochet',
  'prism',
  'mech',
  'frost',
  'cluster',
  'sword',
  'tether',
  'laser',
  'execute',
]);

export const STARTER_ASSEMBLY_MODULE_IDS = Object.freeze([
  'wing-swept',
  'engine-ion',
  'tail-vector',
  'base-cannon',
]);

export const STAGE_MODULE_REWARDS = Object.freeze([
  ['wing-razor', 'tail-stabilizer'],
  ['engine-afterburn', 'red-hunter'],
  ['wing-aegis', 'engine-pulse'],
  ['tail-aegis', 'blue-vortex'],
  ['wing-falcon', 'engine-quiet'],
  ['tail-hunter', 'frost-shard'],
  ['wing-prism', 'engine-repair'],
  ['tail-repair', 'prism-lens'],
  ['wing-borealis', 'engine-overclock'],
  ['tail-command', 'gravity-rail'],
  ['wing-tempest', 'engine-harvest'],
  ['tail-phase', 'solar-plasma'],
  ['wing-vanguard', 'engine-siege'],
  ['tail-reactor', 'meteor-array'],
  ['wing-reclaimer', 'engine-command'],
  ['tail-fortune'],
  ['wing-eclipse', 'engine-singularity', 'tail-omega'],
].map((rewards) => Object.freeze(rewards)));

export function unlockedSkillPathIds(highestCleared = -1, debugUnlockAll = false) {
  if (debugUnlockAll) return [...SKILL_PATH_UNLOCK_ORDER];
  const clearedCount = Math.max(0, Math.floor(Number(highestCleared) || 0) + 1);
  const unlockedCount = Math.min(SKILL_PATH_UNLOCK_ORDER.length, 4 + clearedCount);
  return SKILL_PATH_UNLOCK_ORDER.slice(0, unlockedCount);
}

export function stageModuleRewardIds(stageIndex) {
  return [...(STAGE_MODULE_REWARDS[stageIndex] || [])];
}

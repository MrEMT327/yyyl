export const RARITIES = {
  common: { label: '强化', weight: 58 },
  rare: { label: '进阶', weight: 30 },
  epic: { label: '质变', weight: 13 },
  legendary: { label: '终极联动', weight: 5 },
};

export function createRunStats() {
  return {
    // The pilot's unupgraded attack baseline. Equipment, resonance and
    // weapon effects multiply from here.
    damageMultiplier: 1.3,
    fireRateMultiplier: 1,
    moveSpeedMultiplier: 1,
    projectileSpeedMultiplier: 1,
    projectileScale: 1,
    bossDamageMultiplier: 1,
    eliteDamageMultiplier: 1,
    extraProjectiles: 0,
    pierce: 0,
    critChance: 0.04,
    critMultiplier: 1.75,
    magnetRange: 220,
    xpMultiplier: 1,
    maxLives: 3,
    maxHp: 100,
    maxHpMultiplier: 1,
    damageTakenMultiplier: 1,
    collisionDamageTakenMultiplier: 1,
    activeCooldownMultiplier: 1,
    activeDamageMultiplier: 1,
    supportDamageMultiplier: 1,
    supportFireRateMultiplier: 1,
    enemyBulletSpeedMultiplier: 1,
    healingMultiplier: 1,
    magnetRangeMultiplier: 1,
    assemblySupports: [],
    burnDps: 0,
    burnDuration: 0,
    frostChance: 0,
    frostStrength: 0,
    frostDuration: 2.5,
    chainChance: 0,
    chainDamage: 0,
    chainJumps: 1,
    killBlastRadius: 0,
    killBlastDamage: 0,
    droneCount: 0,
    droneDamage: 1.2,
    droneFireInterval: 0.42,
    droneFireRate: 1,
    droneHomingStrength: 3.8,
    missileLevel: 0,
    shieldLevel: 0,
    levelHeal: 0,
    lowHealthPower: 0,
    redOverdrive: 0,
    blueOverdrive: 0,
    swarmOverdrive: 0,
    fortressOverdrive: 0,
    homingStrengthMultiplier: 1,
    spiralScale: 1,
    spiralFrequency: 1,
    prismLevel: 0,
    ricochetBounces: 0,
    ricochetRetention: 0.78,
    ricochetScale: 1,
    redVulnerability: 0,
    redVulnerabilityDuration: 0,
    blueStunChance: 0,
    blueStunDuration: 0,
    prismStunChance: 0,
    prismStunDuration: 0,
    ricochetKnockback: 0,
    mechVulnerability: 0,
    mechVulnerabilityDuration: 0,
    splitKnockback: 0,
    executeChance: 0,
    executeMultiplier: 1,
    executePityEvery: 0,
    executeCounter: 0,
    executeSwords: 0,
    executeSwordDamage: 0.56,
    splitLevel: 0,
    splitDamage: 0.36,
    absoluteZero: 0,
    baseShots: 1,
    redShots: 0,
    redDamage: 0.82,
    blueShots: 0,
    blueDamage: 0.74,
    prismShots: 0,
    prismDamage: 0.72,
    ricochetShots: 0,
    ricochetDamage: 0.94,
    frostShots: 0,
    frostDamage: 0.76,
    clusterShots: 0,
    clusterDamage: 0.9,
    clusterFragments: 0,
    clusterFragmentDamage: 0.32,
    clusterFuse: 0.48,
    clusterExplosionRadius: 36,
    clusterVolleyEvery: 5,
    clusterKnockback: 0,
    swordShots: 0,
    swordDamage: 0.62,
    swordBossMultiplier: 3,
    swordGuidance: 5.2,
    swordDelay: 0.3,
    swordAttackCount: 5,
    swordPierce: 0,
    swordVolleyEvery: 4,
    swordVulnerability: 0,
    swordVulnerabilityDuration: 0,
    tetherPairs: 0,
    tetherDamage: 0.52,
    tetherTickDamage: 0.2,
    tetherSpan: 54,
    tetherVolleyEvery: 3,
    tetherStunChance: 0,
    tetherStunDuration: 0,
    laserDps: 0,
    laserTargets: 1,
    laserRange: 920,
    laserBurnDps: 0,
    laserBurnDuration: 0,
    laserBossMultiplier: 1,
  };
}

export const ROUTES = [
  { id: 'red', icon: '▲', name: '赤猎制导', color: '#ff5b52', description: '自动追踪与猎杀标记', chain: '激活 → 弹数 → 制导 → 猎杀 → 赤色天网', buff: '破甲 · 命中施加易伤' },
  { id: 'blue', icon: '≋', name: '蓝涡螺旋', color: '#4778ff', description: '螺旋速度、振幅与贯穿', chain: '激活 → 弹数 → 转速 → 振幅 → 深海奇点', buff: '失衡 · 概率短暂眩晕' },
  { id: 'prism', icon: '◇', name: '棱角折射', color: '#a56cff', description: '像闪电链一样连续折向敌群', chain: '激活 → 光束 → 链跳 → 聚焦 → 棱镜天幕', buff: '电麻 · 折射可打断敌人' },
  { id: 'ricochet', icon: '●', name: '重力弹球', color: '#ff913d', description: '弹球在战区边界反弹', chain: '激活 → 弹数 → 反弹 → 质量 → 引力球场', buff: '冲击 · 命中击退敌人' },
  { id: 'mech', icon: '◈', name: '蜂群僚机', color: '#ffd24a', description: '双机起步，自动追踪并呼叫导弹', chain: '双机激活 → 编队 → 射速 → 导弹 → 航母蜂群', buff: '扫描 · 僚机命中施加易伤' },
  { id: 'frost', icon: '❉', name: '寒霜冰弹', color: '#45e2e8', description: '冻结敌潮并触发碎冰', chain: '激活 → 弹数 → 冻结 → 碎冰 → 绝对零度', buff: '寒缓 · 冻结并降低移速' },
  { id: 'cluster', icon: '✺', name: '天穹集束炮', color: '#ff704d', description: '炮弹空爆后散射子母弹', chain: '激活 → 子母弹 → 装药 → 饱和 → 天火覆盖', buff: '震退 · 爆风推离敌群' },
  { id: 'sword', icon: '✧', name: '万剑归宗', color: '#d8f4ff', description: '剑阵同时归宗，命中首领伤害提升至5倍', chain: '激活 → 剑数 → 归宗 → 穿心 → 天剑无量', buff: '剑痕 · 连续命中叠加易伤' },
  { id: 'tether', icon: '∞', name: '双星锁链', color: '#65ffb5', description: '双球并行，能量锁链横扫敌阵', chain: '激活 → 双星 → 链宽 → 脉冲 → 引力枷锁', buff: '束缚 · 锁链概率定身' },
  { id: 'laser', icon: '⌁', name: '灼日锁定', color: '#ffdf5f', description: '持续锁定敌人并叠加灼烧', chain: '激活 → 功率 → 多锁 → 过热 → 日冕审判', buff: '灼烧 · 持续造成火焰伤害' },
  { id: 'execute', icon: '✦', name: '量子裁决', color: '#ff4fa3', description: '高倍率裁决与垂直光剑', chain: '激活 → 概率 → 倍率 → 光剑 → 终焉骰局' },
  { id: 'split', icon: 'Ψ', name: '基础白弹', color: '#7be65a', description: '对白弹进行齐射、贯穿与分裂改造', chain: '常驻 → 齐射 → 分裂 → 贯穿 → 无尽机炮', buff: '动能 · 白弹命中轻微击退' },
];

export const ROUTE_MAP = new Map(ROUTES.map((route) => [route.id, route]));
export const MAX_NORMAL_SKILL_PATHS = 5;

const makeRecipeRequirements = (...requirements) => Object.freeze(
  requirements.map(([skillId, required]) => Object.freeze({ skillId, required })),
);

// Each recipe must satisfy at least the corresponding *_cap unlock check below.
// A route core is a visible first recipe step; split is the only route without
// a core because its base projectile is always available.
const ULTIMATE_RECIPE_REQUIREMENTS = Object.freeze({
  red: makeRecipeRequirements(['red_core', 1], ['red_count', 2], ['red_guidance', 2]),
  blue: makeRecipeRequirements(['blue_core', 1], ['blue_count', 2], ['blue_spin', 2]),
  prism: makeRecipeRequirements(['prism_core', 1], ['prism_count', 1], ['prism_reflect', 3]),
  ricochet: makeRecipeRequirements(['ricochet_core', 1], ['ricochet_count', 2], ['ricochet_bounce', 2]),
  mech: makeRecipeRequirements(['mech_core', 1], ['mech_count', 2], ['mech_missile', 2]),
  frost: makeRecipeRequirements(['frost_core', 1], ['frost_count', 2], ['frost_chance', 2]),
  cluster: makeRecipeRequirements(['cluster_core', 1], ['cluster_count', 2], ['cluster_fragments', 2]),
  sword: makeRecipeRequirements(['sword_core', 1], ['sword_count', 2], ['sword_guidance', 2]),
  tether: makeRecipeRequirements(['tether_core', 1], ['tether_count', 1], ['tether_span', 3]),
  laser: makeRecipeRequirements(['laser_core', 1], ['laser_power', 2], ['laser_heat', 2]),
  execute: makeRecipeRequirements(['execute_core', 1], ['execute_chance', 2], ['execute_multi', 2]),
  split: makeRecipeRequirements(['split_level', 2], ['split_damage', 3]),
});

const owned = (acquired, path) => path === 'split' || (acquired[`${path}_core`] || 0) > 0;
const needs = (path, test = () => true) => (acquired) => owned(acquired, path) && test(acquired);

// Ultimate skills arrive in two power steps. The first keeps the old unlock
// timing but contributes only half of the capstone's bonus; the second
// restores the original, full capstone value later in the run.
const stagedMultiplier = (fullMultiplier, level) => {
  const firstStage = 1 + (fullMultiplier - 1) * 0.5;
  return level <= 1 ? firstStage : fullMultiplier / firstStage;
};
const stagedIncrease = (total, level) => {
  const firstStage = Math.ceil(total * 0.5);
  return level <= 1 ? firstStage : total - firstStage;
};
const stagedToward = (current, target, level) => (
  level <= 1 ? current + (target - current) * 0.5 : target
);

function applyRouteBuff({ stats }, path) {
  if (path === 'red') {
    stats.redVulnerability = Math.min(0.34, Math.max(0.1, stats.redVulnerability + 0.012));
    stats.redVulnerabilityDuration = Math.max(2.6, stats.redVulnerabilityDuration + 0.12);
  } else if (path === 'blue') {
    stats.blueStunChance = Math.min(0.52, stats.blueStunChance + 0.025);
    stats.blueStunDuration = Math.max(0.22, stats.blueStunDuration + 0.018);
  } else if (path === 'prism') {
    stats.prismStunChance = Math.min(0.7, stats.prismStunChance + 0.035);
    stats.prismStunDuration = Math.max(0.18, stats.prismStunDuration + 0.02);
  } else if (path === 'ricochet') {
    stats.ricochetKnockback = Math.min(105, stats.ricochetKnockback + 7);
  } else if (path === 'mech') {
    stats.mechVulnerability = Math.min(0.28, Math.max(0.06, stats.mechVulnerability + 0.012));
    stats.mechVulnerabilityDuration = Math.max(1.8, stats.mechVulnerabilityDuration + 0.1);
  } else if (path === 'frost') {
    stats.frostStrength = Math.min(0.86, stats.frostStrength + 0.018);
    stats.frostDuration = Math.min(5, stats.frostDuration + 0.12);
  } else if (path === 'cluster') {
    stats.clusterKnockback = Math.min(130, stats.clusterKnockback + 9);
  } else if (path === 'sword') {
    stats.swordVulnerability = Math.min(0.38, Math.max(0.08, stats.swordVulnerability + 0.014));
    stats.swordVulnerabilityDuration = Math.max(2.1, stats.swordVulnerabilityDuration + 0.12);
  } else if (path === 'tether') {
    stats.tetherStunChance = Math.min(0.72, stats.tetherStunChance + 0.04);
    stats.tetherStunDuration = Math.max(0.24, stats.tetherStunDuration + 0.025);
  } else if (path === 'laser') {
    stats.laserBurnDuration = Math.max(1.4, stats.laserBurnDuration + 0.14);
    stats.laserBurnDps += 0.18;
  } else if (path === 'split') {
    stats.splitKnockback = Math.min(54, stats.splitKnockback + 4);
  }
}

const SKILLS = [
  {
    id: 'red_core', path: 'red', icon: '▲', rarity: 'rare', maxLevel: 1, name: '激活·赤猎制导', tags: ['赤猎', '激活'], starter: true,
    describe: () => '新增 1 枚红色追踪弹；从此可随机到赤猎系列强化',
    apply: ({ stats }) => { stats.redShots = 1; stats.homingStrengthMultiplier *= 1.28; },
  },
  {
    id: 'red_count', path: 'red', icon: '+', rarity: 'common', maxLevel: 4, name: '赤猎弹头 +1', tags: ['赤猎', '弹数'],
    unlock: needs('red'), describe: () => '每轮额外发射 1 枚红色追踪弹',
    apply: ({ stats }) => { stats.redShots += 1; },
  },
  {
    id: 'red_guidance', path: 'red', icon: '⌁', rarity: 'common', maxLevel: 5, name: '制导速度 +28%', tags: ['赤猎', '追踪'],
    unlock: needs('red'), describe: () => '红弹转向速度 +28%，更快锁定侧翼目标',
    apply: ({ stats }) => { stats.homingStrengthMultiplier *= 1.28; },
  },
  {
    id: 'red_warhead', path: 'red', icon: '◆', rarity: 'rare', maxLevel: 4, name: '猎杀战斗部', tags: ['赤猎', '伤害'],
    unlock: needs('red'), describe: () => '红弹伤害 +38%，暴击率 +6%',
    apply: ({ stats }) => { stats.redDamage *= 1.38; stats.critChance += 0.06; },
  },
  {
    id: 'red_mark', path: 'red', icon: '⌾', rarity: 'epic', maxLevel: 3, name: '猎杀标记', tags: ['赤猎', '首领'],
    unlock: needs('red', (a) => (a.red_warhead || 0) >= 1), describe: () => '红弹对 Boss 伤害 +24%，暴击伤害 +20%',
    apply: ({ stats }) => { stats.bossDamageMultiplier *= 1.24; stats.critMultiplier += 0.2; },
  },
  {
    id: 'red_cap', path: 'red', icon: '✦', rarity: 'legendary', maxLevel: 2, name: '赤色天网', tags: ['赤猎', '终极'],
    unlock: needs('red', (a) => (a.red_count || 0) >= 2 && (a.red_guidance || 0) >= 2), describe: (level) => level <= 1 ? '一段：半数弹幕增幅，猎杀协议预热' : '二段：全场索敌、三击爆破与击破连锁',
    apply: ({ stats }, level = 1) => { stats.redShots += stagedIncrease(2, level); stats.homingStrengthMultiplier *= stagedMultiplier(2, level); stats.redDamage *= stagedMultiplier(1.35, level); if (level >= 2) stats.redOverdrive = 1; },
  },

  {
    id: 'blue_core', path: 'blue', icon: '≋', rarity: 'rare', maxLevel: 1, name: '激活·蓝涡螺旋', tags: ['蓝涡', '激活'], starter: true,
    describe: () => '新增 1 枚蓝色螺旋弹；从此可随机到蓝涡系列强化',
    apply: ({ stats }) => { stats.blueShots = 1; stats.spiralScale = 1; },
  },
  {
    id: 'blue_count', path: 'blue', icon: '+', rarity: 'common', maxLevel: 4, name: '蓝涡弹体 +1', tags: ['蓝涡', '弹数'],
    unlock: needs('blue'), describe: () => '每轮额外发射 1 枚蓝色螺旋弹',
    apply: ({ stats }) => { stats.blueShots += 1; },
  },
  {
    id: 'blue_spin', path: 'blue', icon: '↻', rarity: 'common', maxLevel: 5, name: '螺旋速度 +25%', tags: ['蓝涡', '转速'],
    unlock: needs('blue'), describe: () => '螺旋运动频率 +25%，弹道更加密集',
    apply: ({ stats }) => { stats.spiralFrequency *= 1.25; },
  },
  {
    id: 'blue_amplitude', path: 'blue', icon: '≈', rarity: 'rare', maxLevel: 4, name: '涡流振幅 +30%', tags: ['蓝涡', '覆盖'],
    unlock: needs('blue'), describe: () => '螺旋振幅 +30%，蓝涡伤害 +15%',
    apply: ({ stats }) => { stats.spiralScale *= 1.3; stats.blueDamage *= 1.15; },
  },
  {
    id: 'blue_pierce', path: 'blue', icon: '↑', rarity: 'epic', maxLevel: 3, name: '回旋贯穿', tags: ['蓝涡', '贯穿'],
    unlock: needs('blue', (a) => (a.blue_spin || 0) >= 1), describe: () => '蓝涡弹穿透 +1，伤害 +18%',
    apply: ({ stats }) => { stats.pierce += 1; stats.blueDamage *= 1.18; },
  },
  {
    id: 'blue_cap', path: 'blue', icon: '❈', rarity: 'legendary', maxLevel: 2, name: '深海奇点', tags: ['蓝涡', '终极'],
    unlock: needs('blue', (a) => (a.blue_count || 0) >= 2 && (a.blue_spin || 0) >= 2), describe: (level) => level <= 1 ? '一段：半数蓝涡增幅，奇点开始聚能' : '二段：螺旋转速、振幅与火力完全展开',
    apply: ({ stats }, level = 1) => { stats.blueShots += stagedIncrease(2, level); stats.spiralScale *= stagedMultiplier(1.65, level); stats.spiralFrequency *= stagedMultiplier(1.45, level); stats.blueDamage *= stagedMultiplier(1.35, level); if (level >= 2) stats.blueOverdrive = 1; },
  },

  {
    id: 'prism_core', path: 'prism', icon: '◇', rarity: 'rare', maxLevel: 1, name: '激活·棱角折射', tags: ['棱角', '激活'], starter: true,
    describe: () => '新增 1 束紫色棱角光弹，像闪电链一样连续折射 2 次',
    apply: ({ stats }) => { stats.prismShots = 1; stats.prismLevel = 1; stats.chainChance = 0.72; stats.chainDamage = 0.76; stats.chainJumps = 2; },
  },
  {
    id: 'prism_count', path: 'prism', icon: '+', rarity: 'common', maxLevel: 3, name: '棱镜光束 +1', tags: ['棱镜', '光束'],
    unlock: needs('prism'), describe: () => '每轮额外发射 1 束棱镜光弹',
    apply: ({ stats }) => { stats.prismShots += 1; },
  },
  {
    id: 'prism_reflect', path: 'prism', icon: '⟐', rarity: 'common', maxLevel: 5, name: '闪电链跳跃 +1', tags: ['棱镜', '折射'],
    unlock: needs('prism'), describe: () => '折射概率 +10%，闪电链额外跳跃 1 个目标',
    apply: ({ stats }) => { stats.chainChance = Math.min(1, stats.chainChance + 0.1); stats.chainJumps += 1; },
  },
  {
    id: 'prism_damage', path: 'prism', icon: '△', rarity: 'rare', maxLevel: 4, name: '镜面增幅', tags: ['棱镜', '增幅'],
    unlock: needs('prism'), describe: () => '棱镜本体伤害 +32%，折射保伤 +28%',
    apply: ({ stats }) => { stats.prismDamage *= 1.32; stats.chainDamage += 0.28; },
  },
  {
    id: 'prism_focus', path: 'prism', icon: '◊', rarity: 'epic', maxLevel: 3, name: '聚焦透镜', tags: ['棱镜', '首领'],
    unlock: needs('prism', (a) => (a.prism_damage || 0) >= 1), describe: () => '棱镜对 Boss 伤害 +20%，额外穿透 1 个目标',
    apply: ({ stats }) => { stats.bossDamageMultiplier *= 1.2; stats.pierce += 1; },
  },
  {
    id: 'prism_cap', path: 'prism', icon: '◈', rarity: 'legendary', maxLevel: 2, name: '棱镜天幕', tags: ['棱镜', '终极'],
    unlock: needs('prism', (a) => (a.prism_count || 0) >= 1 && (a.prism_reflect || 0) >= 3), describe: (level) => level <= 1 ? '一段：半数光束与折射增幅' : '二段：天幕全开，必定折射并强化链伤',
    apply: ({ stats }, level = 1) => { stats.prismShots += stagedIncrease(2, level); stats.chainChance = stagedToward(stats.chainChance, 1, level); stats.chainJumps += stagedIncrease(4, level); stats.chainDamage *= stagedMultiplier(2, level); stats.prismDamage *= stagedMultiplier(1.4, level); },
  },

  {
    id: 'ricochet_core', path: 'ricochet', icon: '●', rarity: 'rare', maxLevel: 1, name: '激活·重力弹球', tags: ['弹球', '激活'], starter: true,
    describe: () => '每 2 轮主炮发射 2 枚穿透敌群的重力弹球，可反弹 4 次',
    apply: ({ stats }) => { stats.ricochetShots = 2; stats.ricochetBounces = 4; stats.ricochetRetention = 0.82; stats.ricochetScale += 0.1; },
  },
  {
    id: 'ricochet_count', path: 'ricochet', icon: '+', rarity: 'common', maxLevel: 4, name: '重力弹球 +1', tags: ['弹球', '弹数'],
    unlock: needs('ricochet'), describe: () => '每次触发弹球齐射时额外发射 1 枚重力弹球',
    apply: ({ stats }) => { stats.ricochetShots += 1; },
  },
  {
    id: 'ricochet_bounce', path: 'ricochet', icon: '◌', rarity: 'common', maxLevel: 5, name: '边界反弹 +3', tags: ['弹球', '反弹'],
    unlock: needs('ricochet'), describe: () => '弹球额外反弹 3 次，反弹保伤 +7%',
    apply: ({ stats }) => { stats.ricochetBounces += 3; stats.ricochetRetention = Math.min(0.99, stats.ricochetRetention + 0.07); },
  },
  {
    id: 'ricochet_mass', path: 'ricochet', icon: '⬢', rarity: 'rare', maxLevel: 4, name: '质量增幅', tags: ['弹球', '质量'],
    unlock: needs('ricochet'), describe: () => '弹球伤害 +62%，体积 +18%',
    apply: ({ stats }) => { stats.ricochetDamage *= 1.62; stats.ricochetScale += 0.18; },
  },
  {
    id: 'ricochet_shock', path: 'ricochet', icon: '※', rarity: 'epic', maxLevel: 3, name: '冲击震荡', tags: ['弹球', '震波'],
    unlock: needs('ricochet', (a) => (a.ricochet_mass || 0) >= 1), describe: (level) => `击破引发冲击波，半径 ${62 + level * 18}`,
    apply: ({ stats }, level) => { stats.killBlastRadius = Math.max(stats.killBlastRadius, 62 + level * 18); stats.killBlastDamage += 5; },
  },
  {
    id: 'ricochet_cap', path: 'ricochet', icon: '◉', rarity: 'legendary', maxLevel: 2, name: '引力球场', tags: ['弹球', '终极'],
    unlock: needs('ricochet', (a) => (a.ricochet_count || 0) >= 2 && (a.ricochet_bounce || 0) >= 2), describe: (level) => level <= 1 ? '一段：半数弹球与反弹增幅' : '二段：引力球场完全稳定，反弹几乎不损伤',
    apply: ({ stats }, level = 1) => { stats.ricochetShots += stagedIncrease(3, level); stats.ricochetBounces += stagedIncrease(8, level); stats.ricochetRetention = stagedToward(stats.ricochetRetention, 0.99, level); stats.ricochetDamage *= stagedMultiplier(1.7, level); },
  },

  {
    id: 'mech_core', path: 'mech', icon: '◈', rarity: 'rare', maxLevel: 1, name: '激活·蜂群僚机', tags: ['僚机', '激活'], starter: true,
    describe: () => '召唤 2 架轻度追踪的自动索敌僚机',
    apply: ({ stats }) => { stats.droneCount = 2; },
  },
  {
    id: 'mech_count', path: 'mech', icon: '+', rarity: 'common', maxLevel: 5, name: '僚机出舱 +1', tags: ['僚机', '数量'],
    unlock: needs('mech'), describe: () => '新增 1 架自动索敌僚机',
    apply: ({ stats }) => { stats.droneCount += 1; },
  },
  {
    id: 'mech_rate', path: 'mech', icon: '»', rarity: 'common', maxLevel: 4, name: '僚机射速 +32%', tags: ['僚机', '射速'],
    unlock: needs('mech'), describe: () => '所有僚机射击频率 +32%',
    apply: ({ stats }) => { stats.droneFireRate *= 1.32; },
  },
  {
    id: 'mech_damage', path: 'mech', icon: '◆', rarity: 'rare', maxLevel: 4, name: '僚机火力 +20%', tags: ['僚机', '火力'],
    unlock: needs('mech'), describe: () => '所有僚机伤害 +20%',
    apply: ({ stats }) => { stats.droneDamage *= 1.2; },
  },
  {
    id: 'mech_missile', path: 'mech', icon: '»', rarity: 'epic', maxLevel: 3, name: '风暴导弹', tags: ['僚机', '导弹'],
    unlock: needs('mech', (a) => (a.mech_count || 0) >= 1), describe: () => '僚机编队定期发射重型追踪导弹，僚机火力 +10%',
    apply: ({ stats }) => { stats.missileLevel += 1; stats.droneDamage *= 1.1; },
  },
  {
    id: 'mech_cap', path: 'mech', icon: '✺', rarity: 'legendary', maxLevel: 2, name: '航母蜂群', tags: ['僚机', '终极'],
    unlock: needs('mech', (a) => (a.mech_count || 0) >= 2 && (a.mech_missile || 0) >= 2), describe: (level) => level <= 1 ? '一段：半数僚机火力增幅' : '二段：航母蜂群与导弹齐射完全展开',
    apply: ({ stats }, level = 1) => { stats.droneCount += stagedIncrease(3, level); stats.droneFireRate *= stagedMultiplier(1.45, level); stats.droneDamage *= stagedMultiplier(1.5, level); stats.missileLevel += stagedIncrease(2, level); if (level >= 2) stats.swarmOverdrive = 1; },
  },

  {
    id: 'frost_core', path: 'frost', icon: '❉', rarity: 'rare', maxLevel: 1, name: '激活·寒霜冰弹', tags: ['寒霜', '激活'], starter: true,
    describe: () => '新增 1 枚寒霜冰弹，命中有概率冻结目标',
    apply: ({ stats }) => { stats.frostShots = 1; stats.frostChance = 0.4; stats.frostStrength = 0.26; },
  },
  {
    id: 'frost_count', path: 'frost', icon: '+', rarity: 'common', maxLevel: 4, name: '寒霜冰弹 +1', tags: ['寒霜', '弹数'],
    unlock: needs('frost'), describe: () => '每轮额外发射 1 枚寒霜冰弹',
    apply: ({ stats }) => { stats.frostShots += 1; },
  },
  {
    id: 'frost_chance', path: 'frost', icon: '✣', rarity: 'common', maxLevel: 5, name: '冻结概率 +20%', tags: ['寒霜', '冻结'],
    unlock: needs('frost'), describe: () => '寒霜冰弹冻结概率 +20%，冻结时间 +0.3 秒',
    apply: ({ stats }) => { stats.frostChance += 0.2; stats.frostDuration += 0.3; },
  },
  {
    id: 'frost_depth', path: 'frost', icon: '✧', rarity: 'rare', maxLevel: 4, name: '深度冻结', tags: ['寒霜', '控制'],
    unlock: needs('frost'), describe: () => '减速强度 +15%，寒霜伤害 +34%',
    apply: ({ stats }) => { stats.frostStrength = Math.min(0.86, stats.frostStrength + 0.15); stats.frostDamage *= 1.34; },
  },
  {
    id: 'frost_shatter', path: 'frost', icon: '✣', rarity: 'epic', maxLevel: 3, name: '碎冰风暴', tags: ['寒霜', '爆裂'],
    unlock: needs('frost', (a) => (a.frost_chance || 0) >= 2), describe: (level) => `冻结目标击破时产生寒冰爆炸，半径 ${68 + level * 18}`,
    apply: ({ stats }, level) => { stats.killBlastRadius = Math.max(stats.killBlastRadius, 68 + level * 18); stats.killBlastDamage += 5.5; },
  },
  {
    id: 'frost_cap', path: 'frost', icon: '✹', rarity: 'legendary', maxLevel: 2, name: '绝对零度', tags: ['寒霜', '终极'],
    unlock: needs('frost', (a) => (a.frost_count || 0) >= 2 && (a.frost_chance || 0) >= 2), describe: (level) => level <= 1 ? '一段：半数冻结与冰弹增幅' : '二段：绝对零度，冻结与碎冰完全生效',
    apply: ({ stats }, level = 1) => { stats.frostShots += stagedIncrease(2, level); stats.frostChance = stagedToward(stats.frostChance, 1, level); stats.frostStrength = stagedToward(stats.frostStrength, 0.78, level); stats.frostDamage *= stagedMultiplier(1.5, level); if (level >= 2) stats.absoluteZero = 1; },
  },

  {
    id: 'cluster_core', path: 'cluster', icon: '✺', rarity: 'rare', maxLevel: 1, name: '激活·天穹集束炮', tags: ['集束', '激活'], starter: true,
    describe: () => '每 5 轮发射 1 枚炮弹，空爆散射 5 枚子母弹',
    apply: ({ stats }) => { stats.clusterShots = 1; stats.clusterFragments = 5; stats.clusterDamage = 1; },
  },
  {
    id: 'cluster_count', path: 'cluster', icon: '+', rarity: 'common', maxLevel: 3, name: '集束炮弹 +1', tags: ['集束', '弹数'],
    unlock: needs('cluster'), describe: () => '每次集束齐射额外发射 1 枚炮弹',
    apply: ({ stats }) => { stats.clusterShots += 1; },
  },
  {
    id: 'cluster_fragments', path: 'cluster', icon: '✣', rarity: 'common', maxLevel: 4, name: '子母弹 +1', tags: ['集束', '覆盖'],
    unlock: needs('cluster'), describe: () => '每枚炮弹额外散射 1 枚子母弹，子弹伤害 +10%',
    apply: ({ stats }) => { stats.clusterFragments += 1; stats.clusterFragmentDamage *= 1.1; },
  },
  {
    id: 'cluster_warhead', path: 'cluster', icon: '⬢', rarity: 'rare', maxLevel: 4, name: '高爆装药', tags: ['集束', '伤害'],
    unlock: needs('cluster'), describe: () => '母弹伤害 +30%，爆炸半径 +10',
    apply: ({ stats }) => { stats.clusterDamage *= 1.3; stats.clusterExplosionRadius += 10; },
  },
  {
    id: 'cluster_saturation', path: 'cluster', icon: '▦', rarity: 'epic', maxLevel: 2, name: '饱和轰炸', tags: ['集束', '射速'],
    unlock: needs('cluster', (a) => (a.cluster_fragments || 0) >= 2), describe: () => '集束触发间隔缩短 1 轮，子母弹伤害 +20%',
    apply: ({ stats }) => { stats.clusterVolleyEvery = Math.max(3, stats.clusterVolleyEvery - 1); stats.clusterFragmentDamage *= 1.2; },
  },
  {
    id: 'cluster_cap', path: 'cluster', icon: '✺', rarity: 'legendary', maxLevel: 2, name: '天火覆盖', tags: ['集束', '终极'],
    unlock: needs('cluster', (a) => (a.cluster_count || 0) >= 2 && (a.cluster_fragments || 0) >= 2), describe: (level) => level <= 1 ? '一段：半数集束与爆风增幅' : '二段：天火覆盖，子母弹与震退完全展开',
    apply: ({ stats }, level = 1) => { stats.clusterShots += stagedIncrease(2, level); stats.clusterFragments += stagedIncrease(5, level); stats.clusterDamage *= stagedMultiplier(1.4, level); stats.clusterFragmentDamage *= stagedMultiplier(1.35, level); stats.clusterExplosionRadius += stagedIncrease(24, level); },
  },

  {
    id: 'sword_core', path: 'sword', icon: '✧', rarity: 'rare', maxLevel: 1, name: '激活·万剑归宗', tags: ['剑阵', '激活'], starter: true,
    describe: () => '每 4 轮展开 5 柄飞剑；每柄最多归宗 5 次，命中首领伤害提升至5倍',
    apply: ({ stats }) => { stats.swordShots = 5; stats.swordAttackCount = 5; stats.swordDamage = 0.8; },
  },
  {
    id: 'sword_count', path: 'sword', icon: '↻', rarity: 'common', maxLevel: 5, name: '剑意回环 +2 次', tags: ['剑阵', '连击'],
    unlock: needs('sword'), describe: () => '每柄飞剑最多攻击次数 +2（最高 15 次）',
    apply: ({ stats }) => { stats.swordAttackCount = Math.min(15, stats.swordAttackCount + 2); },
  },
  {
    id: 'sword_guidance', path: 'sword', icon: '⌁', rarity: 'common', maxLevel: 4, name: '归宗剑意', tags: ['剑阵', '制导'],
    unlock: needs('sword'), describe: () => '飞剑制导 +32%，蓄势时间缩短 0.04 秒',
    apply: ({ stats }) => { stats.swordGuidance *= 1.32; stats.swordDelay = Math.max(0.12, stats.swordDelay - 0.04); },
  },
  {
    id: 'sword_damage', path: 'sword', icon: '◆', rarity: 'rare', maxLevel: 4, name: '御剑破空', tags: ['剑阵', '伤害'],
    unlock: needs('sword'), describe: () => '飞剑伤害 +36%，飞行速度 +10%',
    apply: ({ stats }) => { stats.swordDamage *= 1.36; stats.projectileSpeedMultiplier *= 1.1; },
  },
  {
    id: 'sword_pierce', path: 'sword', icon: '↑', rarity: 'epic', maxLevel: 3, name: '一剑穿心', tags: ['剑阵', '贯穿'],
    unlock: needs('sword', (a) => (a.sword_damage || 0) >= 1), describe: () => '飞剑贯穿 +1，剑痕易伤额外 +4%',
    apply: ({ stats }) => { stats.swordPierce += 1; stats.swordVulnerability += 0.04; },
  },
  {
    id: 'sword_cap', path: 'sword', icon: '✺', rarity: 'legendary', maxLevel: 2, name: '天剑无量', tags: ['剑阵', '终极'],
    unlock: needs('sword', (a) => (a.sword_count || 0) >= 2 && (a.sword_guidance || 0) >= 2), describe: (level) => level <= 1 ? '一段：半数剑阵火力与归宗增幅' : '二段：天剑无量，制导、穿心与齐射完全展开',
    apply: ({ stats }, level = 1) => { stats.swordShots += stagedIncrease(8, level); stats.swordVolleyEvery = level <= 1 ? Math.min(stats.swordVolleyEvery, 3) : 2; stats.swordGuidance *= stagedMultiplier(1.7, level); stats.swordPierce += stagedIncrease(2, level); stats.swordDamage *= stagedMultiplier(1.45, level); },
  },

  {
    id: 'tether_core', path: 'tether', icon: '∞', rarity: 'rare', maxLevel: 1, name: '激活·双星锁链', tags: ['锁链', '激活'], starter: true,
    describe: () => '每 3 轮甩出 1 对双星球，球间锁链持续切割敌人',
    apply: ({ stats }) => { stats.tetherPairs = 1; stats.tetherDamage = 0.62; stats.tetherTickDamage = 0.26; },
  },
  {
    id: 'tether_count', path: 'tether', icon: '+', rarity: 'common', maxLevel: 3, name: '双星对数 +1', tags: ['锁链', '数量'],
    unlock: needs('tether'), describe: () => '每次齐射额外甩出 1 对双星锁链',
    apply: ({ stats }) => { stats.tetherPairs += 1; },
  },
  {
    id: 'tether_span', path: 'tether', icon: '=', rarity: 'common', maxLevel: 4, name: '锁链延展 +18', tags: ['锁链', '覆盖'],
    unlock: needs('tether'), describe: () => '双星间距 +18，锁链扫荡宽度与球体伤害提升',
    apply: ({ stats }) => { stats.tetherSpan += 18; stats.tetherDamage *= 1.14; },
  },
  {
    id: 'tether_pulse', path: 'tether', icon: 'ϟ', rarity: 'rare', maxLevel: 4, name: '链路脉冲', tags: ['锁链', '伤害'],
    unlock: needs('tether'), describe: () => '锁链持续伤害 +38%，束缚概率 +6%',
    apply: ({ stats }) => { stats.tetherTickDamage *= 1.38; stats.tetherStunChance += 0.06; },
  },
  {
    id: 'tether_bind', path: 'tether', icon: '⌘', rarity: 'epic', maxLevel: 3, name: '磁暴束缚', tags: ['锁链', '控制'],
    unlock: needs('tether', (a) => (a.tether_pulse || 0) >= 1), describe: () => '束缚时间 +0.25 秒，双球额外贯穿 1 个目标',
    apply: ({ stats }) => { stats.tetherStunDuration += 0.25; stats.pierce += 1; },
  },
  {
    id: 'tether_cap', path: 'tether', icon: '⊗', rarity: 'legendary', maxLevel: 2, name: '引力枷锁', tags: ['锁链', '终极'],
    unlock: needs('tether', (a) => (a.tether_count || 0) >= 1 && (a.tether_span || 0) >= 3), describe: (level) => level <= 1 ? '一段：半数双星与锁链增幅' : '二段：引力枷锁全功率束缚',
    apply: ({ stats }, level = 1) => { stats.tetherPairs += stagedIncrease(2, level); stats.tetherSpan *= stagedMultiplier(1.5, level); stats.tetherTickDamage *= stagedMultiplier(2, level); stats.tetherStunChance = stagedToward(stats.tetherStunChance, Math.max(0.88, stats.tetherStunChance), level); },
  },

  {
    id: 'laser_core', path: 'laser', icon: '⌁', rarity: 'rare', maxLevel: 1, name: '激活·灼日锁定', tags: ['激光', '激活'], starter: true,
    describe: () => '持续锁定最近敌人造成伤害，并在目标身上留下灼烧',
    apply: ({ stats }) => { stats.laserDps = 7.5; stats.laserBurnDps = 1.8; stats.laserBurnDuration = 1.6; },
  },
  {
    id: 'laser_power', path: 'laser', icon: '◆', rarity: 'common', maxLevel: 5, name: '光束功率 +38%', tags: ['激光', '伤害'],
    unlock: needs('laser'), describe: () => '锁定激光持续伤害 +38%',
    apply: ({ stats }) => { stats.laserDps *= 1.38; },
  },
  {
    id: 'laser_targets', path: 'laser', icon: '+', rarity: 'common', maxLevel: 3, name: '锁定目标 +1', tags: ['激光', '多锁'],
    unlock: needs('laser'), describe: () => '激光额外锁定 1 个目标，每条光束保持完整伤害',
    apply: ({ stats }) => { stats.laserTargets += 1; },
  },
  {
    id: 'laser_heat', path: 'laser', icon: '≈', rarity: 'rare', maxLevel: 4, name: '过热灼烧', tags: ['激光', '灼烧'],
    unlock: needs('laser'), describe: () => '灼烧伤害 +50%，持续时间 +0.6 秒',
    apply: ({ stats }) => { stats.laserBurnDps *= 1.5; stats.laserBurnDuration += 0.6; },
  },
  {
    id: 'laser_focus', path: 'laser', icon: '◎', rarity: 'epic', maxLevel: 3, name: '焦点锁死', tags: ['激光', '首领'],
    unlock: needs('laser', (a) => (a.laser_power || 0) >= 1), describe: () => '激光对 Boss 伤害 +32%，锁定距离 +120',
    apply: ({ stats }) => { stats.laserBossMultiplier *= 1.32; stats.laserRange += 120; },
  },
  {
    id: 'laser_cap', path: 'laser', icon: '☼', rarity: 'legendary', maxLevel: 2, name: '日冕审判', tags: ['激光', '终极'],
    unlock: needs('laser', (a) => (a.laser_power || 0) >= 2 && (a.laser_heat || 0) >= 2), describe: (level) => level <= 1 ? '一段：半数锁定与灼烧增幅' : '二段：日冕审判，激光过热全功率爆燃',
    apply: ({ stats }, level = 1) => { stats.laserTargets += stagedIncrease(2, level); stats.laserDps *= stagedMultiplier(1.75, level); stats.laserBurnDps *= stagedMultiplier(2, level); stats.laserBurnDuration += stagedIncrease(2, level); },
  },

  {
    id: 'execute_core', path: 'execute', icon: '✦', rarity: 'rare', maxLevel: 1, name: '激活·量子裁决', tags: ['裁决', '激活'], starter: true,
    describe: () => '所有命中获得 8% 概率造成随机 2–4 倍伤害',
    apply: ({ stats }) => { stats.executeChance = 0.08; stats.executeMultiplier = 4; stats.executePityEvery = 16; },
  },
  {
    id: 'execute_chance', path: 'execute', icon: '%', rarity: 'common', maxLevel: 5, name: '裁决概率 +5%', tags: ['裁决', '概率'],
    unlock: needs('execute'), describe: () => '随机高倍伤害触发概率 +5%',
    apply: ({ stats }) => { stats.executeChance += 0.05; },
  },
  {
    id: 'execute_multi', path: 'execute', icon: '×', rarity: 'rare', maxLevel: 4, name: '倍率上限提升', tags: ['裁决', '倍率'],
    unlock: needs('execute'), describe: () => '高倍伤害倍率池提升，最高逐步达到 16 倍',
    apply: ({ stats }) => { stats.executeMultiplier = Math.min(16, Math.max(4, stats.executeMultiplier * 1.55)); },
  },
  {
    id: 'execute_pity', path: 'execute', icon: '✧', rarity: 'rare', maxLevel: 4, name: '裁决光剑 +1', tags: ['裁决', '光剑'],
    unlock: needs('execute'), describe: () => '发射 1 枚垂直量子光剑，可触发裁决效果',
    apply: ({ stats }) => { stats.executeSwords += 1; },
  },
  {
    id: 'execute_boss', path: 'execute', icon: '✦', rarity: 'epic', maxLevel: 3, name: '神性处决', tags: ['裁决', '首领'],
    unlock: needs('execute', (a) => (a.execute_multi || 0) >= 1), describe: () => '裁决触发率 +4%，对 Boss 伤害 +20%',
    apply: ({ stats }) => { stats.executeChance += 0.04; stats.bossDamageMultiplier *= 1.2; },
  },
  {
    id: 'execute_cap', path: 'execute', icon: '✸', rarity: 'legendary', maxLevel: 2, name: '终焉骰局', tags: ['裁决', '终极'],
    unlock: needs('execute', (a) => (a.execute_chance || 0) >= 2 && (a.execute_multi || 0) >= 2), describe: (level) => level <= 1 ? '一段：半数裁决概率与倍率池增幅' : '二段：终焉骰局，16 倍裁决与保底完全解锁',
    apply: ({ stats }, level = 1) => { stats.executeChance += level <= 1 ? 0.06 : 0.06; stats.executeMultiplier = level <= 1 ? Math.max(stats.executeMultiplier, 8) : 16; if (level >= 2) stats.executePityEvery = 6; },
  },

  {
    id: 'split_level', path: 'split', icon: 'Y', rarity: 'common', maxLevel: 4, name: '白弹裂变', tags: ['白弹', '分裂'],
    unlock: needs('split'), describe: (level) => level === 1 ? '普通白弹命中后分裂为 2 枚子弹' : '裂变层级 +1，子弹可继续产生下一层裂变',
    apply: ({ stats }) => { stats.splitLevel += 1; },
  },
  {
    id: 'split_damage', path: 'split', icon: '◆', rarity: 'common', maxLevel: 5, name: '裂变保伤 +7%', tags: ['裂变', '伤害'],
    unlock: needs('split', (a) => (a.split_level || 0) >= 1), describe: () => '每层裂变子弹保留的伤害 +7%',
    apply: ({ stats }) => { stats.splitDamage = Math.min(0.76, stats.splitDamage + 0.07); },
  },
  {
    id: 'split_salvo', path: 'split', icon: '+', rarity: 'rare', maxLevel: 3, name: '白弹齐射 +1', tags: ['裂变', '齐射'],
    unlock: needs('split'), describe: () => '基础白弹每轮额外发射 1 枚',
    apply: ({ stats }) => { stats.baseShots += 1; },
  },
  {
    id: 'split_pierce', path: 'split', icon: '↑', rarity: 'epic', maxLevel: 3, name: '增殖贯穿', tags: ['裂变', '贯穿'],
    unlock: needs('split', (a) => (a.split_level || 0) >= 1), describe: () => '白弹和裂变子弹额外穿透 1 个目标',
    apply: ({ stats }) => { stats.pierce += 1; },
  },
  {
    id: 'split_cap', path: 'split', icon: 'Ж', rarity: 'legendary', maxLevel: 2, name: '无尽机炮', tags: ['裂变', '终极'],
    unlock: needs('split', (a) => (a.split_level || 0) >= 2 && (a.split_damage || 0) >= 3), describe: (level) => level <= 1 ? '一段：半数齐射与裂变增幅' : '二段：无尽机炮，裂变火力完全展开',
    apply: ({ stats }, level = 1) => { stats.baseShots += stagedIncrease(2, level); stats.splitLevel += stagedIncrease(2, level); stats.splitDamage = level <= 1 ? Math.max(stats.splitDamage, 0.61) : Math.max(stats.splitDamage, 0.72); },
  },
].map((skill) => {
  const baseApply = skill.apply;
  return {
    ...skill,
    paths: [skill.path],
    buff: skill.path === 'execute' ? null : ROUTE_MAP.get(skill.path)?.buff,
    apply: (context, level) => {
      baseApply(context, level);
      if (skill.path !== 'execute') applyRouteBuff(context, skill.path);
    },
  };
});

export const SKILL_MAP = new Map(SKILLS.map((skill) => [skill.id, skill]));

export const MAIN_WEAPON_SKILL_IDS = Object.freeze(
  ROUTES.map((route) => (route.id === 'split' ? 'split_level' : `${route.id}_core`)),
);

export function getMainWeaponCandidates() {
  return MAIN_WEAPON_SKILL_IDS.map((skillId) => SKILL_MAP.get(skillId)).filter(Boolean);
}

export function createMainWeaponOfferBag(random = Math.random) {
  const bag = [...MAIN_WEAPON_SKILL_IDS];
  for (let index = bag.length - 1; index > 0; index -= 1) {
    const roll = Math.max(0, Math.min(0.999999, Number(random()) || 0));
    const swapIndex = Math.floor(roll * (index + 1));
    [bag[index], bag[swapIndex]] = [bag[swapIndex], bag[index]];
  }
  return bag;
}

export function weaponBossDamageMultiplier(stats, path = '') {
  const base = Math.max(0, Number(stats?.bossDamageMultiplier) || 1);
  if (path !== 'sword') return base;
  return base * Math.max(0, Number(stats?.swordBossMultiplier) || 1);
}

export const ULTIMATE_RECIPES = Object.freeze(ROUTES.map((route) => {
  const capId = `${route.id}_cap`;
  const cap = SKILL_MAP.get(capId);
  const requirements = Object.freeze(
    (ULTIMATE_RECIPE_REQUIREMENTS[route.id] || []).map(({ skillId, required }) => {
      const skill = SKILL_MAP.get(skillId);
      return Object.freeze({
        id: skillId,
        skillId,
        level: required,
        required,
        name: skill?.name || skillId,
        icon: skill?.icon || '',
      });
    }),
  );
  const total = requirements.reduce((sum, requirement) => sum + requirement.required, 0);
  return Object.freeze({
    id: capId,
    skillId: capId,
    capId,
    path: route.id,
    routeId: route.id,
    name: cap?.name || route.name,
    icon: cap?.icon || route.icon,
    color: route.color,
    requirements,
    total,
    totalRequired: total,
  });
}));

export const ULTIMATE_STAGE_TWO_TASKS = 7;

const ULTIMATE_RECIPE_MAP = new Map(
  ULTIMATE_RECIPES.flatMap((recipe) => [
    [recipe.path, recipe],
    [recipe.capId, recipe],
  ]),
);

export function getUltimateRecipe(pathOrCapId) {
  const key = typeof pathOrCapId === 'object'
    ? pathOrCapId?.path || pathOrCapId?.capId || pathOrCapId?.id
    : pathOrCapId;
  return ULTIMATE_RECIPE_MAP.get(key) || null;
}

export function getUltimateProgress(acquired = {}, pathOrCapId, stageTwoTasks = 0) {
  // Also accept (path, acquired) for callers that naturally put the route
  // first, while preserving the documented (acquired, path) form.
  const levels = typeof acquired === 'string' ? (pathOrCapId || {}) : (acquired || {});
  const recipeKey = typeof acquired === 'string' ? acquired : pathOrCapId;
  const recipe = getUltimateRecipe(recipeKey);
  if (!recipe) return null;

  const requirements = recipe.requirements.map((requirement) => {
    const current = Math.max(0, Number(levels[requirement.skillId]) || 0);
    const completed = Math.min(current, requirement.required);
    return {
      ...requirement,
      current,
      completed,
      missing: Math.max(0, requirement.required - current),
      complete: current >= requirement.required,
    };
  });
  const completed = requirements.reduce((sum, requirement) => sum + requirement.completed, 0);
  const capLevel = Math.max(0, Math.min(2, Number(levels[recipe.capId]) || 0));
  const stageOneCrafted = capLevel >= 1;
  const crafted = capLevel >= 2;
  const complete = requirements.every((requirement) => requirement.complete);
  const stageTwoCompleted = Math.min(
    ULTIMATE_STAGE_TWO_TASKS,
    Math.max(0, Math.floor(Number(stageTwoTasks) || 0)),
  );
  const stageTwoComplete = stageTwoCompleted >= ULTIMATE_STAGE_TWO_TASKS;
  const cap = SKILL_MAP.get(recipe.capId);
  const unlockSatisfied = !cap?.unlock || cap.unlock(levels);
  const displayCompleted = stageOneCrafted ? stageTwoCompleted : completed;
  const displayRequired = stageOneCrafted ? ULTIMATE_STAGE_TWO_TASKS : recipe.total;

  return {
    ...recipe,
    requirements,
    completed: displayCompleted,
    required: displayRequired,
    remaining: Math.max(0, displayRequired - displayCompleted),
    ratio: displayRequired > 0 ? displayCompleted / displayRequired : 1,
    progress: displayRequired > 0 ? displayCompleted / displayRequired : 1,
    complete,
    capLevel,
    stageOneCrafted,
    stageTwoCompleted,
    stageTwoRequired: ULTIMATE_STAGE_TWO_TASKS,
    stageTwoComplete,
    nextStage: Math.min(2, capLevel + 1),
    ready: capLevel === 0
      ? complete && unlockSatisfied
      : capLevel === 1 && stageTwoComplete,
    crafted,
    acquired: stageOneCrafted,
  };
}

export function getReadyUltimateRecipes(acquired = {}, stageTwoTasksByPath = {}) {
  return ULTIMATE_RECIPES
    .map((recipe) => getUltimateProgress(acquired, recipe.path, stageTwoTasksByPath?.[recipe.path]))
    .filter((progress) => progress?.ready);
}

export function getPathInvestments(acquired) {
  return Object.fromEntries(ROUTES.map((route) => [
    route.id,
    SKILLS.filter((skill) => skill.path === route.id)
      .reduce((sum, skill) => sum + (acquired[skill.id] || 0), 0),
  ]));
}

export function getOwnedPaths(acquired) {
  return ROUTES.filter((route) => owned(acquired, route.id)).map((route) => route.id);
}

export function getDominantPaths(acquired) {
  const investments = getPathInvestments(acquired);
  return ROUTES
    .filter((route) => investments[route.id] > 0)
    .sort((a, b) => investments[b.id] - investments[a.id])
    .map((route) => route.id);
}

function skillOfferWeight(skill, acquired) {
  const currentLevel = acquired[skill.id] || 0;
  // Apart from a single guaranteed main-route task card, all offered upgrades
  // use the same weight. This leaves the remaining slots open for free builds.
  return RARITIES[skill.rarity].weight * Math.pow(0.58, currentLevel);
}

function weightedSkillPick(pool, acquired, random = Math.random) {
  const total = pool.reduce((sum, skill) => sum + skillOfferWeight(skill, acquired), 0);
  let roll = random() * total;
  for (const skill of pool) {
    roll -= skillOfferWeight(skill, acquired);
    if (roll <= 0) return skill;
  }
  return pool[pool.length - 1];
}

export function getSkillChoices(acquired = {}, count = 3, preferences = {}) {
  const levels = acquired || {};
  const choiceCount = Math.max(0, Math.floor(Number(count) || 0));
  if (choiceCount === 0) return [];
  const random = typeof preferences.random === 'function' ? preferences.random : Math.random;

  const totalInvestment = Object.values(levels).reduce((sum, level) => sum + level, 0);
  const allowedPaths = Array.isArray(preferences.allowedPaths)
    ? new Set(preferences.allowedPaths)
    : null;
  const primary = ROUTE_MAP.has(preferences.primary) ? preferences.primary : null;
  const stageTwoTasksByPath = preferences.ultimateStageTwoTasks || {};
  const maxSkillPaths = Math.max(1, Math.floor(
    Number(preferences.maxSkillPaths) || MAX_NORMAL_SKILL_PATHS,
  ));
  const featuredPath = ROUTE_MAP.has(preferences.featuredPath) ? preferences.featuredPath : null;
  const ownedSpecialPaths = ROUTES
    .filter((route) => route.id !== 'split' && owned(levels, route.id))
    .map((route) => route.id);
  const ownedPathCount = getOwnedPaths(levels).length;
  const capOffer = (skill) => skill.rarity === 'legendary' || skill.id.endsWith('_cap');
  const upgradePool = SKILLS.filter((skill) => (
    !skill.starter
    && !capOffer(skill)
    && (!allowedPaths || allowedPaths.has(skill.path))
    && owned(levels, skill.path)
    && (levels[skill.id] || 0) < skill.maxLevel
    && (!skill.unlock || skill.unlock(levels))
  ));
  const unlockPool = SKILLS.filter((skill) => (
    skill.starter
    && !capOffer(skill)
    && (!allowedPaths || allowedPaths.has(skill.path))
    && !owned(levels, skill.path)
    && (levels[skill.id] || 0) < skill.maxLevel
    // A run may normally use five projectile routes, counting base white
    // shots. "Take all" can still apply multiple cores from an offer that
    // was generated just below this cap, creating a deliberate over-cap run.
    && ownedPathCount < maxSkillPaths
  ));

  const removeFromPool = (pool, skill) => {
    const index = pool.indexOf(skill);
    if (index >= 0) pool.splice(index, 1);
  };
  const randomPick = (pool) => pool[Math.floor(random() * pool.length)];
  const shuffled = (choices) => choices.sort(() => random() - 0.5);

  // Route-selection mode is intentionally a pure core choice: no white-bullet
  // card can displace one of the three candidate main weapons.
  if (preferences.startersOnly && ownedSpecialPaths.length === 0) {
    const starterChoices = [];
    const featuredCore = featuredPath
      ? unlockPool.find((skill) => skill.path === featuredPath)
      : null;
    const primaryCore = primary
      ? unlockPool.find((skill) => skill.path === primary)
      : null;
    const guaranteedCore = featuredCore || primaryCore;
    if (guaranteedCore && starterChoices.length < choiceCount) {
      starterChoices.push(guaranteedCore);
      removeFromPool(unlockPool, guaranteedCore);
    }
    while (starterChoices.length < choiceCount && unlockPool.length) {
      const skill = randomPick(unlockPool);
      starterChoices.push(skill);
      removeFromPool(unlockPool, skill);
    }
    return shuffled(starterChoices);
  }

  const choices = [];
  const randomOfferPaths = new Set();

  const addUnlockChoice = (skill) => {
    choices.push(skill);
    removeFromPool(unlockPool, skill);
  };

  // If a preference is already known before its core is owned, surface that
  // core first. Otherwise a featured route is guaranteed on the very first
  // regular offer.
  const preferredCore = primary && !owned(levels, primary)
    ? unlockPool.find((skill) => skill.path === primary)
    : null;
  const firstFeaturedCore = !primary && totalInvestment === 0 && featuredPath
    ? unlockPool.find((skill) => skill.path === featuredPath)
    : null;
  const forcedCore = preferredCore || firstFeaturedCore;
  if (forcedCore && choices.length < choiceCount) addUnlockChoice(forcedCore);

  // A committed route contributes only one guaranteed task card. Every other
  // slot draws from the complete eligible pool, so secondary builds remain a
  // discovery instead of being crowded out by the main weapon.
  if (upgradePool.length && choices.length < choiceCount) {
    const primaryProgress = primary
      ? getUltimateProgress(levels, primary, stageTwoTasksByPath[primary])
      : null;
    const primaryTaskPool = primaryProgress && !primaryProgress.crafted
      ? upgradePool.filter((skill) => {
        if (skill.path !== primary) return false;
        if (primaryProgress.capLevel === 1) return true;
        return primaryProgress.requirements.some((requirement) => (
          requirement.skillId === skill.id && !requirement.complete
        ));
      })
      : [];
    const guaranteePool = primary
      ? primaryTaskPool
      : upgradePool;
    if (guaranteePool.length) {
      const guaranteed = weightedSkillPick(guaranteePool, levels, random);
      choices.push(guaranteed);
      upgradePool.splice(upgradePool.indexOf(guaranteed), 1);
    }
  }

  while (choices.length < choiceCount && (upgradePool.length || unlockPool.length)) {
    const nonPrimaryUpgrades = primary
      ? upgradePool.filter((skill) => skill.path !== primary)
      : upgradePool;
    // The guaranteed task above is the only main-route card in a normal
    // offer. For every remaining slot, pick a non-main route first, then pick
    // a card within that route. This keeps routes balanced even when one
    // route happens to have more eligible cards than the others. Once the
    // normal route cap is reached, unlockPool is empty so these slots stay
    // inside the player's existing build.
    const randomPool = primary && (nonPrimaryUpgrades.length || unlockPool.length)
      ? [...nonPrimaryUpgrades, ...unlockPool]
      : [...upgradePool, ...unlockPool];
    const availablePaths = [...new Set(randomPool.map((skill) => skill.path))];
    const freshPaths = availablePaths.filter((path) => !randomOfferPaths.has(path));
    const selectedPath = randomPick(freshPaths.length ? freshPaths : availablePaths);
    const pathPool = randomPool.filter((skill) => skill.path === selectedPath);
    const skill = weightedSkillPick(pathPool, levels, random);
    randomOfferPaths.add(skill.path);
    if (skill.starter) addUnlockChoice(skill);
    else {
      choices.push(skill);
      removeFromPool(upgradePool, skill);
    }
  }
  return shuffled(choices);
}

export function getSkillDescription(skill, nextLevel) {
  return skill.describe(nextLevel);
}

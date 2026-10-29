import { AIRCRAFTS } from './pilots.js';
import { COMMON_WEAPONS } from './fixed-parts/common-weapons.js';

export const GACHA_QUALITIES = Object.freeze({
  R: { id: 'R', name: 'R', color: '#d9e4e6' },
  SR: { id: 'SR', name: 'SR', color: '#62cf83' },
  SSR: { id: 'SSR', name: 'SSR', color: '#758cff' },
  UR: { id: 'UR', name: 'UR', color: '#ff78dc' },
  white: { id: 'white', name: '白色', color: '#edf5f5' },
  green: { id: 'green', name: '绿色', color: '#62cf83' },
  blue: { id: 'blue', name: '蓝色', color: '#5d9dff' },
  purple: { id: 'purple', name: '紫色', color: '#b879ff' },
  gold: { id: 'gold', name: '金色', color: '#ffcf5d' },
});

export const GACHA_ITEM_TYPES = Object.freeze({
  aircraft: { id: 'aircraft', name: '飞机' },
  fixed: { id: 'fixed', name: '固定件' },
  weapon: { id: 'weapon', name: '武器' },
});

export const GACHA_SLOTS = Object.freeze({
  wing: { id: 'wing', name: '机翼' },
  engine: { id: 'engine', name: '推进器' },
  tail: { id: 'tail', name: '机尾' },
});

function effect(stat, value, description) {
  return Object.freeze({ stat, value, description });
}

function aircraftItem(pilot) {
  return Object.freeze({
    id: `aircraft:${pilot.id}`,
    refId: pilot.id,
    callsign: pilot.callsign,
    name: pilot.aircraft,
    displayName: pilot.name,
    type: 'aircraft',
    slot: null,
    quality: pilot.rarity,
    effects: Object.freeze([
      effect('pilotAbility', pilot.ability, `${pilot.skillName}：${pilot.description}`),
    ]),
    icon: pilot.image,
    isUniversal: false,
    isImplemented: true,
  });
}

function fixedItem({
  id,
  name,
  shortName,
  slot,
  quality,
  icon,
  effects,
  assemblyStats,
}) {
  return Object.freeze({
    id,
    name,
    shortName,
    type: 'fixed',
    slot,
    quality,
    effects: Object.freeze(effects),
    icon,
    isUniversal: true,
    isImplemented: true,
    duplicatePolicy: Object.freeze({
      mode: 'same_item_enhancement_material',
      consumeAutomatically: false,
    }),
    assemblyStats: Object.freeze(assemblyStats),
  });
}

const FIXED_SERIES = [
  {
    key: 'assault-wing',
    slot: 'wing',
    label: '强袭机翼',
    icon: 'A',
    qualities: [
      ['white', 'Ⅰ', [effect('bulletDamagePercent', 4, '子弹伤害＋4%')], { damageMultiplier: 1.04 }],
      ['green', 'Ⅱ', [effect('bulletDamagePercent', 7, '子弹伤害＋7%')], { damageMultiplier: 1.07 }],
      ['blue', 'Ⅲ', [
        effect('bulletDamagePercent', 10, '子弹伤害＋10%'),
        effect('eliteAndBossDamagePercent', 4, '对精英和首领伤害＋4%'),
      ], { damageMultiplier: 1.10, eliteDamageMultiplier: 1.04, bossDamageMultiplier: 1.04 }],
    ],
  },
  {
    key: 'rapid-wing',
    slot: 'wing',
    label: '连射机翼',
    icon: 'S',
    qualities: [
      ['white', 'Ⅰ', [effect('fireRatePercent', 4, '射速＋4%')], { fireRateMultiplier: 1.04 }],
      ['green', 'Ⅱ', [effect('fireRatePercent', 7, '射速＋7%')], { fireRateMultiplier: 1.07 }],
      ['blue', 'Ⅲ', [
        effect('fireRatePercent', 10, '射速＋10%'),
        effect('bulletDamagePercent', 3, '子弹伤害＋3%'),
      ], { fireRateMultiplier: 1.10, damageMultiplier: 1.03 }],
    ],
  },
  {
    key: 'calibration-wing',
    slot: 'wing',
    label: '校准机翼',
    icon: 'Q',
    qualities: [
      ['white', 'Ⅰ', [effect('criticalChancePercent', 2, '暴击率＋2%')], { critChance: 0.02 }],
      ['green', 'Ⅱ', [effect('criticalChancePercent', 4, '暴击率＋4%')], { critChance: 0.04 }],
      ['blue', 'Ⅲ', [
        effect('criticalChancePercent', 6, '暴击率＋6%'),
        effect('criticalDamagePercent', 12, '暴击伤害＋12%'),
      ], { critChance: 0.06, critMultiplier: 0.12 }],
    ],
  },
  {
    key: 'vector-engine',
    slot: 'engine',
    label: '矢量推进器',
    icon: 'V',
    qualities: [
      ['white', 'Ⅰ', [effect('moveSpeedPercent', 4, '移动速度＋4%')], { moveSpeedMultiplier: 1.04 }],
      ['green', 'Ⅱ', [effect('moveSpeedPercent', 7, '移动速度＋7%')], { moveSpeedMultiplier: 1.07 }],
      ['blue', 'Ⅲ', [
        effect('moveSpeedPercent', 10, '移动速度＋10%'),
        effect('pickupRangePercent', 20, '道具拾取范围＋20%'),
      ], { moveSpeedMultiplier: 1.10, magnetRangeMultiplier: 1.20 }],
    ],
  },
  {
    key: 'energy-engine',
    slot: 'engine',
    label: '能量推进器',
    icon: 'E',
    qualities: [
      ['white', 'Ⅰ', [effect('skillCooldownPercent', -3, '技能冷却时间－3%')], { activeCooldownMultiplier: 0.97 }],
      ['green', 'Ⅱ', [effect('skillCooldownPercent', -5, '技能冷却时间－5%')], { activeCooldownMultiplier: 0.95 }],
      ['blue', 'Ⅲ', [
        effect('skillCooldownPercent', -8, '技能冷却时间－8%'),
        effect('skillDamagePercent', 4, '技能伤害＋4%'),
      ], { activeCooldownMultiplier: 0.92, activeDamageMultiplier: 1.04 }],
    ],
  },
  {
    key: 'training-engine',
    slot: 'engine',
    label: '训练推进器',
    icon: 'X',
    qualities: [
      ['white', 'Ⅰ', [effect('aircraftXpPercent', 6, '飞机经验获取＋6%')], { xpMultiplier: 1.06 }],
      ['green', 'Ⅱ', [effect('aircraftXpPercent', 10, '飞机经验获取＋10%')], { xpMultiplier: 1.10 }],
      ['blue', 'Ⅲ', [
        effect('aircraftXpPercent', 15, '飞机经验获取＋15%'),
        effect('moveSpeedPercent', 5, '移动速度＋5%'),
        effect('overflowXpConversion', { input: 100, output: 10 }, '100点溢出飞机经验转换为10点通用强化经验'),
      ], { xpMultiplier: 1.15, moveSpeedMultiplier: 1.05 }],
    ],
  },
  {
    key: 'armor-tail',
    slot: 'tail',
    label: '装甲机尾',
    icon: 'H',
    qualities: [
      ['white', 'Ⅰ', [effect('maxHpPercent', 6, '飞机最大耐久＋6%')], { maxHpMultiplier: 1.06 }],
      ['green', 'Ⅱ', [effect('maxHpPercent', 10, '飞机最大耐久＋10%')], { maxHpMultiplier: 1.10 }],
      ['blue', 'Ⅲ', [
        effect('maxHpPercent', 15, '飞机最大耐久＋15%'),
        effect('damageReductionPercent', 3, '受到伤害降低3%'),
      ], { maxHpMultiplier: 1.15, damageTakenMultiplier: 0.97 }],
    ],
  },
  {
    key: 'buffer-tail',
    slot: 'tail',
    label: '缓冲机尾',
    icon: 'B',
    qualities: [
      ['white', 'Ⅰ', [effect('damageReductionPercent', 2, '受到伤害降低2%')], { damageTakenMultiplier: 0.98 }],
      ['green', 'Ⅱ', [effect('damageReductionPercent', 4, '受到伤害降低4%')], { damageTakenMultiplier: 0.96 }],
      ['blue', 'Ⅲ', [
        effect('damageReductionPercent', 6, '受到伤害降低6%'),
        effect('collisionDamageReductionPercent', 20, '碰撞伤害降低20%'),
      ], { damageTakenMultiplier: 0.94, collisionDamageTakenMultiplier: 0.80 }],
    ],
  },
  {
    key: 'repair-tail',
    slot: 'tail',
    label: '修复机尾',
    icon: 'R',
    qualities: [
      ['white', 'Ⅰ', [effect('healingPercent', 12, '耐久回复效果＋12%')], { healingMultiplier: 1.12 }],
      ['green', 'Ⅱ', [effect('healingPercent', 22, '耐久回复效果＋22%')], { healingMultiplier: 1.22 }],
      ['blue', 'Ⅲ', [
        effect('healingPercent', 35, '耐久回复效果＋35%'),
        effect('maxHpPercent', 5, '最大耐久＋5%'),
      ], { healingMultiplier: 1.35, maxHpMultiplier: 1.05 }],
    ],
  },
];

export const GACHA_FIXED_ITEMS = Object.freeze(FIXED_SERIES.flatMap((series) => (
  series.qualities.map(([quality, numeral, effects, assemblyStats]) => fixedItem({
    id: `fixed:${series.key}:${quality}`,
    name: `${GACHA_QUALITIES[quality].name}${series.label}${numeral}`,
    shortName: series.label.replace('推进器', '推进').replace('机翼', '').replace('机尾', ''),
    slot: series.slot,
    quality,
    icon: series.icon,
    effects,
    assemblyStats,
  }))
)));

function purpleWeapon(config) {
  return Object.freeze({
    ...config,
    type: 'weapon',
    slot: 'primary',
    quality: 'purple',
    icon: config.icon || '',
    isUniversal: true,
    isImplemented: true,
    duplicatePolicy: Object.freeze({
      mode: 'refinement',
      maxRank: 5,
      consumeAutomatically: false,
    }),
  });
}

export const GACHA_PURPLE_WEAPONS = Object.freeze([
  purpleWeapon({
    id: 'weapon:twin-pulse',
    name: '双联脉冲炮',
    icon: 'Ⅱ',
    effects: Object.freeze([
      effect('attackIntervalSeconds', 0.20, '攻击间隔0.20秒'),
      effect('projectilesPerShot', 2, '每次发射2发'),
      effect('damagePerProjectileAttackRatio', 0.50, '每发伤害为飞机攻击力的50%'),
      effect('pierceTargets', 0, '不穿透'),
    ]),
    weapon: Object.freeze({ mode: 'parallel', mechanism: 'direct', attackInterval: 0.20, projectileCount: 2, damageRatio: 0.50, projectileSpeed: 'fast', pierce: 0 }),
  }),
  purpleWeapon({
    id: 'weapon:five-way-spread',
    name: '五向散射炮',
    icon: 'Ⅴ',
    effects: Object.freeze([
      effect('attackIntervalSeconds', 0.25, '攻击间隔0.25秒'),
      effect('projectilesPerShot', 5, '每次发射5发'),
      effect('damagePerProjectileAttackRatio', 0.25, '每发伤害为飞机攻击力的25%'),
      effect('spreadAnglesDegrees', [-18, -9, 0, 9, 18], '发射角度-18°、-9°、0°、9°、18°'),
    ]),
    weapon: Object.freeze({ mode: 'spread', mechanism: 'spread', attackInterval: 0.25, projectileCount: 5, damageRatio: 0.25, angles: [-18, -9, 0, 9, 18], pierce: 0 }),
  }),
  purpleWeapon({
    id: 'weapon:piercing-laser',
    name: '贯穿激光器',
    icon: '━',
    effects: Object.freeze([
      effect('damageTickSeconds', 0.10, '伤害结算间隔0.10秒'),
      effect('damagePerTickAttackRatio', 0.42, '每次伤害为飞机攻击力的42%'),
      effect('pierceTargets', 3, '最多同时贯穿3个目标'),
      effect('followAircraftX', true, '激光跟随飞机横向移动'),
    ]),
    weapon: Object.freeze({ mode: 'beam', mechanism: 'beam', damageTick: 0.10, damageRatio: 0.42, maxTargets: 3, followAircraftX: true }),
  }),
  purpleWeapon({
    id: 'weapon:falcon-homing',
    name: '猎鹰追踪弹',
    icon: '➤',
    effects: Object.freeze([
      effect('attackIntervalSeconds', 0.60, '攻击间隔0.60秒'),
      effect('missilesPerShot', 3, '每次发射3枚导弹'),
      effect('directDamageAttackRatio', 0.90, '每枚直接伤害为飞机攻击力的90%'),
      effect('splashDamageAttackRatio', 0.20, '爆炸对附近敌人造成飞机攻击力20%的伤害'),
    ]),
    weapon: Object.freeze({ mode: 'homing', mechanism: 'homing', attackInterval: 0.60, projectileCount: 3, damageRatio: 0.90, splashDamageRatio: 0.20, targetPriority: 'nearest' }),
  }),
  purpleWeapon({
    id: 'weapon:heavy-burst',
    name: '重型爆裂炮',
    icon: '●',
    effects: Object.freeze([
      effect('attackIntervalSeconds', 0.50, '攻击间隔0.50秒'),
      effect('directDamageAttackRatio', 2.00, '直接命中伤害为飞机攻击力的200%'),
      effect('explosionDamageAttackRatio', 0.60, '爆炸伤害为飞机攻击力的60%'),
      effect('pierceTargets', 0, '不穿透'),
    ]),
    weapon: Object.freeze({ mode: 'explosive', mechanism: 'explosive', attackInterval: 0.50, damageRatio: 2.00, splashDamageRatio: 0.60, splashRadius: 'medium', projectileSpeed: 'slow', pierce: 0 }),
  }),
]);

export const GOLD_WEAPON_CONTENT_INTERFACE = Object.freeze({
  type: 'weapon',
  slot: 'primary',
  quality: 'gold',
  isUniversal: false,
  requiredFields: Object.freeze([
    'id',
    'name',
    'exclusiveAircraftId',
    'effects',
    'icon',
    'isImplemented',
  ]),
});

function goldWeapon(config) {
  return Object.freeze({
    ...config,
    type: 'weapon',
    slot: 'primary',
    quality: 'gold',
    isUniversal: false,
    isImplemented: true,
    duplicatePolicy: Object.freeze({
      mode: 'refinement',
      maxRank: 5,
      consumeAutomatically: false,
    }),
  });
}

export const GACHA_GOLD_WEAPONS = Object.freeze([
  goldWeapon({
    id: 'GOLD-AEGIS-01',
    name: '米迦圣环·天穹裁决',
    icon: '⬡',
    exclusiveAircraftId: 'pilot-10',
    exclusiveCallsign: 'AEGIS-M',
    effects: Object.freeze([
      effect('attackIntervalSeconds', 0.25, '攻击间隔0.25秒'),
      effect('lanceDamageRatios', [0.35, 0.70, 0.35], '中央光矛70%，左右光矛各35%'),
      effect('exclusiveEffect', 'sanctuary-echo', '天穹圣域清除的弹幕转化为最多8枚追踪圣枪'),
    ]),
    weapon: Object.freeze({
      mode: 'aegis-lances',
      mechanism: 'direct',
      attackInterval: 0.25,
      projectileCount: 3,
      damageRatios: Object.freeze([0.35, 0.70, 0.35]),
      pierce: 0,
    }),
    exclusiveEffect: Object.freeze({
      id: 'sanctuary-echo',
      triggerAbilityType: 'sanctuary',
      projectileMode: 'homing-holy-lance',
      projectileDamageRatio: 0.65,
      maxProjectiles: 8,
      fallbackProjectiles: 3,
      scalesWithClearedBullets: true,
      modifiesImmunityCharges: false,
      modifiesAbilityInterval: false,
    }),
  }),
  goldWeapon({
    id: 'GOLD-NIGHTFALL-00',
    name: '夜莺零式·相位终曲',
    icon: '◒',
    exclusiveAircraftId: 'pilot-01',
    exclusiveCallsign: 'NIGHTFALL-00',
    effects: Object.freeze([
      effect('attackIntervalSeconds', 0.20, '攻击间隔0.20秒'),
      effect('parallelBladeDamageRatio', 0.55, '每次发射2枚平行羽刃，每枚55%'),
      effect('pierceTargets', 1, '每枚可穿透1个普通敌人'),
      effect('exclusiveEffect', 'phase-counterpoint', '进入零域相位时生成2个持续1.2秒的相位残影'),
    ]),
    weapon: Object.freeze({
      mode: 'phase-blades',
      mechanism: 'direct',
      attackInterval: 0.20,
      projectileCount: 2,
      damageRatio: 0.55,
      pierce: 1,
    }),
    exclusiveEffect: Object.freeze({
      id: 'phase-counterpoint',
      triggerAbilityType: 'phase',
      cloneCount: 2,
      duration: 1.2,
      damageRatio: 0.35,
      copies: 'base-weapon-only',
      recursive: false,
      triggersPilotAbilities: false,
      triggersOtherPassives: false,
      modifiesPhaseDuration: false,
      modifiesAbilityInterval: false,
    }),
  }),
]);

export const GACHA_AIRCRAFT_ITEMS = Object.freeze(AIRCRAFTS.map(aircraftItem));
export const GACHA_COMMON_WEAPONS=Object.freeze(Object.values(COMMON_WEAPONS).map(a=>Object.freeze({
  id:`weapon:${a.id}`,refId:a.id,name:a.name,shortName:a.name,type:'weapon',quality:'white',isUniversal:true,isImplemented:true,common:true,
  icon:a.mechanic,effects:[effect('commonWeapon',a.id,a.normal)],description:a.role,
  duplicatePolicy:{mode:'weapon_fragments'},weaponContent:{family:a.mechanic},
})));
export const GACHA_ITEMS = Object.freeze([
  ...GACHA_AIRCRAFT_ITEMS,
  ...GACHA_FIXED_ITEMS,
  ...GACHA_PURPLE_WEAPONS,
  ...GACHA_GOLD_WEAPONS,
  ...GACHA_COMMON_WEAPONS,
]);
export const GACHA_ITEM_MAP = new Map(GACHA_ITEMS.map((item) => [item.id, item]));

function itemIds(items, quality) {
  return Object.freeze(items.filter((item) => item.quality === quality).map((item) => item.id));
}

export const GACHA_POOLS = Object.freeze({
  aircraft_permanent: Object.freeze({
    id: 'aircraft_permanent',
    name: '飞机角色池',
    type: 'aircraft',
    qualityProbabilities: Object.freeze({ R: 74, SR: 20, SSR: 5, UR: 1 }),
    itemIdsByQuality: Object.freeze({
      R: itemIds(GACHA_AIRCRAFT_ITEMS, 'R'),
      SR: itemIds(GACHA_AIRCRAFT_ITEMS, 'SR'),
      SSR: itemIds(GACHA_AIRCRAFT_ITEMS, 'SSR'),
      UR: itemIds(GACHA_AIRCRAFT_ITEMS, 'UR'),
    }),
    pityCounters: Object.freeze({
      sr: Object.freeze({ resetQualities: Object.freeze(['SR', 'SSR', 'UR']) }),
      ssr: Object.freeze({ resetQualities: Object.freeze(['SSR', 'UR']) }),
      ur: Object.freeze({ resetQualities: Object.freeze(['UR']) }),
    }),
    pityRules: Object.freeze([
      Object.freeze({ id: 'ur', counter: 'ur', triggerAt: 70, priority: 300, weights: Object.freeze({ UR: 100 }) }),
      Object.freeze({ id: 'ssr', counter: 'ssr', triggerAt: 30, priority: 200, eligibleQualities: Object.freeze(['SSR', 'UR']) }),
      Object.freeze({ id: 'sr', counter: 'sr', triggerAt: 10, priority: 100, eligibleQualities: Object.freeze(['SR', 'SSR', 'UR']) }),
    ]),
  }),
  weapon_permanent: Object.freeze({
    id: 'weapon_permanent',
    name: '通用武器池',
    type: 'weapon',
    qualityProbabilities: Object.freeze({ white: 34, green: 30, blue: 25, purple: 10, gold: 1 }),
    itemIdsByQuality: Object.freeze({
      white: Object.freeze(GACHA_COMMON_WEAPONS.map(w=>w.id)),
      green: Object.freeze(GACHA_COMMON_WEAPONS.map(w=>w.id)),
      blue: Object.freeze(GACHA_COMMON_WEAPONS.map(w=>w.id)),
      purple: Object.freeze(GACHA_COMMON_WEAPONS.map(w=>w.id)),
      gold: Object.freeze(GACHA_COMMON_WEAPONS.map(w=>w.id)),
    }),
    pityCounters: Object.freeze({
      purple: Object.freeze({ resetQualities: Object.freeze(['purple', 'gold']) }),
      gold: Object.freeze({ resetQualities: Object.freeze(['gold']) }),
    }),
    pityRules: Object.freeze([
      Object.freeze({ id: 'gold', counter: 'gold', triggerAt: 60, priority: 200, weights: Object.freeze({ gold: 100 }) }),
      Object.freeze({ id: 'purple', counter: 'purple', triggerAt: 10, priority: 100, weights: Object.freeze({ purple: 99, gold: 1 }) }),
    ]),
  }),
});

export const GACHA_POOL_LIST = Object.freeze(Object.values(GACHA_POOLS));

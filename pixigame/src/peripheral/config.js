import { AIRCRAFTS } from '../pilots.js';
import { COMMON_WEAPONS } from '../fixed-parts/common-weapons.js';
import { commonWeaponUpgradeCost } from '../fixed-parts/weapon-progression-config.js';
import { AIRCRAFT_MAX_LEVEL } from '../growth-tuning.js';
export { aircraftUpgradeCost } from '../growth-tuning.js';

export const PERIPHERAL_STORAGE_KEY = 'thunder-peripheral-v1';
export const PERIPHERAL_BACKUP_KEY = 'thunder-peripheral-legacy-backup-v1';
export const GENERAL_SLOTS = Object.freeze(['W3', 'W4', 'W5', 'W6']);
export const PERIPHERAL_MAX_LEVEL = AIRCRAFT_MAX_LEVEL;
// Local stamina pacing requested for this build; extracted reference data stays unchanged.
export const MAX_STAMINA = 100;
export const SORTIE_STAMINA = 5;
export const STAMINA_INTERVAL_MS = 3 * 60 * 1000;
export const STAMINA_RECOVERY_DESCRIPTION = `每 ${STAMINA_INTERVAL_MS / 60000} 分钟恢复 1 点，自然恢复至 ${MAX_STAMINA} 点。`;

// Reuse existing attack implementations and assets, without changing trajectory,
// cadence, status effects, or the retained quality rules of any weapon.
const innateIds = ['aux_cannon', 'aux_drone', 'aux_scatter', 'aux_sidegun', 'aux_rocket',
  'aux_rail', 'aux_lightning', 'aux_laser', 'aux_grenade', 'aux_orb'];
const hulls = [100, 115, 105, 95, 100, 90, 110, 95, 130, 105];
export const PERIPHERAL_AIRCRAFT = Object.freeze(AIRCRAFTS.map((pilot, index) => Object.freeze({
  id: pilot.id, name: pilot.aircraft, rarity: pilot.rarity, color: pilot.color,
  image: `${import.meta.env?.BASE_URL??'/'}art/aircraft-ui-v1/${pilot.id}.webp`, callsign: pilot.callsign, baseHp: hulls[index], baseAttack: 100,
  weaponId: innateIds[index], weaponName: COMMON_WEAPONS[innateIds[index]].name,
})));
export const PERIPHERAL_AIRCRAFT_MAP = new Map(PERIPHERAL_AIRCRAFT.map(a => [a.id, a]));

// Character identity remains independent of weapon firing geometry. These fixed
// passives replace the formal lobby's old shot-count/resonance progression only.
export const PERIPHERAL_PILOT_PASSIVES = Object.freeze({
  'pilot-01': { name: '零域相位', description: '闪避冷却缩短 15%。', modifiers: { dodgeCooldownMultiplier: .85 } },
  'pilot-02': { name: '春息回路', description: '每 5 秒恢复 2% 最大耐久。', modifiers: { healInterval: 5, healMaxHpRatio: .02 } },
  'pilot-03': { name: '绯色散华', description: '所有已装武器基础伤害提高 6%。', modifiers: { damageMultiplier: 1.06 } },
  'pilot-04': { name: '天际横弦', description: '经验吸取范围扩大 25%。', modifiers: { pickupRadiusMultiplier: 1.25 } },
  'pilot-05': { name: '彗星齐射', description: '所有已装武器对 Boss 的伤害提高 12%。', modifiers: { bossDamageMultiplier: 1.12 } },
  'pilot-06': { name: '致命校准', description: '已装武器攻击有 12% 概率暴击，暴击造成 210% 伤害。', modifiers: { critChance: .12, critMultiplierBonus: .35 } },
  'pilot-07': { name: '双星同轨', description: '当前飞机最大耐久提高 10%。', modifiers: { maxHpMultiplier: 1.10 } },
  'pilot-08': { name: '三相火控', description: '本局获得的经验提高 8%。', modifiers: { xpMultiplier: 1.08 } },
  'pilot-09': { name: '四门齐奏', description: '所有受到的伤害降低 8%。', modifiers: { damageTakenMultiplier: .92 } },
  'pilot-10': { name: '天穹圣域', description: '每 7 秒获得相当于最大耐久 5% 的护盾，持续 7 秒，不叠加。', modifiers: { shieldInterval: 7, shieldMaxHpRatio: .05, shieldDuration: 7 } },
});

export const peripheralWeaponUpgradeCost = commonWeaponUpgradeCost;

// Product tuning for this build, not claims about extracted APK economy values.
export const DAILY_TASKS = Object.freeze([
  { id: 'login', name: '每日报到', counter: 'login', target: 1, reward: { coins: 200, aircraftShards: 4, weaponParts: 6 } },
  { id: 'sortie', name: '完成 1 次出击', counter: 'sorties', target: 1, reward: { coins: 300, weaponParts: 8 } },
  { id: 'victory', name: '赢得 1 场战斗', counter: 'victories', target: 1, reward: { diamonds: 20, aircraftShards: 6 } },
  { id: 'upgrade', name: '完成 1 次基础强化', counter: 'upgrades', target: 1, reward: { coins: 150, weaponParts: 4 } },
  { id: 'recruit', name: '完成 1 次招募', counter: 'recruits', target: 1, reward: { coins: 200, diamonds: 10 } },
]);

export const WEEKLY_TASKS = Object.freeze([
  { id: 'weekly-sorties', name: '每周完成 5 次出击', counter: 'sorties', target: 5, reward: { coins: 1200, aircraftShards: 15 } },
  { id: 'weekly-victories', name: '每周取得 3 次胜利', counter: 'victories', target: 3, reward: { diamonds: 60, weaponParts: 30 } },
  { id: 'weekly-upgrades', name: '每周完成 5 次强化', counter: 'upgrades', target: 5, reward: { coins: 800, weaponParts: 15 } },
]);

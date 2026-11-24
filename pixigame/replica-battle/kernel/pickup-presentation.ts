import type { Pickup } from './model';
import {PROJECT_COIN_FRAME_COUNT} from './coin-extrusion.ts';

export const COIN_HEIGHT = 32;
export const COIN_WIDTH = 32;
const COIN_TURNS_PER_SECOND = 1.4;

export function projectCoinPose(pickup: Pick<Pickup, 'uid' | 'age' | 'delay'>) {
  const age = Math.max(0, pickup.age - pickup.delay);
  const angle = age * Math.PI * 2 * COIN_TURNS_PER_SECOND + (Math.abs(pickup.uid) % 17) * .37;
  const turn = (angle / (Math.PI * 2)) % 1;
  return { frame: Math.floor(turn * PROJECT_COIN_FRAME_COUNT), width: COIN_WIDTH, height: COIN_HEIGHT };
}

export const MODULE_PROFILES = {
  rapid: { color: 0xffbb44, label: '射速强化' },
  attack: { color: 0xff6657, label: '伤害强化' },
  invulnerable: { color: 0x70edff, label: '无敌强化' },
  shield: { color: 0x649fff, label: '护盾强化' },
  overdrive: { color: 0xdd8dff, label: '综合强化' },
  generic: { color: 0x8ce2c7, label: '强化模块' },
  missile: { color: 0xff8d42, label: '导弹支援' },
} as const;
export type Profile = keyof typeof MODULE_PROFILES;
export const MODULE_ITEM_PROFILES: Readonly<Record<number, Profile>> = {
  100: 'rapid', 101: 'invulnerable', 105: 'generic',
  111: 'invulnerable', 112: 'invulnerable', 113: 'invulnerable',
  117: 'overdrive', 118: 'overdrive', 119: 'overdrive',
  148: 'shield', 149: 'shield', 150: 'attack', 151: 'attack',
  152: 'rapid', 153: 'rapid', 156: 'shield', 157: 'rapid', 158: 'rapid',
  160: 'overdrive', 161: 'overdrive', 1100: 'generic', 1101: 'generic',
};

export function moduleProfile(pickup: Pick<Pickup, 'kind' | 'itemId'>): Profile | undefined {
  // Passive missile airdrop (114) and equipment support (159) share project art.
  if(pickup.kind === 'trigger' && (pickup.itemId === 114 || pickup.itemId === 159))return 'missile';
  return pickup.kind === 'buff' ? MODULE_ITEM_PROFILES[pickup.itemId] ?? 'generic' : undefined;
}

export function airdropModulePose(pickup: Pick<Pickup, 'age' | 'delay' | 'state' | 'stateTime'>) {
  const time = Math.max(0, pickup.age - pickup.delay);
  const absorbing = pickup.state === 'absorb';
  const progress = absorbing ? Math.min(1, Math.max(0, pickup.stateTime) / .18) : 0;
  return { y: absorbing ? -2 : -2 + Math.sin(time * 2.4) * 1.4,
    scale: 1 - progress * .3, glow: absorbing ? .3 : .08 + (1 + Math.sin(time * 2.4)) * .035 };
}


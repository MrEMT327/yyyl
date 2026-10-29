import type Phaser from 'phaser';
import type { Pickup } from './model';

const TEXTURE = 'original-airdrop-module-shell-v1';
export const MODULE_PROFILES = {
  rapid: { color: 0xffbb44, label: '射速强化' },
  attack: { color: 0xff6657, label: '伤害强化' },
  invulnerable: { color: 0x70edff, label: '无敌强化' },
  shield: { color: 0x649fff, label: '护盾强化' },
  overdrive: { color: 0xdd8dff, label: '综合强化' },
  generic: { color: 0x8ce2c7, label: '强化模块' },
} as const;
type Profile = keyof typeof MODULE_PROFILES;
export const MODULE_ITEM_PROFILES: Readonly<Record<number, Profile>> = {
  100: 'rapid', 101: 'invulnerable', 105: 'generic',
  111: 'invulnerable', 112: 'invulnerable', 113: 'invulnerable',
  117: 'overdrive', 118: 'overdrive', 119: 'overdrive',
  148: 'shield', 149: 'shield', 150: 'attack', 151: 'attack',
  152: 'rapid', 153: 'rapid', 156: 'shield', 157: 'rapid', 158: 'rapid',
  160: 'overdrive', 161: 'overdrive', 1100: 'generic', 1101: 'generic',
};

export function moduleProfile(pickup: Pick<Pickup, 'kind' | 'itemId'>): Profile | undefined {
  return pickup.kind === 'buff' ? MODULE_ITEM_PROFILES[pickup.itemId] ?? 'generic' : undefined;
}

export function preloadAirdropModuleArt(scene: Phaser.Scene) {
  scene.load.image(TEXTURE, './assets/airdrop-modules-v1/module-shell.png');
}

function drawSymbol(graphics: Phaser.GameObjects.Graphics, profile: Profile, color: number) {
  graphics.lineStyle(1.7, color, 1).fillStyle(color, 1);
  if (profile === 'rapid') {
    for (const horizontal of [-6, 0, 6]) {
      graphics.fillRect(horizontal - 1.5, -4, 3, 8);
      graphics.fillTriangle(horizontal - 1.5, -4, horizontal + 1.5, -4, horizontal, -7);
    }
    graphics.lineBetween(-7, 9, 0, 6).lineBetween(0, 6, 7, 9);
  } else if (profile === 'attack') {
    graphics.strokeCircle(0, 0, 6).fillCircle(0, 0, 1.7);
    for (const direction of [-1, 1]) {
      graphics.lineBetween(direction * 4, 0, direction * 10, 0);
      graphics.lineBetween(0, direction * 4, 0, direction * 10);
    }
  } else if (profile === 'shield' || profile === 'invulnerable') {
    graphics.beginPath().moveTo(-8, -7).lineTo(0, -10).lineTo(8, -7)
      .lineTo(7, 3).lineTo(0, 10).lineTo(-7, 3).closePath().strokePath();
    if (profile === 'shield') graphics.lineBetween(-4, 0, 4, 0).lineBetween(0, -4, 0, 4);
    else graphics.strokeCircle(0, -1, 3).lineBetween(0, 2, 0, 5);
  } else if (profile === 'overdrive') {
    graphics.beginPath().moveTo(2, -10).lineTo(-6, 2).lineTo(-1, 2)
      .lineTo(-3, 10).lineTo(7, -3).lineTo(2, -3).closePath().fillPath();
    graphics.lineBetween(-9, -6, -9, 1).lineBetween(9, 2, 9, 8);
  } else {
    graphics.beginPath().moveTo(0, -9).lineTo(8, 0).lineTo(0, 9).lineTo(-8, 0).closePath().strokePath();
    graphics.fillCircle(0, 0, 2);
  }
}

export function createAirdropModuleVisual(scene: Phaser.Scene, pickup: Pickup): Phaser.GameObjects.Container | undefined {
  const profile = moduleProfile(pickup);
  if (!profile) return undefined;
  const color = MODULE_PROFILES[profile].color;
  const shell = scene.add.image(0, 0, TEXTURE).setDisplaySize(60, 60);
  const light = scene.add.graphics().fillStyle(color, 1).fillRoundedRect(-13, -15, 26, 26, 4);
  const symbol = scene.add.graphics().setPosition(0, -2);
  drawSymbol(symbol, profile, color);
  const body = scene.add.container(0, 0, [shell, light, symbol]);
  return scene.add.container(0, 0, [body]).setData('airdropModule', { body, light, profile });
}

export function airdropModulePose(pickup: Pick<Pickup, 'age' | 'delay' | 'state' | 'stateTime'>) {
  const time = Math.max(0, pickup.age - pickup.delay);
  const absorbing = pickup.state === 'absorb';
  const progress = absorbing ? Math.min(1, Math.max(0, pickup.stateTime) / .18) : 0;
  return { y: absorbing ? -2 : -2 + Math.sin(time * 2.4) * 1.4,
    scale: 1 - progress * .3, glow: absorbing ? .3 : .08 + (1 + Math.sin(time * 2.4)) * .035 };
}

export function updateAirdropModuleVisual(view: Phaser.GameObjects.Container, pickup: Pickup): boolean {
  const visual = view.getData('airdropModule');
  if (!visual) return false;
  const pose = airdropModulePose(pickup);
  visual.body.setPosition(0, pose.y).setScale(pose.scale);
  visual.light.setAlpha(pose.glow);
  return true;
}

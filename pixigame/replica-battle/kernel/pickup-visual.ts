import type Phaser from 'phaser';
import type { Pickup } from './model';
import { preloadAirdropModuleArt, createAirdropModuleVisual, updateAirdropModuleVisual } from './airdrop-module-visual';

const COIN = 'licensed-pickup-gold-v1';
const MEDKIT = 'licensed-pickup-medkit-v1';
const ROOT = './assets/licensed-pickups/';
const COIN_FRAMES = 30;
const COIN_FPS = 22;

export function preloadPickupArt(scene: Phaser.Scene) {
  preloadAirdropModuleArt(scene);
  scene.load.spritesheet(COIN, ROOT + 'gold-spin-v1.png', { frameWidth: 128, frameHeight: 128, endFrame: COIN_FRAMES - 1 });
  scene.load.image(MEDKIT, ROOT + 'medkit-white-green-v1.png');
}

export function createPickupVisual(scene: Phaser.Scene, pickup: Pickup): Phaser.GameObjects.Container | undefined {
  const module = createAirdropModuleVisual(scene, pickup);
  if (module) return module;
  // Stg_Prop_Life is a trigger pickup (including healing items 154/155),
  // so it must share the medkit art instead of falling back to the old prefab.
  const healing = pickup.kind === 'heart' || (pickup.kind === 'trigger' && pickup.modelId === 1300008);
  if (pickup.kind !== 'gold' && !healing) return undefined;
  const coin = pickup.kind === 'gold';
  // Logical 540px battle width: roughly 30px coin / 40px medkit visible artwork.
  const image = scene.add.image(0, 0, coin ? COIN : MEDKIT, coin ? 0 : undefined);
  image.setDisplaySize(coin ? 32 : 42, coin ? 32 : 42);
  const view = scene.add.container(0, 0, [image]);
  view.setData('pickupArt', image);
  return view;
}

export function updatePickupVisual(view: Phaser.GameObjects.Container, pickup: Pickup): boolean {
  if (updateAirdropModuleVisual(view, pickup)) return true;
  const image = view.getData('pickupArt') as Phaser.GameObjects.Image | undefined;
  if (!image) return false;
  // Simulation age respects appearance delay and pause; rendering cannot advance gameplay.
  if (pickup.kind === 'gold') image.setFrame(Math.floor(Math.max(0, pickup.age - pickup.delay) * COIN_FPS) % COIN_FRAMES);
  return true;
}

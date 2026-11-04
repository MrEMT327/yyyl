import type Phaser from 'phaser';
import type { Pickup } from './model';
import { cloudAssetBase } from '../../src/ui/cloud-asset-base.js';
import { ensureProjectCoinFrames,PROJECT_COIN_FRAME_COUNT } from './coin-extrusion';
import { preloadAirdropModuleArt, createAirdropModuleVisual, updateAirdropModuleVisual } from './airdrop-module-visual';

const COIN = 'project-pickup-gold-front-v1';
const MEDKIT = 'project-medkit-armored-front-v1';
const COIN_HEIGHT = 32;
const COIN_WIDTH = 32;
const COIN_TURNS_PER_SECOND = 1.4;

export function projectCoinPose(pickup: Pick<Pickup, 'uid' | 'age' | 'delay'>) {
  const age = Math.max(0, pickup.age - pickup.delay);
  const angle = age * Math.PI * 2 * COIN_TURNS_PER_SECOND + (Math.abs(pickup.uid) % 17) * .37;
  const turn = (angle / (Math.PI * 2)) % 1;
  return { frame: Math.floor(turn * PROJECT_COIN_FRAME_COUNT), width: COIN_WIDTH, height: COIN_HEIGHT };
}

export function preloadPickupArt(scene: Phaser.Scene) {
  preloadAirdropModuleArt(scene);
  scene.load.image(COIN, cloudAssetBase + 'art/project-coin-pickup-v1/coin-front-v1.png');
  scene.load.once('complete', () => ensureProjectCoinFrames(scene, COIN));
  scene.load.image(MEDKIT, './assets/project-medkit-v1/medical-case-front-v1.png');
  scene.load.once('complete', () => {
    const texture = scene.textures.get(MEDKIT);
    // Frame out generated transparent padding; keep the original 42px pickup footprint.
    if (texture.key !== '__MISSING' && !texture.has('front')) texture.add('front', 0, 115, 94, 1024, 1024);
  });
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
  const image = scene.add.image(0, 0, coin ? ensureProjectCoinFrames(scene, COIN) : MEDKIT, coin ? 0 : 'front');
  image.setDisplaySize(coin ? COIN_WIDTH : 42, coin ? COIN_HEIGHT : 42);
  const view = scene.add.container(0, 0, [image]);
  view.setData('pickupArt', image);
  return view;
}

export function updatePickupVisual(view: Phaser.GameObjects.Container, pickup: Pickup): boolean {
  if (updateAirdropModuleVisual(view, pickup)) return true;
  const image = view.getData('pickupArt') as Phaser.GameObjects.Image | undefined;
  if (!image) return false;
  // Simulation age respects appearance delay and pause; rendering cannot advance gameplay.
  if (pickup.kind === 'gold') {
    const pose = projectCoinPose(pickup);
    image.setFrame(pose.frame);
  }
  return true;
}

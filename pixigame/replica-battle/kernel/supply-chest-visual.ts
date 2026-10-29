import type Phaser from 'phaser';

const TEXTURE = 'licensed-military-supply-chest-v1';
const SIZE = 76;
type ChestPose = { animation: string; animationAge: number; progress: number };

export function preloadSupplyChestArt(scene: Phaser.Scene) {
  scene.load.image(TEXTURE, './assets/licensed-supply-chest/military-green-v1.png');
}

export function createSupplyChestVisual(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const shadow = scene.add.graphics().fillStyle(0x071317, .28).fillEllipse(0, 23, 56, 14);
  const image = scene.add.image(0, -4, TEXTURE).setDisplaySize(SIZE, SIZE);
  return scene.add.container(0, 0, [shadow, image]).setData('supplyChestBody', image);
}

/** The native NPC still owns contact, rewards and removal timing. */
export function updateSupplyChestVisual(view: Phaser.GameObjects.Container, chest: ChestPose, duration: number) {
  const image = view.getData('supplyChestBody') as Phaser.GameObjects.Image;
  const t = Math.max(0, Math.min(1, chest.animationAge / Math.max(.001, duration)));
  let size = 1, alpha = 1, y = -4, rotation = 0;
  if (chest.animation === 'Born') {
    size = .65 + .35 * (1 - Math.pow(1 - t, 3));
    alpha = Math.min(1, t * 5);
    y -= (1 - t) * 18;
  } else if (chest.animation === 'Death') {
    size = 1 - t * .3;
    alpha = 1 - t;
    y -= t * 12;
  } else {
    y += Math.sin(chest.animationAge * 3) * 2;
    if (chest.progress > 0 || chest.animation === 'Enter') rotation = Math.sin(chest.animationAge * 36) * .035;
  }
  view.setRotation(0).setScale(1).setAlpha(alpha);
  image.setPosition(0, y).setDisplaySize(SIZE * size, SIZE * size).setRotation(rotation);
}

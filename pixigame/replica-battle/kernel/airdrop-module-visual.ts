import type Phaser from 'phaser';
import type { Pickup } from './model';

const TEXTURE = 'original-airdrop-module-shell-v1';
import {type Profile,MODULE_PROFILES,moduleProfile,airdropModulePose} from './pickup-presentation.ts';
export {MODULE_PROFILES,MODULE_ITEM_PROFILES,moduleProfile,airdropModulePose} from './pickup-presentation.ts';

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
  } else if (profile === 'missile') {
    for(const x of [-7,0,7]){
      graphics.fillRect(x-1.7,-3,3.4,9).fillTriangle(x-2,-3,x+2,-3,x,-7);
      graphics.lineBetween(x-2,8,x,10).lineBetween(x,10,x+2,8);
    }
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
  const frame=scene.add.graphics();
  frame.fillStyle(0x0a1a26,.95).fillRoundedRect(-17,-19,34,36,5);
  frame.lineStyle(1.25,0x6f8798,.9).strokeRoundedRect(-17,-19,34,36,5);
  frame.lineStyle(1,color,.9).lineBetween(-12,-20,12,-20).lineBetween(-12,18,12,18);
  for(const side of [-1,1]){
    frame.fillStyle(0x899fad,1).fillRoundedRect(side*22-2,-10,4,20,1);
    frame.fillStyle(0xdce9ed,1).fillRect(side*22-1,-9,2,5);
    for(const y of [-11,-5,1])frame.fillStyle(color,.65).fillRect(side*14-1,y,2,3);
  }
  const light = scene.add.graphics().fillStyle(color, 1).fillRoundedRect(-12, -14, 24, 27, 4);
  const symbol = scene.add.graphics().setPosition(0, -2);
  drawSymbol(symbol, profile, color);
  const body = scene.add.container(0, 0, [shell, frame, light, symbol]);
  const shadow=scene.add.graphics().fillStyle(0x03121c,.3).fillEllipse(0,23,32,8);
  const beacon=scene.add.graphics().lineStyle(1,color,.35).strokeEllipse(0,22,39,12);
  return scene.add.container(0, 0, [shadow, beacon, body]).setData('airdropModule', { body, light, beacon, profile });
}

export function updateAirdropModuleVisual(view: Phaser.GameObjects.Container, pickup: Pickup): boolean {
  const visual = view.getData('airdropModule');
  if (!visual) return false;
  const pose = airdropModulePose(pickup);
  visual.body.setPosition(0, pose.y).setScale(pose.scale);
  visual.light.setAlpha(pose.glow);
  visual.beacon.setAlpha(.35+pose.glow).setScale(.93+pose.glow*.3);
  return true;
}

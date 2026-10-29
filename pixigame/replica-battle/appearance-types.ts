import type Phaser from 'phaser';
import type { NativeMapLayer } from './kernel/native-map-layers';
import type { Point } from './kernel/model';
import type { WeaponAppearance } from './weapon-appearance';

export interface WeaponIcon { readonly key: string; readonly url: string }

export interface PlayerSkinPose {
  clock: number; x: number; y: number; width: number; height: number;
  scaleX: number; scaleY: number; shearX: number; alpha: number; visible: boolean;
}
export interface PlayerSkin {
  width: number; height: number;
  update(pose: PlayerSkinPose): void;
}
export interface BattleAppearance {
  replaceTerrain?: boolean;
  setWeapons?(weapons: readonly WeaponAppearance[]): void;
  weaponIcon?(weapon: WeaponAppearance): WeaponIcon;
  playerSkin?: PlayerSkin;
  preload(scene: Phaser.Scene): void;
  create(scene: Phaser.Scene): void;
  update?(frame: {
    time: number; coastBackgroundTime?: number; clock: number; camera: Readonly<Point>;
    phantomActive?: boolean; playerHitFlash?: boolean; runId?: number;
    flight?: Readonly<{ x: number; z: number; speed: number; active: boolean }>;
    mapCameraOffset(layer: NativeMapLayer): Point;
  }): void;
}

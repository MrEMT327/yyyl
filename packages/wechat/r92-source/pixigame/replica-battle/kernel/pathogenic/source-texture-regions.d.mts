import type Phaser from 'phaser';

export interface MobileTextureSize {
  sourceSize: readonly [number, number];
  size: readonly [number, number];
}
export function queueSourceTexture(scene: Phaser.Scene, key: string, url: string, delivery?: MobileTextureSize): void;
export function textureRegion(crop: readonly number[] | undefined, width: number, height: number, limit: number): [number, number, number, number];
export function sourceTextureKey(scene: Phaser.Scene, descriptor?: {key?: string; crop?: readonly number[]} | null): string | undefined;

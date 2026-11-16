import type { GameContent } from './kernel/model';
import type {
  HitVisualEffect,
  ImageVisualScene,
  ScreenPoint,
  VisualObjectMap,
} from './weapon-visual-types';

export const WEAPON_VISUAL_MODE: 'native-motion-with-pathogenic-accents';
export const RESTORED_WEAPON_MODELS: Set<number>;

export function restoredSequenceOwnsSprite(
  modelId: number,
  hierarchy: readonly string[] | undefined,
  assets: GameContent['assets'],
): boolean;

export function nativeWeaponBody(): false;

/** Keep each birth's fields available to the lifetime callback and result. */
export function admitParticleBirths<T extends { at: number }>(
  births: T[],
  limit: number,
  lifeAt: (birth: T) => number,
): T[];

export interface AccentSample {
  frame: number;
  next: number;
  mix: number;
  alpha: number;
  scale: number;
}

export function accentSample(
  age: number,
  duration: number,
  frames?: number,
): AccentSample | null;

export interface WeaponAccentOptions {
  owns: boolean;
  texture: string;
  key: string;
  frames?: number;
  tint?: number;
}

export function drawWeaponAccent(
  scene: ImageVisualScene,
  effect: HitVisualEffect,
  point: ScreenPoint,
  px: number,
  objects: VisualObjectMap,
  live: Set<string>,
  options: WeaponAccentOptions,
): false;

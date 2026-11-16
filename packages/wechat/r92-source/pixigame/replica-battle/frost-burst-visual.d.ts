import type { Effect, Projectile } from './kernel/model';
import type { HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const FROST_BURST_TEXTURE: 'pathogenic-frost-burst';
export function markFrostBurstVisual(effect: Pick<Effect, 'modelId'>, projectile: Pick<Projectile, 'owner' | 'weaponId'> & Partial<Pick<Projectile, 'familyId'>>): void;
export function preloadFrostBurstVisual(scene: VisualLoaderScene): void;
export function frostBurstSample(effect: Pick<Effect, 'age' | 'duration' | 'originalScale'>): { alpha: number; diameter: number } | null;
export function drawFrostBurstVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): false;

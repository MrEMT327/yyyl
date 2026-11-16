import type { Effect, Projectile } from './kernel/model';
import type { nativeWeaponBody } from './weapon-visual-quality.js';
import type { BeamVisualScene, HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const SCORCH_LINE: 'pathogenic-scorch-line';
export const SCORCH_FIRE: 'pathogenic-scorch-fire';
export function isScorchVisual(projectile: Pick<Projectile, 'owner' | 'familyId' | 'modelId' | 'age' | 'warmup'>): boolean;
export function markScorchHitVisual<T extends Pick<Effect, 'modelId'>>(effect: T, projectile: Pick<Projectile, 'owner' | 'familyId'>): T;
export function preloadScorchWeaponVisual(scene: VisualLoaderScene): void;
export function drawTrialScorchWeaponVisual(scene: BeamVisualScene, projectile: Projectile, live: Set<string>, widthFactor?: number): boolean;
export function drawTrialScorchHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): boolean;
export const drawScorchWeaponVisual: typeof nativeWeaponBody;
export function drawScorchHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): false;

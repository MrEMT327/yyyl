import type { Effect, Projectile } from './kernel/model';
import type { nativeWeaponBody } from './weapon-visual-quality.js';
import type { BeamVisualScene, HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const LASER_TEXTURE: 'pathogenic-laser-line';
export const LASER_GLOW: 'pathogenic-laser-glow';
export function isLaserVisual(projectile: Pick<Projectile, 'owner' | 'familyId' | 'modelId' | 'beam' | 'age' | 'warmup'>): boolean;
export function markLaserHitVisual<T extends Pick<Effect, 'modelId'>>(effect: T, projectile: Pick<Projectile, 'owner' | 'familyId'>): T;
export function preloadLaserWeaponVisual(scene: VisualLoaderScene): void;
export function drawTrialLaserWeaponVisual(scene: BeamVisualScene, projectile: Projectile, live: Set<string>, widthFactor?: number): boolean;
export function drawTrialLaserHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): boolean;
export const drawLaserWeaponVisual: typeof nativeWeaponBody;
export function drawLaserHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): false;

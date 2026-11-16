import type { Effect, Projectile } from './kernel/model';
import type { nativeWeaponBody } from './weapon-visual-quality.js';
import type { BodyVisualScene, HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const MAGNETIC_TEXTURE: 'pathogenic-magnetic-lightning';
export const MAGNETIC_HIT_TEXTURE: 'pathogenic-magnetic-ring';
export function isMagneticVisual(projectile: Pick<Projectile, 'owner' | 'familyId' | 'modelId' | 'beam'>): boolean;
export function markMagneticHitVisual<T extends Pick<Effect, 'modelId'>>(effect: T, projectile: Pick<Projectile, 'owner' | 'familyId'>): T;
export function preloadMagneticWeaponVisual(scene: VisualLoaderScene): void;
export function drawTrialMagneticBodyVisual(scene: BodyVisualScene, projectile: Projectile, live: Set<string>): boolean;
export function drawTrialMagneticHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): boolean;
export const drawMagneticBodyVisual: typeof nativeWeaponBody;
export function drawMagneticHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): false;

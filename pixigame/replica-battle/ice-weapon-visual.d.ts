import type { Effect, Projectile } from './kernel/model';
import type { nativeWeaponBody } from './weapon-visual-quality.js';
import type { BodyVisualScene, HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const ICE_BODY_TEXTURE: 'pathogenic-ice-blade-trial';
export function isIceBodyVisual(projectile: Pick<Projectile, 'owner' | 'familyId' | 'modelId' | 'beam'>): boolean;
export function markIceHitVisual<T extends Pick<Effect, 'modelId'>>(effect: T, projectile: Pick<Projectile, 'owner' | 'familyId'>): T;
export function preloadIceWeaponVisual(scene: VisualLoaderScene): void;
export function drawTrialIceBodyVisual(scene: BodyVisualScene, projectile: Projectile, live: Set<string>): boolean;
export function drawTrialIceHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): boolean;
export const drawIceBodyVisual: typeof nativeWeaponBody;
export function drawIceHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): false;

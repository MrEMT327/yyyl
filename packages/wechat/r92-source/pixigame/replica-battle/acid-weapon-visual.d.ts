import type { Effect, Projectile } from './kernel/model';
import type { OriginalEffectSprite } from './kernel/original-effects';
import type { nativeWeaponBody } from './weapon-visual-quality.js';
import type { BodyVisualScene, HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const ACID_WEAPON_TRIAL_ENABLED: true;
export const ACID_BODY_TEXTURE: 'pathogenic-acid-body-trial';
export const ACID_HIT_TEXTURE: 'pathogenic-acid-hit-trial';
type AcidBody = Pick<Projectile, 'owner' | 'familyId' | 'modelId' | 'beam'>;
export function isAcidBodyVisual(projectile: AcidBody): boolean;
export function markAcidHitVisual<T extends Pick<Effect, 'modelId'>>(effect: T, projectile: Pick<Projectile, 'owner' | 'familyId'>): T;
export function acidHitProgress(effect: Pick<Effect, 'age' | 'duration'>): number | null;
export function preloadAcidWeaponVisual(scene: VisualLoaderScene): void;
export function drawTrialAcidBodyVisual(scene: BodyVisualScene, projectile: Projectile, live: Set<string>): boolean;
export function drawTrialAcidHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): boolean;
export const drawAcidBodyVisual: typeof nativeWeaponBody;
export function drawAcidHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): false;
export function isBasicAcidBody(projectile: AcidBody & Pick<Projectile, 'weaponId' | 'visualHidden' | 'scale'>): boolean;
export function replaceAcidBodySamples(sprites: OriginalEffectSprite[], age: number, enabled: boolean, available: boolean): OriginalEffectSprite[];

import type { Effect, Projectile } from './kernel/model';
import type { HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const SWORD_HIT_TEXTURE: 'pathogenic-sword-hit-glow';
export function markSwordHitVisual<T extends Pick<Effect, 'modelId'>>(effect: T, projectile: Pick<Projectile, 'owner' | 'familyId'>): T;
export function preloadSwordHitVisual(scene: VisualLoaderScene): void;
export function drawSwordHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): false;

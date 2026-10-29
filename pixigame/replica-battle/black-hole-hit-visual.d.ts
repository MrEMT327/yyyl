import type { Effect, Projectile } from './kernel/model';
import type { HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const BLACK_HOLE_HIT_TEXTURE: 'pathogenic-black-hole-hit-ring';
export function markBlackHoleHitVisual<T extends Pick<Effect, 'modelId'>>(effect: T, projectile: Pick<Projectile, 'owner' | 'familyId'>): T;
export function preloadBlackHoleHitVisual(scene: VisualLoaderScene): void;
export function drawBlackHoleHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): false;

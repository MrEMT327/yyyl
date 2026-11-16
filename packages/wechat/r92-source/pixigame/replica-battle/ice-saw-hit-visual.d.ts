import type { Effect, Projectile } from './kernel/model';
import type { HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const ICE_SAW_HIT_TEXTURE: 'pathogenic-ice-saw-hit-ring';
export function markIceSawHitVisual<T extends Pick<Effect, 'modelId'>>(effect: T, projectile: Pick<Projectile, 'owner' | 'familyId'>): T;
export function preloadIceSawHitVisual(scene: VisualLoaderScene): void;
export function drawIceSawHitVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): false;

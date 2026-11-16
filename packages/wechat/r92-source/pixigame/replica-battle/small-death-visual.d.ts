import type { Effect, Enemy } from './kernel/model';
import type {
  HitVisualEffect,
  ImageVisualScene,
  ScreenPoint,
  VisualLoaderScene,
  VisualObjectMap,
} from './weapon-visual-types';

export const SMALL_DEATH_TRIAL_ENABLED: true;
export const SMALL_DEATH_TEXTURE: 'pathogenic-small-death-trial';
export const SMALL_DEATH_FRAME_COUNT: 10;

export function isOrdinaryDeathVisual(effect: object): boolean;
export function markOrdinaryDeathVisual<T extends object>(
  effect: T,
  enemy: Pick<Enemy, 'boss' | 'elite'> & Partial<Pick<Enemy,'scale'|'radiusX'|'radiusZ'>>,
): T;
export function smallDeathFrame(effect: Pick<Effect, 'age' | 'duration'>): number | null;
export function preloadSmallDeathVisual(scene: VisualLoaderScene): void;
export function drawSmallDeathVisual(
  scene: ImageVisualScene,
  effect: HitVisualEffect,
  point: ScreenPoint,
  px: number,
  objects: VisualObjectMap,
  live: Set<string>,
): boolean;

/** Capture the model's bounds before applying the root enemy.scale. */
export function captureEnemyDeathBody(enemy:object,width:number,height:number,pixelsPerUnit:number):boolean;
export function enemyDeathVisualScale(effect:Pick<Effect,'size'>):number;

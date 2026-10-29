import type { Effect } from './kernel/model';
import type { HitVisualEffect, ImageVisualScene, ScreenPoint, VisualLoaderScene, VisualObjectMap } from './weapon-visual-types';

export const PLAYER_DEATH_TRIAL_ENABLED: true;
export const PLAYER_DEATH_TEXTURE: 'pathogenic-player-death-trial';
export function markPlayerDeathVisual(effect: object): void;
export function playerDeathFrame(effect: Pick<Effect, 'age' | 'duration'>): number | null;
export function preloadPlayerDeathVisual(scene: VisualLoaderScene): void;
export function drawPlayerDeathVisual(scene: ImageVisualScene, effect: HitVisualEffect, point: ScreenPoint, px: number, objects: VisualObjectMap, live: Set<string>): boolean;

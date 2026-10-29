import type {ScreenProjection} from '../combat-readability.mjs';

export interface EnemySpriteCore { world: number[]; source: number[] }
export const ENEMY_SPRITE_CORES: Readonly<Record<number, EnemySpriteCore | undefined>>;
export interface EnemySpriteInput {
  owner: string; beam?: boolean; modelId: number; x: number; z: number; scale: number;
}
export function enemySpriteFootprint(
  projectile: EnemySpriteInput, screen: ScreenProjection, rootTransform: number[]
): number[];

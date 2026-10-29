import type {ScreenProjection} from '../combat-readability.mjs';

export interface BossBallScaleInput { x: number; z: number; scale: number }
export function bossBallVisualScale(
  projectile: BossBallScaleInput, screen: ScreenProjection, sourcePixelScale: number
): number;

import type Phaser from 'phaser';
import type { Effect } from './kernel/model';

/** Screen-space positions used by the optional Phaser impact overlays. */
export interface ScreenPoint { x: number; y: number }
export type VisualObjectMap = Map<string, Phaser.GameObjects.Image>;
export type ImageVisualScene = Pick<Phaser.Scene, 'add' | 'textures'>;
export type VisualLoaderScene = Pick<Phaser.Scene, 'load'>;
export type HitVisualEffect = Pick<Effect, 'uid' | 'age' | 'duration' | 'size' | 'originalScale'>;

export interface BodyVisualScene extends ImageVisualScene {
  objects: VisualObjectMap;
  px: number;
  screen(x: number, z: number): ScreenPoint;
}

export interface BeamVisualScene extends BodyVisualScene {
  content: {
    assets: {
      beamEffects: {
        effects: Record<number, {
          usePrefabWidth?: boolean;
          lines?: Array<{
            parameters: {
              widthMultiplier: number | string;
              widthCurve?: { m_Curve?: Array<{ value: number | string }> };
            };
          }>;
        } | undefined>;
      };
    };
  };
}

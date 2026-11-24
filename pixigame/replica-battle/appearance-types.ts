import type { NativeMapLayer } from './kernel/native-map-layers';
import type { Point } from './kernel/model';
import type { WeaponAppearance } from './weapon-appearance';

export interface WeaponIcon { readonly key: string; readonly url: string }

export interface PlayerSkinPose {
  clock: number; x: number; y: number; width: number; height: number;
  scaleX: number; scaleY: number; shearX: number; alpha: number; visible: boolean;
}
export interface PlayerSkin {
  width: number; height: number;
  update(pose: PlayerSkinPose): void;
}
export interface BattleAppearance<Scene = unknown> {
  replaceTerrain?: boolean;
  combatBloomLevels?: number;
  setWeapons?(weapons: readonly WeaponAppearance[]): void;
  weaponIcon?(weapon: WeaponAppearance): WeaponIcon;
  playerSkin?: PlayerSkin;
  /** Project aircraft wing sockets in screen pixels; visual mounting only. */
  missileMounts?(): readonly {x:number;y:number}[];
  preload(scene: Scene): void;
  onResourceLoadError?(key: string): void;
  create(scene: Scene): void;
  update?(frame: {
    time: number; coastBackgroundTime?: number; clock: number; renderDelta?: number;
    /** Unsmoothed display interval in seconds, used only to schedule presentation work. */
    displayInterval?: number; camera: Readonly<Point>;
    phantomActive?: boolean; playerHitFlash?: boolean; runId?: number;
    victoryDeparture?: Readonly<{fromZ:number;targetZ:number;elapsed:number}>;
    /** Actual emitted skill identity, observed without modifying the volley. */
    aircraftPassiveShot?: Readonly<{uid:number;bornAt:number}>;
    /** Read-only visual events; local night light never feeds back into combat. */
    lightingEffects?: readonly {kind:string;age:number;duration:number;size:number;x:number;z:number}[];
    projectPoint?(x:number,z:number): {x:number;y:number};
    flight?: Readonly<{ x: number; z: number; speed: number; radius?: number; active: boolean }>;
    mapCameraOffset(layer: NativeMapLayer): Point;
  }): void;
}

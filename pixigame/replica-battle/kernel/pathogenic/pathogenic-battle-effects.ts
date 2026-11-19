import {CombatEffectDirector,type BattleEffectsHost} from './combat-effect-director';
import {PathogenicSceneView} from './pathogenic-scene-view';
import {IceWeaponTrails} from './ice-weapon-trails.mjs';
export type {BattleEffectsHost,BeamQuery,BeamResult,ScreenPoint} from './combat-effect-director';
export class PathogenicBattleEffects extends CombatEffectDirector {
  constructor(scene:any,graph:Record<string,any>,sourcePixelScale=.25,host:BattleEffectsHost={}) {
    super(scene,graph,sourcePixelScale,host,(scene:any,graph:any)=>new PathogenicSceneView(scene,graph),
      (scene:any,scale:number)=>new IceWeaponTrails(scene,scale));
  }
}

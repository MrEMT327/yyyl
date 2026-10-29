import {iaidoScreenMeshes} from './iaido-vfx.mjs';
// The pilot's dimensional sword formation shares the native line-cut shape,
// not the aircraft trigger, damage, timer or particle emitter.
export const isDimensionSword = b => b.owner === 'player' && b.weaponId === 360011 && b.modelId === 1000051;
export function dimensionSwordScreenMeshes(b,screen) {
  if(!isDimensionSword(b))return [];
  // Reuse only projected ribbon geometry. The temporary descriptor selects the
  // line shape; every physical value remains the original pilot projectile's.
  return iaidoScreenMeshes({...b,weaponId:400007},screen).map(mesh=>({...mesh,
    vertices:mesh.vertices.map(v=>({...v,color:[.28,.82,1,v.color[3]]}))}));
}

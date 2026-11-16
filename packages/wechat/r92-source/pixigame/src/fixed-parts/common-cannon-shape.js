import { commonWeaponPresentation } from '../three/common-weapon-presentation.js';

// cannon.glb, after the loader's X rotation: x ±1.72 (±1.9 with the
// driving band), y -10..5. The glow and exhaust are not solid shot volume.
// Keep model scale and collision together, including coverage and side barrels.
export function commonCannonShape({unit=1,rank=0,width=1,secondary=false,radius=0}={}) {
  const modelScale=unit*commonWeaponPresentation({mechanic:'cannon'}).model
    *(1+rank*.035)*width*(secondary?.7:1);
  const r=Math.max(radius,(rank>=1?1.9:1.72)*modelScale);
  return {modelScale,radius:r,front:Math.max(0,10*modelScale-r),back:Math.max(0,5*modelScale-r)};
}

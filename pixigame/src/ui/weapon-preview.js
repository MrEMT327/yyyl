import { ARSENAL } from '../fixed-parts/airframe-arsenal.js';

// A trajectory preview must not silently consume bullets on invisible targets.
// Chain lightning and orbiting turrets need targets even in their default demo.
export function weaponPreviewTargets(itemId,{impact=false,centerX=300,top=210,rowGap=225,radius=22}={}) {
  const a=ARSENAL[itemId];
  if(!impact&&!['chain','orbit'].includes(a.pattern)&&!['beam','freeze','lightning','drone'].includes(a.mechanic))return [];
  return Array.from({length:12},(_,i)=>({id:`preview-target-${i}`,x:centerX+(i%3-1)*190,y:top+Math.floor(i/3)*rowGap,radius}));
}

export function weaponPreviewTargetVisuals(targets) {
  // These share the energy renderer, so keep enough radiance and width to
  // remain legible after bloom downsampling on the narrow mobile preview.
  return targets.map(t=>({kind:'link',id:`marker/${t.id}`,color:0xd39f78,width:3,alpha:.65,
    points:Array.from({length:25},(_,i)=>({x:t.x+Math.cos(i/24*Math.PI*2)*t.radius,y:t.y+Math.sin(i/24*Math.PI*2)*t.radius}))}));
}

// Display-only measurements of the captured sprite's alpha>=128 core, divided
// by native PPU and multiplied by its prefab transform (assets[-chapters]).
// Shared migrated textures must not erase the different native model sizes.
const ROUND = [112 * 1.421049952507019, 124 * 1.428339958190918];
const SHARD = [93 * .4650000035762787, 129 * .4650000035762787];
export const ENEMY_SPRITE_CORES = Object.freeze({
  1100001: {world:[.56,.56], source:ROUND},
  1100002: {world:[1.52,1.52], source:ROUND},
  1100007: {world:[.98,1.96], source:SHARD},
  1100008: {world:[.30,.96], source:SHARD},
  1100016: {world:[.48,.48], source:ROUND},
  1100018: {world:[.34,.44], source:SHARD},
  1100023: {world:[1.24,1.25], source:ROUND},
});
export function enemySpriteFootprint(b, screen, rootTransform) {
  const profile = b.owner==='enemy'&&!b.beam&&ENEMY_SPRITE_CORES[b.modelId];
  if(!profile)return rootTransform;
  const origin=screen(b.x,b.z),unit=screen(b.x+1,b.z);
  const px=Math.hypot(unit.x-origin.x,unit.y-origin.y), out=[...rootTransform];
  for(const [axis,offset] of [[0,0],[1,2]]){
    const previous=Math.hypot(out[offset],out[offset+1]);
    if(!(previous>0))return rootTransform;
    const ratio=profile.world[axis]*b.scale*px/profile.source[axis]/previous;
    out[offset]*=ratio;out[offset+1]*=ratio;
  }
  return out;
}

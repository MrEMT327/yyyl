import regional from './stage1-anime-assets.json' with {type:'json'};
import reference from './stage1-anime-layout-reference.json' with {type:'json'};

// Regions combine roads, paving and facilities. Ocean remains independent.
const projectionScale=reference.projectionScale;
const regions=reference.regions.map(row=>row.asset);
export const MODULAR_TERRAIN_NAMES=Object.freeze([...regions]);
export const MODULAR_ASSETS=Object.freeze({
  ground:{width:regional.ocean.width,height:regional.ocean.height,url:'stage1-anime-v8/ocean.png'},
  ...Object.fromEntries(regions.map(key=>[key,{...regional[key],kind:'land',url:`stage1-anime-v8/${key}.png`}])),
  seabed:{...regional.seabed,kind:'submerged',url:'stage1-anime-v8/seabed.png'},
  buoy:{width:192,height:256,visibleFraction:107/192,kind:'water',url:'stage1-maritime-v1/buoy.png'},
  cutter:{...regional.cutter,kind:'water',url:'stage1-anime-v8/cutter.png'},
});
const part=(asset,x,z,width)=>Object.freeze({asset,x,z,width:width*projectionScale});
// Match visible alpha>=128 footprints, not transparent canvas widths. Apply
// one projection conversion to X, Z and movement; keep the new art's aspect.
export const MODULAR_ISLANDS=Object.freeze(reference.regions.map(row=>Object.freeze({
  id:row.asset,asset:row.asset,reference:row.source,
  x:row.x*projectionScale,z:(row.z-reference.phase)*projectionScale,
  width:row.width*projectionScale/regional[row.asset].visibleFraction,
  sites:Object.freeze([]),parts:Object.freeze([part('seabed',0,0,row.width*1.12)]),
})));
// Berths use the road-connected piers painted into the regional artwork.
export const MODULAR_WATER_PROPS=Object.freeze([
  {asset:'cutter',host:'harbor-east',x:-.29,z:.205,width:.50,rotation:0},
  {asset:'buoy',host:'harbor-east',x:-.38,z:.12,width:.42},
  {asset:'buoy',host:'harbor-east',x:-.34,z:.28,width:.42},
  {asset:'cutter',host:'harbor-west',x:.30,z:.18,width:.50,rotation:0},
  {asset:'buoy',host:'harbor-west',x:.38,z:.01,width:.42},
].map(row=>Object.freeze({...row,width:row.width*projectionScale/MODULAR_ASSETS[row.asset].visibleFraction})));
// Quiet underwater terrain in the longer open-water intervals. It shares the
// exact ground displacement; this is not a separately drifting ocean layer.
export const MODULAR_SEABED_FIELDS=Object.freeze([
  {x:-1.5,z:0,width:16},{x:1.8,z:65,width:18},{x:-2.2,z:-38,width:15},
].map(row=>Object.freeze({...row,x:row.x*projectionScale,z:(row.z-reference.phase)*projectionScale,width:row.width*projectionScale})));
// Eight water tiles per ground period also close the shader's half-scale
// mirrored sample. This prevents a phase jump under islands at every wrap.
export const MODULAR_TERRAIN_SETTINGS=Object.freeze({
  loopUnits:reference.loopUnits*projectionScale,
  waterTileUnits:reference.loopUnits*projectionScale/8,
  motionScale:projectionScale,nativeSpeed:1.6,scrollScale:.4,
});

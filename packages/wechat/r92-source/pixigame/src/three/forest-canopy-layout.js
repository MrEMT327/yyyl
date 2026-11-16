// Continuous woodland, with small clearings placed across the whole view.
// Each later forest visit swaps two landmarks; it never rebuilds two banks.
const base=import.meta.env?.BASE_URL||'/';
export const FOREST_MODULE_URLS=Object.freeze({
  ground:`${base}art/forest-canopy-v1/canopy-ground.png`,
  a:`${base}art/forest-canopy-v1/crown-grove.png`,
  b:`${base}art/campaign-modules-v1/forest-ruins.png`,
  landmark:`${base}art/campaign-modules-v1/forest-relay.png`,
  'clearing-b':`${base}art/forest-clearings-v1/ruins-clearing.png`,
  'clearing-landmark':`${base}art/forest-clearings-v1/relay-clearing.png`,
});
export const FOREST_LOOP_UNITS=324;
export const FOREST_TILE_UNITS=36;
const crowns=[
  ['near-grove',-8,-5,16],['east-crowns',10,19,17],['center-crowns',2,64,13],
  ['west-canopy',-12,87,16],['east-thicket',12,109,15],['deep-crowns',-3,151,18],
  ['north-grove',9,178,16],['west-branches',-10,202,14],['central-grove',0,241,17],
  ['east-leaves',12,263,15],['west-leaves',-12,292,17],['tail-grove',5,318,16],
].map(([id,x,z,width])=>Object.freeze({id,asset:'a',x,z,width,kind:'canopy',order:.5}));
const landmarks=[
  {id:'old-arch',asset:'b',x:-4.8,z:45,width:15},
  {id:'relay-glade',asset:'landmark',x:7.5,z:125,width:16},
  {id:'feature-1',asset:'b',x:4,z:213,width:15},
  {id:'feature-2',asset:'landmark',x:-7,z:288,width:14},
].map(row=>Object.freeze({...row,kind:'landmark',order:1.5,clearingAsset:`clearing-${row.asset}`}));
const placements=Object.freeze([...crowns,...landmarks]);
export function forestPlacements(variant=0){
  const visit=Math.max(0,Math.trunc(Number(variant)||0));
  if(visit%2===0)return placements;
  return Object.freeze(placements.map(row=>row.id==='feature-1'||row.id==='feature-2'?
    Object.freeze({...row,asset:row.asset==='b'?'landmark':'b',clearingAsset:row.asset==='b'?'clearing-landmark':'clearing-b'}):row));
}

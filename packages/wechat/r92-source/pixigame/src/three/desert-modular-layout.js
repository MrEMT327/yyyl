// Natural desert pieces share one ground clock; variation is authored, never RNG.
const base=import.meta.env?.BASE_URL||'/';
const art=(name,ext='png')=>`${base}art/desert-modules-v1/${name}.${ext}`;
export const DESERT_MODULE_URLS=Object.freeze({
  ground:art('ground-sand'),crescent:art('dune-crescent'),dunes:art('dune-ridge'),
  ridge:art('rock-ridge'),boulders:art('boulders'),oasis:art('oasis'),palms:art('palms'),
  pyramid:art('pyramid'),sandstoneGate:art('sandstone-gate','webp'),
  solarOutpost:art('solar-outpost','webp'),windCarvedSpires:art('wind-carved-spires','webp'),
});
export const DESERT_LOOP_UNITS=324;

export const DESERT_EXTRA_LANDMARKS=Object.freeze({
  assets:Object.freeze(['sandstoneGate','solarOutpost','windCarvedSpires']),
  slots:Object.freeze([
    {id:'desert-landmark-1',x:7,z:83,width:17},
    {id:'desert-landmark-2',x:-7,z:175,width:18},
    {id:'desert-landmark-3',x:-7.5,z:280,width:18},
  ].map(row=>Object.freeze({...row,kind:'rotating-landmark',order:2.2}))),
});

// Unequal spacing, sizes and overlap break up the banks without forming slots.
const dunes=[
  ['west-entry','crescent',-13,-5,34],['east-entry','dunes',13,18,34],
  ['center-wave','dunes',14,42,30],['west-flow','crescent',-15,69,33],
  ['east-lee','dunes',13,91,29],['west-oasis','crescent',-12,117,32],
  ['east-shelter','crescent',15,144,35],['center-saddle','dunes',3,163,28],
  ['west-flare','dunes',-14,190,34],['east-ripple','crescent',12,213,32],
  ['west-knot','dunes',-11,244,35],['east-gate','crescent',14,270,32],
  ['center-low','crescent',-3,291,30],['west-tail','dunes',-13,316,32],
].map(([id,asset,x,z,width])=>Object.freeze({id,asset,x,z,width,kind:'terrain',order:.4,feather:.05,featherAxis:'both'}));
const details=[
  {id:'buried-pyramid',asset:'pyramid',x:-3.5,z:44,width:18,kind:'landmark',order:1.5},
  {id:'eastern-pyramid',asset:'pyramid',x:10.5,z:230,width:12,kind:'landmark',order:1.5},
  {id:'east-strata',asset:'ridge',x:15,z:30,width:21,kind:'rock',order:1.2},
  {id:'west-piles',asset:'boulders',x:-10,z:70,width:12,kind:'rock',order:1.2},
  {id:'center-stones',asset:'boulders',x:-2,z:102,width:7,kind:'rock',order:1.2},
  {id:'shallow-oasis',asset:'oasis',x:7.8,z:126,width:21,kind:'oasis',order:1},
  {id:'west-scarp',asset:'ridge',x:-15,z:152,width:23,kind:'rock',order:1.2},
  {id:'palm-recess',asset:'palms',x:-9,z:177,width:12,kind:'vegetation',order:2},
  {id:'east-crown',asset:'ridge',x:13,z:199,width:19,kind:'rock',order:1.2},
  {id:'feature-1',asset:'ridge',x:-10,z:244,width:20,kind:'rock',order:1.2},
  {id:'palm-spur',asset:'palms',x:11,z:255,width:8,kind:'vegetation',order:2},
  {id:'east-scatter',asset:'boulders',x:9,z:286,width:10,kind:'rock',order:1.2},
  {id:'feature-2',asset:'palms',x:15,z:314,width:13,kind:'vegetation',order:2},
].map(row=>Object.freeze({...row,feather:.05,featherAxis:'both'}));
const placements=Object.freeze([...dunes,...details]);
export function desertPlacements(variant=0){
  const visit=Math.max(0,Math.trunc(Number(variant)||0));
  const alternate=visit%2!==0;
  const terrain=alternate?placements.map(row=>row.id==='feature-1'||row.id==='feature-2'?
    Object.freeze({...row,asset:'boulders'}):row):placements;
  return Object.freeze([...terrain,Object.freeze({...DESERT_EXTRA_LANDMARKS.slots[0],
    asset:alternate?'solarOutpost':'sandstoneGate'})]);
}

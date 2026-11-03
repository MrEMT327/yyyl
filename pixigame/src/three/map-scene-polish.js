// Owned scene composition only. Simulation, camera coefficients and map speeds
// stay in their source-derived modules.
export const COAST_ISLAND_LAYOUT=Object.freeze([
  [2,.65,.38,.52], [0,0,0,0], [0,.62,.65,.52],
  [1,.55,.42,.52], [0,0,0,0], [2,.76,.63,.52],
  [0,0,0,0], [0,.78,.36,.52], [2,.58,.66,.52],
  [0,0,0,0], [1,.54,.59,.52], [0,0,0,0],
].map(row=>Object.freeze(row)));
export const COAST_ISLAND_Y_OFFSETS=Object.freeze([.10,0,-.12,.14,0,-.09,0,.08,-.14,0,.12,0]);

const NEUTRAL=Object.freeze({color:Object.freeze([1,1,0,0]),opacity:1});
const distant={
  coast:[.93,.91,.02,.035],ruins:[.86,.86,.035,.05],
  volcano:[.89,.88,.012,.05],sewer:[.83,.80,.05,.06],
  space:[.81,.76,.04,.07],'frozen-rift':[.79,.84,.03,.11],
  'storm-front':[.86,.80,.03,.05],'iron-dock':[.87,.84,.025,.04],
  'red-nest':[.86,.82,.04,.06],'emerald-rainforest':[.88,.82,.04,.05],
  'neon-city':[.86,.78,.04,.055],'sky-core':[.88,.85,.03,.05],
  'orbital-wreckage':[.81,.75,.045,.07],'lunar-outpost':[.88,.78,.035,.04],
  'ring-spaceport':[.87,.82,.03,.04],'obsidian-wastes':[.90,.72,.02,.025],
  'terraced-highlands':[.87,.82,.03,.055],'lunar-ring-station':[.87,.82,.03,.055],
  'lunar-crater-field':[.84,.62,.04,.05],'lunar-research-camp':[.89,.80,.04,.045],
};
const fog={coast:.62,'coast-defense':.68,ruins:.58,volcano:.48,sewer:.44,space:.22,
  'frozen-rift':.42,'storm-front':.80,'iron-dock':.48,'red-nest':.44,
  'emerald-rainforest':.48,'neon-city':.36,'sky-core':.30,
  'orbital-wreckage':.26,'ring-spaceport':.28,'obsidian-wastes':.40,
  'terraced-highlands':.46,'lunar-outpost':.24,'lunar-ring-station':.22,
  'lunar-crater-field':.18,'lunar-research-camp':.22};
// Quarter-step vertical scales share an eight-strip mirrored wrap.
// Independent atmosphere silhouettes. Stretch only non-directional vapor,
// keeping the existing protected center and current number of render layers.
const atmosphere={coast:[1,1],ruins:[1.18,1.5],volcano:[1.1,.5],sewer:[1.3,1.75],
  space:[.92,.5],'frozen-rift':[1.18,1.5],'storm-front':[.86,.75],
  'iron-dock':[1.25,1.5],'red-nest':[1.05,1.25],'emerald-rainforest':[1.1,1.25],
  'neon-city':[1.25,1.5],'sky-core':[.95,.75],'orbital-wreckage':[.9,.75],
  'ring-spaceport':[1.05,.75],'obsidian-wastes':[1.2,1.5],'terraced-highlands':[1.1,1.25],
  'lunar-outpost':[1.25,1.75],'lunar-ring-station':[1.3,1.5],
  'lunar-crater-field':[1.35,2],'lunar-research-camp':[1.25,1.75]};
const bridgePatterns={ruins:[1,1,0,1],volcano:[1,0,1,1],sewer:[1,1,1,0],
  'frozen-rift':[1,0,1,0],'iron-dock':[1,0,1,1],'red-nest':[1,1,0,1],
  'emerald-rainforest':[1,0,1,1],'neon-city':[1,1,1,0],'sky-core':[1,1,0,0],
  'lunar-outpost':[1,1,0,1],'ring-spaceport':[1,0,1,1],'obsidian-wastes':[1,1,0,1],
  'terraced-highlands':[1,1,1,0],'lunar-ring-station':[1,0,1,1],
  'lunar-research-camp':[1,1,0,1]};
for(const value of Object.values(bridgePatterns))Object.freeze(value);
const detachedScale=Object.freeze({space:.88,'storm-front':.90,'orbital-wreckage':.84});
const layouts=new Map(),profiles=new Map(),clouds=new Map();
export function mapSceneLayout(theme){
  if(!layouts.has(theme))layouts.set(theme,Object.freeze({bridgeCadence:bridgePatterns[theme],detailScale:detachedScale[theme]??1}));
  return layouts.get(theme);
}
export function mapAtmosphereShape(sceneId){
  if(!clouds.has(sceneId))clouds.set(sceneId,Object.freeze(sceneId.endsWith('-balanced')?[...(atmosphere[sceneId.slice(0,-9)]||[1,1])]:[1,1]));
  return clouds.get(sceneId);
}
export function mapLayerGrade(sceneId,role){
  if(!sceneId.endsWith('-balanced'))return NEUTRAL;
  const key=sceneId+'/'+role;
  if(profiles.has(key))return profiles.get(key);
  const theme=sceneId.slice(0,-9);
  let color=role==='midground'?(distant[theme]||[.89,.88,.025,.045])
    :role==='background'?[1,.90,.012,0]:[1,1,0,0];
  if(role==='background'&&theme==='neon-city')color=[.96,.68,.055,.035];
  if(role==='foreground'&&['emerald-rainforest','red-nest','terraced-highlands'].includes(theme))color=[1,.91,0,.015];
  const opacity=role==='cloud'?(fog[theme]??.5):role==='effects'?.65:1;
  const result=Object.freeze({color:Object.freeze([...color]),opacity});
  profiles.set(key,result);return result;
}

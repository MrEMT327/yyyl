// Local presentation choices for our existing artwork. Native map motion,
// encounters, collision and the composited gameplay layer remain unchanged.
// Each row is [source island band, uniform scale, target X, source X].
// The three RGBA cutouts occupy equal-height bands; empty cells stay empty.
export const COAST_ISLAND_LAYOUT=Object.freeze([
  [2,.80,.38,.38], [0,0,0,0], [0,.76,.65,.43],
  [1,.67,.42,.66], [0,0,0,0], [2,.91,.63,.38],
  [0,0,0,0], [0,.94,.36,.43], [2,.70,.66,.38],
  [0,0,0,0], [1,.64,.59,.66], [0,0,0,0],
].map(row=>Object.freeze(row)));

const NEUTRAL=Object.freeze({color:Object.freeze([1,1,0,0]),opacity:1});
// [brightness, saturation, distant haze, center quieting]. No blur, tone-map
// change or resolution reduction; silhouettes retain their authored pixels.
const distant={
  coast:[.90,.90,.025,.04], ruins:[.86,.86,.035,.05],
  volcano:[.87,.89,.025,.04], sewer:[.86,.85,.035,.04],
  space:[.78,.78,.035,.065], 'frozen-rift':[.83,.88,.025,.085],
  'storm-front':[.88,.84,.035,.04], 'orbital-wreckage':[.82,.80,.035,.06],
};
const fog={coast:.68,ruins:.58,volcano:.52,sewer:.46,space:.24,
  'frozen-rift':.46,'storm-front':.84,'iron-dock':.50,'red-nest':.46,
  'emerald-rainforest':.52,'neon-city':.40,'sky-core':.32,
  'orbital-wreckage':.28,'ring-spaceport':.30,'obsidian-wastes':.44,
  'terraced-highlands':.48,'lunar-outpost':.28,'lunar-ring-station':.24,
  'lunar-crater-field':.24,'lunar-research-camp':.24};
const profiles=new Map();
export function mapLayerGrade(sceneId,role){
  // Named legacy previews keep their approved presentation. The campaign's
  // balanced scenes get a small, explicit grade by depth and theme.
  if(!sceneId.endsWith('-balanced'))return NEUTRAL;
  const key=sceneId+'/'+role;
  if(profiles.has(key))return profiles.get(key);
  const theme=sceneId.slice(0,-9);
  const color=role==='midground'?(distant[theme]||[.89,.88,.025,.045])
    :role==='background'?[1,.90,.012,0]:[1,1,0,0];
  const opacity=role==='cloud'?(fog[theme]??.5):role==='effects'?.72:1;
  const result=Object.freeze({color:Object.freeze([...color]),opacity});
  profiles.set(key,result);return result;
}

// Presentation-only assignments; chapter IDs remain save/balance keys.
export const ENEMY_FAMILIES = {
  naval:['naval-swallow','naval-gunboat','naval-escort','naval-carrier'],
  city:['city-patrol','city-blade','city-warden','city-suppressor'],
  industrial:['industrial-drill','industrial-boiler','industrial-pincer','industrial-foundry'],
  water:['water-ray','water-turbine','water-clearer','water-pump'],
  alien:['alien-saucer','alien-triangle','alien-trilobe','alien-mothership'],
  forest:['forest-leaf','forest-stinger','forest-mantis','forest-falcon'],
  polar:['polar-owl','polar-spike','polar-warden','polar-fortress'],
  ruin:['ruin-wing','ruin-ring','ruin-obelisk','ruin-sentinel'],
  bone:['bone-scout','bone-dart','bone-guard','bone-boss'],
  bio:['bio-moth','bio-sac','bio-hunter','bio-mother'],
  crystal:['crystal-dart','crystal-petal','crystal-guard','crystal-crown'],
};
// Primary family owns elites/Boss. Optional guest family supplies heavy/relay units.
export const CHAPTER_LINEUPS = {
  coast:['naval'],city:['city'],forge:['industrial'],sewer:['water'],space:['alien'],
  'frozen-rift':['polar'],'storm-front':['alien'],'iron-dock':['naval','industrial'],
  'red-nest':['bio'],'sky-core':['alien'],'sand-ruins':['ruin'],
  'emerald-rainforest':['forest','bio'],'neon-city':['city'],'white-salt-lake':['naval'],
  'obsidian-wastes':['industrial','crystal'],'sunken-city':['water','ruin'],
  'amethyst-mines':['crystal'],'floating-isles':['alien','forest'],'copper-mesa':['industrial'],
  'polar-night-base':['polar','city'],'autumn-fjord':['naval','forest'],
  'giantwood-marsh':['forest','bio'],'chalk-spires':['ruin'],'offshore-oilfield':['industrial','naval'],
  'orbital-wreckage':['alien'],'coral-lagoon':['naval','water'],'terraced-highlands':['forest'],
  'rail-graveyard':['industrial','city'],'azure-geothermal':['water','crystal'],'lunar-outpost':['alien'],
  'windmill-plains':['forest','city'],'redwood-gorge':['forest'],'frozen-lake-city':['polar','ruin'],
  'coastal-airfield':['naval','city'],'ring-spaceport':['alien','city'],'sunset-saltworks':['naval'],
  'bamboo-valley':['forest'],'abandoned-dam':['water','industrial'],'polar-shipyard':['polar','naval'],
  'mars-base':['alien','industrial'],'amber-dunes':['bio'],'waterfall-peaks':['forest'],
  'abandoned-refinery':['forest','city'],'frozen-canal':['bone'],'deep-space-array':['city'],
  'giant-lotus-pond':['water','bio'],'wind-carved-yardang':['ruin','bone'],
  'abandoned-raceway':['city'],'glassflower-meadow':['crystal'],'ancient-stone-circle':['ruin','crystal'],
};
export function libraryFamilies(chapterId){return CHAPTER_LINEUPS[chapterId]||CHAPTER_LINEUPS.coast;}
const bossNames={naval:'潮汐航空母舰',city:'都市镇压者',industrial:'移动铸造炉',water:'深渠移动泵站',alien:'天幕母舰',forest:'苍翼猎隼',polar:'冰原堡垒',ruin:'古阵守护者',bone:'骨甲巨兽',bio:'膜翼母体',crystal:'晶冠巨像'};
export function libraryBossName(chapterId){return bossNames[libraryFamilies(chapterId)[0]];}
export function libraryEnemyId(chapterId,kind,elite=false,boss=false){
  const families=libraryFamilies(chapterId);
  const family=ENEMY_FAMILIES[!elite&&!boss&&families[1]&&['heavy','relay'].includes(kind)?families[1]:families[0]];
  return family[boss?3:elite?2:['dart','turret','relay'].includes(kind)?1:0];
}

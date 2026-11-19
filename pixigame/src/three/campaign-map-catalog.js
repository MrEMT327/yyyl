import chapterCatalog from '../replica/chapter-correspondence.json' with {type:'json'};

const base = import.meta.env?.BASE_URL || '/';
const art = path => `${base}art/${path}.png`;
const freeze = Object.freeze;

// These are the map images used by both the chapter list and the battle renderer.
export const CAMPAIGN_MAP_ART = freeze({
  coast: freeze({artUrl:art('stage1-anime-v8/ocean'),previewUrl:art('stage1-anime-v8/airfield-west')}),
  desert: freeze({artUrl:art('desert-modules-v1/ground-sand'),previewUrl:art('desert-modules-v1/oasis')}),
  volcano: freeze({artUrl:art('stage3-modular-v2/basalt-ground'),previewUrl:art('stage3-modular-v2/geothermal-station-v2')}),
  space: freeze({artUrl:art('space-modular-api-v2/base-a-deep-space'),previewUrl:art('space-modular-api-v2/relay-outpost')}),
  ice: freeze({artUrl:art('icefield-modular-api-v3/base-a-blue-ice'),previewUrl:art('icefield-modular-api-v3/igloo-camp')}),
  forest: freeze({artUrl:art('forest-canopy-v1/canopy-ground'),previewUrl:art('campaign-modules-v1/forest-ruins')}),
});

// The first nine chapters keep their approved compositions and names.
const OPENING_MAPS=freeze([
  ['coast','蔚蓝海岸'],
  ['desert','流金沙海'],
  ['volcano','熔火禁区'],
  ['desert','风蚀岩谷'],
  ['space','星际深空'],
  ['ice','冰原裂隙'],
  ['forest','林海高地'],
  ['coast','海岸船坞'],
  ['forest','翡翠藤谷'],
].map(freeze));

// Each later chapter has a fixed map template and its own display name.
// Template chapters 1, 2, 3, 5, 6 and 9 supply the six approved maps.
const LATER_CHAPTERS=freeze([
  [1, '澄湾群岛'], // 10
  [2, '赤沙古陵'], // 11
  [3, '玄岩熔谷'], // 12
  [5, '星环哨站'], // 13
  [6, '霜脊营地'], // 14
  [9, '苍藤遗迹'], // 15
  [1, '晨潮浅湾'], // 16
  [5, '紫雾星带'], // 17
  [9, '碧冠林境'], // 18
  [2, '琥珀沙丘'], // 19
  [3, '玄武台地'], // 20
  [5, '远轨中继站'], // 21
  [6, '银穹冰盖'], // 22
  [1, '鸣礁海峡'], // 23
  [9, '苔石古门'], // 24
  [2, '碑影绿洲'], // 25
  [6, '白原雪垒'], // 26
  [3, '硫烟山口'], // 27
  [5, '星尘航道'], // 28
  [2, '长风砂脊'], // 29
  [1, '双港水道'], // 30
  [3, '灼岩断层'], // 31
  [9, '静林高台'], // 32
  [6, '风雪隘口'], // 33
  [2, '金丘荒漠'], // 34
  [5, '碎星回廊'], // 35
  [6, '雪穹边界'], // 36
  [3, '熔河矿场'], // 37
  [2, '砂塔之境'], // 38
  [9, '翠幕深林'], // 39
  [1, '青岬海湾'], // 40
  [5, '群星锚地'], // 41
  [2, '金碑沙原'], // 42
  [9, '幽藤石庭'], // 43
  [3, '余烬岩台'], // 44
  [6, '凛风雪原'], // 45
  [1, '南礁列岛'], // 46
  [3, '灰烬断崖'], // 47
  [5, '行星外环'], // 48
  [1, '潮线空港'], // 49
  [6, '蓝冰断层'], // 50
  [2, '砂砾旷原'], // 51
  [9, '苍叶丘陵'], // 52
  [1, '远岬海防'], // 53
  [6, '寒域观测站'], // 54
  [3, '地热前哨'], // 55
  [5, '星云渡口'], // 56
  [9, '古林回廊'], // 57
  [1, '薄雾岬湾'], // 58
  [2, '沉沙边境'], // 59
  [3, '赤焰天堑'], // 60
].map(freeze));

export function campaignMapSourceIndex(index){
  if(index<OPENING_MAPS.length)return index;
  const mapChapter=LATER_CHAPTERS[index-OPENING_MAPS.length]?.[0]??1;
  return mapChapter-1;
}

export function campaignChapterNameForStage(index){
  return LATER_CHAPTERS[index-OPENING_MAPS.length]?.[1];
}

export const CHAPTER_MAP_INDICES=freeze(chapterCatalog.chapters.map(({stageIndex})=>campaignMapSourceIndex(stageIndex)));
export const CAMPAIGN_CHAPTER_THEMES=freeze(CHAPTER_MAP_INDICES.map(index=>OPENING_MAPS[index][0]));

const sceneVersions = {volcano:2, space:2, ice:3};
export const CAMPAIGN_OPENING_MAPS = freeze(OPENING_MAPS.map(([theme,name],index) => {
  const {artUrl,previewUrl} = CAMPAIGN_MAP_ART[theme];
  if(index===0) {
    return freeze({id:'coast-defense-balanced',name,theme,artUrl,
      depthUrl:art('project-coast-balanced-v1/far-water-soft')});
  }
  const id = `campaign-${theme}-${index+1}-modules-v${sceneVersions[theme] ?? 1}`;
  return freeze({id,name,theme,artUrl,previewUrl});
}));

export function campaignMapForStage(stage) {
  const value = Number(stage);
  const index = Number.isFinite(value) ? Math.max(0,Math.floor(value)) : 0;
  return CAMPAIGN_OPENING_MAPS[CHAPTER_MAP_INDICES[index] ?? campaignMapSourceIndex(index)];
}

import {CAMPAIGN_OPENING_MAPS,CHAPTER_MAP_INDICES,CAMPAIGN_MAP_ART} from './campaign-map-catalog.js';
import {STAGE3_MODULE_URLS,STAGE3_PLACEMENTS,STAGE3_LOOP_UNITS,STAGE3_ROCK_GRADES} from './stage3-modular-layout.js';
import {DESERT_MODULE_URLS,DESERT_LOOP_UNITS,DESERT_EXTRA_LANDMARKS,desertPlacements} from './desert-modular-layout.js';
import {COAST_CLOUD_MOTION} from './coast-cloud-motion.js';
import {FOREST_MODULE_URLS,FOREST_LOOP_UNITS,FOREST_TILE_UNITS,forestPlacements} from './forest-canopy-layout.js';
import {ICEFIELD_MODULE_URLS,ICEFIELD_LOOP_UNITS,ICEFIELD_EXTRA_LANDMARKS,icefieldPlacements} from './icefield-modular-layout.js';
import {SPACE_MODULE_URLS,SPACE_LOOP_UNITS,SPACE_BACKGROUND_TRAVEL,spacePlacements} from './space-modular-layout.js';
import {MODULAR_TERRAIN_SETTINGS} from './stage1-modular-layout.js';

export {campaignMapSourceIndex,campaignChapterNameForStage,CAMPAIGN_CHAPTER_THEMES} from './campaign-map-catalog.js';

const base=import.meta.env?.BASE_URL||'/';
const asset=name=>`${base}art/campaign-modules-v1/${name}.png`;
const connector=name=>`${base}art/campaign-connectors-v1/${name}.png`;
const existing=name=>`${base}art/${name}.png`;
const freeze=Object.freeze;

// One reusable library per theme. Geometry and gameplay are deliberately not
// described here; these are presentation-only scenery assets and placements.
export const CAMPAIGN_THEME_LIBRARY=freeze({
  coast:freeze({name:'海岸',water:true,ground:CAMPAIGN_MAP_ART.coast.artUrl,color:0x164e87,
    connectors:freeze({connector:connector('coast-isthmus')}),
    pieces:freeze({a:existing('stage1-anime-v8/headland-east'),b:existing('stage1-anime-v8/harbor-east'),
      landmark:CAMPAIGN_MAP_ART.coast.previewUrl,alternate:existing('stage1-anime-v8/harbor-west')}),
    clouds:[0x91b9d7,.55,0xdce9f1,.4]}),
  desert:freeze({name:'沙漠',water:false,ground:DESERT_MODULE_URLS.ground,color:0xc7ae87,
    connectors:freeze({}),preview:DESERT_MODULE_URLS.oasis,pieces:DESERT_MODULE_URLS,
    clouds:'chapter-one'}),
  volcano:freeze({name:'火山',water:false,ground:asset('volcano-ground'),color:0x4c4b60,
    connectors:freeze({connector:connector('volcano-ridge')}),
    pieces:freeze({a:asset('volcano-mesa'),b:asset('volcano-crater'),landmark:asset('volcano-station')}),
    clouds:[0x8c8296,.3,0xb2a6ad,.18]}),
  space:freeze({name:'星空',water:false,weather:false,ground:SPACE_MODULE_URLS.ground,color:0x0b152c,
    connectors:freeze({}),preview:SPACE_MODULE_URLS.relayOutpost,
    pieces:freeze(Object.fromEntries(Object.entries(SPACE_MODULE_URLS).filter(([key])=>key!=='ground'))),clouds:null}),
  ice:freeze({name:'冰原',water:false,ground:ICEFIELD_MODULE_URLS.ground,color:0x46778d,
    connectors:freeze({}),preview:ICEFIELD_MODULE_URLS.iglooCamp,
    pieces:freeze(Object.fromEntries(Object.entries(ICEFIELD_MODULE_URLS).filter(([key])=>key!=='ground'))),
    clouds:'chapter-one',precipitation:'snow'}),
  forest:freeze({name:'森林',water:false,ground:FOREST_MODULE_URLS.ground,color:0x315d3c,
    connectors:freeze({}),preview:FOREST_MODULE_URLS.b,
    pieces:freeze(Object.fromEntries(Object.entries(FOREST_MODULE_URLS).filter(([key])=>key!=='ground'))),
    clouds:[0x9db8ae,.38,0xc8dccb,.22]}),
});

// Reusable slots. A later visit keeps ordinary placements identical and
// replaces two feature slots. No random calls: pause/re-entry cannot reshuffle
// scenery, and simulation randomness is never consumed by map decoration.
const LAYOUTS=freeze({
  coast:{rows:6,x:12.8,width:26},
  volcano:{rows:7,x:11.7,width:25},space:{rows:5,x:10.7,width:22},
  ice:{rows:7,x:11.5,width:25},forest:{rows:8,x:11.7,width:25},
});

export function themePlacements(theme,variant=0){
  const library=CAMPAIGN_THEME_LIBRARY[theme];
  if(!library)throw new Error(`未知场景主题：${theme}`);
  if(theme==='desert')return desertPlacements(variant);
  if(theme==='ice')return icefieldPlacements(variant);
  if(theme==='space')return spacePlacements(variant);
  if(theme==='forest')return forestPlacements(variant);
  const layout=LAYOUTS[theme],slots=[];
  for(let row=0;row<layout.rows;row++)for(const side of[-1,1]){
    const feature=row===2&&side===1?'feature-1':row===layout.rows-2&&side===-1?'feature-2':null;
    const id=feature??`bank-${row}-${side}`,x=side*layout.x;
    const z=row*216/layout.rows+(side===1?8:0)-8;
    let key=(row+(side===1?1:0))%3===1?'b':'a';
    if(id==='feature-1')key=variant%2?'b':'landmark';
    if(id==='feature-2')key=variant%2?'landmark':(library.pieces.alternate?'alternate':'b');
    slots.push(freeze({id,asset:key,x,z,width:layout.width}));
  }
  return freeze(slots);
}

// Joining strips have open ends and overlap the neighboring landmarks. Their
// endpoint IDs are retained so editor/validation tooling can verify each join.
export function themeConnections(theme,placements){
  if(theme==='desert'||theme==='ice'||theme==='space'||theme==='forest')return freeze([]);
  const layout=LAYOUTS[theme],step=216/layout.rows,links=[];
  for(const side of[-1,1]){
    const bank=placements.filter(p=>Math.sign(p.x)===side).sort((a,b)=>a.z-b.z);
    for(let i=0;i<bank.length;i++){
      const from=bank[i],to=bank[(i+1)%bank.length];
      const gantry=theme==='space'&&from.asset==='landmark';
      links.push(freeze({id:`join-${side}-${i}`,kind:'connection',from:from.id,to:to.id,
        asset:gantry?'gantry':'connector',x:from.x,z:from.z+step/2,
        width:gantry?15:layout.width*.96,height:step-6,
        feather:gantry?0:.12,order:gantry?2:1.5}));
    }
  }
  return freeze(links);
}

export function sampleThemeModuleMotion(definition,elapsed,cameraX,unitsPerWorld){
  return {moduleTravel:Math.max(0,Number(elapsed)||0)*definition.nativeSpeed*unitsPerWorld,
    moduleUnitsPerWorld:unitsPerWorld,lateralOffset:-cameraX*unitsPerWorld*.3};
}

export function createCampaignThemeScenes(firstScene,firstCloudLayers){
  const scenes=[],layerPacks={},visits={};
  for(const [index,{id,theme,name,artUrl,previewUrl}] of CAMPAIGN_OPENING_MAPS.entries()){
    const library=CAMPAIGN_THEME_LIBRARY[theme];
    const variant=visits[theme]??0;visits[theme]=variant+1;
    if(index===0){scenes.push(firstScene);continue;}
    const thirdStage=index===2,icefield=theme==='ice',space=theme==='space';
    const scene=freeze({id,name,theme,variant,
      textureId:thirdStage?id:icefield?'campaign-ice-modules-v3':space?'campaign-space-modules-v2':`campaign-${theme}-modules-v1`,smoothBackground:true,
      artUrl,previewUrl,ground:library.color,edge:library.color,accent:0x8faeb6,mist:0xa5bbc4,
      ...(library.weather===false?{weather:false}:{}),...(library.precipitation?{precipitation:library.precipitation}:{})});
    const urls={...library.pieces,...library.connectors,...(thirdStage?STAGE3_MODULE_URLS:{}),...(space?{}:{cloudBank:existing('stage1-anime-v8/cloud-bank'),
      cloudLargeA:existing('stage1-anime-v8/cloud-large-a'),cloudLargeB:existing('stage1-anime-v8/cloud-large-b')})};
    const placements=thirdStage?STAGE3_PLACEMENTS:themePlacements(theme,variant);
    const moduleKeys=thirdStage?['ground',...new Set(placements.map(row=>row.asset))]:['ground',...Object.keys(library.pieces),...Object.keys(library.connectors)];
    const rotatingLandmarks=icefield?ICEFIELD_EXTRA_LANDMARKS:theme==='desert'?DESERT_EXTRA_LANDMARKS:undefined;
    const terrain=freeze({id:`${id}-terrain`,sceneId:id,name:`${library.name} · 模块地形`,role:'terrain',
      source:'ground',depth:-1000,rotatingLandmarks,modules:freeze(moduleKeys.map(key=>freeze([key]))),
      themeModules:true,authoredMotion:true,motionGroup:'terrain',waterSurface:library.water,
      nativeSpeed:MODULAR_TERRAIN_SETTINGS.nativeSpeed*MODULAR_TERRAIN_SETTINGS.motionScale,
      loopUnits:thirdStage?STAGE3_LOOP_UNITS:theme==='desert'?DESERT_LOOP_UNITS:icefield?ICEFIELD_LOOP_UNITS:space?SPACE_LOOP_UNITS:theme==='forest'?FOREST_LOOP_UNITS:216,tileUnits:theme==='forest'?FOREST_TILE_UNITS:54,...(theme==='forest'?{forestCanopy:true}:{}),...(space?{backgroundTravelScale:SPACE_BACKGROUND_TRAVEL}:{}),roadMarkings:false,placements:thirdStage?placements:freeze([...placements,...themeConnections(theme,placements)]),spriteTint:theme==='desert'||theme==='forest'||icefield||space?0xffffff:0xcad5df,...(thirdStage?{materialGrades:STAGE3_ROCK_GRADES}:{})});
    const layers=[terrain];
    if(library.clouds){
      const chapterOneClouds=library.clouds==='chapter-one';
      const cloudLayers=chapterOneClouds?firstCloudLayers:[firstCloudLayers[0],firstCloudLayers[2]];
      for(const [i,original] of cloudLayers.entries()){
        layers.push(freeze({...original,id:`${id}-cloud-${i}`,sceneId:id,nativeLayer:undefined,
          cloudMotion:original.nativeLayer===5?COAST_CLOUD_MOTION.near:COAST_CLOUD_MOTION.far,
          // Chapter one's complete far / white middle / near stack keeps its
          // original tint, opacity, softness and placement on the desert.
          ...(chapterOneClouds?{}:{tint:library.clouds[i*2],opacity:original.opacity*library.clouds[i*2+1]})}));
      }
    }
    scenes.push(scene);layerPacks[id]=freeze({layers:freeze(layers),urls:freeze(urls)});
  }
  return freeze({scenes:freeze(CHAPTER_MAP_INDICES.map(index=>scenes[index])),layerPacks:freeze(layerPacks)});
}

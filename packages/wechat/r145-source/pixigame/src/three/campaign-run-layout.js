import {MODULAR_ISLANDS,MODULAR_TERRAIN_SETTINGS} from './stage1-modular-layout.js';

// A presentation-only random stream. It never reads or advances combat RNG.
const wrap=(n,period)=>((n%period)+period)%period;
const FIXED_SPACE_SCENERY=new Set(['distant-nebula','distant-planet','orbital-facility']);
let serial=0;
export function createScenerySeed(){
  const value=new Uint32Array(1);
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(value);
  else value[0]=(Date.now()^Math.trunc((globalThis.performance?.now?.()??0)*1000))>>>0;
  return (value[0]+Math.imul(++serial,0x9e3779b9))>>>0;
}
function stream(seed){
  let state=seed>>>0;
  return ()=>{state=(state+0x6d2b79f5)>>>0;let n=state;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}
function sceneSeed(seed,id){
  let value=seed>>>0;
  for(const c of id)value=Math.imul(value^c.charCodeAt(0),16777619)>>>0;
  return value;
}
function shuffled(values,random){
  const result=[...values];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
function family(theme,row){
  if(theme==='space'&&FIXED_SPACE_SCENERY.has(row.kind))return null;
  if(row.kind==='connection'||row.kind==='base-region'||row.kind==='background-region')return null;
  if(theme==='coast'||theme==='volcano')return 'bank';
  if(row.clearingAsset)return 'forest-landmark';
  if(theme==='desert'||row.kind==='rotating-landmark')return row.kind;
  if(theme==='forest')return row.kind;
  if(row.id.startsWith('feature-'))return 'facility';
  return row.kind==='distant-asteroid'?'distant':'natural';
}

/** Later occurrences of a theme reuse its own assets, with a stable layout for
 * one run. Connected banks move as units; independent scenery stays in safe
 * authored slots, and forest buildings keep their matching clearings. */
export function campaignRunDefinition(scene,definition,seed,revision=0){
  if(seed===undefined||seed===null||!(scene.variant>0)||!definition.themeModules)return definition;
  return rearrangeModules(scene,definition,Number(seed)+Math.imul(revision,0x9e3779b9));
}

function rearrangeModules(scene,definition,seed){
  const mixed=sceneSeed(seed>>>0,scene.id),random=stream(mixed);
  const period=definition.loopUnits,phase=(.12+random()*.76)*period;
  const banked=scene.theme==='coast'||scene.theme==='volcano';
  const shifts={[-1]:(random()-.5)*1.5,[1]:(random()-.5)*1.5};
  const scales={[-1]:.97+random()*.06,[1]:.97+random()*.06};
  const groups=new Map();
  for(const row of definition.placements){
    const group=family(scene.theme,row);if(!group)continue;
    if(!groups.has(group))groups.set(group,[]);groups.get(group).push(row.asset);
  }
  for(const [key,values]of groups)groups.set(key,shuffled(values,random));
  const placements=definition.placements.map(row=>{
    // Keep parallax landmarks in their authored lanes and out of the asteroid shuffle.
    if(scene.theme==='space'&&FIXED_SPACE_SCENERY.has(row.kind))return row;
    const group=family(scene.theme,row),asset=group?groups.get(group).pop():row.asset;
    if(banked){
      const side=Math.sign(row.x)||1;
      return Object.freeze({...row,asset,x:row.x+shifts[side],z:wrap(row.z+phase,period),width:row.width*scales[side]});
    }
    if(!group)return Object.freeze({...row,z:wrap(row.z+phase,period)});
    const rotating=group==='rotating-landmark';
    const major=rotating||group==='facility'||group==='forest-landmark'||row.kind==='landmark'||row.kind==='oasis';
    const limit=scene.theme==='forest'&&major?7.8:major?10.5:16;
    const sign=major&&random()<.5?-1:1;
    const x=Math.max(-limit,Math.min(limit,row.x*sign+(random()-.5)*(major?4:2)));
    const z=wrap(row.z+phase+(random()-.5)*(major&&!rotating?16:6),period);
    const width=row.width*(.95+random()*.10);
    return Object.freeze({...row,asset,x,z,width,...(row.clearingAsset?{clearingAsset:'clearing-'+asset}:{})});
  });
  return Object.freeze({...definition,placements:Object.freeze(placements),layoutSeed:mixed});
}

function rearrangeCoastIslands(random){
  const period=MODULAR_TERRAIN_SETTINGS.loopUnits,phase=random()*period;
  return Object.freeze([-1,1].flatMap(side=>{
    // Keep the pier, props and seabed attached to their authored island.
    const islands=MODULAR_ISLANDS.filter(row=>Math.sign(row.x)===side).sort((a,b)=>a.z-b.z);
    const slots=shuffled(islands.map(row=>row.z),random);
    return islands.map((row,index)=>Object.freeze({
      ...row,z:wrap(slots[index]+phase,period),
    }));
  }));
}

function rearrangeVolcano(placements,period,random){
  // Breaks between the river and its banks, the outpost ridge, and the
  // ridge that crosses the original map wrap. Linked terrain travels together.
  const origin=54;
  const starts=[0,111,202];
  const order=shuffled([0,1,2],random);
  const destinations=[];
  let cursor=random()*period;
  for(const section of order){
    destinations[section]=cursor;
    cursor+=(starts[section+1]??period)-starts[section];
  }
  return placements.map(row=>{
    const z=wrap(row.z-origin,period);
    const section=z>=starts[2]?2:z>=starts[1]?1:0;
    return Object.freeze({...row,z:wrap(destinations[section]+z-starts[section],period)});
  });
}

function rearrangeSpace(placements,random,swapFacilities){
  const side=random()<.5?-1:1;
  const facilityOffset=random()*18-9,farOffset=random()*10-5;
  return placements.map(row=>{
    if(row.kind==='orbital-facility'){
      const asset=swapFacilities?(row.asset==='orbitalDock'?'relayOutpost':'orbitalDock'):row.asset;
      return Object.freeze({...row,asset,x:row.x*side,z:row.z+facilityOffset});
    }
    if(row.kind==='distant-nebula'||row.kind==='distant-planet'){
      return Object.freeze({...row,x:row.x*side,z:row.z+farOffset});
    }
    return row;
  });
}

function pickRunLandmarks(definition,random){
  const {assets,slots}=definition.rotatingLandmarks;
  const choices=shuffled(assets,random).slice(0,2);
  const anchors=shuffled(slots,random).slice(0,choices.length);
  const placements=definition.placements.filter(row=>row.kind!=='rotating-landmark');
  placements.push(...anchors.map((slot,index)=>({...slot,asset:choices[index]})));
  return {...definition,placements};
}

// Share texture packs across runs while deriving scenery from the sortie seed.
export function reusedCampaignRunDefinition(scene,definition,stage,seed,revision){
  if(!definition.rigidTerrain&&!definition.themeModules)return definition;
  const chapterSeed=(seed+Math.imul(stage+1,0x9e3779b9))>>>0;
  const runSeed=(chapterSeed+Math.imul(revision,0x85ebca6b))>>>0;
  const random=stream(sceneSeed(runSeed,scene.id));
  if(definition.rigidTerrain)return Object.freeze({...definition,islands:rearrangeCoastIslands(random)});
  if(scene.theme==='volcano'){
    return Object.freeze({...definition,placements:Object.freeze(rearrangeVolcano(definition.placements,definition.loopUnits,random))});
  }
  const layout=definition.rotatingLandmarks?pickRunLandmarks(definition,random):definition;
  const seeded=rearrangeModules(scene,layout,runSeed);
  if(scene.theme!=='space')return seeded;
  // Alternate the two station types on retries, independently of their side.
  const swapFacilities=(chapterSeed+revision)%2!==0;
  return Object.freeze({...seeded,placements:Object.freeze(rearrangeSpace(seeded.placements,random,swapFacilities))});
}

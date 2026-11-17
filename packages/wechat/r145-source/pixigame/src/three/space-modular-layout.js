import {CAMPAIGN_MAP_ART} from './campaign-map-catalog.js';

const base=import.meta.env?.BASE_URL||'/';
const art=name=>`${base}art/space-modular-api-v2/${name}.png`;
const freeze=Object.freeze;

export const SPACE_MODULE_URLS=freeze({
  ground:CAMPAIGN_MAP_ART.space.artUrl,blueBase:art('base-b-blue-stars'),violetBase:art('base-c-violet-stars'),
  nebula:`${base}art/space-modular-api-v2/nebula-filament.webp`,
  planet:`${base}art/space-modular-api-v2/ringed-planet.webp`,
  shard:art('asteroid-shard'),cluster:art('asteroid-cluster'),relayOutpost:CAMPAIGN_MAP_ART.space.previewUrl,orbitalDock:art('orbital-dock'),
});
export const SPACE_LOOP_UNITS=216;
export const SPACE_BACKGROUND_TRAVEL=.16;
const placements=freeze([
  {id:'blue-star-section',asset:'blueBase',kind:'background-region',x:0,z:80,width:90,height:135,feather:.18,featherAxis:'both',order:.4,travelScale:SPACE_BACKGROUND_TRAVEL},
  {id:'violet-star-section',asset:'violetBase',kind:'background-region',x:0,z:164,width:90,height:135,feather:.18,featherAxis:'both',order:.5,travelScale:SPACE_BACKGROUND_TRAVEL},
  // Deep-space silhouettes drift independently of the nearby rocks and structures.
  {id:'nebula-west',asset:'nebula',kind:'distant-nebula',x:-6.7,z:9,width:30,order:.58,travelScale:.19,opacity:.52,feather:.18,featherAxis:'both'},
  {id:'nebula-east',asset:'nebula',kind:'distant-nebula',x:6,z:45,width:33,angle:.38,order:.58,travelScale:.19,opacity:.52,feather:.18,featherAxis:'both'},
  {id:'ringed-planet',asset:'planet',kind:'distant-planet',x:10.1,z:15.5,width:17.5,order:.65,travelScale:.085,opacity:.88},
  {id:'distant-shard',asset:'shard',kind:'distant-asteroid',x:-8.5,z:15,width:7,order:.75,travelScale:.55},
  {id:'distant-cluster',asset:'cluster',kind:'distant-asteroid',x:11,z:112,width:9,order:.75,travelScale:.55},
  {id:'cluster-west',asset:'cluster',x:-13,z:-8,width:21},
  {id:'shard-east',asset:'shard',x:13,z:30,width:16},
  {id:'feature-1',asset:'orbitalDock',kind:'orbital-facility',x:-6.9,z:65,width:13.2,order:.9,travelScale:.9},
  {id:'cluster-east',asset:'cluster',x:14,z:107,width:21},
  {id:'shard-west',asset:'shard',x:-12,z:138,width:17},
  {id:'feature-2',asset:'relayOutpost',kind:'orbital-facility',x:7.7,z:170,width:14.5,order:.9,travelScale:.9},
  {id:'inner-shard',asset:'shard',x:0,z:204,width:7},
].map(freeze));

// Later visits change sides for distant scenery and swap the orbital facilities.
// The sprites keep their original lighting direction.
export function spacePlacements(variant=0){
  if(variant%2===0)return placements;
  return freeze(placements.map(row=>{
    if(row.kind==='distant-planet'||row.kind==='distant-nebula')return freeze({...row,x:-row.x});
    if(row.kind==='orbital-facility')return freeze({...row,x:-row.x,asset:row.asset==='orbitalDock'?'relayOutpost':'orbitalDock'});
    return row;
  }));
}

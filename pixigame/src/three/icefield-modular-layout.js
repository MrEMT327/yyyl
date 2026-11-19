import {CAMPAIGN_MAP_ART} from './campaign-map-catalog.js';

const base=import.meta.env?.BASE_URL||'/';
const art=(name,ext='png')=>`${base}art/icefield-modular-api-v3/${name}.${ext}`;
const freeze=Object.freeze;

// Three quiet painted bases precede independent, grounded scenery regions.
// Snow coverage uses the existing feathered ground overlays and terrain clock.
export const ICEFIELD_MODULE_URLS=freeze({
  ground:CAMPAIGN_MAP_ART.ice.artUrl,snowBase:art('base-b-thin-snow'),transitionBase:art('base-c-snow-transition'),
  snowShelf:art('snow-shelf'),iceRidge:art('ice-ridge'),iglooCamp:CAMPAIGN_MAP_ART.ice.previewUrl,researchCamp:art('research-camp'),
  glacierArch:art('glacier-arch','webp'),icebreakerWreck:art('icebreaker-wreck','webp'),frozenBasin:art('frozen-basin','webp'),
});
export const ICEFIELD_LOOP_UNITS=216;

export const ICEFIELD_EXTRA_LANDMARKS=freeze({
  assets:freeze(['glacierArch','icebreakerWreck','frozenBasin']),
  slots:freeze([
    {id:'ice-landmark-1',x:-7.3,z:14,width:17},
    {id:'ice-landmark-2',x:7.5,z:110,width:18},
    {id:'ice-landmark-3',x:-7,z:202,width:16},
  ].map(row=>freeze({...row,kind:'rotating-landmark',order:1.6}))),
});
const placements=freeze([
  {id:'thin-snow-section',asset:'snowBase',kind:'base-region',x:0,z:80,width:90,height:135,feather:.18,featherAxis:'both',order:.05},
  {id:'transition-section',asset:'transitionBase',kind:'base-region',x:0,z:164,width:90,height:135,feather:.18,featherAxis:'both',order:.06},
  {id:'shelf-west',asset:'snowShelf',x:-12,z:-8,width:24},
  {id:'ridge-east',asset:'iceRidge',x:12,z:26,width:19},
  {id:'feature-1',asset:'iglooCamp',x:-5.5,z:60,width:16},
  {id:'shelf-east',asset:'snowShelf',x:13,z:98,width:26},
  {id:'ridge-west',asset:'iceRidge',x:-13,z:129,width:18},
  {id:'feature-2',asset:'researchCamp',x:4.8,z:165,width:16},
  {id:'inner-snow',asset:'snowShelf',x:-1,z:199,width:11},
  {...ICEFIELD_EXTRA_LANDMARKS.slots[0],asset:'glacierArch'},
  {...ICEFIELD_EXTRA_LANDMARKS.slots[1],asset:'icebreakerWreck'},
].map(freeze));

export function icefieldPlacements(variant=0){
  return freeze(placements.map(row=>{
    if(!variant||variant%2===0||!row.id.startsWith('feature-'))return row;
    return freeze({...row,x:-row.x,asset:row.id==='feature-1'?'researchCamp':'iglooCamp'});
  }));
}

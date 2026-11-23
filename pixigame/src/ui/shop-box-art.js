import {nativeItemPresentation} from '../replica/native-item-presentation.js';
import {nativeGearPresentation} from '../replica/native-item-names.js';

export const boxChestArt=box=>`${import.meta.env?.BASE_URL||'/'}art/${box.id===3?'project-equipment-boxes-v1/advanced.png':'shop-comic-v1/weapon-crate-v2.webp'}`;
export const percent=(weight,denominator=100000)=>`${Number((weight/denominator*100).toFixed(3))}%`;
export const boxRewardGroups=box=>(box?.rates||[]).filter(group=>group.weight>0).map(group=>({...group,items:group.items.filter(item=>item.weight>0).map(item=>({...item,...nativeItemPresentation(item.id)}))}));
// Showcase real obtainable equipment, with three different silhouettes/parts.
export function boxShowcaseItems(box) {
 const items=boxRewardGroups(box).flatMap(group=>group.items).map(item=>({...item,gear:nativeGearPresentation(item.id)})).filter(item=>item.gear&&item.image);
 const advanced=box?.id===3,parts=advanced?['fire-control','cockpit','fuselage']:['engine-armor','cockpit','fuselage'];
 return parts.map((part,index)=>items.filter(item=>item.gear.partId===part).sort((a,b)=>{
  const aRank=advanced&&index===1?a.gear.rank:0,bRank=advanced&&index===1?b.gear.rank:0;
  return bRank-aRank||b.qualityRank-a.qualityRank||a.id-b.id;
 })[0]).filter(Boolean);
}
// Positions are percentages of the chest's particle layer; size and drift use
// the shop's design units so the effect follows the artwork on narrow screens.
export const advancedParticles=[
 ['glint',14,51,40,-10,18,5.7,-1.7],
 ['glint',69,20,34,12,16,6.4,-4.2],
 ['glint',89,78,37,10,21,6.8,-2.3],
 ['mote',9,74,22,-12,50,4.9,-2.5],
 ['mote',24,83,18,-20,35,5.4,-.8],
 ['mote',28,26,20,-15,37,5.2,-3.2],
 ['mote',48,19,15,11,40,5.7,-.9],
 ['mote',81,87,24,13,46,5.1,-1.7],
 ['mote',93,55,19,16,54,5.8,-3.8],
 ['fleck',16,86,10,-17,65,5.9,-2.2],
 ['fleck',38,85,8,-13,44,5.3,-4.1],
 ['fleck',57,13,9,9,45,6.1,-3.6],
 ['fleck',85,33,11,14,52,5.6,-1.1],
 ['fleck',92,93,10,17,63,6.2,-4.3],
];

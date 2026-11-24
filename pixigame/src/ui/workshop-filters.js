import { WEAPON_QUALITIES } from '../fixed-parts/common-weapons.js';

export const WORKSHOP_FILTERS=['all','ready','equipped',...WEAPON_QUALITIES.map((_,i)=>`q${i}`)];
const filterLabel=(value,leveling)=>value==='all'?'全部':value==='ready'?(leveling?'可强化':'可升星'):value==='equipped'?'已装备':WEAPON_QUALITIES[Number(value.slice(1))]||'全部';

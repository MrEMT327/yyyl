import {NATIVE_PILOT_SKINS} from './replica/native-pilot-roster.js';

// Built-in frames are cosmetic only. Pilot portraits follow permanent activation,
// independently of the currently deployed pilot and temporary preview access.
export const PLAYER_FRAMES=Object.freeze([
  {id:'blue',name:'航翼徽章'}, {id:'gray',name:'银隼机翼'},
  {id:'green',name:'雷达航标'}, {id:'purple',name:'星轨观测'},
  {id:'gold',name:'星冠勋章'}, {id:'red',name:'赤曜突击'},
  {id:'ice',name:'极光航线'}, {id:'navy',name:'深空领航'},
].map(Object.freeze));
const pilotIds=new Set(Object.values(NATIVE_PILOT_SKINS));
const frameIds=new Set(PLAYER_FRAMES.map(row=>row.id));
export function normalizePlayerAppearance(raw){
  return {avatar:raw?.avatar==='auto'||pilotIds.has(raw?.avatar)?raw.avatar:'auto',
    frame:frameIds.has(raw?.frame)?raw.frame:'blue',
    revision:Number.isSafeInteger(raw?.revision)&&raw.revision>=0?raw.revision:0};
}
export function playerAppearanceSnapshot(raw,{roster=[],basePilotId='pilot-01',pilotId=basePilotId,nativeCollection=null,ownedPilots=[]}={}){
  const state=normalizePlayerAppearance(raw);
  const activated=new Set(nativeCollection
    ? nativeCollection.pilots.filter(row=>row.owned).map(row=>NATIVE_PILOT_SKINS[row.id]).filter(Boolean)
    : ownedPilots);
  activated.add(basePilotId);
  const avatars=[{id:'auto',name:'随出战驾驶员',available:true},...roster.filter(row=>pilotIds.has(row.id)).map(row=>({id:row.id,name:row.name,available:activated.has(row.id)}))];
  const avatar=avatars.some(row=>row.id===state.avatar&&row.available)?state.avatar:'auto';
  return {...state,avatar,currentPilotId:avatar==='auto'?pilotId:avatar,avatars,frames:PLAYER_FRAMES};
}
export function planPlayerAppearance(raw,access,{kind,id,expectedRevision}={}){
  const state=normalizePlayerAppearance(raw);
  if(expectedRevision!==state.revision)throw Error('外观已变化，请重新选择');
  if(kind!=='avatar'&&kind!=='frame')throw Error('未知外观类型');
  const item=(kind==='avatar'?access.avatars:access.frames).find(row=>row.id===id);
  if(!item)throw Error('未知外观');
  if(kind==='avatar'&&!item.available)throw Error('激活对应驾驶员后解锁该头像');
  if(state[kind]===id)return {state,changed:false};
  return {state:{...state,[kind]:id,revision:state.revision+1},changed:true};
}

import {NATIVE_AIRCRAFT_SKINS} from './native-aircraft-skins.js';
import {NATIVE_PILOT_SKINS} from './native-pilot-roster.js';

const baseKinds={
  skins:{appearances:NATIVE_AIRCRAFT_SKINS,identity:'baseAircraftId'},
  pilots:{appearances:NATIVE_PILOT_SKINS,identity:'basePilotId'},
};

// Native selection owns battle progression. Legacy IDs supply only the base
// appearance when id=0 is selected; an appearance never grants activation.
export function nativeCollectionIdentity(collection,base={}){
  const baseAircraftId=base.aircraftId||'pilot-01',basePilotId=base.pilotId||'pilot-01';
  return {baseAircraftId,basePilotId,
    aircraftId:NATIVE_AIRCRAFT_SKINS[collection.skinId]||baseAircraftId,
    pilotId:NATIVE_PILOT_SKINS[collection.pilots.find(row=>row.equipped)?.id]||basePilotId};
}

// Shared by catalog cards, detail actions and profile presentation. Availability
// includes the base appearance; owned remains native activation for growth.
export function nativeCollectionAccess(group,snapshot,row){
  if(row.baseOnly)return {isBase:true,basicOnly:true,available:true,using:Boolean(row.equipped),selectionId:0};
  const base=baseKinds[group],appearance=base&&(snapshot[base.identity]||'pilot-01');
  const isBase=Boolean(base&&base.appearances[row.id]===appearance);
  const baseSelected=group==='skins'?snapshot.replicaCollection.skinId===0
    :group==='pilots'&&!snapshot.replicaCollection.pilots.some(pilot=>pilot.equipped);
  return {isBase,basicOnly:isBase&&!row.owned,available:Boolean(row.owned||isBase),
    using:Boolean(row.equipped||(isBase&&!row.owned&&baseSelected)),
    selectionId:isBase&&!row.owned?0:Number(row.id)};
}

// Old accounts can retain a base aircraft absent from the native unlock list.
// This display row represents id=0 only; it is never written into progression.
export function nativeCollectionRows(group,snapshot){
  const rows=snapshot.replicaCollection[group]||[];
  if(group!=='skins')return rows;
  const appearance=snapshot.baseAircraftId||'pilot-01';
  if(rows.some(row=>NATIVE_AIRCRAFT_SKINS[row.id]===appearance))return rows;
  const aircraft=snapshot.aircraft?.find(row=>row.id===appearance);
  if(!aircraft)return rows;
  const stage={star:0,skills:[],attributes:[],cost:[]};
  return [{id:0,name:aircraft.aircraftName||aircraft.aircraft||aircraft.name||'初始飞机',
    baseOnly:true,baseAppearanceId:appearance,owned:false,equipped:snapshot.replicaCollection.skinId===0,
    star:0,defaultStar:0,quality:40,qualityName:'基础',stages:[stage],stage,
    maxed:true,costs:[],canPurchase:false},...rows];
}

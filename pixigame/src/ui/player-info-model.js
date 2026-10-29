import {GEAR_PARTS} from '../peripheral/equipment-system.js';
import { NATIVE_AIRCRAFT_SKINS } from '../replica/native-aircraft-skins.js';
import { NATIVE_PILOT_SKINS } from '../replica/native-pilot-roster.js';
import {DEFAULT_PLAYER_NAME} from '../player-identity.js';
const itemId=value=>typeof value==='object'?value?.itemId||value?.id:value;

// Only equipped slots and completed campaign results are profile evidence.
// Inventory ownership, selected stages and temporary unlocks are not progress.
export function playerInfoModel(snapshot={},callsign='') {
  const aircraft=snapshot.aircraft?.find(item=>item.id===snapshot.aircraftId);
  const pilot=snapshot.pilots?.find(item=>item.id===snapshot.pilotId);
  const weapon=id=>snapshot.weapons?.find(item=>item.id===itemId(id));
  const main=weapon(snapshot.innateWeapon||aircraft?.weaponId||snapshot.loadout?.W1);
  const cleared=(snapshot.stages||[]).filter(stage=>stage.bestCleared===true);
  const latest=cleared.reduce((last,stage)=>!last||stage.index>last.index?stage:last,null);
  const model = {
    name:String(callsign||snapshot.playerName||DEFAULT_PLAYER_NAME),aircraft,pilot,main,
    power:snapshot.power,attack:snapshot.combatStats?.attack,hp:snapshot.combatStats?.maxHp,
    cleared:cleared.length,progress:latest?`第 ${latest.index+1} 章`:'尚未通关',
    gear:Array.from({length:5},(_,index)=>{
      const type=index+1;
      return {type,label:snapshot.equipment?.blueprints?.find(part=>part.type===type)?.name||GEAR_PARTS[index].name,
        item:snapshot.equipment?.items?.find(item=>item.uid===snapshot.equipment?.slots?.[type])};
    }),
    weapons:['W3','W4','W5','W6'].map(slot=>({slot,item:weapon(snapshot.loadout?.[slot])})),
    aircraftOwned:(snapshot.aircraft||[]).filter(item=>item.owned&&!item.temporaryUnlocked),
    pilotsOwned:(snapshot.pilots||[]).filter(item=>item.owned&&!item.temporaryUnlocked),
    skills:kind=>{const bank=snapshot.fleet?.[kind];return (bank?.slots||[]).map(id=>bank.skills?.find(skill=>skill.id===id)).filter(Boolean);},
  };
  if(!snapshot.replicaCollection)return model;
  const collection=snapshot.replicaCollection,plain=value=>String(value||'').replace(/<[^>]*>/g,'');
  const skills=row=>(row?.stage?.skills||[]).map(skill=>({...skill,name:plain(skill.name),description:plain(skill.description)}));
  const skin=row=>({...snapshot.aircraft?.find(item=>item.id===NATIVE_AIRCRAFT_SKINS[row.id]),
    id:NATIVE_AIRCRAFT_SKINS[row.id],nativeId:row.id,stars:row.star,owned:row.owned,temporaryUnlocked:false,
    name:row.name,aircraftName:row.name,level:undefined});
  const pilotRow=row=>{
    const list=skills(row);
    return {...snapshot.pilots?.find(item=>item.id===NATIVE_PILOT_SKINS[row.id]),
      id:NATIVE_PILOT_SKINS[row.id],nativeId:row.id,stars:row.star,owned:row.owned,temporaryUnlocked:false,
      name:row.name,skillName:list.map(skill=>skill.name).join('、'),passiveDescription:list.map(skill=>skill.description).join('；'),
      passive:{name:list.map(skill=>skill.name).join('、'),description:list.map(skill=>skill.description).join('；')}};
  };
  const gun=row=>({...row,id:row.appearance||String(row.id),nativeRow:row,stars:row.star});
  const currentSkin=collection.skins.find(row=>row.id===collection.skinId&&row.owned);
  const currentPilot=collection.pilots.find(row=>row.equipped);
  const currentGun=collection.guns.find(row=>row.equipped);
  return {...model,native:true,
    aircraft:currentSkin?skin(currentSkin):{...aircraft,name:'基础战机',aircraftName:'基础战机',stars:0,level:undefined},
    pilot:currentPilot?pilotRow(currentPilot):null,
    main:currentGun?gun(currentGun):null,
    // Cloud slots remain visible; native secondary weapons are chosen in battle.
    weapons:['W3','W4','W5','W6'].map(slot=>({slot,item:null})),
    aircraftOwned:collection.skins.filter(row=>row.owned).map(skin),
    pilotsOwned:collection.pilots.filter(row=>row.owned).map(pilotRow),
    skills:kind=>kind==='pilot'?skills(currentPilot):collection.slots.flatMap(id=>skills(collection.skins.find(row=>row.id===id&&row.owned))),
  };
}


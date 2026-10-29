import { calculateStudyLoadout } from '../../replica-battle/kernel/loadout-state';
import { validateReplicaConfiguration, replicaConfigurationKey } from './loadout-contract.js';
import { initializeReplicaLoadoutCapabilities } from './native-runtime-capabilities.js';
import { withNativeResearchRuntime } from './native-research-runtime.js';
import { nativeSkillText } from './native-skill-text.js';
let request;
let cachedKey, cachedResult, pendingKey, pendingResult;
async function catalog() {
  return request ||= Promise.all(['loadout-catalog','loadout-runtime','player-appearances'].map(async name=>{
    const response=await fetch(new URL(`${import.meta.env.BASE_URL}replica-battle/data/${name}.json`,document.baseURI),{cache:'no-store'});
    if(!response.ok)throw new Error('原版属性资料读取失败');
    return response.json();
  })).then(([data,runtime,appearances])=>({...data,runtime:withNativeResearchRuntime(runtime),appearances})).catch(error=>{request=null;throw error;});
}
/** Read-only adapter. Uses the same calculator/state as battle preparation. */
async function calculateDetails(value) {
  const configuration=validateReplicaConfiguration(value),data=await catalog();
  const state=configuration.progression;state.equipment=configuration.equipment.map(row=>({...row}));
  initializeReplicaLoadoutCapabilities();
  const result=calculateStudyLoadout(data,state);
  const names=Object.fromEntries(Object.entries(data.attributeNames).map(([key,row])=>[key,row.name||key]));
  const skills=result.initialSkillIds.map(id=>{
    const row=data.allSkills.find(row=>row.id===id);
    return nativeSkillText({id,name:row?.name,description:row?.description,supported:result.battleSkillIds.includes(id)});
  });
  return {configurationKey:replicaConfigurationKey(configuration),attack:result.attack,hp:result.hp,
    // CommonUtils.GetBattlePower 0x6fa6c5c: Attack + HPMax * FP(0x4000),
    // then FloorToLong. FP has 16 fractional bits: 0x4000 is exactly 1/4.
    // Inputs remain the replica calculator's values, identical to battle entry.
    power:Math.floor(result.attack + result.hp / 4),
    attributes:result.attributes,economyAttributes:result.economyAttributes,contributions:result.contributions,names,skills,
    unsupported:result.unsupportedEffects.filter(row=>!['战机外观','人物外观'].includes(row.source))};
}

/** Bound cache to one configuration. No rendered textures or game instance. */
export async function replicaLoadoutDetails(value) {
  const configuration=validateReplicaConfiguration(value),key=replicaConfigurationKey(configuration);
  if(cachedKey===key)return structuredClone(cachedResult);
  if(pendingKey!==key) {
    pendingKey=key;
    pendingResult=calculateDetails(configuration).then(result=>{
      if(pendingKey===key){cachedKey=key;cachedResult=result;}
      return result;
    }).finally(()=>{if(pendingKey===key){pendingKey=undefined;pendingResult=undefined;}});
  }
  return structuredClone(await pendingResult);
}

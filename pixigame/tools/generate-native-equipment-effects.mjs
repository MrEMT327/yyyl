import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const catalog=JSON.parse(read('public/replica-battle/data/loadout-catalog.json'));
const cloud=JSON.parse(read('src/peripheral/equipment-reference-data.json'));
const skills=new Map(catalog.allSkills.map(row=>[row.id,row]));
const rows=new Map(catalog.equipment.map(row=>[row.id,row]));
const predecessor=new Map();
for(const row of rows.values()){
  const ref=cloud.equip.find(value=>value.ID===row.id);
  for(const key of ['baseAttribute','AttributeOnLevelUp','FeatureJson','NextID','equipType','quality']){
    if(!ref||JSON.stringify(ref[key])!==JSON.stringify(row.raw[key]))throw new Error(`Equipment table mismatch ${row.id}/${key}`);
  }
  if(row.raw.NextID){
    if(predecessor.has(row.raw.NextID))throw new Error(`Ambiguous quality predecessor ${row.raw.NextID}`);
    predecessor.set(row.raw.NextID,row.id);
  }
}
const plain=value=>String(value||'').replace(/<[^>]*>/g,'');
function features(row){
  const result=[],seen=new Set();
  let current=row;
  while(current){
    if(seen.has(current.id))throw new Error(`Equipment chain cycle ${current.id}`);
    seen.add(current.id);
    const entries=current.raw.FeatureJson?JSON.parse(current.raw.FeatureJson):[];
    for(const f of Array.isArray(entries)?entries:[entries]){
      if(f.Type==='Attr'){
        for(const expr of String(f.Args).split(';').filter(Boolean)){
          const [key,amount]=expr.split('='),definition=catalog.attributeNames[key];
          if(!definition||!Number.isFinite(Number(amount)))throw new Error(`Missing attribute ${expr}`);
          result.unshift({quality:current.raw.quality,type:'attribute',key,value:Number(amount),
            text:`${current.qualityName} · ${plain(definition.name||key)} ${Number(amount)>=0?'+':''}${amount}${key.endsWith('%')?'%':''}`});
        }
      }else if(f.Type==='Skill'){
        for(const id of String(f.Args).match(/\d+/g)||[]){
          const skill=skills.get(Number(id));
          if(!skill?.description)throw new Error(`Missing original equipment description ${id}`);
          result.unshift({quality:current.raw.quality,type:'skill',skillId:Number(id),
            text:`${current.qualityName} · ${plain(skill.description)}`});
        }
      }else throw new Error(`Unsupported equipment feature ${f.Type}`);
    }
    current=rows.get(predecessor.get(current.id));
  }
  return result;
}
const equipment=Object.fromEntries([...rows.values()].map(row=>[row.id,{
  id:row.id,nativeName:row.name,rank:row.raw.rank,series:row.raw.seq,slot:row.slot,features:features(row),
}]));
const sim=read('replica-battle/kernel/simulation.ts');
const start=sim.indexOf('    registerLoadoutAttributeConsumers('),end=sim.indexOf('\n    const buffs =',start);
if(start<0||end<0)throw new Error('Native capability declarations not found');
const registration=sim.slice(start,end).trim();
if(!registration.includes('loadoutRuntimeActions.add')||!registration.includes('registerLoadoutDependencyHandlers'))throw new Error('Incomplete native declarations');
const outputs=new Map([
 ['src/replica/native-equipment-effects-index.json',JSON.stringify({source:'replica-battle/data/loadout-catalog.json',equipment},null,2)+'\n'],
 ['src/replica/native-runtime-capabilities.js',`// Generated from the actual Simulation constructor declarations; no new handlers.\n// Used by read-only lobby calculations before a Simulation exists.\nimport { registerLoadoutAttributeConsumers } from '../../replica-battle/kernel/loadout-attributes';\nimport { nativeLoadoutDamageAttributeNames, nativeLoadoutSurvivalAttributeNames } from '../../replica-battle/kernel/combat-attributes';\nimport { loadoutRuntimeActions } from '../../replica-battle/kernel/special-skill-runtime';\nimport { registerLoadoutDependencyHandlers } from '../../replica-battle/kernel/loadout-dependencies';\nexport function initializeReplicaLoadoutCapabilities() {\n  ${registration}\n}\n`],
]);
for(const [file,contents] of outputs){
  if(process.argv.includes('--check')){
    if(read(file)!==contents)throw new Error(`Generated data out of date: ${file}`);
  }else fs.writeFileSync(path.join(root,file),contents);
}
console.log(`Native equipment: ${rows.size} rows; all quality-chain descriptions and runtime capability declarations match source.`);

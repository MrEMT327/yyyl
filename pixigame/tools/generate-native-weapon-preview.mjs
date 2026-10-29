import fs from 'node:fs';
import crypto from 'node:crypto';
const read=file=>fs.readFileSync(file,'utf8');
const sources=['public/replica-battle/data/combat.json','public/replica-battle/data/loadout-catalog.json','public/replica-battle/data/skill-selection.json'];
const raw=sources.map(read),[combat,catalog,selection]=raw.map(JSON.parse);
const skills=new Map([...Object.values(catalog.allSkills),...Object.values(catalog.skills)].map(row=>[row.id,row]));
const plain=value=>String(value||'').replace(/<[^>]*>/g,'').trim();
const card=id=>{
  const row=skills.get(id);
  if(!row)throw new Error('Missing native preview skill '+id);
  return {id,name:plain(row.name),description:plain(row.description)};
};
const families=Object.fromEntries(Object.values(combat.families).map(family=>[family.id,{
  id:family.id,name:family.name,description:family.description,
  stages:family.stages.map(stage=>{
    const row=selection.skills[stage.skillId];
    if(!row)throw new Error('Missing native selection stage '+stage.skillId);
    const type=combat.mode==='B'?row.IsUpgrade_B:row.IsUpgrade;
    const ids=combat.mode==='B'?row.UpgradeSkillId_B:row.UpgradeSkillId;
    return {id:stage.skillId,star:stage.star,kind:type===1?'breakthrough':type===2?'minor':'direct',
      description:card(stage.skillId).description,options:ids.map(card)};
  })
}]));
const output=JSON.stringify({mode:combat.mode,
  sources:Object.fromEntries(sources.map((file,i)=>[file,crypto.createHash('sha256').update(raw[i]).digest('hex')])),
  families},null,2)+'\n';
const target='src/replica/native-weapon-preview-index.json';
if(process.argv.includes('--check')){
  if(read(target)!==output)throw new Error('Native weapon preview is stale');
  console.log('Native weapon preview matches current mode, stages, skill IDs and descriptions.');
}else{fs.writeFileSync(target,output);console.log('Generated native weapon preview.');}

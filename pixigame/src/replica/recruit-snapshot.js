import { nativeWeaponDisplayText } from './native-weapon-display.js';
import { nativeCollectionAccess } from './native-collection-access.js';
import { NATIVE_PILOT_SKINS } from './native-pilot-roster.js';
import { nativePilotDisplayQuality } from './native-pilot-quality.js';

const plain=value=>nativeWeaponDisplayText(String(value||'').replace(/<[^>]*>/g,''));

export function cloudNativeRecruitSnapshot(s){
  if(!s.nativeAcquisition)return s;
  // Direct recruitment and retained legacy boxes have independent histories and guarantees.
  const candidates=new Set((s.pilotSupply?.candidates||[]).map(row=>row.id));
  return {...s,pools:{pilot:s.pilotSupply?.pool||{unavailable:true}},recruitHistory:s.pilotSupply?.history||[],
    pilots:s.replicaCollection.pilots.filter(row=>NATIVE_PILOT_SKINS[row.id]).map(row=>{
      const skin=s.pilots.find(p=>p.id===NATIVE_PILOT_SKINS[row.id]);
      const name=row.stage.skills.map(skill=>plain(skill.name)).join('、');
      const description=row.stage.skills.map(skill=>plain(skill.description)).join('\n');
      const access=nativeCollectionAccess('pilots',s,row),quality=nativePilotDisplayQuality({nativeId:row.id});
      return {...skin,...quality,nativeId:row.id,recruitable:!s.pilotSupply||candidates.has(row.id),
        owned:access.activated,activated:access.activated,available:access.available,temporaryUnlocked:false,
        stars:row.star,copies:0,skillName:name,description,passive:{name,description}};
    })};
}

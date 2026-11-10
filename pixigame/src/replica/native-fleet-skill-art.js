import catalogue from './native-fleet-skill-art.json' with {type:'json'};
import {cloudAssetBase} from '../ui/cloud-asset-base.js';
export const NATIVE_FLEET_SKILL_ASSETS=Object.freeze(catalogue.assets);
const byId=new Map(catalogue.assets.flatMap(row=>row.skillIds.map(id=>[Number(id),row])));
const byIcon=new Map(catalogue.assets.map(row=>[row.key,row]));
const url=row=>row?`${cloudAssetBase}art/${catalogue.pack}/${row.file}`:null;
export const nativeFleetSkillArt=id=>url(byId.get(Number(id)));
export const nativeFleetSkillIconArt=icon=>url(byIcon.get(String(icon||'').split('/').pop().replace(/\.(png|webp)$/,'')));

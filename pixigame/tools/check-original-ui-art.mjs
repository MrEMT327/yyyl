import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_UI_ART } from '../src/ui/project-ui-art.js';
import { BATTLE_SKILL_ART_KEYS, battleSkillIconUrl } from '../src/ui/battle-skill-art.js';
import { TALENT_ART_KEYS } from '../src/ui/research-art.js';
import { RESEARCH_BLUEPRINT_ART } from '../src/replica/research-blueprint-art.js';
import {SKILL_ICON_ASSETS,NATIVE_FLEET_SKILL_ASSETS} from '../src/replica/native-weapon-skill-art.js';
import {SKILL_BACKGROUND_ELEMENTS} from '../src/replica/native-weapon-skill-art.js';
const project = fileURLToPath(new URL('../', import.meta.url));
const audit = JSON.parse(await readFile(new URL('../art/project-ui-icons-v1/source-audit.json',import.meta.url)));
const retired = JSON.parse(await readFile(new URL('./retired-runtime-assets.json',import.meta.url)));
const retiredPath = entry => entry.publicPath || `art/${entry.path}`;
const retiredMatches = (entry,path) => entry.kind === 'file' ? path === retiredPath(entry) : path.startsWith(retiredPath(entry)+'/');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(dir) {
  const result=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const path=resolve(dir,entry.name);
    if(entry.isDirectory())result.push(...await files(path));
    else if(entry.isFile())result.push(path);
  }
  return result;
}
export async function inspectOriginalUiArt({shippingRoot=resolve(project,'public'),sourceRoot=resolve(project,'src')}={}) {
  const violations=[],archiveHashes=new Map(audit.archived.filter(f=>/\.(png|jpe?g|webp)$/i.test(f.oldPath)).map(f=>[f.sha256,f.oldPath]));
  let replicaFiles = new Map();
  try {
    const manifest = JSON.parse(await readFile(resolve(shippingRoot, 'replica-battle/source-manifest.json'), 'utf8'));
    if (manifest.engine === 'danke-replica-v1') replicaFiles = new Map([...manifest.publicFiles, ...(manifest.originalAssetAdditions || [])].map(row => [`replica-battle/${row.path}`, row.sha256]));
  } catch { /* No replica snapshot is shipped by this target. */ }
  let sourceFiles=0,images=0;
  if(sourceRoot)for(const path of await files(sourceRoot)) {
    if(!/\.(js|css|json)$/.test(path))continue;
    sourceFiles++;
    const content=await readFile(path,'utf8');
    for(const entry of retired.assets) {
      if(content.includes(retiredPath(entry)+(entry.kind==='file'?'':'/')))violations.push({type:'retired-asset-reference',path:relative(project,path),source:entry.path});
    }
    for(const banned of audit.forbiddenRoots) {
      const name=banned.slice(4,-1);
      if(content.includes(banned)||content.includes(`'${name}'`)||content.includes(`"${name}"`))violations.push({type:'competitor-reference',path:relative(project,path),source:banned});
    }
  }
  for(const path of await files(shippingRoot)) {
    const rel=relative(shippingRoot,path).replaceAll('\\','/');
    if(retired.assets.some(entry=>retiredMatches(entry,rel)))violations.push({type:'retired-asset-shipped',path:rel});
    if(audit.forbiddenRoots.some(prefix=>rel.startsWith(prefix)))violations.push({type:'competitor-directory-shipped',path:rel});
    if(!/\.(png|jpe?g|webp)$/i.test(path))continue;
    images++;
    const duplicate=archiveHashes.get(hash(await readFile(path)));
    if(duplicate && replicaFiles.get(rel)!==hash(await readFile(path)))violations.push({type:'competitor-image-bytes',path:rel,source:duplicate});
  }
  for(const original of audit.preservedPsd) {
    const path=resolve(shippingRoot,original.path.replace(/^public\//,''));
    try {if(hash(await readFile(path))!==original.sha256)violations.push({type:'protected-psd-changed',path:original.path});}
    catch {violations.push({type:'protected-psd-missing',path:original.path});}
  }
  for(const [name,url] of Object.entries(PROJECT_UI_ART)) {
    try {await readFile(resolve(shippingRoot,url.replace(/^\//,'')));}
    catch {violations.push({type:'missing-registered-icon',name,path:url});}
  }
  // Check the icons actually selected by the current runtime, including the
  // weapon-theme override. Retired catalogues are not shipping dependencies.
  for(const key of BATTLE_SKILL_ART_KEYS) {
    const url=battleSkillIconUrl(key);
    try {await readFile(resolve(shippingRoot,url.replace(/^\//,'')));}
    catch {violations.push({type:'missing-battle-skill-icon',key,path:url});}
  }
  for(const dir of ['project-ui-icons-v1','project-resource-icons-v2','project-battle-passives-v2','project-flight-blueprints-v1','project-equipment-blueprints-v2','project-talents-v1','project-research-blueprints-v2','project-supplement-icons-v1','project-enemy-health-v1','navigation-icons-v2','battle-skill-icons-v4','project-damage-numbers-v1','skill-element-backgrounds-v1','fleet-skill-icons-v1','weapon-variant-skill-icons-v5'])try {
    const manifest=JSON.parse(await readFile(resolve(shippingRoot,'art',dir,'manifest.json'),'utf8'));
    if(dir==='skill-element-backgrounds-v1'&&JSON.stringify(manifest.assets.map(row=>row.key).sort())!==JSON.stringify([...SKILL_BACKGROUND_ELEMENTS].sort()))violations.push({type:'skill-element-background-coverage',directory:dir});
    if(dir==='battle-skill-icons-v4'&&JSON.stringify(manifest.assets.map(row=>row.key).sort())!==JSON.stringify(SKILL_ICON_ASSETS.filter(row=>row.category!=='variant').map(row=>row.key).sort()))violations.push({type:'skill-icon-coverage',directory:dir});
    if(dir==='fleet-skill-icons-v1'&&manifest.assets.length!==NATIVE_FLEET_SKILL_ASSETS.length)violations.push({type:'fleet-skill-coverage',directory:dir});
    if(dir==='weapon-variant-skill-icons-v5'&&manifest.assets.length!==11)violations.push({type:'variant-skill-coverage',directory:dir});
    if(dir==='project-talents-v1'&&JSON.stringify(manifest.assets.map(entry=>entry.key).sort())!==JSON.stringify(TALENT_ART_KEYS))violations.push({type:'talent-icon-coverage',directory:dir});
    if(dir.startsWith('project-research-blueprints-')&&JSON.stringify(manifest.assets.map(entry=>entry.nativeItemId))!==JSON.stringify(RESEARCH_BLUEPRINT_ART.map(entry=>entry.nativeItemId)))violations.push({type:'research-blueprint-coverage',directory:dir});
    for(const entry of manifest.assets) {
      if(hash(await readFile(resolve(shippingRoot,'art',dir,entry.file)))!==entry.sha256.toLowerCase())violations.push({type:'generated-icon-hash-mismatch',path:`${dir}/${entry.file}`});
      if(dir==='project-research-blueprints-v2'&&hash(await readFile(resolve(shippingRoot,entry.weaponSource.path)))!==entry.weaponSource.sha256)violations.push({type:'blueprint-weapon-source-stale',path:entry.file});
      if(dir==='project-resource-icons-v2'&&Math.max(...entry.sourceSize)<1024)violations.push({type:'resource-source-not-hd',path:entry.file});
    }
  } catch(error) {violations.push({type:'generated-icon-manifest',directory:dir,message:error.message});}
  return {sourceFiles,shippingImages:images,archivedFiles:audit.archived.length,protectedPsdIcons:audit.preservedPsd.length,violations,ok:violations.length===0};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const result=await inspectOriginalUiArt({shippingRoot:process.argv[2]?resolve(process.argv[2]):undefined});
  console.log(JSON.stringify(result,null,2));
  if(!result.ok)process.exitCode=1;
}

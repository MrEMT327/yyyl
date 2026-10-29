import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROJECT_UI_ART } from '../src/ui/project-ui-art.js';
import { BATTLE_SKILL_ART_KEYS } from '../src/ui/battle-skill-art.js';
import { TALENT_ART_KEYS } from '../src/ui/research-art.js';
import { RESEARCH_BLUEPRINT_ART } from '../src/replica/research-blueprint-art.js';
const project = fileURLToPath(new URL('../', import.meta.url));
const audit = JSON.parse(await readFile(new URL('../art/project-ui-icons-v1/source-audit.json',import.meta.url)));
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
    for(const banned of audit.forbiddenRoots) {
      const name=banned.slice(4,-1);
      if(content.includes(banned)||content.includes(`'${name}'`)||content.includes(`"${name}"`))violations.push({type:'competitor-reference',path:relative(project,path),source:banned});
    }
  }
  for(const path of await files(shippingRoot)) {
    const rel=relative(shippingRoot,path).replaceAll('\\','/');
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
  for(const dir of ['project-ui-icons-v1','project-resource-icons-v2','project-battle-skills-v1','project-flight-blueprints-v1','project-talents-v1','project-research-blueprints-v1','project-supplement-icons-v1'])try {
    const manifest=JSON.parse(await readFile(resolve(shippingRoot,'art',dir,'manifest.json'),'utf8'));
    if(dir==='project-battle-skills-v1'&&JSON.stringify(manifest.assets.map(entry=>entry.key))!==JSON.stringify(BATTLE_SKILL_ART_KEYS))violations.push({type:'battle-skill-icon-coverage',directory:dir});
    if(dir==='project-talents-v1'&&JSON.stringify(manifest.assets.map(entry=>entry.key).sort())!==JSON.stringify(TALENT_ART_KEYS))violations.push({type:'talent-icon-coverage',directory:dir});
    if(dir==='project-research-blueprints-v1'&&JSON.stringify(manifest.assets.map(entry=>entry.nativeItemId))!==JSON.stringify(RESEARCH_BLUEPRINT_ART.map(entry=>entry.nativeItemId)))violations.push({type:'research-blueprint-coverage',directory:dir});
    for(const entry of manifest.assets) {
      if(hash(await readFile(resolve(shippingRoot,'art',dir,entry.file)))!==entry.sha256)violations.push({type:'generated-icon-hash-mismatch',path:`${dir}/${entry.file}`});
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

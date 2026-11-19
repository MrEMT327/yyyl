import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,relative,posix} from 'node:path';
import {fileURLToPath} from 'node:url';

const project=fileURLToPath(new URL('../',import.meta.url));
const media=/\.(?:png|jpe?g|webp|gif|svg|avif|bmp|tga|dds|ktx2?|wav|mp3|ogg|m4a|aac|flac|ttf|otf|woff2?|fbx|glb|gltf|obj|bin|mp4|webm)$/i;
// Sprite/animation/mesh/material exports are presentation assets even when JSON.
const presentationAsset=path=>media.test(path)||/^assets\/.*\.(?:json|atlas|skel|spine|prefab|anim|mat|material|shader|glsl|bundle)$/i.test(path)||/^data\/.*(?:assets?|animation|effects|geometry|mesh|material|texture|appearance|map-layers|health-bars|prefab|particle|sprite|atlas|loadout-runtime).*\.json$/i.test(path);
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const studyMarkers=['mountStudyLoadout','原包研究模式','正在装载原包装备与图鉴','本界面使用 APK 原表与原包图片','replicaResearchToggle'];
const referenceOnly=['replica-battle/assets/loadout-ui/','replica-battle/data/loadout-ui.json','replica-battle/source-manifest.json'];
let trustedIndex;

// This is deliberately independent of the manifest inside the package being
// checked. A copied/edited public whitelist must never authorize original art.
export function createReleaseAssetIndex(referenceManifest,uiAudit){
  if(referenceManifest?.engine!=='danke-replica-v1'||!Array.isArray(referenceManifest.publicFiles)||!referenceManifest.publicFiles.length||!Array.isArray(uiAudit?.archived)||!uiAudit.archived.length)
    throw Error('发布素材索引缺失或不完整，禁止跳过检查');
  const hashes=new Map(),paths=new Set(),add=(row,path,kind)=>{
    if(!/^[0-9a-f]{64}$/i.test(row.sha256))throw Error(`发布素材索引哈希无效：${path}`);
    if(!hashes.has(row.sha256))hashes.set(row.sha256,{kind,sources:[]});
    const item=hashes.get(row.sha256);if(kind==='original-media')item.kind=kind;
    item.sources.push(path);paths.add(path);
  };
  for(const row of [...referenceManifest.publicFiles,...(referenceManifest.originalAssetAdditions||[])]){
    if(presentationAsset(row.path))add(row,`replica-battle/${row.path}`,'unreviewed-reference-media');
  }
  for(const row of uiAudit.archived){
    if(media.test(row.oldPath))add(row,row.oldPath.replace(/^public\//,''),'original-media');
  }
  if(!hashes.size)throw Error('发布素材索引为空，禁止跳过检查');
  return {hashes,paths,forbiddenRoots:[...(uiAudit.forbiddenRoots||[]),...referenceOnly]};
}

export async function releaseAssetIndex(){
  return trustedIndex ||= Promise.all([
    readFile(resolve(project,'replica-battle/source-manifest.json'),'utf8'),
    readFile(resolve(project,'art/project-ui-icons-v1/source-audit.json'),'utf8'),
  ]).then(([snapshot,audit])=>createReleaseAssetIndex(JSON.parse(snapshot),JSON.parse(audit)));
}

export function inspectReleaseBytes(path,bytes,index){
  path=path.replaceAll('\\','/');
  const violations=[];
  if(path.startsWith('/')||/^[a-z]:/i.test(path)||posix.normalize(path).startsWith('../')||path.split('/').includes('..'))
    return [{type:'unsafe-package-path',path}];
  if(index.forbiddenRoots.some(prefix=>prefix.endsWith('/')?path.startsWith(prefix):path===prefix))
    violations.push({type:'reference-only-path',path});
  if(index.paths.has(path))violations.push({type:'unreviewed-reference-path',path});
  const sha256=digest(bytes),known=index.hashes.get(sha256);
  if(known)violations.push({type:known.kind+'-bytes',path,sha256,sources:known.sources});
  if(/\.(?:js|css|html)$/i.test(path)){
    const text=bytes.toString('utf8');
    for(const marker of studyMarkers)if(text.includes(marker))violations.push({type:'research-ui-code',path,marker});
  }
  return violations;
}

export function assertReleaseBytes(path,bytes,index){
  const violations=inspectReleaseBytes(path,bytes,index);
  if(violations.length)throw Error(`发布被阻止：${path} 含原版、未审查复刻媒体或研究专用内容（${violations.map(v=>v.type).join('、')}）`);
}

export async function inspectReleaseAssets({shippingRoot=resolve(project,'public'),index}={}){
  index??=await releaseAssetIndex();
  const violations=[];let files=0,bytes=0;
  async function walk(dir){
    const entries=await readdir(dir,{withFileTypes:true});
    for(const entry of entries){
      const file=resolve(dir,entry.name),path=relative(shippingRoot,file).replaceAll('\\','/');
      if(entry.isSymbolicLink()){violations.push({type:'unreviewed-symlink',path});continue;}
      if(entry.isDirectory()){await walk(file);continue;}
      if(!entry.isFile())continue;
      const content=await readFile(file);files++;bytes+=content.length;
      violations.push(...inspectReleaseBytes(path,content,index));
    }
  }
  await walk(shippingRoot);
  return {kind:'strict-release-media-audit',shippingRoot,files,bytes,knownReferenceMediaHashes:index.hashes.size,violations,ok:violations.length===0};
}

export function releaseAssetSummary(report){
  const byType={},byDirectory={};
  for(const v of report.violations){
    byType[v.type]=(byType[v.type]||0)+1;
    const directory=v.path.split('/').slice(0,3).join('/');
    byDirectory[directory]=(byDirectory[directory]||0)+1;
  }
  return {kind:report.kind,ok:report.ok,files:report.files,bytes:report.bytes,knownReferenceMediaHashes:report.knownReferenceMediaHashes,
    violationCount:report.violations.length,affectedFiles:new Set(report.violations.map(v=>v.path)).size,byType,byDirectory,samples:report.violations.slice(0,8)};
}

export async function assertReleaseAssets(options){
  const report=await inspectReleaseAssets(options);
  if(!report.ok){
    const error=Error(`发布素材检查未通过：${report.violations.length} 项原版/未审查复刻媒体或研究内容。替换并清理后才能出包。`);
    error.report=report;throw error;
  }
  return report;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const rootArg=process.argv[2]&&!process.argv[2].startsWith('--')?resolve(process.argv[2]):undefined;
    const report=await inspectReleaseAssets({shippingRoot:rootArg});
    const reportAt=process.argv.indexOf('--report');
    if(reportAt>=0){const {writeFile}=await import('node:fs/promises');await writeFile(resolve(process.argv[reportAt+1]),JSON.stringify(report,null,2)+'\n');}
    console.log(JSON.stringify(releaseAssetSummary(report),null,2));
    if(!report.ok)process.exitCode=1;
  }catch(error){console.error(error.message);process.exitCode=1;}
}

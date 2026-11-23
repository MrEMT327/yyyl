import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { compileWechatThreeRuntime } from './compile-three-runtime.mjs';
import { withPackageOutput } from './build-wechat.mjs';
import { assertNativePackage } from '../pixigame/wechat/tools/native-syntax.mjs';
import { wrapNativeCubismCore } from '../pixigame/wechat/tools/cubism-native.mjs';
import { checkThreeUiTextureCoverage, loadThreeTextureAssets } from './three-texture-assets.mjs';
import { loadThreeCompatMedia } from './three-compat-media.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const repo=resolve(root,'../../..'),h5=join(repo,'pixigame');
const inputs=join(root,'build-inputs');
const requiredAssets=[
  'art/entry-screens-v4/startup.png',
  'art/three-ui/three-art-072afc9e0d40.png',
  'art/orange-jetboard-v5/runtime.json',
  'art/ui-images-v1/psd-main-v1/main-background.webp',
  'replica-battle/data/loadout-catalog.json',
  'replica-battle/data/loadout-runtime.json',
  'replica-battle/data/player-appearances.json',
  'replica-battle/data/sword-original-effects.json',
  'replica-battle/data/sorties-v1/chapter-1.json',
];
const MAX_PACKAGE_BYTES=4*1024*1024;
const MAX_ALL_PACKAGES=20*1024*1024;
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function buildThreeWechat({output}={}){
  const cdn=await json(join(inputs,'cdn-manifest.json'));
  const cdnBase=new URL(cdn.cdnBase);
  if(cdnBase.protocol!=='https:'||cdnBase.username||cdnBase.password||cdnBase.search||cdnBase.hash||!cdnBase.pathname.endsWith('/')){
    throw Error('微信小游戏 CDN 必须配置 HTTPS 目录地址');
  }
  // Use the CDN inventory for the shared H5 runtime in addition to the older package inventory.
  const extra=cdn.three;
  const assetTransfers={...cdn.transfers,...extra?.transfers};
  const uploads=extra?.uploads??[];
  const listed=new Set([...cdn.entries,...(extra?.entries??[]),...uploads].map(row=>row.path));
  const cdnFiles=[...listed];
  const cacheVersion=sha(JSON.stringify([cdn.cacheVersion,extra]));
  const networkAssets={cdnBase:cdnBase.href,assetTransfers,cdnFiles,cacheVersion};
  const textures=await loadThreeTextureAssets(inputs,join(h5,'public'));
  const compat=await loadThreeCompatMedia(inputs,h5);
  await checkThreeUiTextureCoverage(h5,textures,listed,assetTransfers);
  const uploadSizes=new Map(uploads.map(({path,bytes})=>[path,bytes]));
  const required=[...new Set([...requiredAssets,...uploadSizes.keys()])];
  async function checkAsset(key){
    const path=assetTransfers[key]?.path??key;
    if(!listed.has(path))return key+'（未登记）';
    try{
      const url=new URL(path.split('/').map(encodeURIComponent).join('/'),cdnBase);
      const response=await fetch(url,{method:'HEAD',headers:{'accept-encoding':'identity'},redirect:'error',signal:AbortSignal.timeout(8000)});
      if(!response.ok)return path+'（HTTP '+response.status+'）';
      if(/text\/html/i.test(response.headers.get('content-type')??''))return path+'（响应为网页）';
      if(uploadSizes.has(path)&&Number(response.headers.get('content-length'))!==uploadSizes.get(path))return path+'（文件大小不符）';
      return null;
    }catch(error){return path+'（'+(error.cause?.code??error.name)+'）';}
  }
  const invalid=[];
  const batchSize=12;
  for(let start=0;start<required.length;start+=batchSize){
    const results=await Promise.all(required.slice(start,start+batchSize).map(checkAsset));
    invalid.push(...results.filter(Boolean));
  }
  if(invalid.length)throw Error('微信 CDN 清单或地址未匹配当前游戏资源：\n'+invalid.join('\n'));
  const entry=join(root,'pixigame/wechat/src/three/game.js');
  const {parts,modules}=await compileWechatThreeRuntime({origin:cdnBase.origin,entry,split:true});
  const config=await json(join(inputs,'r145-baseline/project.config.json'));
  const version=execFileSync('git',['rev-parse','--short=8','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
  const cubism=await readFile(join(h5,'public/art/live2d-runtime/live2dcubismcore.min.js'),'utf8');
  const cubismScript=wrapNativeCubismCore(cubism);
  const units=new Map(parts);units.set('cubism',cubismScript);

  const ordered=[...units].sort((a,b)=>Buffer.byteLength(b[1])-Buffer.byteLength(a[1]));
  const packages=[],files={};
  function place(filename,source){
    const size=Buffer.byteLength(source);
    if(size+1024>MAX_PACKAGE_BYTES)throw Error('微信单个文件超出分包容量 '+filename+' '+size);
    let pkg=packages.find(row=>row.bytes+size+1024<MAX_PACKAGE_BYTES);
    if(!pkg){pkg={name:'three-code-'+(packages.length+1),bytes:0,entries:[]};packages.push(pkg);}
    pkg.entries.push({filename,source});pkg.bytes+=size;
    return pkg.name+'/'+filename;
  }
  for(const [name,source] of ordered){
    const filename=name==='runtime'?'runtime.js':name==='cubism'?'cubism.js':name.replace('@native/','')+'.js';
    files[name]=place(filename,source);
  }
  const texturePaths=new Map([...textures.files,...compat.files].sort((a,b)=>b.source.length-a.source.length)
    .map(({filename,source})=>[filename,place(filename,source)]));
  const localFiles=Object.fromEntries(Object.entries({...textures.aliases,...compat.images,...compat.effects}).map(([path,filename])=>
    [path,texturePaths.get(filename)]));
  const musicFiles=Object.fromEntries(Object.entries(compat.music).map(([key,filename])=>[key,texturePaths.get(filename)]));
  const fallbackFiles=Object.fromEntries(Object.entries(textures.fallbackAliases).map(([path,filename])=>
    [assetTransfers[path]?.path??path,texturePaths.get(filename)]));
  const assets={...networkAssets,localFiles,fallbackFiles,musicFiles};
  const sourceDigest=createHash('sha256');
  for(const [name,source] of [...units].sort(([a],[b])=>a.localeCompare(b)))sourceDigest.update(name).update(source);
  for(const {filename,source} of [...textures.files,...compat.files])sourceDigest.update(filename).update(source);
  sourceDigest.update(JSON.stringify(assets));
  const buildId='three-'+version+'-'+sourceDigest.digest('hex').slice(0,12);

  return withPackageOutput(root,output,async ({output,entries})=>{
    await mkdir(entries,{recursive:true});
    for(const pkg of packages){
      const folder=join(entries,pkg.name);await mkdir(folder);
      await writeFile(join(folder,'game.js'),'// WeChat subpackage entry.\n');
      for(const {filename,source} of pkg.entries)await writeFile(join(folder,filename),source);
    }
    const map=Object.entries(files).map(([name,path])=>
      '  '+JSON.stringify(name)+':()=>require('+JSON.stringify('./'+path)+')').join(',\n');
    const manifest={
      deviceOrientation:'portrait',showStatusBar:false,iOSHighPerformance:true,
      subpackages:packages.map(({name})=>({name,root:name+'/'})),
    };
    const launcher=[
      'const load={\n'+map+'\n};',
      'const modules=new Map();',
      'GameGlobal.__shnhReadModule=name=>{if(!load[name])throw Error("未知小游戏模块 "+name);if(!modules.has(name))modules.set(name,load[name]());return modules.get(name);};',
      'const pending=new Map();',
      'function loadPackage(name){',
      '  if(!pending.has(name))pending.set(name,new Promise((resolve,reject)=>wx.loadSubpackage({name,success:resolve,fail:reject})).catch(error=>{pending.delete(name);throw error;}));',
      '  return pending.get(name);',
      '}',
      'const config='+JSON.stringify({...assets,buildId})+';',
      'config.loadPackage=loadPackage;',
      'config.loadCubism=()=>Promise.resolve().then(()=>GameGlobal.__shnhReadModule("cubism"));',
      'const packages='+JSON.stringify(packages.map(({name})=>name))+';',
      'Promise.all(packages.map(loadPackage)).then(()=>{',
      '  const {openWechatGame}=GameGlobal.__shnhReadModule("runtime");',
      '  GameGlobal.__shnhGame=openWechatGame(wx,config);',
      '  console.info("[少女航线 微信小游戏]",config.buildId,"Three.js");',
      '}).catch(error=>{console.error("[小游戏启动]",error);wx.showModal({title:"少女航线",content:String(error.errMsg||error.message||error),showCancel:false});});',
    ].join('\n')+'\n';
    const manifestSource=JSON.stringify(manifest,null,2)+'\n';
    const projectSource=JSON.stringify({...config,compileType:'game',projectname:'少女航线 Three.js',setting:{...config.setting,urlCheck:true}},null,2)+'\n';
    const buildSource=JSON.stringify({buildId,source:version,renderer:'Three.js',mode:'wechat-cdn',
      assets:cdnBase.href,modules:modules.length,packagedTextures:Object.keys(textures.aliases).length+Object.keys(compat.images).length+Object.keys(fallbackFiles).length,
      packagedEffects:Object.keys(compat.effects).length,
      packagedMusic:Object.keys(musicFiles).length,packages:packages.map(({name,bytes})=>({name,bytes})),
      runtimeSha256:sha(parts.get('runtime')),threeSha256:sha(parts.get('@native/game-three')),cubismSha256:sha(cubismScript)},null,2)+'\n';
    const threeLicense=await readFile(join(h5,'node_modules/three/LICENSE'));
    const cubismLicense=await readFile(join(h5,'public/art/live2d-runtime/LIVE2D-PROPRIETARY-LICENSE.html'));
    const size=ordered.reduce((total,[,body])=>total+Buffer.byteLength(body),textures.bytes+compat.bytes)
      +Buffer.byteLength(launcher+manifestSource+projectSource+buildSource)+threeLicense.length+cubismLicense.length+packages.length*35;
    if(size>MAX_ALL_PACKAGES)throw Error('微信小游戏分包总大小超限 '+size);
    await Promise.all([
      writeFile(join(entries,'game.js'),launcher),writeFile(join(entries,'game.json'),manifestSource),
      writeFile(join(entries,'project.config.json'),projectSource),writeFile(join(entries,'BUILD-INFO.json'),buildSource),
      writeFile(join(entries,'THREE-LICENSE.txt'),threeLicense),writeFile(join(entries,'LIVE2D-LICENSE.txt'),cubismLicense),
    ]);
    await assertNativePackage(entries);
    return {buildId,output,bytes:size,packages:packages.length,assets:cdnBase.href};
  });
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  console.log(JSON.stringify(await buildThreeWechat({output:process.argv[2]})));
}

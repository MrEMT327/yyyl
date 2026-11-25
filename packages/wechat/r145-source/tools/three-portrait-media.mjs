import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {join,posix,resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {compactPortraitClip} from '../pixigame/wechat/src/three/portrait-clip.js';

const hash=b=>createHash('sha256').update(b).digest('hex');
const json=async path=>JSON.parse(await readFile(path,'utf8'));

async function portraitSources(publicRoot){
  const sources=[];
  for(const folder of ['art/engineer-ee76','art/violet-astra-v31']){
    const manifest=await json(join(publicRoot,folder,'runtime.json'));
    for(const clip of Object.values(manifest.clips)){
      const key=posix.join(folder,clip.file);
      sources.push({key,width:manifest.packedWidth/2,height:manifest.height/2,video:true});
      sources.push({key:compactPortraitClip(key),sourceKey:key,width:manifest.packedWidth/4,height:manifest.height/4,video:true});
    }
  }
  const folder='art/golden-yoga-v12',golden=await json(join(publicRoot,folder,'runtime.json'));
  for(const path of new Set(Object.values(golden.textures))){
    const key=posix.join(folder,path),png=await readFile(join(publicRoot,key));
    const width=png.readUInt32BE(16),height=png.readUInt32BE(20),scale=960/Math.max(width,height);
    if(scale<1)sources.push({key,width:Math.round(width*scale),height:Math.round(height*scale),video:false});
  }
  return sources;
}

export async function preparePortraitMedia(folder,publicRoot,ffmpeg){
  await mkdir(folder,{recursive:true});
  const entries=[];
  for(const {key,sourceKey,width,height,video} of await portraitSources(publicRoot)){
    const input=join(publicRoot,sourceKey??key),sourceSha256=hash(await readFile(input));
    const args=['-nostdin','-v','error','-threads','2','-i',input,'-map','0:v:0','-an','-map_metadata','-1',
      '-vf','scale='+width+':'+height+':flags=lanczos,setsar=1'];
    let bytes;
    if(video){
      const temp=join(folder,'encode-'+process.pid+'.mp4');
      try{
        execFileSync(ffmpeg,[...args,'-c:v','libx264','-preset','medium','-crf',sourceKey?'25':'22','-pix_fmt','yuv420p','-threads','3','-movflags','+faststart','-y',temp]);
        bytes=await readFile(temp);
      }finally{await unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error;});}
    }else{
      bytes=execFileSync(ffmpeg,[...args,'-frames:v','1','-c:v','png','-pix_fmt','rgba','-compression_level','9','-f','image2pipe','pipe:1'],{maxBuffer:8*1024*1024});
    }
    const sha256=hash(bytes),file='portrait-'+sha256.slice(0,20)+(video?'.mp4':'.png');
    await writeFile(join(folder,file),bytes);
    entries.push({key,file,sha256,sourceSha256});
  }
  await writeFile(join(folder,'manifest.json'),JSON.stringify(entries,null,2)+'\n');
}

export async function loadPortraitMedia(inputs,publicRoot){
  const folder=join(inputs,'three-portrait-media'),entries=await json(join(folder,'manifest.json'));
  const expected=new Map((await portraitSources(publicRoot)).map(row=>[row.key,row]));
  const files=new Map(),aliases={};
  let videos=0;
  for(const {key,file,sha256,sourceSha256} of entries){
    const spec=expected.get(key);
    if(!spec||hash(await readFile(join(publicRoot,spec.sourceKey??key)))!==sourceSha256)throw Error('微信立绘源素材与清单不符 '+key);
    expected.delete(key);
    if(file!=='portrait-'+sha256.slice(0,20)+(spec.video?'.mp4':'.png')||!/^[0-9a-f]{64}$/.test(sha256))throw Error('无效立绘文件名 '+key);
    const source=files.get(file)??await readFile(join(folder,file));
    if(hash(source)!==sha256||(spec.video?source.toString('ascii',4,8)!=='ftyp':
      source.readUInt32BE(0)!==0x89504e47||source.readUInt32BE(16)!==spec.width||source.readUInt32BE(20)!==spec.height))
      throw Error('微信立绘素材校验失败 '+key);
    files.set(file,source);aliases[key]=file;if(spec.video)videos++;
  }
  if(expected.size)throw Error('微信立绘素材不完整 '+[...expected.keys()].join(', '));
  return {aliases,videos,files:[...files].map(([filename,source])=>({filename,source})),
    bytes:[...files.values()].reduce((total,b)=>total+b.length,0)};
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){
  const root=fileURLToPath(new URL('../',import.meta.url));
  await preparePortraitMedia(join(root,'build-inputs/three-portrait-media'),resolve(root,'../../../pixigame/public'),process.argv[2]??'ffmpeg');
}

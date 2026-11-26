import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,unlink,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {musicNames,packagedMusicNames,musicCdnDirectory,catalogRepairs,firstEffects} from './three-compat-media.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),h5=join(root,'../../../pixigame');
const cli=process.argv.slice(2),musicOnly=cli.includes('--music-only');
const out=join(root,'build-inputs','three-compat-media'),ffmpeg=cli.find(value=>value!=='--music-only')||'ffmpeg';
const cdnOutput=join(root,'../out/music-cdn',musicCdnDirectory);
const sha=b=>createHash('sha256').update(b).digest('hex');
const musicHeadroom=.68;
const entries=[];
await Promise.all([mkdir(out,{recursive:true}),mkdir(cdnOutput,{recursive:true})]);
const manifest=join(out,'manifest.json');
const previous=await readFile(manifest,'utf8').then(JSON.parse,error=>{if(error.code==='ENOENT')return [];throw error;});
if(musicOnly&&!previous.length)throw Error('仅更新音乐需要现有兼容媒体清单');
async function save(key,sourcePath,{music=false,effect=false,maxSide=0,indexed=false}={}){
  const path=join(h5,sourcePath),sourceSha256=sha(await readFile(path));
  const args=['-hide_banner','-loglevel','error','-i',path,'-map_metadata','-1'];
  const temp=join(out,`${key}-${process.pid}.m4a`);
  const remoteMusic=music&&!packagedMusicNames.includes(key);
  if(music){
    // Preserve the stereo mix, with the same playback headroom for both tiers.
    const mix='alimiter=limit=.65:attack=3:release=50:level=false:latency=true,volume='+musicHeadroom;
    args.push('-map','0:a:0','-af',mix,'-ar','44100','-ac','2','-c:a','aac','-b:a',remoteMusic?'96000':'64000','-movflags','+faststart',temp);
  }
  else if(effect)args.push('-ac','1','-ar','16000','-c:a','pcm_s16le','-f','wav');
  else{
    args.push('-frames:v','1');
    const scale=`scale=${maxSide}:${maxSide}:force_original_aspect_ratio=decrease:flags=lanczos`;
    if(indexed)args.push('-filter_complex',`[0:v]${scale},format=rgba,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:alpha_threshold=28`);
    else if(maxSide)args.push('-vf',scale);
    args.push('-c:v','png','-pix_fmt',indexed?'pal8':'rgba','-compression_level','9','-f','image2pipe');
  }
  let bytes;
  if(music)try{execFileSync(ffmpeg,args);bytes=await readFile(temp);}finally{
    await unlink(temp).catch(error=>{if(error.code!=='ENOENT')throw error;});
  }
  else bytes=execFileSync(ffmpeg,[...args,'pipe:1'],{maxBuffer:6*1024*1024});
  // The WAV muxer on a pipe uses a streaming size sentinel. Stamp the real
  // RIFF chunk lengths for native decoders which need a seekable header.
  if(effect){
    bytes.writeUInt32LE(bytes.length-8,4);
    for(let at=12;at+8<=bytes.length;){
      if(bytes.toString('ascii',at,at+4)==='data'){bytes.writeUInt32LE(bytes.length-at-8,at+4);break;}
      const size=bytes.readUInt32LE(at+4);at+=8+size+(size&1);
    }
  }
  const sha256=sha(bytes),filename=`${remoteMusic?key:music?'music':effect?'effect':'catalog'}-${sha256.slice(0,20)}.${music?'m4a':effect?'wav':'png'}`;
  await writeFile(join(remoteMusic?cdnOutput:out,filename),bytes);
  const row={key,filename,sha256,sourceSha256,...(music?{playbackGain:1/musicHeadroom}:{})};
  if(remoteMusic)row.download={path:musicCdnDirectory+filename,bytes:bytes.length};
  entries.push(row);
  return bytes.length;
}
let total=0;
for(const key of musicNames)total+=await save(key,`assets/audio/sfx/music/${key}.ogg`,{music:true});
if(musicOnly){
  entries.push(...previous.filter(({key})=>!musicNames.includes(key)));
}else{
  for(const [key,maxSide,indexed] of catalogRepairs)total+=await save(key,`public/${key}`,{maxSide,indexed});
  for(const key of firstEffects)total+=await save(key,`public/${key}`,{effect:true});
}
await writeFile(manifest,JSON.stringify(entries,null,2)+'\n');
for(const entry of previous){
  if(!/^(?:music|catalog|effect)-[a-f0-9]{20}\.(?:m4a|png|wav)$/.test(entry.filename)||entries.some(row=>row.filename===entry.filename))continue;
  const old=join(out,entry.filename);
  const bytes=await readFile(old).catch(error=>{if(error.code!=='ENOENT')throw error;});
  if(bytes&&sha(bytes)===entry.sha256)await unlink(old);
}
console.log(JSON.stringify({files:entries.length,total,cdnOutput}));

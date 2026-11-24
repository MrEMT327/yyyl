import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

export const musicNames=['brain_fight','heart_fight','intestine_fight','liver_fight','lungs_fight','skin_fight','stomach_fight','heart_boss'];
export const catalogRepairs=[
  ['art/pilot-head-icons-v1/pilot-06.png',128],
  ['art/aircraft-ui-v1/pilot-07.webp',180],
  ['art/project-talents-v1/firepower.webp',128],
  ['art/pilot-head-icons-v1/pilot-07.png',112,true],
  ['art/pilot-head-icons-v1/pilot-09.png',112,true],
  ['art/pilot-head-icons-v1/pilot-10.png',112,true],
  ['art/audio-switch-v2/track-on.png',256,true],
  ['art/audio-switch-v2/track-off.png',256,true],
  ['art/audio-switch-v2/thumb.png',96,true],
];
export const firstEffects=['audio/pathogenic/shots/gun_shot.wav','audio/pathogenic/pickup_sound.wav','audio/pathogenic/shot_hit.wav'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

export async function loadThreeCompatMedia(inputs,h5){
  const folder=join(inputs,'three-compat-media');
  const entries=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
  const files=[],music={},images={},effects={};
  for(const {key,filename,sha256,sourceSha256} of entries){
    const isMusic=musicNames.includes(key),isEffect=firstEffects.includes(key);
    if(!isMusic&&!isEffect&&!catalogRepairs.some(([path])=>path===key))throw Error('微信兼容素材路径未登记 '+key);
    const sourcePath=isMusic?`assets/audio/sfx/music/${key}.ogg`:`public/${key}`;
    if(sha(await readFile(join(h5,sourcePath)))!==sourceSha256)throw Error('微信兼容素材的源文件已更新 '+key);
    if(!/^(?:music|catalog|effect)-[a-f0-9]{20}\.(?:m4a|png|wav)$/.test(filename))throw Error('无效兼容素材文件名 '+filename);
    const source=await readFile(join(folder,filename)),checksum=sha(source);
    if(checksum!==sha256||!filename.includes(checksum.slice(0,20))||
      !(isMusic?filename.endsWith('.m4a')&&source.toString('ascii',4,8)==='ftyp':isEffect?
        filename.endsWith('.wav')&&source.toString('ascii',0,4)==='RIFF':filename.endsWith('.png')&&source.readUInt32BE(0)===0x89504e47))
      throw Error('微信兼容素材校验失败 '+key);
    const routes=isMusic?music:isEffect?effects:images;
    if(Object.hasOwn(routes,key))throw Error('重复微信兼容素材 '+key);
    routes[key]=filename;files.push({filename,source});
  }
  if(Object.keys(music).length!==musicNames.length||Object.keys(images).length!==catalogRepairs.length||Object.keys(effects).length!==firstEffects.length)
    throw Error('微信兼容素材不完整');
  return {files,music,images,effects,bytes:files.reduce((total,row)=>total+row.source.length,0)};
}

import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {recruitPreview} from '../../../../pixigame/src/three/game-screen/recruit-preview-atlas.js';

const [ffmpeg='ffmpeg',output,source,dependencyDir]=process.argv.slice(2);
const require=dependencyDir?createRequire(join(resolve(dependencyDir),'package.json')):createRequire(import.meta.url);
const sharp=require('sharp');
const inputs=fileURLToPath(new URL('../build-inputs/three-textures/',import.meta.url));
const h5=resolve(source||fileURLToPath(new URL('../../../../pixigame/',import.meta.url)));
const directory=resolve(output||inputs);
const publicDirectory=join(h5,'public');
const manifestPath=join(directory,'manifest.json');
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const [manifest,art,sourcePortraits]=await Promise.all([
  json(manifestPath),json(join(h5,'src/three/game-screen/menu-art.json')),
  json(join(publicDirectory,'art/recruit-portraits-v2/manifest.json')),
]);
const portraits=new Map(sourcePortraits.entries.map(entry=>[entry.id,entry]));
assert.deepEqual([...portraits.keys()].sort(),[...recruitPreview.tiles.keys()].sort());
const items=[];
for(const [id,tiles] of recruitPreview.tiles){
  items.push({...tiles.portrait,path:'art/recruit-portraits-v2/'+portraits.get(id).file});
  items.push({...tiles.card,path:art['roster-'+id].slice(1)});
  items.push({...tiles.selected,path:art['roster-active-'+id].slice(1)});
}

const args=['-hide_banner','-loglevel','error','-filter_complex_threads','2'];
const sources=[];
for(const {path} of items){
  const input=join(publicDirectory,path);
  sources.push({path,sha256:sha(await readFile(input))});
  args.push('-threads','1','-i',input);
}
const padding=recruitPreview.padding;
const filters=items.map(({size},index)=>{
  const side=size-2*padding;
  return '['+index+':v]scale='+side+':'+side+':flags=lanczos,format=rgba,pad='+size+':'+size+':'+padding+':'+padding+
    ':color=black@0[t'+index+']';
});
const positions=items.map(({x,y})=>x+'_'+y).join('|');
filters.push(items.map((_,index)=>'[t'+index+']').join('')+
  'xstack=inputs='+items.length+':layout='+positions+':fill=black@0:shortest=1[out]');
const composed=execFileSync(ffmpeg,[...args,'-filter_complex',filters.join(';'),'-map','[out]','-frames:v','1',
  '-c:v','png','-pix_fmt','rgba','-f','image2pipe','pipe:1'],{maxBuffer:8*1024*1024});
const bytes=await sharp(composed).png({palette:true,dither:0,compressionLevel:9,effort:10}).toBuffer();
const info=await sharp(bytes).metadata();
assert.equal(info.format,'png');
assert(info.hasAlpha,'Recruit previews require alpha');
assert.equal(info.width,recruitPreview.width);
assert.equal(info.height,recruitPreview.height);
const file=sha(bytes).slice(0,20)+'.png';
await writeFile(join(directory,file),bytes);
manifest.recruitPreview={path:recruitPreview.path,file,layoutSha256:sha(JSON.stringify([...recruitPreview.tiles])),sources};
await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify({file,bytes:bytes.length,cells:items.length}));

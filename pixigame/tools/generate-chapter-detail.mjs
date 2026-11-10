import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';

// Reuse the combat appearance factories, recording their rest pose rather than
// shipping native/competitor portraits or a second hand-authored enemy design.
async function generate(){
const root=path.resolve(import.meta.dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const catalog=read('public/replica-battle/data/chapters.json');
const reviewOutput=process.argv.includes('--review-output')?process.argv[process.argv.indexOf('--review-output')+1]:null;
if(reviewOutput&&(!path.isAbsolute(reviewOutput)||/^c:/i.test(reviewOutput)))throw Error('Review output must be an absolute non-C path');
const chapters=catalog.chapters.map(c=>read(`public/replica-battle/data/${c.chapterFile}.json`));
const assets=read('public/replica-battle/data/assets.json');
const originalSprites={...assets.sprites};
assets.bossAnimation=read('public/replica-battle/data/boss-animation.json');
assets.bossAnimations=read('public/replica-battle/data/boss-animation-chapters.json');
for(const extra of Object.values(read('public/replica-battle/data/assets-chapters.json').chapters)){
  Object.assign(assets.prefabs,extra.prefabs);Object.assign(assets.sprites,extra.sprites);
}
const entities=Object.assign({},...chapters.map(c=>c.entities));

const specific=['scatter-gunboat','patrol-drone','heavy-scatter','elite-scatter','siege-boss'];
const others=fs.readdirSync(path.join(root,'replica-battle')).filter(f=>/^chapter\d+-enemy-art\.ts$/.test(f)).sort((a,b)=>parseInt(a.slice(7))-parseInt(b.slice(7)));
const files=[...specific.map(n=>n+'-art.ts'),...others];
const bundled=await build({stdin:{contents:files.map((f,i)=>`export * as a${i} from './replica-battle/${f}';`).join('\n'),resolveDir:root},bundle:true,format:'esm',platform:'node',write:false,logLevel:'silent'});
const modules=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const adapters=files.map((_f,i)=>modules['a'+i]);
const textures=new Map();
const scene={load:{image(key,url){textures.set(key,{url,frames:new Map()});}},textures:{exists:key=>textures.has(key),get(key){const t=textures.get(key);return{has:n=>t.frames.has(n),add(n,_i,x,y,width,height){t.frames.set(n,{x,y,width,height});}}}},add:{
  container(){return{list:[],add(img){this.list.push(...(Array.isArray(img)?img:[img]));return this;},setData(){return this;}};},
  image(x,y,key,frame){const t=textures.get(key),f=t.frames.get(frame);if(!f)throw Error(`Missing frame ${key}:${frame}`);return {x,y,key,frame:f,originX:.5,originY:.5,scaleX:1,scaleY:1,rotation:0,alpha:1,
    setOrigin(x,y=x){this.originX=x;this.originY=y;return this;},setPosition(x,y){this.x=x;this.y=y;return this;},setScale(x,y=x){this.scaleX=x;this.scaleY=y;return this;},setRotation(v){this.rotation=v;return this;},setAngle(v){this.rotation=v*Math.PI/180;return this;},setAlpha(v){this.alpha=v;return this;},setDisplaySize(w,h){this.scaleX=w/f.width;this.scaleY=h/f.height;return this;},setFlipX(v){this.flipX=v;return this;},setTint(){return this;},setBlendMode(){return this;},setDepth(){return this;},setData(){return this;}};}
}};
const ids=reviewOutput?Object.values(entities).filter(e=>[2,3,201].includes(e.type)).map(e=>e.id):[...new Set(chapters.flatMap(c=>c.chapter.parameters.PreviewMonsters||[]))];
const modelIds=[...new Set(ids.map(id=>entities[id]?.modelId).filter(Boolean))];
for(const adapter of adapters)for(const [name,fn] of Object.entries(adapter))if(name.startsWith('preload'))fn(scene,modelIds);
const enemyArt={};const missing=[];
for(const modelId of modelIds){
  const prefab=Object.values(assets.prefabs).find(p=>p.modelIds?.includes(modelId));
  let view;
  for(const adapter of adapters){const [name,create]=Object.entries(adapter).find(([n])=>/^create/.test(n))||[];if(!create)continue;
    view=create(scene,modelId,40,prefab,['createScatterGunboat','createPatrolDrone','createHeavyScatter','createEliteScatter'].includes(name)?assets.sprites:assets);if(view)break;
  }
  if(!view?.list.length){
      const r=prefab?.renderers?.find(r=>r.active&&r.enabled),sprite=originalSprites[r?.sprite];
      if(sprite?.url.includes("/owned-enemies/")){enemyArt[modelId]={image:"replica-battle/"+sprite.url};continue;}
      missing.push(modelId);continue;
  }
  const layers=view.list.filter(i=>i.alpha>0).map(i=>({url:'replica-battle/'+textures.get(i.key).url,size:(()=>{const b=fs.readFileSync(path.join(root,'public/replica-battle',textures.get(i.key).url));return[b.readUInt32BE(16),b.readUInt32BE(20)];})(),rect:[i.frame.x,i.frame.y,i.frame.width,i.frame.height],x:i.x,y:i.y,sx:i.scaleX*(i.flipX?-1:1),sy:i.scaleY,ox:i.originX,oy:i.originY,angle:i.rotation,alpha:i.alpha}));
  const points=layers.flatMap(l=>[[0,0],[1,0],[0,1],[1,1]].map(([u,v])=>{const x=(u-l.ox)*l.rect[2]*l.sx,y=(v-l.oy)*l.rect[3]*l.sy;return[l.x+x*Math.cos(l.angle)-y*Math.sin(l.angle),l.y+x*Math.sin(l.angle)+y*Math.cos(l.angle)];}));
  const x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1])),w=Math.max(...points.map(p=>p[0]))-x,h=Math.max(...points.map(p=>p[1]))-y;
  enemyArt[modelId]={bounds:[x,y,w,h],layers};
}
const names={120130:'仿生飞翼',120135:'散射炮艇',120137:'巡逻无人机',120143:'重型散射战机',122003:'精英散射战机',121002:'攻城战舰'};
if(missing.length)throw Error(`Missing project enemy artwork: ${missing.join(',')}`);
if(reviewOutput){
  const waveIds=new Set(chapters.flatMap(c=>c.enemyIds));
  const rows=modelIds.map(modelId=>{
    const variants=ids.filter(id=>entities[id].modelId===modelId).map(id=>({id,type:entities[id].type,tier:entities[id].type===3?'首领':entities[id].type===201?'精英':'普通',waveChapters:chapters.filter(c=>c.enemyIds.includes(id)).map(c=>c.chapter.id),dependencyChapters:chapters.filter(c=>c.entities[id]).map(c=>c.chapter.id)}));
    return{modelId,name:names[modelId]||`外观 ${modelId}`,variants,chapters:[...new Set(variants.flatMap(v=>v.waveChapters))].sort((a,b)=>a-b),art:enemyArt[modelId]};
  }).sort((a,b)=>a.chapters[0]-b.chapters[0]||a.modelId-b.modelId);
  const review={scope:'60 chapters: all enemy entity types 2, 3 and 201, including dependent/summoned entities; excludes player, drones, projectiles and pickups.',chapterCount:chapters.length,entityCount:ids.length,waveEntityCount:waveIds.size,modelCount:modelIds.length,rows};
  fs.mkdirSync(path.dirname(reviewOutput),{recursive:true});fs.writeFileSync(reviewOutput,JSON.stringify(review,null,2));
  console.log(JSON.stringify({reviewOutput,chapters:chapters.length,enemyEntities:ids.length,waveEnemies:waveIds.size,models:modelIds.length,rendered:Object.keys(enemyArt).length}));return;
}
const output={version:1,unresolvedPreviewIds:ids.filter(id=>!entities[id]),chapters:chapters.map(c=>({id:c.chapter.id,enemies:(c.chapter.parameters.PreviewMonsters||[]).filter(id=>entities[id]&&enemyArt[entities[id].modelId]).map(id=>{const row=entities[id];return{id,modelId:row.modelId,name:names[row.modelId]||(String(id).startsWith('34')?'关卡首领':String(id).startsWith('31')?'精英战机':'敌方战机')};}),drops:c.chapter.parameters.FinishReward||[]})),art:enemyArt};
const file=path.join(root,'src/replica/chapter-detail-catalog.json'),text=JSON.stringify(output);
if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==text)throw Error('Chapter detail catalog is stale. Run node tools/generate-chapter-detail.mjs');}
else fs.writeFileSync(file,text);
console.log(JSON.stringify({chapters:chapters.length,enemies:ids.length,models:modelIds.length,rendered:Object.keys(enemyArt).length,missing,missingEntities:ids.filter(id=>!entities[id])}));

}
generate().catch(e=>{console.error(e.message);process.exitCode=1;});

import * as T from 'three';
import {Container} from '../three/display.js';
import {createSpriteHitFeedback} from '../three/enemy-hit-feedback.js';
import {createEnemyFlightMotion} from './enemy-flight-motion.js';
import {ENEMY_FAMILIES,libraryFamilies,libraryEnemyId} from './enemy-library-lineup.js';

// Resolve against the page, not the bundled module under /assets/.
// An absolute URL also keeps dynamic imports and images on the same base
// when the game is deployed in a subdirectory with Vite base './'.
const base=new URL('art/enemies/',new URL(import.meta.env.BASE_URL,document.baseURI));
const assetUrl=path=>new URL(path,base).href;
let catalog,poseParts,modules;
const assets=new Map(),loading=new Map();
const remains=[];
const MAX_REMAINS=12;
const BOSS_ARMOR_KEYS=new Set(['wing','pod','tank','pump','slab','crown','fist','strut','ring']);

// Transfer only the visual. The defeated enemy has already left combat and
// awarded its rewards; these short-lived hull pieces never participate in AI.
export function retireLibraryEnemy(enemy,parent,reduced=false){
  if(reduced||!enemy.model?.libraryEnemy)return false;
  if(remains.length>=MAX_REMAINS){const oldest=remains.shift();oldest.holder.destroy({children:true});}
  const model=enemy.model,holder=new Container({label:'enemy-remains'});
  holder.position.set(enemy.x,enemy.y);holder.scale.copyFrom(enemy.view.scale);
  holder.rotation=enemy.view.rotation;
  model.removeFromParent();holder.addChild(model);parent.addChild(holder);
  model.beginDeath(enemy.elite?.42:.24);
  const velocity=model.flightVelocity;
  remains.push({holder,model,age:0,x:enemy.x,y:enemy.y,
    vx:Math.max(-150,Math.min(150,velocity.x))*.35,
    vy:Math.max(-150,Math.min(150,velocity.y))*.35});
  enemy.model=null;return true;
}
export function stepEnemyRemains(dt){
  if(dt<=0)return;
  for(let i=remains.length-1;i>=0;i--){
    const r=remains[i];r.age+=dt;
    const travel=(1-Math.exp(-r.age*5))/5;
    r.holder.position.set(r.x+r.vx*travel,r.y+r.vy*travel+r.age*r.age*14);
    if(r.model.updateDeath(dt)){r.holder.destroy({children:true});remains.splice(i,1);}
  }
}
export function clearEnemyRemains(){
  for(const r of remains)r.holder.destroy({children:true});
  remains.length=0;
}
function loadModules(){
  return modules ||= Promise.all([
    import(/* @vite-ignore */ assetUrl('catalog.js')),import(/* @vite-ignore */ assetUrl('poses.js')),
  ]).then(([data,poses])=>{catalog=new Map(data.enemies.map(e=>[e.id,e]));poseParts=poses.poseParts;})
    .catch(error=>{modules=null;throw error;});
}
async function loadAsset(id){
  if(assets.has(id))return;
  if(loading.has(id))return loading.get(id);
  const task=new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{
      const texture=new T.Texture(image);texture.colorSpace=T.SRGBColorSpace;
      texture.minFilter=T.LinearMipmapLinearFilter;texture.magFilter=T.LinearFilter;texture.needsUpdate=true;
      assets.set(id,{image,texture,users:0});resolve();
    };
    image.onerror=()=>reject(new Error('敌人素材加载失败：'+id));
    image.src=assetUrl(catalog.get(id).src);
  }).finally(()=>loading.delete(id));
  loading.set(id,task);return task;
}
export async function loadEnemyLibrary(chapterId){
  await loadModules();
  const ids=libraryFamilies(chapterId).flatMap(f=>ENEMY_FAMILIES[f]);
  await Promise.all(ids.map(loadAsset));
}
export function releaseUnusedEnemyLibrary(chapterId){
  const keep=new Set(libraryFamilies(chapterId).flatMap(f=>ENEMY_FAMILIES[f]));
  for(const [id,asset] of assets)if(!keep.has(id)&&asset.users===0){asset.texture.dispose();assets.delete(id);}
}
export function enemyLibrarySpec(chapterId,kind,elite=false,boss=false){
  return catalog?.get(libraryEnemyId(chapterId,kind,elite,boss));
}
export function enemyLibraryColor(chapterId,kind='scout',elite=false,boss=false){
  return Number.parseInt((enemyLibrarySpec(chapterId,kind,elite,boss)?.shotColor||'#ffce79').slice(1),16);
}

// One atlas and one dynamic mesh per enemy, not a Canvas texture uploaded each frame.
// Part motion is shared with the preview. Movement/collisions remain in main simulation.
export function createLibraryEnemy(spec,{radius,parentScale=1,motionSeed=0}={}){
  const asset=assets.get(spec?.id);if(!asset)return null;
  asset.users++;
  const view=new Container();view.libraryEnemy=true;view.directional=false;
  const geometry=new T.BufferGeometry(),capacity=384;
  for(const [name,size] of [['position',3],['uv',2],['color',3]])
    geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage));
  const material=new T.MeshBasicMaterial({map:asset.texture,vertexColors:true,transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide,toneMapped:false});
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;view.object3D.add(mesh);
  // Match central bodies to existing forgiving collision cores; decorative wings extend outside.
  const fit=(radius*2.8)/(spec.width*parentScale);
  const hitFeedback=createSpriteHitFeedback(material,radius/parentScale);
  const flightMotion=createEnemyFlightMotion(spec,motionSeed);
  let flight=flightMotion.update(0);
  let vertex=0,angle=0,filter='none',stack=[],lastTime=0,lastShot=-100;
  let recoil=0,recoilVelocity=0,death=null;
  // Cosmetic wear uses existing articulated armor; luminous cores and the
  // central hull stay readable. No phase, collision or material replacement.
  const wearsArmor=spec.tier==='Boss';
  let wear=0,wearPart=0,wearClock=0,wearInterval=1.4,wearSerial=0;
  let wearSocket=null,wearSpark=null;
  view.flightVelocity={x:0,y:0};
  const context={
    get filter(){return filter},set filter(value){filter=value},
    save(){stack.push([angle,filter])},restore(){[angle,filter]=stack.pop()},rotate(value){angle+=value},
  };
  const corners=[[0,0],[0,1],[1,0],[0,1],[1,1],[1,0]];
  function part(_ctx,_enemy,key,x,y,w,h,{flip=false,angle:rotation=0,pivotX=.5,pivotY=.5}={}){
    // The preview's old bone dart exhaust is deliberately omitted in combat.
    if(spec.id==='bone-dart'&&key==='engine')return;
    const region=spec.regions[key],q=asset.image.naturalWidth/1280;
    // Appendages trail the hull slightly on turns; central body and muzzle
    // remain stable. This reuses the atlas mesh, without extra draw calls.
    const appendage=/wing|claw|limb|arm|shield|slab|shard|fist|crown/.test(key);
    const partAngle=rotation+(appendage?flight.lag*.45:0);
    const ca=Math.cos(angle),sa=Math.sin(angle),cr=Math.cos(partAngle),sr=Math.sin(partAngle);
    const armorIndex=wearsArmor&&BOSS_ARMOR_KEYS.has(key)?wearPart++:-1;
    // Only the first and third armor pieces: asymmetric local damage rather
    // than turning the entire boss dark. The preview never supplies HP.
    const worn=armorIndex===0||armorIndex===2;
    const brightness=Number(/brightness\(([\d.]+)\)/.exec(filter)?.[1]||1)*(worn?1-wear:1);
    for(const [u,v] of corners){
      const px=(u-pivotX)*w*(flip?-1:1),py=(v-pivotY)*h;
      const rx=x+px*cr-py*sr,ry=y+px*sr+py*cr;
      const localX=(rx*ca-ry*sa)*fit,localY=(rx*sa+ry*ca)*fit;
      // Small affine lean suggests depth without changing the top-down camera.
      geometry.attributes.position.setXYZ(vertex,localX*(1-Math.abs(flight.bank)*.12),localY+localX*flight.bank*.12,0);
      geometry.attributes.uv.setXY(vertex,(region[0]+u*region[2])*q/asset.image.naturalWidth,1-(region[1]+v*region[3])*q/asset.image.naturalHeight);
      geometry.attributes.color.setXYZ(vertex,brightness,brightness,brightness);vertex++;
    }
    if(worn&&(!wearSocket||wearSerial%2===1)){
      // Ring/strut centers lie underneath the luminous core; attach their
      // sparse sparks to the visible rim instead of the empty atlas center.
      const px=((key==='ring'?.18:.5)-pivotX)*w*(flip?-1:1);
      const py=((key==='strut'?.2:.5)-pivotY)*h;
      const rx=x+px*cr-py*sr,ry=y+px*sr+py*cr;
      const localX=(rx*ca-ry*sa)*fit,localY=(rx*sa+ry*ca)*fit;
      wearSocket={x:localX*(1-Math.abs(flight.bank)*.12),y:localY+localX*flight.bank*.12};
    }
  }
  view.fire=()=>{
    if(death||lastTime-lastShot<.075)return;
    lastShot=lastTime;recoilVelocity=Math.min(28,recoilVelocity+24);
  };
  view.reactToHit=(profile,angle)=>hitFeedback.trigger(profile,angle);
  view.consumeWearSpark=()=>{const spark=wearSpark;wearSpark=null;return spark;};
  view.updateEnemy=(time,{charging=false,motionDt=Math.max(0,time-lastTime),vx=0,vy=0,
    healthRatio,wearDt=motionDt,wearActive=false,reducedMotion=false}={})=>{
    if(death)return;
    const hasHealth=wearsArmor&&Number.isFinite(healthRatio);
    const wearStep=Math.max(0,Math.min(.05,wearDt));
    const targetWear=hasHealth?Math.max(0,Math.min(1,(.7-healthRatio)/.55))*.32:0;
    wear=hasHealth?wear+(targetWear-wear)*(1-Math.exp(-8*wearStep)):0;
    wearPart=0;wearSocket=null;wearSpark=null;
    flight=flightMotion.update(motionDt,vx,vy,charging);
    view.flightVelocity.x=vx;view.flightVelocity.y=vy;
    lastTime=time;vertex=0;angle=0;filter='none';stack.length=0;
    // Critically damped recoil: fast kick, slower return, bounded under bursts.
    // Advance on the same status-scaled clock as flight, including stun/pause.
    const step=Math.max(0,Math.min(.05,motionDt)),damping=spec.tier==='Boss'?11:15;
    const spring=recoilVelocity+damping*recoil,decay=Math.exp(-damping*step);
    recoil=Math.min(1,(recoil+spring*step)*decay);
    recoilVelocity=(recoilVelocity-damping*spring*step)*decay;
    const charge=flight.charge*(.73+.08*Math.sin(time*5))*(1-recoil*.65);
    mesh.rotation.z=flight.angle;
    mesh.position.set(flight.x/parentScale,(flight.y-recoil*(spec.tier==='小怪'?1.2:2))/parentScale,0);
    poseParts(context,spec,flight.time,charge,recoil,true,part);
    if(hasHealth&&wearActive&&!reducedMotion&&healthRatio>0&&healthRatio<.4&&wearSocket){
      wearClock+=wearStep;
      if(wearClock>=wearInterval){
        const c=Math.cos(mesh.rotation.z),s=Math.sin(mesh.rotation.z);
        wearSpark={x:mesh.position.x+wearSocket.x*c-wearSocket.y*s,
          y:mesh.position.y+wearSocket.x*s+wearSocket.y*c,color:0xffbd78};
        wearClock=0;wearSerial++;wearInterval=1.2+(wearSerial%4)*.2;
      }
    }else wearClock=0;
    geometry.setDrawRange(0,vertex);
    for(const attribute of Object.values(geometry.attributes)){
      attribute.clearUpdateRanges();attribute.addUpdateRange(0,vertex*attribute.itemSize);attribute.needsUpdate=true;
    }
    hitFeedback.update(time);
  };
  view.beginDeath=(life=.3)=>{
    if(death)return;
    // Capture the current articulated pose, not a reset/default sprite.
    const source=geometry.attributes.position.array.slice(0,vertex*3),pieces=[];
    const colors=wear>0?geometry.attributes.color.array.slice(0,vertex*3):null;
    for(let start=0;start<vertex;start+=6){
      let x=0,y=0;
      for(let i=start;i<start+6;i++){x+=source[i*3];y+=source[i*3+1];}
      x/=6;y/=6;
      const a=Math.hypot(x,y)>1?Math.atan2(y,x):start*2.399;
      pieces.push({start,x,y,dx:Math.cos(a),dy:Math.sin(a),spin:(start%12?-1:1)*.55});
    }
    death={source,colors,pieces,age:0,life};
    wearSpark=null;wearSocket=null;wearClock=0;
    hitFeedback.update(lastTime+1);
  };
  view.updateDeath=dt=>{
    if(!death)return false;
    death.age+=Math.max(0,dt);
    const t=Math.min(1,death.age/death.life),boss=spec.tier==='Boss';
    const separation=(boss?12:radius*.48)*(1-Math.exp(-t*3))/parentScale;
    const position=geometry.attributes.position;
    for(const p of death.pieces){
      const angle=p.spin*t*(boss?.25:1),c=Math.cos(angle),s=Math.sin(angle);
      for(let i=p.start;i<p.start+6;i++){
        const x=death.source[i*3]-p.x,y=death.source[i*3+1]-p.y;
        position.setXYZ(i,p.x+x*c-y*s+p.dx*separation,p.y+x*s+y*c+p.dy*separation,0);
        const shade=1-t*.65;
        geometry.attributes.color.setXYZ(i,(death.colors?.[i*3]??1)*shade,
          (death.colors?.[i*3+1]??1)*shade,(death.colors?.[i*3+2]??1)*shade);
      }
    }
    position.clearUpdateRanges();position.addUpdateRange(0,vertex*3);position.needsUpdate=true;
    geometry.attributes.color.needsUpdate=true;
    view.alpha=Math.max(0,1-Math.max(0,t-.2)/.8);
    return t>=1;
  };
  view._disposeVisuals=()=>{geometry.dispose();material.dispose();asset.users--;};
  view.updateEnemy(0);return view;
}

import * as T from 'three';

// Shared atlases, two draw calls regardless of the number of allied drones.
// Coordinates are the transparent part bounds in the original 1254px images.
const PARTS = {
  drone: {body:[184,44,313,617],wing:[713,212,447,389],core:[168,814,357,329],plate:[819,726,213,451]},
  mother: {body:[24,46,619,701],wing:[644,222,599,394],core:[124,812,389,373],turret:[785,788,325,403]},
};
const textures = new Map();
let loading;
export const droneSpriteAssets = {ready:false,error:null,source:'layered sprite / weapon-drones-v1'};

function loadAtlas(kind) {
  return new Promise((resolve,reject) => {
    const image = new Image();
    const timer = setTimeout(() => finish(new Error(`无人机贴图加载超时：${kind}`)), 10000);
    function finish(error) {
      clearTimeout(timer); image.onload=null; image.onerror=null;
      if (error) { reject(error); return; }
      const texture = new T.Texture(image);
      texture.colorSpace=T.SRGBColorSpace;
      texture.minFilter=T.LinearMipmapLinearFilter; texture.magFilter=T.LinearFilter;
      texture.needsUpdate=true; texture.name=`Allied ${kind} parts`;
      resolve([kind,texture]);
    }
    image.onload=()=>finish();
    image.onerror=()=>finish(new Error(`无人机贴图加载失败：${kind}`));
    image.src=new URL(`art/weapon-drones-v1/${kind}-parts-v1.png`,new URL(import.meta.env.BASE_URL,document.baseURI)).href;
  });
}

export function loadDroneSpriteAssets() {
  if (droneSpriteAssets.ready) return Promise.resolve(true);
  if (loading) return loading;
  loading=Promise.allSettled(Object.keys(PARTS).map(loadAtlas)).then(results => {
    const failed=results.find(result=>result.status==='rejected');
    if (failed) {
      for (const result of results) if (result.status==='fulfilled') result.value[1].dispose();
      droneSpriteAssets.error=String(failed.reason);
      console.warn('[drone sprites] 使用原模型回退',droneSpriteAssets.error);
      return false;
    }
    for (const result of results) textures.set(...result.value);
    Object.assign(droneSpriteAssets,{ready:true,error:null});
    return true;
  }).finally(()=>{loading=null;});
  return loading;
}

const CORNERS=[[0,0],[0,1],[1,0],[0,1],[1,1],[1,0]];
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
function phaseFor(id) {
  let seed=0;
  for (const letter of String(id)) seed=(seed*31+letter.charCodeAt(0))>>>0;
  return (seed%628)/100;
}

class AtlasBatch {
  constructor(root,kind,capacity) {
    this.kind=kind; this.count=0;
    const geometry=this.geometry=new T.BufferGeometry();
    const vertices=capacity*12*6;
    for (const [name,size] of [['position',3],['uv',2],['color',4]]) {
      geometry.setAttribute(name,new T.BufferAttribute(new Float32Array(vertices*size),size).setUsage(T.DynamicDrawUsage));
    }
    geometry.boundingBox=new T.Box3();
    geometry.setDrawRange(0,0);
    const material=this.material=new T.MeshBasicMaterial({map:textures.get(kind),vertexColors:true,
      transparent:true,depthWrite:false,depthTest:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false});
    this.mesh=new T.Mesh(geometry,material);
    this.mesh.name=`Allied layered ${kind}`; this.mesh.frustumCulled=false;
    this.mesh.userData.bloom=false; this.mesh.visible=false;
    root.add(this.mesh);
  }
  begin() { this.count=0; this.geometry.boundingBox.makeEmpty(); }
  part(pose,key,x,y,width,height,{pivotX=.5,pivotY=.5,flip=false,angle=0,shade=1,alpha=1,depth=0}={}) {
    const {position,uv,color}=this.geometry.attributes;
    if (this.count+6>position.count) return;
    const region=PARTS[this.kind][key],texture=textures.get(this.kind);
    const c=Math.cos(angle),s=Math.sin(angle),rootC=Math.cos(pose.angle),rootS=Math.sin(pose.angle);
    const bounds=this.geometry.boundingBox;
    for (const [u,v] of CORNERS) {
      const px=(u-pivotX)*width*(flip?-1:1),py=(v-pivotY)*height;
      const lx=x+px*c-py*s,ly=y+px*s+py*c;
      const bankX=lx*(1-Math.abs(pose.bank)*.25)+pose.bank*depth;
      const bankY=ly+lx*pose.bank*.5;
      const wx=pose.x+(bankX*rootC-bankY*rootS)*pose.scale;
      const wy=pose.y+(bankX*rootS+bankY*rootC)*pose.scale;
      const at=this.count++;
      position.setXYZ(at,wx,wy,8);
      uv.setXY(at,(region[0]+u*region[2])/texture.image.width,1-(region[1]+v*region[3])/texture.image.height);
      color.setXYZW(at,shade,shade,shade,pose.alpha*alpha);
      bounds.min.x=Math.min(bounds.min.x,wx); bounds.min.y=Math.min(bounds.min.y,wy);
      bounds.max.x=Math.max(bounds.max.x,wx); bounds.max.y=Math.max(bounds.max.y,wy);
    }
    bounds.min.z=8; bounds.max.z=8;
  }
  finish() {
    this.geometry.setDrawRange(0,this.count); this.mesh.visible=this.count>0;
    for (const attribute of Object.values(this.geometry.attributes)) {
      attribute.clearUpdateRanges(); attribute.addUpdateRange(0,this.count*attribute.itemSize); attribute.needsUpdate=true;
    }
  }
  dispose() { this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose(); }
}

export class DroneSpriteModels {
  constructor(root,capacity=32) {
    // Reserve the body layer before CommonWeaponRenderer adds its light pass;
    // lazily created atlas meshes must not jump above muzzle/HP feedback.
    this.root=new T.Group(); this.root.name='Allied layered drone bodies'; root.add(this.root);
    this.capacity=capacity; this.count=0;
    this.batches=new Map(); this.poses=new Map(); this.frame=0; this.time=null;
  }
  get meshes() { return [...this.batches.values()].map(batch=>batch.mesh); }
  begin(time) {
    if (this.time!==null&&time<this.time) this.poses.clear();
    this.dt=this.time===null?0:clamp(time-this.time,0,.05);
    this.time=time; this.frame++; this.count=0;
    this.reduced=Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
    for (const batch of this.batches.values()) batch.begin();
  }
  add(v,scale=1,angle=v.angle||0) {
    if (!droneSpriteAssets.ready) return false;
    // The real small-drone limit is 12 plus one mother; this is only a generous
    // display safety bound. Never alter or remove the simulation entities.
    if (this.count>=this.capacity) return true;
    const kind=v.mother?'mother':'drone',id=v.id??`preview-${kind}`;
    let batch=this.batches.get(kind);
    if (!batch) { batch=new AtlasBatch(this.root,kind,this.capacity); this.batches.set(kind,batch); }
    let pose=this.poses.get(id);
    if (!pose||(v.age??1)<pose.age) {
      pose={angle,bank:0,phase:phaseFor(id),age:v.age??1,previousX:v.x,previousY:v.y,frame:this.frame};
      this.poses.set(id,pose);
    }
    const delta=Math.atan2(Math.sin(angle-pose.angle),Math.cos(angle-pose.angle));
    if (this.reduced) { pose.angle=angle; pose.bank=0; }
    else if (this.dt>0) {
      const sideSpeed=((v.x-pose.previousX)*Math.cos(angle)+(v.y-pose.previousY)*Math.sin(angle))/this.dt;
      const target=clamp(delta*.12+sideSpeed*.00035,-.12,.12);
      pose.bank+=(target-pose.bank)*(1-Math.exp(-8*this.dt));
      pose.angle+=delta*(1-Math.exp(-(v.mother?12:18)*this.dt));
    }
    pose.frame=this.frame; pose.age=v.age??1; pose.previousX=v.x; pose.previousY=v.y;
    const wave=this.reduced?0:Math.sin(pose.age*(v.mother?1.7:2.2)+pose.phase);
    Object.assign(pose,{x:v.x,y:v.y+wave*(v.mother?.22:.35)*scale,scale,
      alpha:clamp(v.alpha??1,0,1)*(v.darker?.72:1)});
    const deploy=this.reduced?1:smooth(pose.age/.22);
    const part=(...args)=>batch.part(pose,...args);
    if (v.mother) {
      // The carrier is broader, not a uniformly enlarged small drone. These
      // dimensions retain the previous mother's approximate screen footprint.
      part('body',0,1.1,30,34,{shade:.32,alpha:.65});
      for (const side of [-1,1]) part('wing',side*(9.3+deploy*.7),2,9,5.92,
        {pivotX:.82,flip:side>0,angle:side*(pose.bank*.18+wave*.012),shade:side<0?.92:.83});
      part('body',0,0,30,34);
      part('core',0,-3.6,7.3,7,{depth:3});
      for (const side of [-1,1]) part('core',side*5.9,6.3,6.7,6.42,{depth:2,shade:.94});
      for (const x of [-5.6,0,5.6]) part('turret',x,-7.2,3.5,4.34,{depth:2});
    } else {
      part('body',0,.8,13,25.6,{shade:.3,alpha:.65});
      for (const side of [-1,1]) part('wing',side*(2.8+deploy*2.2),.7,12,10.44,
        {pivotX:.84,flip:side>0,angle:side*(pose.bank*.22+wave*.018),shade:side<0?.94:.86});
      part('body',0,0,13,25.6);
      part('plate',0,8.1,3.8,8.05,{depth:2});
      part('core',0,2.3,6.25,5.76,{depth:3});
    }
    this.count++;
    return true;
  }
  finish() {
    for (const batch of this.batches.values()) batch.finish();
    for (const [id,pose] of this.poses) if (pose.frame!==this.frame) this.poses.delete(id);
  }
  snapshot() { return {layeredDrones:this.count,droneSpriteAssets:{...droneSpriteAssets},droneSpriteBatches:this.meshes.filter(mesh=>mesh.visible).length}; }
  dispose() { for (const batch of this.batches.values()) batch.dispose(); this.batches.clear(); this.poses.clear(); this.root.removeFromParent(); }
}

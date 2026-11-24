import {LinearFilter,NoColorSpace,OneFactor,Texture} from 'three';
import {loadArtwork} from './image-loading.js';
import artwork from './weather-art.json';
import {cloudAssetBase} from '../../ui/cloud-asset-base.js';

export function createWeatherArt(stage,theme){
  const entries=new Map(),pending=[];
  const root=new URL(cloudAssetBase,document.baseURI);
  let disposed=false;
  function add(key,path){
    pending.push(loadArtwork(new URL(path.replace(/^\//,''),root).href).then(image=>{
      if(disposed)return;
      const texture=new Texture(image);texture.needsUpdate=true;
      texture.flipY=false;texture.colorSpace=NoColorSpace;texture.generateMipmaps=false;
      texture.minFilter=texture.magFilter=LinearFilter;entries.set(key,texture);
    },cause=>{throw new Error('天气贴图读取失败 '+path,{cause});}));
  }
  for(const [name,url] of Object.entries(artwork.washes))add('wash-'+name,url);
  add('flash',artwork.flash);add('bank','art/stage1-anime-v8/cloud-bank.png');add('cloud','art/stage1-anime-v8/cloud-large-b.png');
  for(const [name,url] of Object.entries(artwork.lamps))add(name,url);
  if(theme==='city'||!theme)for(const [name,art] of Object.entries(artwork.city)){add(name+'-core',art.core);add(name+'-halo',art.halo);}
  if(theme==='volcano'||!theme)for(const [name,art] of Object.entries(artwork.lava)){add(name+'-core',art.core);add(name+'-halo',art.halo);}
  const nodes=[];
  function sprite(depth,additive=false){
    const mesh=stage.makeSprite(stage.white,depth);mesh.visible=false;nodes.push(mesh);
    if(additive)mesh.material.blendDst=OneFactor;
    return mesh;
  }
  function place(mesh,key,x,y,w,h,tint=0xffffff,opacity=1,angle=0){
    const texture=entries.get(key);mesh.visible=Boolean(texture&&opacity>0);
    if(!mesh.visible)return;
    mesh.position.set(x,y,0);mesh.rotation.z=angle;
    mesh.material.uniforms.art.value=texture;mesh.material.uniforms.size.value.set(w,h);
    mesh.material.uniforms.opacity.value=opacity;stage.tint(mesh,tint);
  }
  return {ready:Promise.all(pending),sprite,place,lava:artwork.lava,
    dispose(){disposed=true;for(const t of entries.values())t.dispose();for(const n of nodes)stage.remove(n);}
  };
}

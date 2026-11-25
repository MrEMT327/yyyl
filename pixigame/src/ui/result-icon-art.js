import {LinearMipmapLinearFilter} from 'three';
import {loadCombatUiTexture} from './combat-art.js';
import {upgradeIconLayout} from './upgrade-icon-layout.js';

const textures=new Map();
let owners=0;
export function retainResultTextures(){
  owners++;let released=false;
  return ()=>{
    if(released)return;
    released=true;if(--owners)return;
    for(const texture of textures.values()){texture.dispose();texture.image=null;}
    textures.clear();
  };
}
export function resultTexture(url,fit=false,priority,onReady){
  let texture=textures.get(url);
  if(!texture){
    texture=loadCombatUiTexture(url,fit,priority,onReady&&((art)=>{
      if(textures.get(url)===art)onReady(art);
    }));
    textures.set(url,texture);
  }
  if(fit)texture.userData.inventoryIcon=true;
  if(fit&&!texture.generateMipmaps){
    // Average the source pixels when a fitted reward or weapon is drawn small.
    texture.generateMipmaps=true;
    texture.minFilter=LinearMipmapLinearFilter;
    if(texture.image)texture.needsUpdate=true;
  }
  if(texture.image?.width)onReady?.(texture);
  return texture;
}

export function icon(surface,source,x,y,width,height,fit=true){
  const texture=source?.isTexture?source:resultTexture(source,fit);
  const mesh=surface.image(texture,x,y,width,height);
  if(!fit)return mesh;
  let fittedImage;
  mesh.onBeforeRender=()=>{
    const image=texture.image;
    if(!image?.width||!image?.height||fittedImage===image)return;
    fittedImage=image;
    const layout=upgradeIconLayout(texture,{x,y,width,height});
    mesh.position.set(layout.x+layout.width/2,layout.y+layout.height/2,0);
    mesh.scale.set(layout.width,-layout.height,1);
    mesh.updateMatrixWorld();
    if(layout.crop){
      const coordinates=mesh.geometry.attributes.uv,{x,y,width,height}=layout.crop;
      for(let index=0;index<coordinates.count;index++)coordinates.setXY(index,
        x+coordinates.getX(index)*width,1-y-(1-coordinates.getY(index))*height);
      coordinates.needsUpdate=true;
    }
  };
  return mesh;
}

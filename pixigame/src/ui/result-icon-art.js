import {LinearFilter,LinearMipmapLinearFilter,SRGBColorSpace} from 'three';
import {artworkTexture} from '../three/game-screen/image-loading.js';
import {upgradeIconLayout} from './upgrade-icon-layout.js';

const textures=new Map();
export function resultTexture(url,fit=false){
  let texture=textures.get(url);
  if(!texture){
    texture=artworkTexture(url,undefined,()=>{});
    texture.colorSpace=SRGBColorSpace;
    texture.generateMipmaps=false;
    texture.minFilter=LinearFilter;
    textures.set(url,texture);
  }
  if(fit&&!texture.generateMipmaps){
    // Average the source pixels when a fitted reward or weapon is drawn small.
    texture.userData.inventoryIcon=true;
    texture.generateMipmaps=true;
    texture.minFilter=LinearMipmapLinearFilter;
    if(texture.image)texture.needsUpdate=true;
  }
  return texture;
}

export function icon(surface,url,x,y,width,height,fit=true){
  const texture=resultTexture(url,fit);
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

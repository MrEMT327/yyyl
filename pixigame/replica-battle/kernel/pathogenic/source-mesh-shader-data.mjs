import {inverseMatrix,matrix3,matrix4} from './pathogenic-geometry.mjs';
const IDENTITY=[1,0,0,1,0,0];
export function createSourceMeshShaderData(){
 const data={time:0,projectilePalette:undefined,color:[1,1,1,1],screenToLocal:Array(9).fill(0),localToScreen:Array(9).fill(0),modelMatrix:Array(16).fill(0),
  textureSize:[0,0],uvRect:[0,0,1,1],mainPremultiplied:false,mainRepeat:false,uniforms:{},textures:{},lighting:'unlit',
  compatibility:{renderer:'compatibility',lightCount:0,directionalLightCount:0}};
 Object.defineProperty(data,'inverseScratch',{value:Array(6).fill(0)});return data;
}
export function updateSourceMeshShaderData(data,item,source,time,line,gain,opacity,palette,installed,resolved){
 data.time=time;data.projectilePalette=palette;
 for(let i=0;i<3;i++)data.color[i]=line?gain:item.color[i];data.color[3]=line?opacity:item.color[3]*opacity;
 const m=item.matrix??IDENTITY;matrix3(inverseMatrix(m,data.inverseScratch),data.screenToLocal);matrix3(m,data.localToScreen);matrix4(m,data.modelMatrix);
 const w=source.width,h=source.height,crop=line?null:item.texture?.crop;
 data.textureSize[0]=w;data.textureSize[1]=h;
 data.uvRect[0]=(crop?crop[0]:0)/w;data.uvRect[1]=(crop?crop[1]:0)/h;data.uvRect[2]=(crop?crop[2]:w)/w;data.uvRect[3]=(crop?crop[3]:h)/h;
 data.mainPremultiplied=installed.binding.premultiplied;data.mainRepeat=item.textureRepeat===2;
 data.uniforms=resolved.uniforms;data.textures=resolved.textures;return data;
}

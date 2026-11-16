import {Vector3} from 'three';

const emitters=new Set(['river','pool','b','fissures','vent','a','shelf','cascade','sulfur','geothermal','extraction']);
const center=new Vector3(),edge=new Vector3(),top=new Vector3();

// Project the exact painted sprite, including its alpha padding. Both passes
// use the same transform as the terrain; there is no separate scroll clock.
export function sampleVolcanoNightLandmarks(record,camera,width,height){
  if(record.definition?.sceneId!=='campaign-volcano-3-modules-v2')return [];
  const lights=[];
  for(const {sprite,row}of record.instances??[]){
    if(!sprite.visible||!emitters.has(row.asset))continue;
    const sourceImage=sprite.material.map?.image;if(!sourceImage)continue;
    sprite.updateWorldMatrix(true,false);
    center.set(0,0,0);edge.set(1,0,0);top.set(0,0,1);
    for(const p of [center,edge,top])p.applyMatrix4(sprite.matrixWorld).project(camera);
    const x=(center.x*.5+.5)*width,y=(.5-center.y*.5)*height;
    const dx=(edge.x-center.x)*width/2,dy=-(edge.y-center.y)*height/2;
    const coreWidth=Math.hypot(dx,dy),coreHeight=Math.hypot((top.x-center.x)*width/2,(top.y-center.y)*height/2);
    const radius=(coreWidth+coreHeight)/2;
    if(x+radius<0||x-radius>width||y+radius<0||y-radius>height)continue;
    lights.push({x,y,id:row.id,shape:'lava-surface',emissionAsset:row.asset,sourceImage,
      coreWidth,coreHeight,angle:Math.atan2(dy,dx),time:record.ground?.material?.uniforms?.time?.value??0,strength:row.asset==='river'?.62:row.asset==='pool'?.88:row.asset==='cascade'?.80:row.kind==='facility'?.42:row.asset==='sulfur'?.42:row.asset==='a'||row.asset==='shelf'?.48:.72});
  }
  return lights;
}

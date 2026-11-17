import {Vector3} from 'three';
import {CITY_NIGHT_WINDOWS,CITY_STREET_LIGHTS,CITY_WINDOW_SOURCE_SIZE} from './city-night-lights.js';

const center=new Vector3(),edge=new Vector3(),top=new Vector3();
const windowBounds=Object.fromEntries(Object.entries(CITY_NIGHT_WINDOWS).map(([asset,panes])=>[asset,[
  Math.min(...panes.map(p=>p[0]))/CITY_WINDOW_SOURCE_SIZE,
  Math.min(...panes.map(p=>p[1]))/CITY_WINDOW_SOURCE_SIZE,
  Math.max(...panes.map(p=>p[0]+p[2]))/CITY_WINDOW_SOURCE_SIZE,
  Math.max(...panes.map(p=>p[1]+p[3]))/CITY_WINDOW_SOURCE_SIZE,
]]));
function screenPoint(sprite,u,v,camera,width,height){
  center.set(u-.5,0,v-.5).applyMatrix4(sprite.matrixWorld).project(camera);
  return {x:(center.x*.5+.5)*width,y:(.5-center.y*.5)*height};
}

export function sampleCityNightLandmarks(record,camera,width,height){
  const windows=[],streets=[];
  for(const {sprite,row} of record.instances??[]){
    if(!sprite.visible||!sprite.material.map)continue;
    if(row.kind==='city-building'&&CITY_NIGHT_WINDOWS[row.asset]){
      sprite.updateWorldMatrix(true,false);
      const p=screenPoint(sprite,.5,.5,camera,width,height);
      edge.set(1,0,0).applyMatrix4(sprite.matrixWorld).project(camera);
      top.set(0,0,1).applyMatrix4(sprite.matrixWorld).project(camera);
      const dx=(edge.x-center.x)*width/2,dy=-(edge.y-center.y)*height/2;
      const coreWidth=Math.hypot(dx,dy),coreHeight=Math.hypot((top.x-center.x)*width/2,(top.y-center.y)*height/2);
      // Cull the glass, not the transparent padding around the building art.
      const [left,up,right,down]=windowBounds[row.asset];
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const [u,v]of [[left,up],[right,up],[right,down],[left,down]]){
        const q=screenPoint(sprite,u,v,camera,width,height);
        minX=Math.min(minX,q.x);maxX=Math.max(maxX,q.x);minY=Math.min(minY,q.y);maxY=Math.max(maxY,q.y);
      }
      if(maxX< -16||minX>width+16||maxY< -16||minY>height+16)continue;
      windows.push({...p,id:row.id,shape:'building-windows',windowAsset:row.asset,coreWidth,coreHeight,
        angle:Math.atan2(dy,dx),size:12,strength:.96,color:row.asset==='relay'?0xa9dcff:0xffce80});
    }else if(row.kind==='city-ground'){
      const anchors=CITY_STREET_LIGHTS[row.template];
      if(!anchors?.length)continue;
      sprite.updateWorldMatrix(true,false);
      for(const [u,v,du=0,dv=0]of anchors){
        const p=screenPoint(sprite,u,v,camera,width,height);
        const length=Math.hypot(du,dv)||1,nx=du/length,ny=dv/length;
        const pool=screenPoint(sprite,u+nx*.016,v+ny*.016,camera,width,height);
        const along=screenPoint(sprite,u+nx*.12,v+ny*.12,camera,width,height);
        const across=screenPoint(sprite,u-ny*.085,v+nx*.085,camera,width,height);
        const poolWidth=Math.hypot(along.x-p.x,along.y-p.y),poolHeight=Math.hypot(across.x-p.x,across.y-p.y);
        const margin=Math.max(poolWidth,poolHeight)*.5;
        if(pool.x<-margin||pool.x>width+margin||pool.y<-margin||pool.y>height+margin)continue;
        streets.push({...p,shape:'streetlamp',size:13,strength:.86,color:0xffd694,
          poolX:pool.x,poolY:pool.y,poolWidth,poolHeight,poolAngle:Math.atan2(along.y-p.y,along.x-p.x)});
      }
    }
  }
  // One pair of cached stamps covers every window of a building, leaving the
  // existing 24-landmark budget available for both buildings and street lamps.
  return [...windows,...streets];
}

import {Vector3} from 'three';

// Centers and pane sizes on the original 1024px icefield artwork. Only the
// painted igloo entrances and cabin windows emit; roofs and snow stay dark.
const anchors={
  iglooCamp:[[603,382,18,20],[673,440,16,19],[684,528,17,20]],
  researchCamp:[[419,399,10,8],[446,387,12,8],[483,451,10,8],[520,465,11,9],[559,459,12,9]],
};
const center=new Vector3(),edge=new Vector3(),top=new Vector3();

export function sampleIcefieldNightLandmarks(record,camera,width,height){
  if(!record.definition?.sceneId?.startsWith('campaign-ice-'))return [];
  const lights=[];
  for(const {sprite,row}of record.instances??[]){
    if(!sprite.visible||!sprite.material.map)continue;
    const windows=anchors[row.asset];
    if(!windows)continue;
    sprite.updateWorldMatrix(true,false);
    for(const [i,[px,py,pw,ph]]of windows.entries()){
      center.set(px/1024-.5,0,py/1024-.5);
      edge.set((px+pw)/1024-.5,0,py/1024-.5);
      top.set(px/1024-.5,0,(py+ph)/1024-.5);
      for(const point of [center,edge,top])point.applyMatrix4(sprite.matrixWorld).project(camera);
      const x=(center.x*.5+.5)*width,y=(.5-center.y*.5)*height;
      const coreWidth=Math.hypot((edge.x-center.x)*width/2,(edge.y-center.y)*height/2);
      const coreHeight=Math.hypot((top.x-center.x)*width/2,(top.y-center.y)*height/2);
      const size=Math.min(18,Math.max(7,Math.max(coreWidth,coreHeight)*2.2));
      if(!Number.isFinite(x+y+coreWidth+coreHeight)||x< -size||x>width+size||y< -size||y>height+size)continue;
      lights.push({id:`${row.id}-light-${i}`,x,y,shape:'window',coreWidth,coreHeight,size,strength:.72,color:0xffc278});
    }
  }
  return lights;
}

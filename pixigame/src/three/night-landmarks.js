import {Vector3} from 'three';

// Normalized TOP-LEFT pixel locations on our own island artwork. Each point
// remains attached to an actual painted window, pier light or runway marker.
const anchors=Object.freeze({
  'harbor-east':[[.169,.635,12],[.281,.607,11],[.431,.645,10],[.559,.287,11]],
  'harbor-west':[[.826,.597,12],[.672,.689,11],[.578,.635,9]],
  'airfield-west':[[.548,.330,11],[.551,.402,9],[.551,.497,9],[.656,.256,8],[.694,.642,8]],
  'radar-east':[[.558,.412,10],[.640,.421,9]],
});
// Pixel centers and INNER pane dimensions measured on the original project
// canal artwork. Frames, masonry, hazard paint and the water are not emitters.
const surfaceWindows={
  'pumping-station':[[146,651,17,9],[167,651,17,9],[412,740,12,10],[859,1080,15,10],
    [135,1301,19,9],[161,1301,19,9],[925,230,6,10]],
  'filter-basin':[[173,192,5,9],[914,445,4,8],[857,740,5,8],[316,864,4,8],[286,960,5,9],[187,1024,4,9]],
  'sluice-works':[[224,206,5,10],[877,566,5,9],[812,1068,5,10],[158,1145,4,8]],
};
const panePoint=new Vector3(),paneEdge=new Vector3(),paneTop=new Vector3();
function surfaceLandmarks(record,camera,width,height,lights){
  const {definition:d,material,mesh}=record,u=material?.uniforms;
  if(!d?.shoreVariants||!u?.artwork?.value||!u.repeatY)return;
  const repeats=u.repeatY.value,scroll=u.scroll.value,sourceHeight=u.sourceHeight?.value??1,sourceWidth=u.sourceWidth?.value??1;
  if(!(repeats>0&&sourceHeight>0&&sourceWidth>0))return;
  for(let strip=Math.floor(scroll);strip<=Math.ceil(scroll+repeats);strip++){
    const section=((strip%6)+6)%6;
    const texture=d.coastSequence?(section===0||section===3?u.artwork.value:section===1||section===5?u.alternateArt?.value:u.thirdArt?.value):
      (((strip%2)+2)%2===0?u.artwork.value:u.alternateArt?.value);
    const image=texture?.image,url=image?.currentSrc||image?.src||'',name=/([^/]+)\.png(?:\?|$)/.exec(url)?.[1];
    const windows=surfaceWindows[name];if(!windows)continue;
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;if(!(iw>0&&ih>0))continue;
    for(const [sx,sy,pw,ph]of windows){
      // Invert sampleShore's height crop and 2.5% directional seam exactly.
      const localY=((1-sy/ih-.5)/sourceHeight+.5)/.975;
      if(localY<.026||localY>1)continue;
      const v=(strip+localY-scroll)/repeats;if(v<0||v>1)continue;
      const lx=(sx/iw-.5)/sourceWidth*d.width,lz=(.5-v)*d.length;
      panePoint.set(lx,0,lz);paneEdge.set(lx+pw/iw/sourceWidth*d.width,0,lz);
      paneTop.set(lx,0,lz+ph/ih/sourceHeight/.975/repeats*d.length);
      mesh.localToWorld(panePoint);mesh.localToWorld(paneEdge);mesh.localToWorld(paneTop);
      panePoint.project(camera);paneEdge.project(camera);paneTop.project(camera);
      const x=(panePoint.x*.5+.5)*width,y=(.5-panePoint.y*.5)*height;
      if(x<-20||x>width+20||y<-20||y>height+20)continue;
      const coreWidth=Math.hypot((paneEdge.x-panePoint.x)*width/2,(paneEdge.y-panePoint.y)*height/2);
      const coreHeight=Math.hypot((paneTop.x-panePoint.x)*width/2,(paneTop.y-panePoint.y)*height/2);
      lights.push({x,y,shape:'window',coreWidth,coreHeight,size:Math.max(12,Math.min(22,Math.max(coreWidth,coreHeight)*1.7)),
        strength:1,color:0xffb456});
    }
  }
}

const point=new Vector3();
export function sampleNightLandmarks(records,camera,width=540,height=960){
  const lights=[];
  camera.updateMatrixWorld();
  for(const record of records){
    if(!record.mesh.visible)continue;
    record.mesh.updateWorldMatrix(true,true);
    surfaceLandmarks(record,camera,width,height,lights);
    for(const cluster of record.clusters??[]){
      if(!cluster.parent.visible||!cluster.island.material.map)continue;
      for(const [u,v,size]of anchors[cluster.row.asset]??[]){
        point.set(u-.5,0,v-.5);cluster.island.localToWorld(point);point.project(camera);
        const x=(point.x*.5+.5)*width,y=(.5-point.y*.5)*height;
        if(x< -18||x>width+18||y< -18||y>height+18)continue;
        lights.push({x,y,size:size*1.8,strength:.9,color:0xffb65e});
      }
    }
    for(const {sprite,row,host}of record.waterProps??[]){
      if(row.asset!=='buoy'||!host.parent.visible||!sprite.visible)continue;
      point.set(0,0,-.23);sprite.localToWorld(point);point.project(camera);
      const x=(point.x*.5+.5)*width,y=(.5-point.y*.5)*height;
      if(x>=-18&&x<=width+18&&y>=-18&&y<=height+18)lights.push({x,y,size:20,strength:.95,color:0xffb75c});
    }
  }
  return lights.slice(0,24);
}

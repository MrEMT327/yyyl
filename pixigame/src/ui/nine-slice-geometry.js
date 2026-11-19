import { BufferGeometry, Float32BufferAttribute } from 'three';

// One mesh, nine UV regions. Corner lengths are uniform on both axes even for
// very wide or very tall controls. No extra texture or draw call per slice.
export function nineSliceGeometry(width,height,sourceWidth,sourceHeight,slice,corner) {
  const [sourceX,sourceY]=Array.isArray(slice)?slice:[slice,slice];
  const ex=Array.isArray(corner)?Math.max(0,Math.min(corner[0],width/2)):Math.max(0,Math.min(corner,width/2,height/2));
  const ey=Array.isArray(corner)?Math.max(0,Math.min(corner[1],height/2)):ex;
  const sx=Math.min(sourceX,sourceWidth/2),sy=Math.min(sourceY,sourceHeight/2);
  const xs=[0,ex,width-ex,width],ys=[0,ey,height-ey,height];
  const us=[0,sx/sourceWidth,1-sx/sourceWidth,1],vs=[0,sy/sourceHeight,1-sy/sourceHeight,1];
  return sliceGrid(width,height,xs,ys,us,vs);
}

// CSS border-image uses independently authored top, right, bottom and left insets.
export function slicedFrameGeometry(width,height,sw,sh,[top,right,bottom,left],cornerScale){
  const [dt,dr,db,dl]=Array.isArray(cornerScale)?cornerScale:[top,right,bottom,left].map(n=>n*cornerScale);
  const fit=Math.min(1,width/(dl+dr||1),height/(dt+db||1));
  return sliceGrid(width,height,[0,dl*fit,width-dr*fit,width],[0,dt*fit,height-db*fit,height],
    [0,left/sw,1-right/sw,1],[0,top/sh,1-bottom/sh,1]);
}

function sliceGrid(width,height,xs,ys,us,vs){
  const positions=[],uvs=[];
  for(let row=0;row<3;row++)for(let col=0;col<3;col++) {
    for(const [dx,dy] of [[0,0],[0,1],[1,0],[1,0],[0,1],[1,1]]) {
      positions.push(xs[col+dx]/width-.5,.5-ys[row+dy]/height,0);
      uvs.push(us[col+dx],1-vs[row+dy]);
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new Float32BufferAttribute(uvs,2));
  return geometry;
}

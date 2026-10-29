import { BufferGeometry, Float32BufferAttribute } from 'three';

// One mesh, nine UV regions. Corner lengths are uniform on both axes even for
// very wide or very tall controls. No extra texture or draw call per slice.
export function nineSliceGeometry(width,height,sourceWidth,sourceHeight,slice,corner) {
  const edge=Math.max(0,Math.min(corner,width/2,height/2));
  const sx=Math.min(slice,sourceWidth/2),sy=Math.min(slice,sourceHeight/2);
  const xs=[0,edge,width-edge,width],ys=[0,edge,height-edge,height];
  const us=[0,sx/sourceWidth,1-sx/sourceWidth,1],vs=[0,sy/sourceHeight,1-sy/sourceHeight,1];
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

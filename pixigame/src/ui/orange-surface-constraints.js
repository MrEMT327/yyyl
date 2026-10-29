// Prevent local inversions introduced where two original deformation surfaces
// meet in the target sleeve/wrist. Native hand topology is never regularized.
export function createOrangeSurfaceConstraints(manifest){
 let offset=0;
 const meshes=manifest.layers.map(layer=>{const start=offset;offset+=layer.vertices.length;if(!layer.constraints)return null;
  const triangles=[];for(let i=0;i<layer.constraints.indices.length;i+=3){const ids=layer.constraints.indices.slice(i,i+3).map(v=>v*2),[a,b,c]=ids,p=layer.vertices,area=(p[b]-p[a])*(p[c+1]-p[a+1])-(p[b+1]-p[a+1])*(p[c]-p[a]);if(Math.abs(area)<.001)continue;triangles.push({ids:ids.map(v=>v+start),sign:Math.sign(area),minimum:Math.max(.1,Math.abs(area)*.03)});}
  return{triangles};}).filter(Boolean);
 return positions=>{
  let corrections=0,maxStep=0,remaining=0;
  for(const mesh of meshes){
   for(let iteration=0;iteration<64;iteration++){
    let changed=0;
    for(const {ids:[a,b,c],sign,minimum}of mesh.triangles){
     const ax=positions[a],ay=positions[a+1],bx=positions[b],by=positions[b+1],cx=positions[c],cy=positions[c+1];
     const area=((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))*sign;if(area>=minimum*.999)continue;
     const gradients=[[(by-cy)*sign,(cx-bx)*sign],[(cy-ay)*sign,(ax-cx)*sign],[(ay-by)*sign,(bx-ax)*sign]],den=gradients.reduce((n,[x,y])=>n+x*x+y*y,0);if(den<1e-12)continue;
     const scale=(minimum-area)/den;for(const [j,index]of [a,b,c].entries()){const dx=gradients[j][0]*scale,dy=gradients[j][1]*scale;positions[index]+=dx;positions[index+1]+=dy;maxStep=Math.max(maxStep,Math.hypot(dx,dy));}changed++;corrections++;
    }
    if(!changed)break;
   }
   for(const {ids:[a,b,c],sign}of mesh.triangles)if(((positions[b]-positions[a])*(positions[c+1]-positions[a+1])-(positions[b+1]-positions[a+1])*(positions[c]-positions[a]))*sign<=0)remaining++;
  }
  return{corrections,maxStep,remaining};
 };
}

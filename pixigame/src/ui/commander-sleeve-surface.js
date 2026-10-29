// The supplied right-sleeve island accidentally includes a second copy of the
// black/red skirt side panel. ArtTorso/ArtSkirt already contain the complete
// garment and gold ornament. The duplicate must not move with the bent arm.
// This boundary runs through the transparent gap between skirt and sleeve in
// the authored rest pose; sleeve/cuff/tail pixels stay on their own mesh.
const BORDER=[[512,616],[520,618],[528,624],[536,628],[544,633],[552,637],[560,643],[568,648],[576,655],[584,659],[592,667],[600,676],[608,682],[616,684],[624,689],[632,700],[640,704],[688,720],[720,720]];
export function commanderSkirtLeakBoundary(y){
  for(let i=1;i<BORDER.length;i++)if(y<=BORDER[i][0]){const[a,x]=BORDER[i-1],[b,z]=BORDER[i];return x+(z-x)*(y-a)/(b-a);}
  return BORDER.at(-1)[1];
}
export function commanderSleeveSkirtDuplicate(x,y){return y>=512-1e-4&&y<=720+1e-4&&x<=commanderSkirtLeakBoundary(y)+1e-4;}
export function trimCommanderSleeveIndices(rest,indices){
  const result=[];
  for(let t=0;t<indices.length;t+=3){
    const triangle=Array.from(indices.subarray(t,t+3));
    if(!triangle.every(i=>commanderSleeveSkirtDuplicate(rest[i*2]*512+512,768-rest[i*2+1]*512)))result.push(...triangle);
  }
  return new Uint16Array(result);
}

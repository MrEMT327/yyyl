import {COMMANDER_FOOT_COVERAGE} from './commander-foot-coverage.js';

export function trimCommanderLegIndices(uv,indices){
  const result=[],join=COMMANDER_FOOT_COVERAGE.bounds[1];
  for(let t=0;t<indices.length;t+=3){
    const triangle=Array.from(indices.subarray(t,t+3)),y=triangle.map(i=>(1-uv[i*2+1])*2048),min=Math.min(...y),max=Math.max(...y);
    if(min<join&&max>join)throw Error('Commander leg cut crosses the UV grid');
    if(max<=join)result.push(...triangle);
  }
  return new Uint16Array(result);
}

// The supplied shoe mesh follows the old geta silhouette. A regenerated foot
// can extend past those triangles. Rebuild the one display surface from the
// actual new alpha support, keeping all native vertices as a stable prefix.
export function createCommanderFootSurface(rest,sourceUv,sourceIndices){
  const points=Array.from(rest),uv=Array.from(sourceUv),indices=[],vertices=new Map();
  for(let j=0;j<uv.length;j+=2)vertices.set(`${Math.round(uv[j]*2048)},${Math.round((1-uv[j+1])*2048)}`,j/2);
  const point=(x,y)=>{
    const key=`${x},${y}`;
    if(vertices.has(key))return vertices.get(key);
    const i=points.length/2;points.push((x-512)/512,(768-y)/512);uv.push(x/2048,1-y/2048);vertices.set(key,i);return i;
  };
  const [a,b,c]=Array.from(sourceIndices.subarray(0,3)).map(i=>i*2);
  const positive=(rest[b]-rest[a])*(rest[c+1]-rest[a+1])-(rest[b+1]-rest[a+1])*(rest[c]-rest[a])>0;
  const {cell,rows}=COMMANDER_FOOT_COVERAGE;
  for(const [y,...spans]of rows)for(let j=0;j<spans.length;j+=2)for(let x=spans[j];x<spans[j+1];x+=cell){
    const a=point(x,y),b=point(x+cell,y),c=point(x,y+cell),d=point(x+cell,y+cell);
    indices.push(...(positive?[a,c,b,b,c,d]:[a,b,c,b,d,c]));
  }
  if(points.length/2>65535||!indices.length)throw Error('Invalid commander foot surface');
  return {rest:new Float32Array(points),uv:new Float32Array(uv),indices:new Uint16Array(indices)};
}

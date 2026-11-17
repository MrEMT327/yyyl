/* Consumer adaptation of geometry-contract.json, formula by body worker.
 * No imports from previous native/Inochi tools; source fields read current Core XY.
 */
const smooth=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
export function createLegCrossSectionField(contract){
  const byIndex=new Map();for(const leg of contract.legs)for(const i of leg.indices){if(byIndex.has(i))throw Error('Leg index overlap');byIndex.set(i,leg);}
  function anchor(spec,source){const xy=source(spec.index);let x=0,y=0;for(let k=0;k<3;k++){x+=xy[2*spec.vertices[k]]*spec.weights[k];y+=xy[2*spec.vertices[k]+1]*spec.weights[k];}return [x,y];}
  function anchors(leg,source){return ['hip','knee','ankle'].map(n=>anchor(leg.anchors[n],source));}
  function point(p,a){
    const [H,K,A]=a,f=contract.field,parts=[];
    for(const [q,r] of [[H,K],[K,A]]){const vx=r[0]-q[0],vy=r[1]-q[1],len2=vx*vx+vy*vy;if(len2<1e-12)throw Error('Degenerate leg centerline');const px=p[0]-q[0],py=p[1]-q[1],t=(px*vx+py*vy)/len2,tc=Math.max(0,Math.min(1,t)),dx=px-tc*vx,dy=py-tc*vy;parts.push({nx:px-t*vx,ny:py-t*vy,dist:dx*dx+dy*dy,bump:0.55+0.45*Math.sin(Math.PI*tc)**2});}
    const mind=Math.min(parts[0].dist,parts[1].dist),w=parts.map(x=>Math.exp(-(x.dist-mind)/(2*f.sigma*f.sigma))),sum=w[0]+w[1];let dx=0,dy=0;for(let i=0;i<2;i++){const m=w[i]/sum*parts[i].bump;dx+=m*parts[i].nx;dy+=m*parts[i].ny;}
    const gate=smooth((H[1]-f.topZeroBelowHip-p[1])/f.topTransition)*smooth((p[1]-(A[1]+f.shoeZeroAboveAnkle))/f.shoeTransition)*contract.amount;return[p[0]+dx*gate,p[1]];
  }
  return {
    targets:[...byIndex.keys()],
    transform(index,input,{sourcePositions}){const leg=byIndex.get(index);if(!leg)throw Error('Unapproved leg target');const a=anchors(leg,sourcePositions),out=new Float32Array(input.length);for(let k=0;k<input.length;k+=2){const p=point([input[k],input[k+1]],a);out[k]=p[0];out[k+1]=p[1];}return out;},
    anchorDiagnostics(source,rendered){return contract.legs.map(leg=>{const before=anchors(leg,source),after=anchors(leg,rendered);return {leg:leg.name,anchors:['hip','knee','ankle'].map((name,i)=>({name,sourceWorld:before[i],renderedBarycentricWorld:after[i],renderedBarycentricErrorWorld:Math.hypot(after[i][0]-before[i][0],after[i][1]-before[i][1]),analyticFieldAtAnchor:point(before[i],before)}))};});}
  };
}

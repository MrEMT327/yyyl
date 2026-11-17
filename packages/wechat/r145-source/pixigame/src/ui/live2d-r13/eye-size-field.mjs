/* Consumer-only coherent eye-group scaling; source Core XY, UV and indices are untouched.
 * Combine targets/transform with other disjoint fields in one render-position adapter.
 * prepare() must be called after Core.update and before renderer.drawModel (mask pass included).
 */
export const EYE_GROUPS = [
 {name:'Part5',anchor:8,targets:[2,3,4,5,6,7,8,70,71,75,325]},
 {name:'Part7',anchor:22,targets:[17,18,19,20,21,22,69,72,73,74,326]}
];
export function createEyeSizeField({scale=0.92}={}) {
 if(!Number.isFinite(scale)||scale<0.8||scale>1) throw Error('Eye scale must be 0.8..1');
 const targets=EYE_GROUPS.flatMap(g=>g.targets),byIndex=new Map(EYE_GROUPS.flatMap(g=>g.targets.map(i=>[i,g])));
 function center(g,sourcePositions){const a=sourcePositions(g.anchor);if(!a?.length)throw Error('Missing eye anchor '+g.anchor);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let k=0;k<a.length;k+=2){x0=Math.min(x0,a[k]);x1=Math.max(x1,a[k]);y0=Math.min(y0,a[k+1]);y1=Math.max(y1,a[k+1]);}return[(x0+x1)/2,(y0+y1)/2];}
 function transform(i,xy,{sourcePositions}){const g=byIndex.get(i);if(!g||scale===1)return xy;const[cx,cy]=center(g,sourcePositions);for(let k=0;k<xy.length;k+=2){xy[k]=cx+(xy[k]-cx)*scale;xy[k+1]=cy+(xy[k+1]-cy)*scale;}return xy;}
 return {targets,transform,scale,groups:EYE_GROUPS,diagnostics(sourcePositions){return EYE_GROUPS.map(g=>({name:g.name,anchor:g.anchor,center: center(g,sourcePositions),scale,targets:g.targets}));}};
}

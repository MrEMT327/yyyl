import {transformPoint} from './source-scene-sampler.mjs';
import {sampleCurve,sampleGradient} from './pathogenic-particles.mjs';
export function inverseMatrix(m){const d=m[0]*m[3]-m[1]*m[2];if(!Number.isFinite(d)||Math.abs(d)<1e-12)throw Error('Singular source transform');return [m[3]/d,-m[1]/d,-m[2]/d,m[0]/d,(m[2]*m[5]-m[3]*m[4])/d,(m[1]*m[4]-m[0]*m[5])/d];}
export const matrix3=m=>[m[0],m[1],0,m[2],m[3],0,m[4],m[5],1];
export const matrix4=m=>[m[0],m[1],0,0,m[2],m[3],0,0,0,0,1,0,m[4],m[5],0,1];
export function spriteGeometry(sprite){
  const [x,y,w,h]=sprite.localRect;
  const points=[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const [u,v,uw,vh]=sprite.texture.crop??[0,0,sprite.texture.width,sprite.texture.height];
  const us=sprite.flipX?[u+uw,u]:[u,u+uw],vs=sprite.flipY?[v+vh,v]:[v,v+vh];
  return {vertices:points.map((p,i)=>({position:transformPoint(sprite.matrix,p),uv:[us[i===1||i===2?1:0],vs[i>=2?1:0]],color:sprite.color})),indices:[0,1,2,0,2,3]};
}

/*
 * Port of Godot scene/2d/line_builder.cpp and Geometry2D::segment_intersects_segment.
 * Source: https://github.com/godotengine/godot/blob/master/scene/2d/line_builder.cpp
 * Retrieved 2026-10-22. Godot 4.7 development branch; not an original-exe hash claim.
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
const add2=(a,b)=>[a[0]+b[0],a[1]+b[1]],sub2=(a,b)=>[a[0]-b[0],a[1]-b[1]],mul2=(a,s)=>[a[0]*s,a[1]*s];
const dot2=(a,b)=>a[0]*b[0]+a[1]*b[1],cross2=(a,b)=>a[0]*b[1]-a[1]*b[0];
const norm2=a=>{const n=Math.hypot(...a);return n?mul2(a,1/n):[0,0];};
const ortho2=a=>[a[1],-a[0]],lerp2=(a,b,t)=>add2(a,mul2(sub2(b,a),t)),dist2=(a,b)=>Math.hypot(...sub2(a,b));
const EPSILON=1e-5;
function segmentIntersection(a,b,c,d){
 const B=sub2(b,a),len=dot2(B,B);if(len<=0)return null;
 const bn=mul2(B,1/len),convert=p=>{const v=sub2(p,a);return [dot2(v,bn),v[1]*bn[0]-v[0]*bn[1]];};
 const C=convert(c),D=convert(d);
 if((C[1]<-EPSILON&&D[1]<-EPSILON)||(C[1]>EPSILON&&D[1]>EPSILON))return null;
 if(C[1]===D[1]||Math.abs(C[1]-D[1])<Math.max(EPSILON,EPSILON*Math.abs(C[1])))return null;
 const t=D[0]+(C[0]-D[0])*D[1]/(D[1]-C[1]);
 return t<0||t>1?null:add2(a,mul2(B,t));
}
const bakedCurves=new WeakMap();
/** Godot Curve::sample_baked, including the stored bake resolution and domain. */
export function sampleLineWidthCurve(graph,ref,t){
 const r=ref?.$ref?graph.resources[ref.$ref]:ref;
 if(r?.type!=='Curve')throw Error('Line width_curve must resolve to Curve');
 const p=r.properties,lo=p.min_domain??p._limits?.[2]??0,hi=p.max_domain??p._limits?.[3]??1;
 let cache=bakedCurves.get(r);
 if(!cache){
  const n=p.bake_resolution??100,d=p._data??[];cache=Array(n).fill(0);
  for(let i=1;i<n-1;i++)cache[i]=sampleCurve(graph,ref,lo+(hi-lo)*i/(n-1));
  if(d.length){cache[0]=d[0][1];cache[n-1]=d[d.length-5][1];}bakedCurves.set(r,cache);
 }
 if(!Number.isFinite(t))return 0;if(cache.length<2)return cache[0]??0;
 let f=(t-lo)/(hi-lo)*(cache.length-1),i=Math.floor(f);
 if(i<0){i=0;f=0;}else if(i>=cache.length){i=cache.length-1;f=0;}
 return i+1<cache.length?cache[i]+(cache[i+1]-cache[i])*(f-i):cache.at(-1);
}

/** Original local-unit tessellation. sourceUV is Godot UV, not atlas pixel UV.
 * Curve baking, caps, miter fallback, round joins and closed-seam fake walk are
 * retained. JS doubles are not bit-identical to Godot real_t float operations.
 */
export function lineGeometry(graph,line){
 const points=line.localPoints??[],vertices=[],indices=[],last=[0,0];
 const result=()=>({vertices,indices,unsupported:[]});
 if(points.length<2||line.width<=0)return result();
 const width=line.width??10,hw=width/2,wrap=!!line.closed&&points.length>2;
 const mode=line.textureMode??0,joint=line.jointMode??0,begin=line.beginCapMode??0,end=line.endCapMode??0;
 const precision=line.roundPrecision??8,sharpSq=(line.sharpLimit??2)**2;
 const texture=line.texture,crop=texture?.crop;
 const aspect=line.tileAspect??(texture?(crop?crop[2]/crop[3]:texture.width/texture.height):1);
 if(!(aspect>0)||!(precision>=1))throw Error('Invalid Godot line texture aspect/round precision');
 if([mode,joint,begin,end].some(x=>![0,1,2].includes(x)))throw Error('Unsupported Godot line mode');
 const gradient=!!line.gradient,curve=!!line.widthCurve,needDistance=gradient||curve||mode===1||mode===2;
 const curveAt=t=>curve?sampleLineWidthCurve(graph,line.widthCurve,t):1;
 const colorAt=t=>gradient?sampleGradient(graph,line.gradient,t):[1,1,1,1];
 const colorFirst=colorAt(0),colorLast=colorAt(1);
 const canvasColor=gradient?(line.canvasColor??line.color??[1,1,1,1]):(line.color??[1,1,1,1]);
 const put=(p,c,uv)=>{const sourceUV=mode?uv:[0,0];vertices.push({localPosition:[...p],position:transformPoint(line.matrix,p),sourceUV:[...sourceUV],uv:[...sourceUV],color:(gradient?c:[1,1,1,1]).map((v,i)=>v*canvasColor[i])});return vertices.length-1;};
 const stripBegin=(up,down,c,x)=>{last[0]=put(up,c,[x,0]);last[1]=put(down,c,[x,1]);};
 const stripQuad=(up,down,c,x)=>{const i=put(up,c,[x,0]);put(down,c,[x,1]);indices.push(last[0],i+1,last[1],last[0],i,i+1);last[0]=i;last[1]=i+1;};
 const stripTri=(p,orientation)=>{const opposite=1-orientation,i=vertices.length,prev=vertices.at(-1),uv=vertices[last[opposite]].sourceUV;
  // Copy the already modulated color: this is Godot colors.back().
  vertices.push({localPosition:[...p],position:transformPoint(line.matrix,p),sourceUV:[...uv],uv:[...uv],color:[...prev.color]});
  indices.push(last[opposite],i,last[orientation]);last[opposite]=i;
 };
 const stripArc=(center,delta,orientation)=>{const v=sub2(vertices[last[1-orientation]].localPosition,center),radius=Math.hypot(...v),step=Math.PI/precision*(delta<0?-1:1),steps=Math.abs(delta)/(Math.PI/precision),start=Math.atan2(v[1],v[0]);
  let t=start;for(let i=0;i<steps;i++,t+=step)stripTri(add2(center,[Math.cos(t)*radius,Math.sin(t)*radius]),orientation);
  const endAngle=start+delta;stripTri(add2(center,[Math.cos(endAngle)*radius,Math.sin(endAngle)*radius]),orientation);
 };
 const arc=(center,v,delta,c,rect)=>{const radius=Math.hypot(...v),step=Math.PI/precision*(delta<0?-1:1),steps=Math.abs(delta)/(Math.PI/precision),start=Math.atan2(v[1],v[0]);
  const uv=(x,y)=>[rect[0]+rect[2]*x,rect[1]+rect[3]*y],i0=put(center,c,uv(.5,.5));let t=start,tt=-Math.PI/2;
  for(let i=0;i<steps;i++,t+=step,tt+=step)put(add2(center,[Math.cos(t)*radius,Math.sin(t)*radius]),c,uv((Math.cos(tt)+1)/2,(Math.sin(tt)+1)/2));
  put(add2(center,[Math.cos(start+delta)*radius,Math.sin(start+delta)*radius]),c,uv((Math.cos(-Math.PI/2+delta)+1)/2,(Math.sin(-Math.PI/2+delta)+1)/2));
  for(let i=0;i<steps;i++)indices.push(i0,i0+i+1,i0+i+2);
 };
 let pos0=points[0],pos1=points[1],f0=norm2(sub2(pos1,pos0)),u0=ortho2(f0),factor=curveAt(0),half=hw*factor;
 let distance=0,total=0,color0=colorFirst,color1=colorFirst,x0=0,x1=0;
 if(needDistance){for(let i=1;i<points.length;i++)total+=dist2(points[i],points[i-1]);
  if(wrap)total+=dist2(points.at(-1),pos0);else{if(begin)total+=half;if(end)total+=hw*curveAt(1);}
 }
 if(needDistance&&Math.abs(total)<EPSILON)return result();
 let up0=add2(pos0,mul2(u0,half)),down0=sub2(pos0,mul2(u0,half));
 if(!wrap){
  if(begin===1){up0=sub2(up0,mul2(f0,half));down0=sub2(down0,mul2(f0,half));distance+=half;}
  else if(begin===2){if(mode===1)x0=factor*.5/aspect;else if(mode===2)x0=width*factor/total;arc(pos0,sub2(up0,pos0),-Math.PI,color0,[0,0,x0*2,1]);distance+=half;}
  stripBegin(up0,down0,color0,x0);
 }
 const segments=wrap?points.length:points.length-2;let firstUp,firstDown,firstSharp=false;
 for(let i=wrap?-1:1;i<=segments;i++){
  pos1=points[i===-1?points.length-1:i%points.length];const pos2=points[(i+1)%points.length],f1=norm2(sub2(pos2,pos1)),u1=ortho2(f1),orientation=dot2(u0,f1)>0?0:1;
  if(needDistance&&i>=1)distance+=dist2(pos0,pos1);
  color1=gradient?colorAt(distance/total):colorFirst;if(curve){factor=curveAt(distance/total);half=hw*factor;}
  const n0=mul2(u0,half*(orientation===1?-1:1)),n1=mul2(u1,half*(orientation===1?-1:1));
  let cornerIn=segmentIntersection(add2(pos0,n0),add2(pos1,n0),add2(pos1,n1),add2(pos2,n1));
  const intersect=cornerIn!==null;let cornerOut;
  if(intersect)cornerOut=sub2(mul2(pos1,2),cornerIn);else{cornerIn=add2(pos1,n0);cornerOut=sub2(pos1,n0);}
  const cornerUp=orientation===0?cornerIn:cornerOut,cornerDown=orientation===0?cornerOut:cornerIn;
  let current=joint,up1,down1;
  if(intersect){
   if(current===0&&dot2(sub2(cornerOut,pos1),sub2(cornerOut,pos1))/(hw*hw*factor*factor)>sharpSq)current=1;
   if(current===0){up1=cornerUp;down1=cornerDown;}
   else if(orientation===0){up1=cornerUp;down1=sub2(pos1,mul2(u0,half));}
   else{up1=add2(pos1,mul2(u0,half));down1=cornerDown;}
  }else{if(current===0)current=1;up1=cornerUp;down1=cornerDown;}
  if(mode===1)x1=distance/(width*aspect);else if(mode===2)x1=distance/total;
  color0=color1;u0=u1;f0=f1;pos0=pos1;
  if(intersect){if(current===0){up0=up1;down0=down1;}
   else if(orientation===0){up0=cornerUp;down0=sub2(pos1,mul2(u1,half));}
   else{up0=add2(pos1,mul2(u1,half));down0=cornerDown;}
  }else{up0=add2(pos1,mul2(u1,half));down0=sub2(pos1,mul2(u1,half));}
  if(i===-1)continue;
  if(wrap&&i===0){const center=mul2(add2(up1,down1),.5);
   if(factor===0&&curve)throw Error('Godot closed Line2D has a zero-width start seam; original tessellator divides by zero');
   firstUp=lerp2(center,up1,1/factor);firstDown=lerp2(center,down1,1/factor);firstSharp=current===0;
  }
  if(wrap&&curve&&!firstSharp&&i===segments){const center=mul2(add2(firstUp,firstDown),.5);stripQuad(lerp2(center,firstUp,factor),lerp2(center,firstDown,factor),color1,x1);return result();}
  stripQuad(up1,down1,color1,x1);
  if(current!==0){
   const cb=orientation===0?down1:up1,ce=orientation===0?down0:up0;
   if(current===1&&!(wrap&&i===segments))stripTri(ce,orientation);
   else if(current===2&&!(wrap&&i===segments)){const vb=sub2(cb,pos1),ve=sub2(ce,pos1);let cross=cross2(vb,ve);if(Object.is(cross,-0))cross=0;stripArc(pos1,Math.atan2(cross,dot2(vb,ve)),orientation);}
   if(!intersect)stripBegin(up0,down0,color1,x1);
  }
 }
 if(!wrap){
  pos1=points.at(-1);if(needDistance)distance+=dist2(pos0,pos1);color1=colorLast;factor=curveAt(1);half=hw*factor;
  let up1=add2(pos1,mul2(u0,half)),down1=sub2(pos1,mul2(u0,half));
  if(end===1){up1=add2(up1,mul2(f0,half));down1=add2(down1,mul2(f0,half));distance+=half;}
  if(mode===1)x1=distance/(width*aspect);else if(mode===2)x1=distance/total;stripQuad(up1,down1,color1,x1);
  if(end===2){const d=mode===1?factor/aspect:mode===2?width*factor/total:0;arc(pos1,sub2(up1,pos1),Math.PI,colorLast,[x1-d*.5,0,d,1]);}
 }
 return result();
}

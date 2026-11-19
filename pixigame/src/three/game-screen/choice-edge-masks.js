import {
  BufferAttribute,BufferGeometry,Camera,Color,CustomBlending,DoubleSide,DynamicDrawUsage,Float32BufferAttribute,
  LinearFilter,Mesh,NoBlending,OneFactor,RawShaderMaterial,Scene,ShapeUtils,Vector2,Vector4,WebGLRenderTarget
} from 'three';
import {buildEdgeArcFrames,edgeBaseContour,EDGE_FRAME_RATE} from '../../ui/breakthrough-edge-profile.js';

const vertex=`precision highp float;attribute vec3 position;attribute vec4 coverage;
uniform vec2 size;varying vec4 ink;
void main(){ink=coverage;gl_Position=vec4(position.x/size.x*2.-1.,1.-position.y/size.y*2.,0.,1.);}`;
export const borderVertex=`attribute vec3 position;varying vec2 pixelUV;
void main(){pixelUV=position.xy;gl_Position=vec4(position.xy*2.-1.,0.,1.);}`;
const maskFragment='precision highp float;varying vec4 ink;void main(){gl_FragColor=ink;}';
const blurFragment=`precision highp float;varying vec2 pixelUV;uniform sampler2D inputMask;uniform vec2 stride,weights[25];uniform int radius;
vec3 readMask(vec2 p){return texture2D(inputMask,p).rgb*step(0.,min(p.x,p.y))*step(max(p.x,p.y),1.);}
void main(){
  vec3 sum=readMask(pixelUV)*weights[0].xyy;
  for(int i=1;i<25;i++){if(i>radius)break;vec2 offset=stride*float(i);sum+=(readMask(pixelUV+offset)+readMask(pixelUV-offset))*weights[i].xyy;}
  gl_FragColor=vec4(sum,1.);
}`;
export function borderGeometry(w,h,band){
  const data=[],dx=Math.min(.5,band/w),dy=Math.min(.5,band/h);
  function quad(l,b,r,t){if(l>=r||b>=t)return;data.push(l,b,0,r,b,0,l,t,0,r,b,0,r,t,0,l,t,0);}
  quad(0,0,1,dy);quad(0,1-dy,1,1);quad(0,dy,dx,1-dy);quad(1-dx,dy,1,1-dy);
  const geo=new BufferGeometry();geo.setAttribute('position',new Float32BufferAttribute(data,3));return geo;
}
function maskBatch(size){
  const geometry=new BufferGeometry(),mat=new RawShaderMaterial({vertexShader:vertex,fragmentShader:maskFragment,uniforms:{size:{value:size}},
    side:DoubleSide,forceSinglePass:true,transparent:true,blending:CustomBlending,blendSrc:OneFactor,blendDst:OneFactor,depthTest:false,depthWrite:false});
  const mesh=new Mesh(geometry,mat),scene=new Scene();mesh.frustumCulled=false;scene.add(mesh);
  let positions,colors,capacity=0;
  const vertices=[],channels=[];
  function triangle(a,b,c,channel){
    for(const [x,y] of [a,b,c]){vertices.push(x,y,0);channels.push(channel===0?1:0,channel===1?1:0,channel===2?1:0,channel===3?1:0);}
  }
  function line(points,width,channel,closed=false){
    const count=points.length;if(count<2)return;
    const segments=[],half=width/2;
    for(let i=0;i<(closed?count:count-1);i++){
      const a=points[i],b=points[(i+1)%count],x=b[0]-a[0],y=b[1]-a[1],len=Math.hypot(x,y);
      if(len<1e-6)continue;
      const nx=-y/len,ny=x/len,ox=nx*half,oy=ny*half;
      const al=[a[0]+ox,a[1]+oy],ar=[a[0]-ox,a[1]-oy],bl=[b[0]+ox,b[1]+oy],br=[b[0]-ox,b[1]-oy];
      triangle(al,ar,bl,channel);triangle(ar,br,bl,channel);segments.push({a,nx,ny,al,ar,bl,br});
    }
    for(let i=closed?0:1;i<segments.length;i++){
      const q=segments[i],p=segments[(i+segments.length-1)%segments.length],dot=p.nx*q.nx+p.ny*q.ny,cross=p.nx*q.ny-p.ny*q.nx;
      if(Math.abs(cross)<1e-6||1+dot<1e-5)continue;
      const outside=cross>0?-1:1,from=outside<0?p.br:p.bl,to=outside<0?q.ar:q.al;
      triangle(q.a,from,to,channel);
      // Both authored arc joins use the SVG miter limit of two stroke radii.
      if(2/(1+dot)<=4){
        const k=outside*half/(1+dot);
        triangle(from,[q.a[0]+(p.nx+q.nx)*k,q.a[1]+(p.ny+q.ny)*k],to,channel);
      }
    }
  }
  return {scene,line,triangle,upload(){
    const n=vertices.length/3;
    if(n>capacity){capacity=2**Math.ceil(Math.log2(n));geometry.dispose();
      positions=new Float32Array(capacity*3);colors=new Uint8Array(capacity*4);
      geometry.setAttribute('position',new BufferAttribute(positions,3).setUsage(DynamicDrawUsage));
      geometry.setAttribute('coverage',new BufferAttribute(colors,4).setUsage(DynamicDrawUsage));}
    if(n){
      positions.set(vertices);colors.set(channels);
      for(const [name,size] of [['position',3],['coverage',4]]){const a=geometry.getAttribute(name);a.clearUpdateRanges();a.addUpdateRange(0,n*size);a.needsUpdate=true;}
    }
    geometry.setDrawRange(0,n);vertices.length=0;channels.length=0;
  },dispose(){geometry.dispose();mat.dispose();}};
}
function gaussians(a,b){
  const one=s=>{const radius=Math.min(24,Math.ceil(s*3)),v=new Float32Array(25);let sum=1;v[0]=1;
    for(let i=1;i<=radius;i++){v[i]=Math.exp(-i*i/(2*s*s));sum+=2*v[i];}
    for(let i=0;i<=radius;i++)v[i]/=sum;return {v,radius};};
  const first=one(Math.max(.05,a)),second=one(Math.max(.05,b)),weights=new Float32Array(50);
  for(let i=0;i<25;i++){weights[2*i]=first.v[i];weights[2*i+1]=second.v[i];}
  return {weights,radius:Math.max(first.radius,second.radius)};
}
export function createEdgeMasks(renderer,w,h,pw,ph){
  const size=new Vector2(w,h),camera=new Camera(),scale=Math.min(w/600,h/1300);
  const msaa=Math.min(4,renderer.capabilities.maxSamples);
  const target=(w,h,samples=0)=>new WebGLRenderTarget(w,h,{samples,depthBuffer:false,stencilBuffer:false,minFilter:LinearFilter,magFilter:LinearFilter});
  const hw=Math.ceil(pw/2),hh=Math.ceil(ph/2),wide=target(hw,hh,msaa),near=target(pw,ph,msaa),fine=target(pw,ph,msaa);
  const wideTemp=target(hw,hh),nearTemp=target(pw,ph);
  const blurGeo=borderGeometry(w,h,Math.max(18,64*scale));
  const uniforms={inputMask:{value:null},stride:{value:new Vector2()},weights:{value:null},radius:{value:0}};
  const blurMaterial=new RawShaderMaterial({vertexShader:borderVertex,fragmentShader:blurFragment,uniforms,depthTest:false,depthWrite:false,blending:NoBlending});
  const blurScene=new Scene(),blurMesh=new Mesh(blurGeo,blurMaterial);blurMesh.frustumCulled=false;blurScene.add(blurMesh);
  const batches=[maskBatch(size),maskBatch(size),maskBatch(size)],frames=buildEdgeArcFrames(w,h,{paths:false});
  const outside=[[0,0],[w,0],[w,h],[0,h]],inside=edgeBaseContour(w,h),vertices=outside.concat(inside);
  const vectors=list=>list.map(([x,y])=>new Vector2(x,y));
  const ring=ShapeUtils.triangulateShape(vectors(outside),[vectors(inside)]);
  const param=(a,b,x,y)=>[gaussians(Math.max(.45,a*scale)*x/w,Math.max(.45,b*scale)*x/w),gaussians(Math.max(.45,a*scale)*y/h,Math.max(.45,b*scale)*y/h)];
  const wideFilter=param(8,4.2,hw,hh),nearFilter=param(1,1,pw,ph);
  const oldVp=new Vector4(),oldSc=new Vector4(),oldColor=new Color();
  function draw(target,scene){
    renderer.setRenderTarget(target);renderer.setViewport(0,0,target.width,target.height);renderer.clear(true,false,false);renderer.render(scene,camera);
  }
  function blur(raw,temp,filters){
    for(let axis=0;axis<2;axis++){
      const {weights,radius}=filters[axis];uniforms.weights.value=weights;uniforms.radius.value=radius;
      uniforms.inputMask.value=(axis?temp:raw).texture;uniforms.stride.value.set(axis?0:1/raw.width,axis?1/raw.height:0);
      draw(axis?raw:temp,blurScene);
    }
  }
  return {wide:wide.texture,near:near.texture,fine:fine.texture,render(seconds){
    const phase=Math.max(0,seconds)*EDGE_FRAME_RATE,index=Math.floor(phase)%frames.length,t=phase-Math.floor(phase);
    const f=frames[index],next=frames[(index+1)%frames.length];
    const main=f.points.map((p,i)=>[p[0]+(next.points[i][0]-p[0])*t,p[1]+(next.points[i][1]-p[1])*t]);
    const stroke=(batch,ch,paths,width,closed=false)=>{for(const line of paths)batches[batch].line(line,Math.max(.65,width*scale),ch,closed);};
    stroke(0,0,[main],36,true);stroke(0,1,[main],22,true);stroke(0,2,f.branchLines,12);
    stroke(1,0,[main],8.5,true);stroke(1,1,f.branchLines,4.5);
    stroke(2,0,[main],2.35,true);stroke(2,1,f.branchLines,1.05);stroke(2,2,f.echoLines,.8);
    for(const [a,b,c] of ring)batches[2].triangle(vertices[a],vertices[b],vertices[c],3);
    const before=renderer.getRenderTarget(),clip=renderer.getScissorTest(),alpha=renderer.getClearAlpha(),clear=renderer.autoClear;
    renderer.getViewport(oldVp);renderer.getScissor(oldSc);renderer.getClearColor(oldColor);
    try{
      renderer.autoClear=false;renderer.setScissorTest(false);renderer.setClearColor(0,0);
      for(let i=0;i<3;i++){batches[i].upload();draw([wide,near,fine][i],batches[i].scene);}
      blur(wide,wideTemp,wideFilter);blur(near,nearTemp,nearFilter);
    }finally{
      renderer.setRenderTarget(before);renderer.setViewport(oldVp);renderer.setScissor(oldSc);renderer.setScissorTest(clip);
      renderer.setClearColor(oldColor,alpha);renderer.autoClear=clear;
    }
  },dispose(){for(const b of batches)b.dispose();for(const t of [wide,near,fine,wideTemp,nearTemp])t.dispose();blurMaterial.dispose();blurGeo.dispose();}};
}


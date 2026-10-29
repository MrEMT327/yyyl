import * as T from 'three';
import {RibbonGeometry} from '../fighter/upstream/RibbonGeometry.js';
import {VeilRibbon,VEIL_STYLE} from './VeilRibbon.js';
const TAU=Math.PI*2;
const tmpColor=new T.Color();
function colorOf(value,config,fallback='#ffffff'){
 const token=value||fallback;
 if(token==='@engine')return tmpColor.set(config.engineColor||fallback).clone();
 if(token==='@accent')return tmpColor.set(config.accentColor||fallback).clone();
 if(token==='@hull')return tmpColor.set(config.hullColor||fallback).clone();
 return tmpColor.set(token).clone();
}
function addOwned(registry,...items){for(const item of items)if(item)registry.push(item);}
function meshBasic(color,opacity=.5){
 return new T.MeshBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false});
}
function standardGlass(color,opacity=.22){
 return new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.92,transparent:true,opacity,metalness:.05,roughness:.04,side:T.DoubleSide,depthWrite:false});
}

function cyberStripMaterial(color,edgeColor,opacity=.18){
 const uniforms={uTime:{value:0},uColor:{value:color.clone()},uEdgeColor:{value:edgeColor.clone()},uOpacity:{value:opacity}};
 return new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,uniforms,
  vertexShader:`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec2 vUv; uniform vec3 uColor,uEdgeColor; uniform float uTime,uOpacity;
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
void main(){
 vec2 uv=vUv;
 float body=smoothstep(0.02,0.10,uv.x)*(1.0-smoothstep(0.88,0.98,uv.x));
 float side=1.0-smoothstep(0.14,0.38,abs(uv.y-.5));
 float profile=body*(0.34+0.66*side);
 float edge=(1.0-smoothstep(0.02,0.08,abs(uv.y-.5)))*body;
 float stripes=(step(0.68,fract(uv.x*7.0-uTime*0.8))*0.18 + step(0.92,fract(uv.x*3.0+uv.y*4.0))*0.24)*body*side;
 float scan=smoothstep(0.0,0.12,1.0-abs(fract(uv.x*2.0-uTime*0.55)-0.5)*2.0)*0.55*body;
 float alpha=(profile*0.80 + edge*0.22 + stripes + scan*0.25)*uOpacity;
 if(alpha<0.01) discard;
 vec3 color=mix(uColor,uEdgeColor,0.28+0.52*edge+0.26*scan);
 color+=uEdgeColor*stripes*1.15;
 gl_FragColor=vec4(color,alpha);
}`});
}

function cyberNodeMaterial(color,edgeColor,opacity=.18,pattern=0){
 const uniforms={uTime:{value:0},uColor:{value:color.clone()},uEdgeColor:{value:edgeColor.clone()},uOpacity:{value:opacity},uPattern:{value:pattern}};
 return new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,uniforms,
  vertexShader:`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec2 vUv; uniform vec3 uColor,uEdgeColor; uniform float uTime,uOpacity,uPattern;
float rectMask(vec2 p, vec2 halfSize){vec2 d=abs(p)-halfSize;return 1.0-smoothstep(0.0,0.04,max(d.x,d.y));}
void main(){
 vec2 p=vUv*2.0-1.0;
 float pat=floor(uPattern+0.5);
 float shape=0.0;
 float accent=0.0;
 if(pat<0.5){
  float diamond=1.0-smoothstep(0.32,0.52,abs(p.x)+abs(p.y));
  float core=1.0-smoothstep(0.08,0.22,abs(p.x)+abs(p.y));
  shape=diamond; accent=core;
 }else if(pat<1.5){
  float left=rectMask(p+vec2(0.34,0.0),vec2(0.14,0.56));
  float right=rectMask(p-vec2(0.34,0.0),vec2(0.14,0.56));
  float spine=rectMask(p,vec2(0.08,0.28));
  shape=max(max(left,right),spine); accent=spine;
 }else if(pat<2.5){
  float chevronA=1.0-smoothstep(0.06,0.12,abs(p.y-0.36*p.x)-0.10)*(1.0-smoothstep(0.48,0.78,p.x));
  float chevronB=1.0-smoothstep(0.06,0.12,abs(p.y+0.36*p.x)-0.10)*(1.0-smoothstep(0.48,0.78,-p.x));
  float core=rectMask(p,vec2(0.22,0.16));
  shape=max(core,max(chevronA,chevronB)); accent=core;
 }else{
  float top=rectMask(p-vec2(0.0,0.44),vec2(0.56,0.10));
  float bottom=rectMask(p+vec2(0.0,0.44),vec2(0.56,0.10));
  float left=rectMask(p+vec2(0.44,0.0),vec2(0.10,0.54));
  float right=rectMask(p-vec2(0.44,0.0),vec2(0.10,0.54));
  float core=rectMask(p,vec2(0.18,0.18));
  shape=max(max(top,bottom),max(left,right)); shape=max(shape,core*0.8); accent=core;
 }
 float pulse=0.76+0.24*sin(uTime*2.2 + p.x*4.0 + p.y*2.0);
 float scan=smoothstep(0.0,0.08,1.0-abs(fract(vUv.y*3.0-uTime*0.55)-0.5)*2.0)*0.4;
 float alpha=(shape*(0.72+0.28*pulse)+accent*0.28+scan*shape*0.2)*uOpacity;
 if(alpha<0.01) discard;
 vec3 color=mix(uColor,uEdgeColor,0.34+0.5*accent+0.16*scan);
 gl_FragColor=vec4(color,alpha);
}`});
}
function seeded(i){const v=Math.sin(i*127.1+91.7)*43758.5453;return v-Math.floor(v);}
function polygonGeometry(points){
 const vertices=[];const tri=(a,b,c)=>vertices.push(a[0],a[1],0,b[0],b[1],0,c[0],c[1],0);
 for(let i=1;i<points.length-1;i++)tri(points[0],points[i],points[i+1]);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}
function scalePoints(points,scale){return points.map(([x,y])=>[x*scale,y*scale]);}
function softFilm(color,opacity=.18){
 return new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.22,transparent:true,opacity,metalness:0,roughness:.58,side:T.DoubleSide,depthWrite:false});
}
function ribbonPanelMaterial(color,edgeColor,opacity=.22){
 const uniforms={uTime:{value:0},uColor:{value:color.clone()},uEdgeColor:{value:edgeColor.clone()},uOpacity:{value:opacity}};
 const material=new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.DoubleSide,toneMapped:false,uniforms,
  vertexShader:`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec2 vUv; uniform vec3 uColor,uEdgeColor; uniform float uTime,uOpacity;
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
void main(){
 vec2 uv=vUv;
 float span=1.0-abs(uv.y*2.0-1.0);
 float root=smoothstep(0.0,0.06,uv.x);
 float tip=1.0-smoothstep(0.82,1.0,uv.x);
 float body=(0.16+0.62*pow(span,0.85))*root*(0.38+0.62*tip);
 float veil=0.82+0.18*sin(uv.x*10.0-uTime*1.35+uv.y*2.7);
 float edge=smoothstep(0.18,0.95,span);
 float seam=smoothstep(0.06,0.26,uv.y)*(1.0-smoothstep(0.28,0.62,uv.y))*0.22;
 float dots=step(0.84,hash12(vec2(floor(uv.x*28.0),floor((1.0-uv.y)*8.0)+11.0)));
 dots*=smoothstep(0.16,0.92,uv.x)*(1.0-smoothstep(0.04,0.30,uv.y));
 float alpha=(body*veil + seam + dots*0.10)*uOpacity;
 if(alpha<0.01) discard;
 vec3 color=mix(uColor*0.82,uEdgeColor,0.30+0.45*edge);
 color+=uEdgeColor*(seam*0.9+dots*0.24);
 gl_FragColor=vec4(color,alpha);
}`});
 return material;
}
function ribbonFlowMaterial(color,edgeColor,opacity=.12){
 const uniforms={uTime:{value:0},uColor:{value:color.clone()},uEdgeColor:{value:edgeColor.clone()},uOpacity:{value:opacity}};
 const material=new T.ShaderMaterial({
  transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,uniforms,
  vertexShader:`varying vec2 vUv;
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec2 vUv; uniform vec3 uColor,uEdgeColor; uniform float uTime,uOpacity;
float hash12(vec2 p){vec3 p3=fract(vec3(p.xyx)*0.1031);p3+=dot(p3,p3.yzx+33.33);return fract((p3.x+p3.y)*p3.z);}
void main(){
 vec2 uv=vUv;
 float center=exp(-pow((uv.y-.5)*5.8,2.0));
 float root=smoothstep(0.0,0.07,uv.x);
 float tip=1.0-smoothstep(0.78,1.0,uv.x);
 float pulse=0.55+0.45*sin(uv.x*18.0-uTime*4.6);
 float spark=step(0.90,hash12(vec2(floor(uv.x*34.0-uTime*8.0),floor(uv.y*5.0)+3.0)));
 spark*=smoothstep(0.14,0.94,uv.x)*center;
 float alpha=(center*(0.18+0.72*pulse)*root*(0.42+0.58*tip)+spark*0.55)*uOpacity;
 if(alpha<0.01) discard;
 vec3 color=mix(uColor,uEdgeColor,0.45+0.35*pulse)+uEdgeColor*spark*0.8;
 gl_FragColor=vec4(color,alpha);
}`});
 return material;
}
function setRibbonCurve(points,time,spec){
 const n=Math.max(1,points.length-1),length=spec.length??2.4,droop=spec.droop??Math.max(.16,length*.11),sweep=spec.sweep??length*.06,flutter=spec.flutter??.045,phase=spec.phase??0,curve=spec.curve??.09;
 for(let i=0;i<=n;i++){
  const t=i/n,bias=Math.pow(t,1.18);
  const x=length*t;
  const y=-(droop*(0.14+bias)) - Math.sin(t*Math.PI)*droop*.56 + Math.sin(time*.85+t*2.4+phase)*flutter*bias;
  const z=sweep*bias + Math.sin(time*1.15+t*5.3+phase)*curve*Math.pow(t,1.45);
  points[i].set(x,y,z);
 }
}

const CYBERPUNK_RUNTIME_PROFILES={
 fighter:{
  panes:[
   {anchor:[-1.92,0.34,-0.74],rotation:[0,0,-0.34],scale:[1.26,0.18],color:'#7de5ff',opacity:.16,pulse:.26},
   {anchor:[1.92,0.34,-0.74],rotation:[0,0,0.34],scale:[1.26,0.18],color:'#7de5ff',opacity:.16,pulse:.26},
   {anchor:[-0.66,0.3,-1.72],rotation:[0,0,-0.12],scale:[0.62,0.12],color:'#d7f8ff',opacity:.11,pulse:.18},
   {anchor:[0.66,0.3,-1.72],rotation:[0,0,0.12],scale:[0.62,0.12],color:'#d7f8ff',opacity:.11,pulse:.18},
   {anchor:[0,0.18,-2.34],rotation:[-0.22,0,0],scale:[0.34,0.1],color:'#f2ffff',opacity:.09,pulse:.14}
  ],
  shards:[
   {anchor:[-2.44,0.26,-0.34],rotation:[-1.57,0,-0.12],scale:[0.96,0.16,1],points:[[0,-.07],[0,.07],[1.22,.03],[1.22,-.03]],color:'#9aefff',innerColor:'#ffffff',glowColor:'#66cbff',opacity:{panel:.12,glow:.11,inner:.14,rim:.04},pulse:.22},
   {anchor:[2.44,0.26,-0.34],rotation:[-1.57,0,0.12],scale:[0.96,0.16,1],points:[[0,-.07],[0,.07],[1.22,.03],[1.22,-.03]],color:'#9aefff',innerColor:'#ffffff',glowColor:'#66cbff',opacity:{panel:.12,glow:.11,inner:.14,rim:.04},pulse:.22},
   {anchor:[-1.02,0.18,-2.52],rotation:[-1.57,0,-0.24],scale:[0.54,0.2,1],points:[[0,-.08],[0,.08],[1,.04],[1,-.04]],color:'#baf8ff',innerColor:'#ffffff',glowColor:'#79dbff',opacity:{panel:.11,glow:.10,inner:.14,rim:.04},pulse:.18},
   {anchor:[1.02,0.18,-2.52],rotation:[-1.57,0,0.24],scale:[0.54,0.2,1],points:[[0,-.08],[0,.08],[1,.04],[1,-.04]],color:'#baf8ff',innerColor:'#ffffff',glowColor:'#79dbff',opacity:{panel:.11,glow:.10,inner:.14,rim:.04},pulse:.18}
  ],
  bars:[
   {anchor:[-1.46,0.22,-1.18],rotation:[0,0,-0.32],scale:[1.18,0.12],color:'#7fdfff',edgeColor:'#eafcff',opacity:.18,pulse:.18},
   {anchor:[1.46,0.22,-1.18],rotation:[0,0,0.32],scale:[1.18,0.12],color:'#7fdfff',edgeColor:'#eafcff',opacity:.18,pulse:.18},
   {anchor:[0,0.28,-2.06],rotation:[0,0,0],scale:[0.74,0.08],color:'#bdefff',edgeColor:'#ffffff',opacity:.12,pulse:.14}
  ],
  sparks:[{anchor:[0,0.32,-0.68],count:18,radius:[1.04,0.1,0.52],color:'#d8fdff',size:.034,opacity:.14,spin:.16,wobble:.10}]},
 halo:{
  panes:[
   {anchor:[-2.02,0.36,-0.26],rotation:[0,0,-0.32],scale:[0.94,0.26],color:'#b8ff95',opacity:.16,pulse:.18},
   {anchor:[2.02,0.36,-0.26],rotation:[0,0,0.32],scale:[0.94,0.26],color:'#b8ff95',opacity:.16,pulse:.18},
   {anchor:[-1.2,0.28,0.82],rotation:[0,0,-0.18],scale:[0.72,0.14],color:'#f3ffd5',opacity:.11,pulse:.16},
   {anchor:[1.2,0.28,0.82],rotation:[0,0,0.18],scale:[0.72,0.14],color:'#f3ffd5',opacity:.11,pulse:.16},
   {anchor:[0,0.24,1.08],rotation:[0.08,0,0],scale:[0.56,0.14],color:'#f5ffe8',opacity:.1,pulse:.22}
  ],
  shards:[
   {anchor:[-2.28,0.2,0.46],rotation:[-1.57,0,-0.34],scale:[0.96,0.24,1],points:[[0,-.12],[0,.12],[1.06,.06],[1.06,-.06]],color:'#cfffbe',innerColor:'#ffffff',glowColor:'#9bf76f',opacity:{panel:.12,glow:.12,inner:.15,rim:.05},pulse:.16},
   {anchor:[2.28,0.2,0.46],rotation:[-1.57,0,0.34],scale:[0.96,0.24,1],points:[[0,-.12],[0,.12],[1.06,.06],[1.06,-.06]],color:'#cfffbe',innerColor:'#ffffff',glowColor:'#9bf76f',opacity:{panel:.12,glow:.12,inner:.15,rim:.05},pulse:.16},
   {anchor:[-0.88,0.34,1.18],rotation:[-1.57,0,-0.7],scale:[0.42,0.16,1],points:[[0,-.09],[0,.09],[0.9,.05],[0.9,-.05]],color:'#e4ffd0',innerColor:'#ffffff',glowColor:'#b9ff88',opacity:{panel:.10,glow:.10,inner:.14,rim:.04},pulse:.18},
   {anchor:[0.88,0.34,1.18],rotation:[-1.57,0,0.7],scale:[0.42,0.16,1],points:[[0,-.09],[0,.09],[0.9,.05],[0.9,-.05]],color:'#e4ffd0',innerColor:'#ffffff',glowColor:'#b9ff88',opacity:{panel:.10,glow:.10,inner:.14,rim:.04},pulse:.18}
  ],
  bars:[
   {anchor:[-1.66,0.14,0.48],rotation:[0,0,-0.18],scale:[1.0,0.10],color:'#b7ff88',edgeColor:'#f6ffdd',opacity:.18,pulse:.12},
   {anchor:[1.66,0.14,0.48],rotation:[0,0,0.18],scale:[1.0,0.10],color:'#b7ff88',edgeColor:'#f6ffdd',opacity:.18,pulse:.12},
   {anchor:[0,0.36,1.06],rotation:[0,0,0],scale:[0.9,0.08],color:'#dfff9d',edgeColor:'#ffffff',opacity:.12,pulse:.18}
  ],
  sparks:[{anchor:[0,0.52,0],count:28,radius:[0.98,0.12,0.98],color:'#f0ffd4',size:.036,opacity:.18,spin:.18,wobble:.14}]},
 crimson:{
  panes:[
   {anchor:[-3.18,0.24,0.52],rotation:[0,0,-0.06],scale:[1.36,0.14],color:'#ff9468',opacity:.16,pulse:.26},
   {anchor:[3.18,0.24,0.52],rotation:[0,0,0.06],scale:[1.36,0.14],color:'#ff9468',opacity:.16,pulse:.26},
   {anchor:[-1.26,0.46,-0.62],rotation:[0,0,-0.52],scale:[0.76,0.16],color:'#ffc6b3',opacity:.11,pulse:.18},
   {anchor:[1.26,0.46,-0.62],rotation:[0,0,0.52],scale:[0.76,0.16],color:'#ffc6b3',opacity:.11,pulse:.18},
   {anchor:[0,0.16,-1.92],rotation:[-0.08,0,0],scale:[0.54,0.1],color:'#fff1e1',opacity:.08,pulse:.12}
  ],
  shards:[
   {anchor:[-2.26,0.32,-0.22],rotation:[-1.57,0,-0.28],scale:[1.12,0.22,1],points:[[0,-.10],[0,.10],[1.32,.08],[1.32,-.08]],color:'#ff9479',innerColor:'#fff5e8',glowColor:'#ff6138',opacity:{panel:.12,glow:.14,inner:.15,rim:.05},pulse:.24},
   {anchor:[2.26,0.32,-0.22],rotation:[-1.57,0,0.28],scale:[1.12,0.22,1],points:[[0,-.10],[0,.10],[1.32,.08],[1.32,-.08]],color:'#ff9479',innerColor:'#fff5e8',glowColor:'#ff6138',opacity:{panel:.12,glow:.14,inner:.15,rim:.05},pulse:.24},
   {anchor:[-0.94,0.54,-1.18],rotation:[-1.57,0,-0.9],scale:[0.46,0.18,1],points:[[0,-.08],[0,.08],[0.94,.12],[0.94,-.12]],color:'#ffc0aa',innerColor:'#ffffff',glowColor:'#ff7d52',opacity:{panel:.1,glow:.12,inner:.14,rim:.04},pulse:.2},
   {anchor:[0.94,0.54,-1.18],rotation:[-1.57,0,0.9],scale:[0.46,0.18,1],points:[[0,-.08],[0,.08],[0.94,.12],[0.94,-.12]],color:'#ffc0aa',innerColor:'#ffffff',glowColor:'#ff7d52',opacity:{panel:.1,glow:.12,inner:.14,rim:.04},pulse:.2}
  ],
  bars:[
   {anchor:[-2.14,0.18,-0.64],rotation:[0,0,-0.08],scale:[1.12,0.09],color:'#ff764c',edgeColor:'#ffe0c3',opacity:.20,pulse:.24},
   {anchor:[2.14,0.18,-0.64],rotation:[0,0,0.08],scale:[1.12,0.09],color:'#ff764c',edgeColor:'#ffe0c3',opacity:.20,pulse:.24},
   {anchor:[0,0.42,-1.22],rotation:[0,0,0],scale:[0.62,0.08],color:'#ffb38a',edgeColor:'#fff2e7',opacity:.13,pulse:.18}
  ],
  sparks:[{anchor:[0,0.38,-0.32],count:32,radius:[1.16,0.1,0.46],color:'#ffc493',size:.04,opacity:.22,spin:.32,wobble:.18}]},
 azure:{
  panes:[
   {anchor:[-3.06,0.46,-0.92],rotation:[0,0,-0.08],scale:[1.34,0.18],color:'#91ddff',opacity:.15,pulse:.16},
   {anchor:[3.06,0.46,-0.92],rotation:[0,0,0.08],scale:[1.34,0.18],color:'#91ddff',opacity:.15,pulse:.16},
   {anchor:[-1.02,0.28,-2.22],rotation:[0,0,-0.16],scale:[0.62,0.12],color:'#dff9ff',opacity:.11,pulse:.14},
   {anchor:[1.02,0.28,-2.22],rotation:[0,0,0.16],scale:[0.62,0.12],color:'#dff9ff',opacity:.11,pulse:.14},
   {anchor:[0,0.16,-2.66],rotation:[0.04,0,0],scale:[0.38,0.1],color:'#f6ffff',opacity:.08,pulse:.12}
  ],
  shards:[
   {anchor:[-1.42,0.22,-2.0],rotation:[-1.57,0,-0.18],scale:[0.92,0.18,1],points:[[0,-.08],[0,.08],[1.24,.03],[1.24,-.03]],color:'#c8f0ff',innerColor:'#ffffff',glowColor:'#79cfff',opacity:{panel:.11,glow:.1,inner:.14,rim:.04},pulse:.16},
   {anchor:[1.42,0.22,-2.0],rotation:[-1.57,0,0.18],scale:[0.92,0.18,1],points:[[0,-.08],[0,.08],[1.24,.03],[1.24,-.03]],color:'#c8f0ff',innerColor:'#ffffff',glowColor:'#79cfff',opacity:{panel:.11,glow:.1,inner:.14,rim:.04},pulse:.16},
   {anchor:[-2.52,0.28,-0.84],rotation:[-1.57,0,-0.1],scale:[0.94,0.12,1],points:[[0,-.06],[0,.06],[1.34,.02],[1.34,-.02]],color:'#a9e5ff',innerColor:'#ffffff',glowColor:'#63bfff',opacity:{panel:.1,glow:.10,inner:.13,rim:.04},pulse:.14},
   {anchor:[2.52,0.28,-0.84],rotation:[-1.57,0,0.1],scale:[0.94,0.12,1],points:[[0,-.06],[0,.06],[1.34,.02],[1.34,-.02]],color:'#a9e5ff',innerColor:'#ffffff',glowColor:'#63bfff',opacity:{panel:.1,glow:.10,inner:.13,rim:.04},pulse:.14}
  ],
  bars:[
   {anchor:[-2.5,0.18,-1.28],rotation:[0,0,-0.06],scale:[1.34,0.08],color:'#88d7ff',edgeColor:'#f0feff',opacity:.18,pulse:.14},
   {anchor:[2.5,0.18,-1.28],rotation:[0,0,0.06],scale:[1.34,0.08],color:'#88d7ff',edgeColor:'#f0feff',opacity:.18,pulse:.14},
   {anchor:[0,0.24,-2.24],rotation:[0,0,0],scale:[0.8,0.06],color:'#b5e9ff',edgeColor:'#ffffff',opacity:.11,pulse:.12}
  ],
  sparks:[{anchor:[0,0.34,-0.64],count:18,radius:[0.96,0.1,0.7],color:'#c8f1ff',size:.034,opacity:.15,spin:.16,wobble:.12}]},
 prism:{
  panes:[
   {anchor:[-2.08,0.42,-0.18],rotation:[0,0,-0.24],scale:[1.08,0.34],color:'#c6ffd5',opacity:.16,pulse:.18},
   {anchor:[2.08,0.42,-0.18],rotation:[0,0,0.24],scale:[1.08,0.34],color:'#c6ffd5',opacity:.16,pulse:.18},
   {anchor:[-0.88,0.54,-0.64],rotation:[0,0,-0.44],scale:[0.52,0.16],color:'#f2fff3',opacity:.1,pulse:.16},
   {anchor:[0.88,0.54,-0.64],rotation:[0,0,0.44],scale:[0.52,0.16],color:'#f2fff3',opacity:.1,pulse:.16},
   {anchor:[0,0.58,-0.62],rotation:[0,0,0],scale:[0.72,0.12],color:'#f8fff7',opacity:.08,pulse:.12}
  ],
  shards:[
   {anchor:[-1.68,0.3,-0.48],rotation:[-1.57,0,-0.42],scale:[1.04,0.26,1],points:[[0,-.10],[0,.10],[1.0,.14],[1.0,-.14]],color:'#e2ffd1',innerColor:'#ffffff',glowColor:'#9bffb3',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.2},
   {anchor:[1.68,0.3,-0.48],rotation:[-1.57,0,0.42],scale:[1.04,0.26,1],points:[[0,-.10],[0,.10],[1.0,.14],[1.0,-.14]],color:'#e2ffd1',innerColor:'#ffffff',glowColor:'#9bffb3',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.2},
   {anchor:[-2.46,0.2,0.06],rotation:[-1.57,0,-0.22],scale:[0.82,0.18,1],points:[[0,-.08],[0,.08],[0.94,.04],[0.94,-.04]],color:'#d5ffcc',innerColor:'#ffffff',glowColor:'#85f6a5',opacity:{panel:.1,glow:.1,inner:.13,rim:.04},pulse:.16},
   {anchor:[2.46,0.2,0.06],rotation:[-1.57,0,0.22],scale:[0.82,0.18,1],points:[[0,-.08],[0,.08],[0.94,.04],[0.94,-.04]],color:'#d5ffcc',innerColor:'#ffffff',glowColor:'#85f6a5',opacity:{panel:.1,glow:.1,inner:.13,rim:.04},pulse:.16}
  ],
  bars:[
   {anchor:[-1.84,0.26,-0.02],rotation:[0,0,-0.22],scale:[1.02,0.10],color:'#aef7b0',edgeColor:'#f6fff0',opacity:.18,pulse:.16},
   {anchor:[1.84,0.26,-0.02],rotation:[0,0,0.22],scale:[1.02,0.10],color:'#aef7b0',edgeColor:'#f6fff0',opacity:.18,pulse:.16},
   {anchor:[0,0.64,-0.44],rotation:[0,0,0],scale:[0.68,0.08],color:'#d8ff7d',edgeColor:'#ffffff',opacity:.12,pulse:.14}
  ],
  sparks:[{anchor:[0,0.36,-0.12],count:26,radius:[0.92,0.12,0.92],color:'#f0ffc6',size:.036,opacity:.18,spin:.18,wobble:.12}]},
 scarlet:{
  panes:[
   {anchor:[-2.52,0.28,-0.48],rotation:[0,0,-0.18],scale:[1.12,0.16],color:'#ff7cb8',opacity:.16,pulse:.22},
   {anchor:[2.52,0.28,-0.48],rotation:[0,0,0.18],scale:[1.12,0.16],color:'#ff7cb8',opacity:.16,pulse:.22},
   {anchor:[-0.82,0.26,-1.34],rotation:[0,0,-0.18],scale:[0.56,0.1],color:'#ffd8ec',opacity:.1,pulse:.16},
   {anchor:[0.82,0.26,-1.34],rotation:[0,0,0.18],scale:[0.56,0.1],color:'#ffd8ec',opacity:.1,pulse:.16},
   {anchor:[0,0.22,-1.54],rotation:[0,0,0],scale:[0.52,0.1],color:'#fff4fb',opacity:.08,pulse:.12}
  ],
  shards:[
   {anchor:[-2.06,0.18,-0.62],rotation:[-1.57,0,-0.12],scale:[0.92,0.16,1],points:[[0,-.07],[0,.07],[1.18,.04],[1.18,-.04]],color:'#ffa5d2',innerColor:'#fff3fb',glowColor:'#ff63aa',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.18},
   {anchor:[2.06,0.18,-0.62],rotation:[-1.57,0,0.12],scale:[0.92,0.16,1],points:[[0,-.07],[0,.07],[1.18,.04],[1.18,-.04]],color:'#ffa5d2',innerColor:'#fff3fb',glowColor:'#ff63aa',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.18},
   {anchor:[-1.02,0.4,-0.82],rotation:[-1.57,0,-0.68],scale:[0.42,0.16,1],points:[[0,-.08],[0,.08],[0.84,.10],[0.84,-.10]],color:'#ffc1e0',innerColor:'#ffffff',glowColor:'#ff80b8',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.2},
   {anchor:[1.02,0.4,-0.82],rotation:[-1.57,0,0.68],scale:[0.42,0.16,1],points:[[0,-.08],[0,.08],[0.84,.10],[0.84,-.10]],color:'#ffc1e0',innerColor:'#ffffff',glowColor:'#ff80b8',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.2}
  ],
  bars:[
   {anchor:[-1.72,0.16,-0.84],rotation:[0,0,-0.12],scale:[0.92,0.08],color:'#ff74b7',edgeColor:'#ffe7f6',opacity:.18,pulse:.18},
   {anchor:[1.72,0.16,-0.84],rotation:[0,0,0.12],scale:[0.92,0.08],color:'#ff74b7',edgeColor:'#ffe7f6',opacity:.18,pulse:.18},
   {anchor:[0,0.3,-1.08],rotation:[0,0,0],scale:[0.52,0.08],color:'#ffb9df',edgeColor:'#ffffff',opacity:.11,pulse:.16}
  ],
  sparks:[{anchor:[0,0.32,-0.26],count:20,radius:[1.04,0.1,0.42],color:'#ffc2e5',size:.036,opacity:.18,spin:.24,wobble:.16}]},
 verdure:{
  panes:[
   {anchor:[-1.96,0.26,-0.98],rotation:[0,0,-0.24],scale:[0.92,0.32],color:'#b8ffd0',opacity:.16,pulse:.16},
   {anchor:[1.96,0.26,-0.98],rotation:[0,0,0.24],scale:[0.92,0.32],color:'#b8ffd0',opacity:.16,pulse:.16},
   {anchor:[-0.82,0.34,0.72],rotation:[0,0,-0.12],scale:[0.52,0.12],color:'#f4fff1',opacity:.1,pulse:.14},
   {anchor:[0.82,0.34,0.72],rotation:[0,0,0.12],scale:[0.52,0.12],color:'#f4fff1',opacity:.1,pulse:.14},
   {anchor:[0,0.46,0.96],rotation:[0.06,0,0],scale:[0.54,0.12],color:'#fbfff9',opacity:.08,pulse:.12}
  ],
  shards:[
   {anchor:[-1.08,0.42,0.08],rotation:[-1.57,0,-0.88],scale:[0.76,0.28,1],points:[[0,-.10],[0,.10],[0.84,.08],[0.84,-.08]],color:'#ddffd8',innerColor:'#ffffff',glowColor:'#8cf6bb',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.16},
   {anchor:[1.08,0.42,0.08],rotation:[-1.57,0,0.88],scale:[0.76,0.28,1],points:[[0,-.10],[0,.10],[0.84,.08],[0.84,-.08]],color:'#ddffd8',innerColor:'#ffffff',glowColor:'#8cf6bb',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.16},
   {anchor:[-2.22,0.22,-0.56],rotation:[-1.57,0,-0.24],scale:[0.84,0.18,1],points:[[0,-.08],[0,.08],[1.08,.04],[1.08,-.04]],color:'#cbffcf',innerColor:'#ffffff',glowColor:'#84f4ab',opacity:{panel:.1,glow:.1,inner:.13,rim:.04},pulse:.16},
   {anchor:[2.22,0.22,-0.56],rotation:[-1.57,0,0.24],scale:[0.84,0.18,1],points:[[0,-.08],[0,.08],[1.08,.04],[1.08,-.04]],color:'#cbffcf',innerColor:'#ffffff',glowColor:'#84f4ab',opacity:{panel:.1,glow:.1,inner:.13,rim:.04},pulse:.16}
  ],
  bars:[
   {anchor:[-1.34,0.22,-0.16],rotation:[0,0,-0.38],scale:[0.86,0.08],color:'#8df3b2',edgeColor:'#effff6',opacity:.16,pulse:.12},
   {anchor:[1.34,0.22,-0.16],rotation:[0,0,0.38],scale:[0.86,0.08],color:'#8df3b2',edgeColor:'#effff6',opacity:.16,pulse:.12},
   {anchor:[0,0.48,0.82],rotation:[0,0,0],scale:[0.7,0.08],color:'#b7ffd0',edgeColor:'#ffffff',opacity:.10,pulse:.12}
  ],
  sparks:[{anchor:[0,0.64,0.02],count:28,radius:[0.94,0.12,0.94],color:'#f3ffc7',size:.034,opacity:.18,spin:.14,wobble:.12}]},
 bastion:{
  panes:[
   {anchor:[-2.42,0.56,-1.0],rotation:[0,0,-0.08],scale:[1.22,0.16],color:'#9fd8ff',opacity:.14,pulse:.12},
   {anchor:[2.42,0.56,-1.0],rotation:[0,0,0.08],scale:[1.22,0.16],color:'#9fd8ff',opacity:.14,pulse:.12},
   {anchor:[-4.24,0.36,0.18],rotation:[0,0,-0.02],scale:[0.68,0.12],color:'#e6f8ff',opacity:.09,pulse:.14},
   {anchor:[4.24,0.36,0.18],rotation:[0,0,0.02],scale:[0.68,0.12],color:'#e6f8ff',opacity:.09,pulse:.14},
   {anchor:[0,0.42,-1.48],rotation:[0,0,0],scale:[0.44,0.1],color:'#f3fbff',opacity:.08,pulse:.12}
  ],
  shards:[
   {anchor:[-1.82,0.62,-2.16],rotation:[-1.57,0,-0.14],scale:[1.02,0.22,1],points:[[0,-.12],[0,.12],[1.24,.04],[1.24,-.04]],color:'#c0e7ff',innerColor:'#ffffff',glowColor:'#74c2ff',opacity:{panel:.11,glow:.1,inner:.13,rim:.04},pulse:.14},
   {anchor:[1.82,0.62,-2.16],rotation:[-1.57,0,0.14],scale:[1.02,0.22,1],points:[[0,-.12],[0,.12],[1.24,.04],[1.24,-.04]],color:'#c0e7ff',innerColor:'#ffffff',glowColor:'#74c2ff',opacity:{panel:.11,glow:.1,inner:.13,rim:.04},pulse:.14},
   {anchor:[-3.06,0.34,-0.82],rotation:[-1.57,0,-0.04],scale:[0.86,0.1,1],points:[[0,-.06],[0,.06],[1.04,.02],[1.04,-.02]],color:'#b7e2ff',innerColor:'#ffffff',glowColor:'#7ebeff',opacity:{panel:.1,glow:.09,inner:.12,rim:.04},pulse:.12},
   {anchor:[3.06,0.34,-0.82],rotation:[-1.57,0,0.04],scale:[0.86,0.1,1],points:[[0,-.06],[0,.06],[1.04,.02],[1.04,-.02]],color:'#b7e2ff',innerColor:'#ffffff',glowColor:'#7ebeff',opacity:{panel:.1,glow:.09,inner:.12,rim:.04},pulse:.12}
  ],
  bars:[
   {anchor:[-3.24,0.24,-0.86],rotation:[0,0,-0.04],scale:[1.42,0.08],color:'#77b9ff',edgeColor:'#e8f6ff',opacity:.16,pulse:.10},
   {anchor:[3.24,0.24,-0.86],rotation:[0,0,0.04],scale:[1.42,0.08],color:'#77b9ff',edgeColor:'#e8f6ff',opacity:.16,pulse:.10},
   {anchor:[0,0.54,-1.74],rotation:[0,0,0],scale:[0.84,0.08],color:'#b9e0ff',edgeColor:'#ffffff',opacity:.12,pulse:.12}
  ],
  sparks:[{anchor:[0,0.56,-1.0],count:14,radius:[0.72,0.08,0.36],color:'#d9efff',size:.03,opacity:.14,spin:.10,wobble:.08}]},
 wraith:{
  panes:[
   {anchor:[-1.92,0.6,-0.02],rotation:[0,0,-0.16],scale:[1.7,0.12],color:'#e6fbff',opacity:.08,pulse:.08},
   {anchor:[1.92,0.6,-0.02],rotation:[0,0,0.16],scale:[1.7,0.12],color:'#e6fbff',opacity:.08,pulse:.08},
   {anchor:[-0.74,0.32,-1.12],rotation:[0,0,-0.12],scale:[0.46,0.08],color:'#ffffff',opacity:.06,pulse:.10},
   {anchor:[0.74,0.32,-1.12],rotation:[0,0,0.12],scale:[0.46,0.08],color:'#ffffff',opacity:.06,pulse:.10},
   {anchor:[0,0.28,-1.12],rotation:[0,0,0],scale:[0.42,0.08],color:'#fbffff',opacity:.05,pulse:.12}
  ],
  shards:[
   {anchor:[-1.52,0.38,-0.24],rotation:[-1.57,0,-0.32],scale:[0.72,0.18,1],points:[[0,-.07],[0,.07],[0.82,.05],[0.82,-.05]],color:'#ebfcff',innerColor:'#ffffff',glowColor:'#a6e8ff',opacity:{panel:.07,glow:.07,inner:.1,rim:.03},pulse:.1},
   {anchor:[1.52,0.38,-0.24],rotation:[-1.57,0,0.32],scale:[0.72,0.18,1],points:[[0,-.07],[0,.07],[0.82,.05],[0.82,-.05]],color:'#ebfcff',innerColor:'#ffffff',glowColor:'#a6e8ff',opacity:{panel:.07,glow:.07,inner:.1,rim:.03},pulse:.1},
   {anchor:[-2.3,0.2,0.16],rotation:[-1.57,0,-0.14],scale:[0.82,0.1,1],points:[[0,-.05],[0,.05],[1.16,.02],[1.16,-.02]],color:'#ebfdff',innerColor:'#ffffff',glowColor:'#9fdfff',opacity:{panel:.06,glow:.06,inner:.09,rim:.03},pulse:.08},
   {anchor:[2.3,0.2,0.16],rotation:[-1.57,0,0.14],scale:[0.82,0.1,1],points:[[0,-.05],[0,.05],[1.16,.02],[1.16,-.02]],color:'#ebfdff',innerColor:'#ffffff',glowColor:'#9fdfff',opacity:{panel:.06,glow:.06,inner:.09,rim:.03},pulse:.08}
  ],
  bars:[
   {anchor:[-1.76,0.18,-0.42],rotation:[0,0,-0.16],scale:[1.08,0.06],color:'#c9f1ff',edgeColor:'#ffffff',opacity:.11,pulse:.08},
   {anchor:[1.76,0.18,-0.42],rotation:[0,0,0.16],scale:[1.08,0.06],color:'#c9f1ff',edgeColor:'#ffffff',opacity:.11,pulse:.08},
   {anchor:[0,0.38,-1.02],rotation:[0,0,0],scale:[0.54,0.05],color:'#effcff',edgeColor:'#ffffff',opacity:.08,pulse:.08}
  ],
  sparks:[{anchor:[0,0.58,-0.74],count:10,radius:[0.74,0.08,0.44],color:'#f9ffff',size:.028,opacity:.09,spin:.06,wobble:.06}]},
 auric:{
  panes:[
   {anchor:[-2.04,0.36,-0.04],rotation:[0,0,-0.22],scale:[1.0,0.28],color:'#ffd46f',opacity:.16,pulse:.14},
   {anchor:[2.04,0.36,-0.04],rotation:[0,0,0.22],scale:[1.0,0.28],color:'#ffd46f',opacity:.16,pulse:.14},
   {anchor:[-0.92,0.52,-0.38],rotation:[0,0,-0.48],scale:[0.54,0.16],color:'#fff5cf',opacity:.1,pulse:.14},
   {anchor:[0.92,0.52,-0.38],rotation:[0,0,0.48],scale:[0.54,0.16],color:'#fff5cf',opacity:.1,pulse:.14},
   {anchor:[0,0.42,-0.86],rotation:[0,0,0],scale:[0.72,0.1],color:'#fff9e4',opacity:.08,pulse:.12}
  ],
  shards:[
   {anchor:[-1.02,0.44,-0.4],rotation:[-1.57,0,-0.74],scale:[0.82,0.24,1],points:[[0,-.09],[0,.09],[0.86,.1],[0.86,-.1]],color:'#ffe8b0',innerColor:'#fffdf4',glowColor:'#ffca66',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.16},
   {anchor:[1.02,0.44,-0.4],rotation:[-1.57,0,0.74],scale:[0.82,0.24,1],points:[[0,-.09],[0,.09],[0.86,.1],[0.86,-.1]],color:'#ffe8b0',innerColor:'#fffdf4',glowColor:'#ffca66',opacity:{panel:.1,glow:.1,inner:.14,rim:.04},pulse:.16},
   {anchor:[-2.1,0.24,-0.18],rotation:[-1.57,0,-0.2],scale:[0.88,0.16,1],points:[[0,-.07],[0,.07],[1.0,.04],[1.0,-.04]],color:'#ffe4a2',innerColor:'#ffffff',glowColor:'#ffc45a',opacity:{panel:.1,glow:.1,inner:.13,rim:.04},pulse:.14},
   {anchor:[2.1,0.24,-0.18],rotation:[-1.57,0,0.2],scale:[0.88,0.16,1],points:[[0,-.07],[0,.07],[1.0,.04],[1.0,-.04]],color:'#ffe4a2',innerColor:'#ffffff',glowColor:'#ffc45a',opacity:{panel:.1,glow:.1,inner:.13,rim:.04},pulse:.14}
  ],
  bars:[
   {anchor:[-1.62,0.18,-0.02],rotation:[0,0,-0.2],scale:[0.96,0.08],color:'#ffc760',edgeColor:'#fff7d5',opacity:.18,pulse:.12},
   {anchor:[1.62,0.18,-0.02],rotation:[0,0,0.2],scale:[0.96,0.08],color:'#ffc760',edgeColor:'#fff7d5',opacity:.18,pulse:.12},
   {anchor:[0,0.54,-0.62],rotation:[0,0,0],scale:[0.84,0.08],color:'#ffe190',edgeColor:'#ffffff',opacity:.12,pulse:.12}
  ],
  sparks:[{anchor:[0,0.68,-0.16],count:24,radius:[1.02,0.08,1.02],color:'#ffecad',size:.036,opacity:.2,spin:.10,wobble:.10}]}
};


const CYBERPUNK_SIGNATURES={
 fighter:{nodes:[
  {anchor:[-0.68,0.34,-1.18],rotation:[0,0,-0.18],scale:[0.34,0.16],color:'#9de9ff',edgeColor:'#ffffff',opacity:.20,pulse:.18,pattern:2},
  {anchor:[0.68,0.34,-1.18],rotation:[0,0,0.18],scale:[0.34,0.16],color:'#9de9ff',edgeColor:'#ffffff',opacity:.20,pulse:.18,pattern:2},
  {anchor:[0,0.34,-2.48],rotation:[0,0,0],scale:[0.22,0.22],color:'#d8f8ff',edgeColor:'#ffffff',opacity:.16,pulse:.12,pattern:0}
 ]},
 halo:{nodes:[
  {anchor:[-1.02,0.34,0.66],rotation:[0,0,-0.34],scale:[0.34,0.18],color:'#c4ff97',edgeColor:'#f8ffe7',opacity:.18,pulse:.12,pattern:3},
  {anchor:[1.02,0.34,0.66],rotation:[0,0,0.34],scale:[0.34,0.18],color:'#c4ff97',edgeColor:'#f8ffe7',opacity:.18,pulse:.12,pattern:3},
  {anchor:[0,0.36,1.18],rotation:[0,0,0],scale:[0.24,0.20],color:'#e9ffd0',edgeColor:'#ffffff',opacity:.14,pulse:.14,pattern:1}
 ]},
 crimson:{nodes:[
  {anchor:[-1.14,0.36,-0.88],rotation:[0,0,-0.64],scale:[0.36,0.16],color:'#ff8a66',edgeColor:'#fff0df',opacity:.20,pulse:.20,pattern:2},
  {anchor:[1.14,0.36,-0.88],rotation:[0,0,0.64],scale:[0.36,0.16],color:'#ff8a66',edgeColor:'#fff0df',opacity:.20,pulse:.20,pattern:2},
  {anchor:[0,0.28,-1.56],rotation:[0,0,0],scale:[0.32,0.12],color:'#ffc3a7',edgeColor:'#ffffff',opacity:.14,pulse:.16,pattern:0}
 ]},
 azure:{nodes:[
  {anchor:[-1.44,0.32,-1.84],rotation:[0,0,-0.08],scale:[0.44,0.12],color:'#97dcff',edgeColor:'#effcff',opacity:.18,pulse:.10,pattern:1},
  {anchor:[1.44,0.32,-1.84],rotation:[0,0,0.08],scale:[0.44,0.12],color:'#97dcff',edgeColor:'#effcff',opacity:.18,pulse:.10,pattern:1},
  {anchor:[0,0.28,-2.64],rotation:[0,0,0],scale:[0.26,0.16],color:'#ccefff',edgeColor:'#ffffff',opacity:.12,pulse:.10,pattern:2}
 ]},
 prism:{nodes:[
  {anchor:[-0.82,0.42,-0.18],rotation:[0,0,-0.28],scale:[0.34,0.14],color:'#bfffb2',edgeColor:'#f8fff4',opacity:.18,pulse:.14,pattern:0},
  {anchor:[0.82,0.42,-0.18],rotation:[0,0,0.28],scale:[0.34,0.14],color:'#bfffb2',edgeColor:'#f8fff4',opacity:.18,pulse:.14,pattern:0},
  {anchor:[0,0.62,-0.62],rotation:[0,0,0],scale:[0.28,0.16],color:'#d4ff8d',edgeColor:'#ffffff',opacity:.14,pulse:.12,pattern:3}
 ]},
 scarlet:{nodes:[
  {anchor:[-0.96,0.34,-0.94],rotation:[0,0,-0.46],scale:[0.34,0.18],color:'#ff74bd',edgeColor:'#ffe9f7',opacity:.18,pulse:.18,pattern:2},
  {anchor:[0.96,0.34,-0.94],rotation:[0,0,0.46],scale:[0.34,0.18],color:'#ff74bd',edgeColor:'#ffe9f7',opacity:.18,pulse:.18,pattern:2},
  {anchor:[0,0.3,-1.34],rotation:[0,0,0],scale:[0.26,0.18],color:'#ffb7e0',edgeColor:'#ffffff',opacity:.12,pulse:.16,pattern:0}
 ]},
 verdure:{nodes:[
  {anchor:[-1.44,0.26,0.18],rotation:[0,0,-0.18],scale:[0.42,0.14],color:'#8ff0b0',edgeColor:'#effff5',opacity:.18,pulse:.12,pattern:1},
  {anchor:[1.44,0.26,0.18],rotation:[0,0,0.18],scale:[0.42,0.14],color:'#8ff0b0',edgeColor:'#effff5',opacity:.18,pulse:.12,pattern:1},
  {anchor:[0,0.56,0.68],rotation:[0,0,0],scale:[0.24,0.20],color:'#bcffd7',edgeColor:'#ffffff',opacity:.12,pulse:.12,pattern:3}
 ]},
 bastion:{nodes:[
  {anchor:[-2.06,0.24,-0.34],rotation:[0,0,-0.04],scale:[0.46,0.16],color:'#8cc7ff',edgeColor:'#eff8ff',opacity:.18,pulse:.10,pattern:3},
  {anchor:[2.06,0.24,-0.34],rotation:[0,0,0.04],scale:[0.46,0.16],color:'#8cc7ff',edgeColor:'#eff8ff',opacity:.18,pulse:.10,pattern:3},
  {anchor:[0,0.48,-1.26],rotation:[0,0,0],scale:[0.30,0.18],color:'#cfe5ff',edgeColor:'#ffffff',opacity:.14,pulse:.10,pattern:1}
 ]},
 wraith:{nodes:[
  {anchor:[-1.34,0.22,-0.78],rotation:[0,0,-0.28],scale:[0.36,0.14],color:'#ddfbff',edgeColor:'#ffffff',opacity:.12,pulse:.08,pattern:2},
  {anchor:[1.34,0.22,-0.78],rotation:[0,0,0.28],scale:[0.36,0.14],color:'#ddfbff',edgeColor:'#ffffff',opacity:.12,pulse:.08,pattern:2},
  {anchor:[0,0.44,-1.54],rotation:[0,0,0],scale:[0.24,0.16],color:'#effdff',edgeColor:'#ffffff',opacity:.10,pulse:.08,pattern:0}
 ]},
 auric:{nodes:[
  {anchor:[-0.82,0.42,-0.24],rotation:[0,0,-0.42],scale:[0.36,0.18],color:'#ffd17a',edgeColor:'#fff8de',opacity:.18,pulse:.12,pattern:2},
  {anchor:[0.82,0.42,-0.24],rotation:[0,0,0.42],scale:[0.36,0.18],color:'#ffd17a',edgeColor:'#fff8de',opacity:.18,pulse:.12,pattern:2},
  {anchor:[0,0.58,-0.84],rotation:[0,0,0],scale:[0.32,0.20],color:'#ffe7a8',edgeColor:'#ffffff',opacity:.12,pulse:.12,pattern:0}
 ]}
};

function mergeSpecialSpec(spec,variant){
 const profile=CYBERPUNK_RUNTIME_PROFILES[variant];
 const signature=CYBERPUNK_SIGNATURES[variant];
 if(!profile&&!signature)return spec;
 return {
  ...spec,
  lenses:[...(spec.lenses||[]),...(profile?.lenses||[]),...(signature?.lenses||[])],
  panes:[...(spec.panes||[]),...(profile?.panes||[]),...(signature?.panes||[])],
  bars:[...(spec.bars||[]),...(profile?.bars||[]),...(signature?.bars||[])],
  nodes:[...(spec.nodes||[]),...(profile?.nodes||[]),...(signature?.nodes||[])],
  ribbons:[...(spec.ribbons||[])],
  shards:[...(spec.shards||[]),...(profile?.shards||[]),...(signature?.shards||[])],
  sparks:[...(spec.sparks||[]),...(profile?.sparks||[]),...(signature?.sparks||[])],
 };
}
/** Extra material language driven by package metadata. These meshes are purely
 * decorative, excluded from triangle accounting, and persist with each fighter.
 */
export function buildSpecialFx(spec,config,ownedGeometries,ownedMaterials,variant){
 spec=mergeSpecialSpec(spec,variant);
 if(!spec)return null;
 const root=new T.Group();root.name='special-fx';root.userData.statsExclude=true;
 const lenses=[],panes=[],bars=[],nodes=[],sparks=[],shards=[],ribbons=[];
 const ribbonRoot=new T.Group();ribbonRoot.name='Counted single-surface veils';const veils=[];
 for(const lens of spec.lenses||[]){
  const g=new T.Group();g.position.fromArray(lens.anchor||[0,0,0]);g.rotation.fromArray(lens.rotation||[-Math.PI/2,0,0]);root.add(g);
  const coreGeo=new T.CircleGeometry(lens.radius?.[0]||lens.radius||.8,48);
  const haloGeo=new T.CircleGeometry((lens.radius?.[1]||lens.radius||.8)*1.24,48);
  const ringGeo=new T.RingGeometry((lens.ring?.[0]||.84)*(lens.radius?.[0]||1),(lens.ring?.[1]||1.0)*(lens.radius?.[0]||1),48,1);
  const sheenGeo=new T.PlaneGeometry((lens.sheen?.[0]||1.4)*(lens.radius?.[0]||1),(lens.sheen?.[1]||.48)*(lens.radius?.[0]||1));
  addOwned(ownedGeometries,coreGeo,haloGeo,ringGeo,sheenGeo);
  const core=new T.Mesh(coreGeo,meshBasic(colorOf(lens.color,config,'#dff4ff'),lens.opacity?.core??.52));
  const halo=new T.Mesh(haloGeo,meshBasic(colorOf(lens.haloColor||lens.color,config,'#ffffff'),lens.opacity?.halo??.20));halo.position.z=-.002;
  const ring=new T.Mesh(ringGeo,meshBasic(colorOf(lens.ringColor||lens.color,config,'#ffffff'),lens.opacity?.ring??.44));ring.position.z=.004;
  const sheen=new T.Mesh(sheenGeo,standardGlass(colorOf(lens.sheenColor||lens.color,config,'#ffffff'),lens.opacity?.sheen??.16));
  sheen.position.set(0,0,.006);sheen.rotation.z=lens.sheenTilt??.2;
  addOwned(ownedMaterials,core.material,halo.material,ring.material,sheen.material);
  g.add(core,halo,ring,sheen);
  for(const m of [core,halo,ring,sheen]){m.renderOrder=20;m.frustumCulled=false;}
  lenses.push({spec:lens,group:g,core,halo,ring,sheen,baseScale:lens.scale??1,pulse:lens.pulse??1,spin:lens.spin??0});
 }
 for(const pane of spec.panes||[]){
  const geo=new T.PlaneGeometry(pane.scale?.[0]||1,pane.scale?.[1]||1);addOwned(ownedGeometries,geo);
  const mesh=new T.Mesh(geo,standardGlass(colorOf(pane.color,config,'#cfefff'),pane.opacity??.22));addOwned(ownedMaterials,mesh.material);
  mesh.position.fromArray(pane.anchor||[0,0,0]);mesh.rotation.fromArray(pane.rotation||[0,0,0]);mesh.renderOrder=18;mesh.frustumCulled=false;root.add(mesh);
  panes.push({spec:pane,mesh,baseOpacity:pane.opacity??.22,pulse:pane.pulse??.12});
 }
 for(const bar of spec.bars||[]){
  const geo=new T.PlaneGeometry(bar.scale?.[0]||1,bar.scale?.[1]||1);addOwned(ownedGeometries,geo);
  const mesh=new T.Mesh(geo,cyberStripMaterial(colorOf(bar.color,config,'#cfefff'),colorOf(bar.edgeColor||bar.color,config,'#ffffff'),bar.opacity??.18));addOwned(ownedMaterials,mesh.material);
  mesh.position.fromArray(bar.anchor||[0,0,0]);mesh.rotation.fromArray(bar.rotation||[0,0,0]);mesh.renderOrder=19;mesh.frustumCulled=false;root.add(mesh);
  bars.push({spec:bar,mesh,baseOpacity:bar.opacity??.18,pulse:bar.pulse??.12,drift:bar.drift??0});
 }
 for(const node of spec.nodes||[]){
  const geo=new T.PlaneGeometry(node.scale?.[0]||1,node.scale?.[1]||1);addOwned(ownedGeometries,geo);
  const mesh=new T.Mesh(geo,cyberNodeMaterial(colorOf(node.color,config,'#dfffff'),colorOf(node.edgeColor||node.color,config,'#ffffff'),node.opacity??.18,node.pattern??0));addOwned(ownedMaterials,mesh.material);
  mesh.position.fromArray(node.anchor||[0,0,0]);mesh.rotation.fromArray(node.rotation||[0,0,0]);mesh.renderOrder=20;mesh.frustumCulled=false;root.add(mesh);
  nodes.push({spec:node,mesh,baseOpacity:node.opacity??.18,pulse:node.pulse??.12,drift:node.drift??0,baseScale:[...(node.scale||[1,1])]});
 }

 for(const ribbon of spec.ribbons||[]){
  if(ribbon.style===VEIL_STYLE){const veil=new VeilRibbon(ribbon,spec.materialLibrary,config,ownedGeometries,ownedMaterials);ribbonRoot.add(veil.root);veils.push(veil);continue;}
  const group=new T.Group();
  const anchor=ribbon.anchor||[0,0,0],rot=ribbon.rotation||[-Math.PI/2,0,0],scale=ribbon.scale||[1,1,1];
  const side=ribbon.symmetric===false?(ribbon.side||1):((anchor[0]||0)<0?-1:1);
  group.position.fromArray(anchor);
  group.rotation.set(rot[0]??-Math.PI/2,Math.abs(rot[1]||0),Math.abs(rot[2]||0));
  group.scale.set((scale[0]||1)*(side<0?-1:1),scale[1]||1,scale[2]||1);
  root.add(group);
  const segments=ribbon.segments??16;
  const panelRibbon=new RibbonGeometry(segments),glowRibbon=new RibbonGeometry(segments),flowRibbon=new RibbonGeometry(segments);
  addOwned(ownedGeometries,panelRibbon.geometry,glowRibbon.geometry,flowRibbon.geometry);
  const panel=new T.Mesh(panelRibbon.geometry,ribbonPanelMaterial(colorOf(ribbon.color,config,'#b8f8ff'),colorOf(ribbon.innerColor||ribbon.glowColor||ribbon.color,config,'#ffffff'),ribbon.opacity?.panel??.24));
  const glow=new T.Mesh(glowRibbon.geometry,meshBasic(colorOf(ribbon.glowColor||ribbon.color,config,'#ddffff'),ribbon.opacity?.glow??.11));
  const flow=new T.Mesh(flowRibbon.geometry,ribbonFlowMaterial(colorOf(ribbon.flowColor||ribbon.innerColor||ribbon.color,config,'#f4ffff'),colorOf(ribbon.innerColor||ribbon.glowColor||ribbon.color,config,'#ffffff'),ribbon.opacity?.flow??.16));
  addOwned(ownedMaterials,panel.material,glow.material,flow.material);
  group.add(glow,panel,flow);
  for(const m of [glow,panel,flow]){m.renderOrder=19;m.frustumCulled=false;}
  ribbons.push({
   spec:ribbon,group,panel,glow,flow,pulse:ribbon.pulse??.18,drift:ribbon.drift??0,
   points:Array.from({length:segments+1},()=>new T.Vector3()),
   camera:new T.Vector3(0,0,8),
   normal:new T.Vector3().fromArray(ribbon.normal||[0,0,1]),
   panelRibbon,glowRibbon,flowRibbon,
   panelWidth:(ribbon.baseWidth??.28)*2,
   glowWidth:(ribbon.baseWidth??.28)*2*(ribbon.glowScale??1.18),
   flowWidth:(ribbon.baseWidth??.28)*2*(ribbon.flowScale??.20),
   tipRatio:(ribbon.tipWidth??((ribbon.baseWidth??.28)*.55))/Math.max((ribbon.baseWidth??.28),1e-4),
   swell:ribbon.swell??.12
  });
 }
 for(const shard of spec.shards||[]){
  const points=shard.points||[[0,-.2],[0,.2],[1,.08],[1,-.08]];
  const outerGeo=polygonGeometry(points);
  const innerGeo=polygonGeometry(scalePoints(points,shard.innerScale??.82));
  addOwned(ownedGeometries,outerGeo,innerGeo);
  const group=new T.Group();group.position.fromArray(shard.anchor||[0,0,0]);group.rotation.fromArray(shard.rotation||[-Math.PI/2,0,0]);group.scale.fromArray(shard.scale||[1,1,1]);root.add(group);
  const glow=new T.Mesh(outerGeo,meshBasic(colorOf(shard.glowColor||shard.color,config,'#ddffff'),shard.opacity?.glow??.16));
  const panel=new T.Mesh(outerGeo,standardGlass(colorOf(shard.color,config,'#d7ffff'),shard.opacity?.panel??.16));
  const inner=new T.Mesh(innerGeo,meshBasic(colorOf(shard.innerColor||shard.color,config,'#ffffff'),shard.opacity?.inner??.18));
  const rim=new T.Mesh(innerGeo,standardGlass(colorOf(shard.rimColor||shard.innerColor||shard.color,config,'#ffffff'),shard.opacity?.rim??.08));
  glow.position.z=-.006;panel.position.z=0;inner.position.z=.006;rim.position.z=.010;
  addOwned(ownedMaterials,glow.material,panel.material,inner.material,rim.material);
  group.add(glow,panel,inner,rim);
  for(const m of [glow,panel,inner,rim]){m.renderOrder=19;m.frustumCulled=false;}
  shards.push({spec:shard,group,glow,panel,inner,rim,baseScale:shard.scale||[1,1,1],pulse:shard.pulse??.18,spin:shard.spin??0,drift:shard.drift??0});
 }
 for(const spark of spec.sparks||[]){
  const g=new T.Group();g.position.fromArray(spark.anchor||[0,0,0]);root.add(g);
  const count=Math.max(1,spark.count||24);const pos=new Float32Array(count*3);const seed=new Float32Array(count);
  const radius=spark.radius||[.6,.24,.6];
  for(let i=0;i<count;i++){
   const a=i/count*TAU+seeded(i)*.2,r=0.22+seeded(i+11)*.78,h=(seeded(i+29)-.5)*2;
   pos[i*3+0]=Math.cos(a)*radius[0]*r;
   pos[i*3+1]=h*radius[1];
   pos[i*3+2]=Math.sin(a)*radius[2]*r;
   seed[i]=seeded(i+53);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('aSeed',new T.BufferAttribute(seed,1));addOwned(ownedGeometries,geo);
  const mat=new T.PointsMaterial({color:colorOf(spark.color,config,'#ffdca5'),transparent:true,opacity:spark.opacity??.56,size:spark.size??.075,sizeAttenuation:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});addOwned(ownedMaterials,mat);
  const points=new T.Points(geo,mat);points.frustumCulled=false;g.add(points);
  sparks.push({spec:spark,group:g,points,baseOpacity:spark.opacity??.56,spin:spark.spin??.4,wobble:spark.wobble??.18});
 }
 return {
  root,ribbonRoot,veils,
  prepareRender(cameraLocal){
   for(const fx of ribbons){
    if(cameraLocal)fx.camera.copy(cameraLocal);
    const tipRatio=Math.max(.14,fx.tipRatio);
    const profile=t=>T.MathUtils.lerp(1,tipRatio,t)*(1+Math.sin(t*Math.PI)*fx.swell);
    const glowProfile=t=>T.MathUtils.lerp(1,tipRatio*.82,t)*(1+Math.sin(t*Math.PI)*(fx.swell*.55));
    const flowProfile=t=>T.MathUtils.lerp(.52,Math.max(.18,tipRatio*.28),t)*(1+Math.sin(t*Math.PI)*(fx.swell*.25));
    fx.panelRibbon.build(fx.points,{width:fx.panelWidth,cameraPosition:fx.camera,normal:fx.normal,widthProfile:profile});
    fx.glowRibbon.build(fx.points,{width:fx.glowWidth,cameraPosition:fx.camera,normal:fx.normal,widthProfile:glowProfile});
    fx.flowRibbon.build(fx.points,{width:fx.flowWidth,cameraPosition:fx.camera,normal:fx.normal,widthProfile:flowProfile});
   }
  },
  update(time,config,globals={},flight=null){
   for(const veil of veils)veil.update(time,config,globals,flight);
   const core=Math.max(.2,config.coreGlow??.8),surface=Math.max(.2,config.surfaceGlow??.8),body=Math.max(.2,config.bodyFx??1),shield=config.shield?.35:0,boost=config.boost?.38:0;
   const energy=Math.min(2.2,core*.65+surface*.30+body*.22+boost+shield);
   for(const fx of lenses){
    const w=.82+.18*Math.sin(time*(.9*fx.pulse)+fx.group.position.x*.35);const s=fx.baseScale*(.96+.07*w+.08*boost);
    fx.group.scale.setScalar(s);fx.group.rotation.y=time*fx.spin;
    fx.core.material.opacity=(fx.spec.opacity?.core??.52)*energy*(.72+.24*w);
    fx.halo.material.opacity=(fx.spec.opacity?.halo??.20)*(surface*.75+.26)*(1.1-.22*w);
    fx.ring.material.opacity=(fx.spec.opacity?.ring??.44)*(core*.62+.26+boost*.35);
    fx.sheen.material.opacity=(fx.spec.opacity?.sheen??.16)*(surface*.48+.15+shield*.20);
   }
   for(const fx of panes){
    const pulse=.82+.18*Math.sin(time*(1+fx.pulse)+fx.mesh.position.x*.12);
    fx.mesh.material.opacity=fx.baseOpacity*(surface*.76+.22+boost*.32+shield*.08)*pulse;
   }
   for(const fx of bars){
    const pulse=.84+.16*Math.sin(time*(1.1+fx.pulse)+fx.mesh.position.x*.1);
    if(fx.drift)fx.mesh.position.y=(fx.spec.anchor?.[1]||0)+Math.sin(time*.7+fx.mesh.position.x*.06)*fx.drift;
    fx.mesh.material.uniforms.uTime.value=time;
    fx.mesh.material.uniforms.uOpacity.value=fx.baseOpacity*(surface*.72+.20+core*.14+boost*.18)*pulse;
   }
   for(const fx of nodes){
    const pulse=.80+.20*Math.sin(time*(1.35+fx.pulse)+fx.mesh.position.x*.22+fx.mesh.position.z*.08);
    if(fx.drift)fx.mesh.position.y=(fx.spec.anchor?.[1]||0)+Math.sin(time*.85+fx.mesh.position.x*.08)*fx.drift;
    fx.mesh.scale.set(fx.baseScale[0]*(1+.04*boost),fx.baseScale[1]*(1+.06*pulse+.04*shield),1);
    fx.mesh.material.uniforms.uTime.value=time;
    fx.mesh.material.uniforms.uOpacity.value=fx.baseOpacity*(core*.76+.16+surface*.18+boost*.22+shield*.08)*pulse;
   }

   for(const fx of ribbons){
    const pulse=.90+.10*Math.sin(time*(.95+fx.pulse)+fx.group.position.x*.06);
    if(fx.drift)fx.group.position.y=(fx.spec.anchor?.[1]||0)+Math.sin(time*.45+fx.group.position.x*.05)*fx.drift;
    setRibbonCurve(fx.points,time,fx.spec);
    fx.panel.material.uniforms.uTime.value=time;
    fx.flow.material.uniforms.uTime.value=time;
    fx.panel.material.uniforms.uOpacity.value=(fx.spec.opacity?.panel??.24)*(surface*.68+.18+boost*.10)*pulse;
    fx.flow.material.uniforms.uOpacity.value=(fx.spec.opacity?.flow??.16)*(core*.52+.18+boost*.18)*(0.78+.22*Math.sin(time*3.2+fx.group.position.x*.08));
    fx.glow.material.opacity=(fx.spec.opacity?.glow??.11)*(core*.40+.12+boost*.16)*(0.86+.14*Math.sin(time*1.7+fx.group.position.x*.1));
   }
   for(const fx of shards){
    const sPulse=.88+.14*Math.sin(time*(1.2+fx.pulse)+fx.group.position.x*.09);
    fx.group.rotation.y+=0; // stable explicit no-op for readability
    if(fx.spin)fx.group.rotation.z=(fx.spec.rotation?.[2]||0)+Math.sin(time*.65+fx.group.position.x*.07)*fx.spin;
    if(fx.drift)fx.group.position.y=(fx.spec.anchor?.[1]||0)+Math.sin(time*.9+fx.group.position.x*.05)*fx.drift;
    fx.group.scale.set((fx.baseScale[0]||1)*(1+.04*boost),(fx.baseScale[1]||1)*(sPulse+.06*boost),(fx.baseScale[2]||1));
    fx.panel.material.opacity=(fx.spec.opacity?.panel??.16)*(surface*.82+.18+boost*.18+shield*.06)*sPulse;
    fx.glow.material.opacity=(fx.spec.opacity?.glow??.16)*(core*.54+.14+boost*.22);
    fx.inner.material.opacity=(fx.spec.opacity?.inner??.18)*(core*.52+.14+shield*.18);
    fx.rim.material.opacity=(fx.spec.opacity?.rim??.08)*(surface*.42+.12+shield*.22);
   }
   for(const fx of sparks){
    fx.group.rotation.y=time*fx.spin;fx.group.rotation.z=Math.sin(time*fx.wobble+fx.group.position.x*.1)*.12;
    fx.points.material.opacity=fx.baseOpacity*(body*.52+.20+boost*.20)*(0.72+.28*Math.sin(time*2.2+fx.group.position.z));
   }
   root.visible=energy>.03;
  },
  clear(){for(const veil of veils)veil.clear();for(const fx of ribbons){fx.panelRibbon.clear();fx.glowRibbon.clear();fx.flowRibbon.clear();}root.visible=false;}
 };
}

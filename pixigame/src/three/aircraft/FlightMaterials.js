import * as T from 'three';
import {NOISE} from './glsl.js';
/** Meteor's proxy-volume principle, rebuilt for a nozzle-aligned plasma jet.
 * In contrast to a flame sprite, we integrate density *inside* a 3D hull and
 * clip each step against the existing opaque depth pass. 24 bounded samples. */
export function jetMaterial(){return new T.ShaderMaterial({transparent:true,side:T.BackSide,depthWrite:false,depthTest:false,
 blending:T.CustomBlending,blendEquation:T.AddEquation,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,toneMapped:false,
 uniforms:{uTime:{value:0},uGain:{value:1},uOpacity:{value:1},uRayDir:{value:new T.Vector3(0,0,1)},uOrthographic:{value:0},uThrottle:{value:0},uColor:{value:new T.Color('#35bdff')},uEye:{value:new T.Vector3()},uObjectView:{value:new T.Matrix4()},uDepth:{value:null},uResolution:{value:new T.Vector2(1,1)},uNear:{value:.12},uFar:{value:180},uUseDepth:{value:0},uSteps:{value:24}},
 vertexShader:`varying vec3 vLocal;void main(){vLocal=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:/*glsl*/`
 varying vec3 vLocal;uniform vec3 uEye,uColor,uRayDir;uniform float uTime,uGain,uOpacity,uOrthographic,uThrottle,uUseDepth,uNear,uFar;uniform sampler2D uDepth;uniform vec2 uResolution;uniform mat4 uObjectView;uniform int uSteps;
 ${NOISE}
 void main(){
  vec3 rd=uOrthographic>.5?normalize(uRayDir):normalize(vLocal-uEye);
  vec3 eye=uOrthographic>.5?vLocal-rd*4.:uEye;vec3 ir=1./(rd+vec3(.000001));
  vec3 a=(vec3(-1.3,-1.3,0.)-eye)*ir,b=(vec3(1.3,1.3,1.)-eye)*ir;
  vec3 mn=min(a,b),mx=max(a,b);float lo=max(0.,max(mn.x,max(mn.y,mn.z))),hi=min(mx.x,min(mx.y,mx.z));if(hi<=lo)discard;
  float depth=1e5;if(uUseDepth>.5){float d=texture2D(uDepth,gl_FragCoord.xy/uResolution).r;depth=(uNear*uFar)/(uFar-d*(uFar-uNear));}
  vec3 color=vec3(0.);float trans=1.;float stepSize=(hi-lo)/float(uSteps);
  for(int j=0;j<32;j++){if(j>=uSteps)break;vec3 p=eye+rd*(lo+(float(j)+.5)*stepSize);
   if(-(uObjectView*vec4(p,1.)).z>depth)continue;
   float s=clamp(p.z,0.,1.);float rad=mix(.74,.06,pow(s,.82));
   float diamond=pow(.5+.5*cos(s*(32.+uThrottle*7.)-.30),7.)*(1.-s);
   rad+=diamond*.12;
   vec2 curl=vec2(sin(s*13.-uTime*5.),cos(s*17.-uTime*4.))*.07*s;
   float r=length(p.xy+curl)/max(.04,rad);
   // fbm is bounded to [0,1]. Outside this radius even the strongest
   // turbulence cannot create density, so skip noise and integration exactly.
   if(r>=1.09+.275*s)continue;
   float n=fbm(p.xy*3.7+vec2(s*10.-uTime*4.1,s*21.-uTime*7.));
   float turbulence=(n-.5)*.55*s;
   float density=(1.-smoothstep(.1,1.09,r+turbulence))*(1.-smoothstep(.58,1.,s));
   density*=smoothstep(0.,.016,s);
   float core=exp(-r*r*7.)*(.6+diamond*.80)*(1.-s);
   vec3 c=mix(uColor*.75,vec3(.69,.94,1.0),clamp(core*.7+diamond*.1,0.,.78));
   c*=1.9+core*2.7+diamond*1.8;
   float opacity=1.-exp(-density*stepSize*2.9);
   color+=trans*opacity*c*uGain;trans*=1.-opacity;if(trans<.02)break;
  }
  if(trans>.998)discard;gl_FragColor=vec4(color*uOpacity,(1.-trans)*uOpacity);
 }`});}
export function trailMaterial(wing=false){return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{uTime:{value:0},uColor:{value:new T.Color('#2ba5f8')},uGain:{value:1}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
 fragmentShader:`varying vec2 vUv;uniform float uTime,uGain;uniform vec3 uColor;${NOISE}
 void main(){float s=vUv.x,x=abs(vUv.y-.5)*2.;float n=fbm(vec2(s*25.-uTime*3.,vUv.y*6.+uTime*.7));
 float body=exp(-x*x*${wing?'10.':'5.'})*(.4+.6*n);float fine=exp(-pow((x-.25-n*.22)*24.,2.))*.26;
 float a=(body+fine)*pow(1.-s,1.3)*smoothstep(0.,.025,s)*uGain*${wing?'.34':'.22'};
 a*=1.-smoothstep(.62,1.,x);if(a<.001)discard;gl_FragColor=vec4(uColor*(1.2+.6*(1.-x)),a);}`});}
export function accentMaterial(){return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{uTime:{value:0},uGain:{value:1},uColor:{value:new T.Color('#5fd2ff')}},
 vertexShader:`varying vec2 vUv;varying vec3 vN,vV;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=cameraPosition-w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`varying vec2 vUv;varying vec3 vN,vV;uniform float uTime,uGain;uniform vec3 uColor;${NOISE}
 void main(){float fres=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.5);float band=exp(-pow((vUv.y-.5)*7.5,2.));
  float ticks=smoothstep(.72,1.,sin(vUv.x*52.-uTime*4.4)*.5+.5)*.22;float sweep=exp(-pow(fract(vUv.x*2.3-uTime*.42)-.12,2.)*110.);
  float noise=fbm(vec2(vUv.x*8.-uTime*.6,vUv.y*5.+uTime*.3));float edge=pow(1.-abs(vUv.y-.5)*2.,1.6);
  float a=(band*(.12+.20*fres)+ticks+sweep*.25+noise*.04*edge)*uGain;if(a<.002)discard;
  vec3 c=uColor*(.75+fres*1.2+edge*.3)+vec3(.95,.98,1.)*sweep*1.6;gl_FragColor=vec4(c,a);}`});}
export function finMaterial(){return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{uTime:{value:0},uGain:{value:1},uColor:{value:new T.Color('#67d7ff')}},
 vertexShader:`varying vec2 vUv;varying vec3 vN,vV,vP;void main(){vUv=uv;vP=position;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=cameraPosition-w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`varying vec2 vUv;varying vec3 vN,vV,vP;uniform float uTime,uGain;uniform vec3 uColor;${NOISE}
 void main(){float fres=pow(1.-abs(dot(normalize(vN),normalize(vV))),2.8);float taper=smoothstep(0.,.18,vUv.x)*(1.-smoothstep(.86,1.,vUv.x));
  float core=(1.-abs(vUv.y-.5)*2.);core=smoothstep(.0,.9,core);float scan=exp(-pow(fract(vUv.y*2.4-uTime*.8)-.18,2.)*90.);
  float lattice=smoothstep(.78,1.,sin(vUv.x*20.+vUv.y*8.-uTime*2.)*.5+.5)*.14;float edge=smoothstep(.78,1.,core)*.16;
  float a=(fres*.16+core*.10+scan*.28+lattice+edge)*taper*uGain;if(a<.002)discard;
  vec3 c=uColor*(.8+fres*1.6+scan*.9)+vec3(.96,.98,1.)*scan*1.2;gl_FragColor=vec4(c,a);}`});}
export function hullFieldMaterial(){return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.BackSide,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{uTime:{value:0},uGain:{value:0},uColor:{value:new T.Color('#4ed1ff')}},
 vertexShader:`varying vec3 vN,vV;varying vec2 vUv;void main(){vUv=uv;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=cameraPosition-w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`varying vec3 vN,vV;varying vec2 vUv;uniform float uTime,uGain;uniform vec3 uColor;
 float hex(vec2 p){p.x*=1.1547;vec2 r=vec2(1.,1.732),a=mod(p,r)-r*.5,b=mod(p-r*.5,r)-r*.5;vec2 q=dot(a,a)<dot(b,b)?a:b;return max(abs(q.x),dot(abs(q),normalize(vec2(1.,1.732))));}
 void main(){float fres=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.4);float h=hex(vec2(vUv.x*20.,vUv.y*12.));float g=1.-smoothstep(.42,.49,h);
  float sweep=exp(-pow(fract(vUv.y*1.6-uTime*.25)-.12,2.)*75.);float a=(fres*.13+g*.05+sweep*.08)*uGain;if(a<.001)discard;
  gl_FragColor=vec4(uColor*(.55+fres*1.4+sweep*.6),a);}`});}
export function shieldMaterial(){return new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.FrontSide,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{uTime:{value:0},uGain:{value:0},uColor:{value:new T.Color('#3dcbfc')}},vertexShader:`varying vec3 vN,vV,vP;varying vec2 vUv;void main(){vUv=uv;vP=position;vec4 w=modelMatrix*vec4(position,1.);vN=normalize(mat3(modelMatrix)*normal);vV=cameraPosition-w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
 fragmentShader:`varying vec3 vN,vV,vP;varying vec2 vUv;uniform float uTime,uGain;uniform vec3 uColor;
 float hex(vec2 p){p.x*=1.1547;vec2 r=vec2(1.,1.732),a=mod(p,r)-r*.5,b=mod(p-r*.5,r)-r*.5;vec2 q=dot(a,a)<dot(b,b)?a:b;return max(abs(q.x),dot(abs(q),normalize(vec2(1.,1.732))));}
 void main(){float fres=pow(1.-abs(dot(normalize(vN),normalize(vV))),3.2);float h=hex(vec2(vUv.x*40.,vUv.y*21.));float edge=smoothstep(.45,.49,h);
 float scan=exp(-pow((vP.y-sin(uTime*.6))/.08,2.));float a=(fres*.34+edge*(fres*.10+.012)+scan*.08)*uGain;
 gl_FragColor=vec4(uColor*(.65+fres*1.25+scan*.6),a);}`});}
export function flashMaterial(){return new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,
 uniforms:{uGain:{value:0},uColor:{value:new T.Color('#95e4ff')}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;vec4 p=modelViewMatrix*vec4(0.,0.,0.,1.);p.xy+=position.xy;gl_Position=projectionMatrix*p;}`,
 fragmentShader:`varying vec2 vUv;uniform float uGain;uniform vec3 uColor;void main(){vec2 p=(vUv-.5)*2.;float r=length(p);float core=exp(-r*r*22.);float spike=exp(-abs(p.x)*44.)*exp(-abs(p.y)*3.)+exp(-abs(p.y)*44.)*exp(-abs(p.x)*3.);gl_FragColor=vec4(uColor*2.4,(core+spike*.3)*uGain);}`});}

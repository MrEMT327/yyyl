// V14 frozen source adapter: transparent canvas, explicit asset base, host camera only.
// Original motion streams, geometry, textures, shaders and layer order are retained.
const VS=`#version 300 es
in vec2 aPosition;in vec2 aCoverage;out vec2 vCoverage;in vec2 aUV;uniform vec4 uView;out vec2 vUV;out vec2 vWorld;void main(){vCoverage=aCoverage;vWorld=aPosition;vec2 q=(aPosition-uView.xy)/uView.zw;gl_Position=vec4(q.x*2.-1.,1.-q.y*2.,0.,1.);vUV=aUV;}`;
const FS=`#version 300 es
precision highp float;in vec2 vUV;in vec2 vWorld;in vec2 vCoverage;uniform float uSharedSurfaceAlpha;uniform float uHipFringeRepair;uniform float uCoverageFilter;uniform float uMaterialDomainMode;uniform vec4 uMaterialDomain;uniform sampler2D uTexture;uniform float uNativeMaterial;uniform sampler2D uNativeMask;uniform vec2 uViewport;uniform bool uNativeMaskReady;uniform vec3 uNativeMultiply;uniform vec3 uNativeScreen;uniform bool uWire;uniform float uOpacity;uniform float uAlphaThreshold;uniform vec4 uEyeMask;uniform float uEyeAngle;uniform float uOpen;uniform sampler2D uOriginal;out vec4 frag;void main(){if(abs(uMaterialDomainMode)>.5){float t=dot(vWorld,uMaterialDomain.xy)+uMaterialDomain.z;if(uMaterialDomainMode<0.&&t>uMaterialDomain.w+.012)discard;if(uMaterialDomainMode>0.&&t<uMaterialDomain.w-.012)discard;}vec4 c=texture(uTexture,vUV);vec2 gx=dFdx(vUV),gy=dFdy(vUV);float edge=fwidth(c.a);if(uCoverageFilter>.5&&edge>.002){vec4 a=textureGrad(uTexture,vUV+.25*gx+.25*gy,gx,gy);vec4 b=textureGrad(uTexture,vUV+.25*gx-.25*gy,gx,gy);vec4 d=textureGrad(uTexture,vUV-.25*gx+.25*gy,gx,gy);vec4 e=textureGrad(uTexture,vUV-.25*gx-.25*gy,gx,gy);float sum=a.a+b.a+d.a+e.a;c=vec4(sum>0.0001?(a.rgb+b.rgb+d.rgb+e.rgb)/sum:vec3(0.),sum*.25);}else{c.rgb=c.a>.0001?c.rgb/c.a:vec3(0.);}
// Rebuild the blue hip-edge colour and subpixel coverage from its local
// contour. This is confined to one body material UV strip; garment interior,
// neighbouring pieces and all animation geometry remain untouched.
if(uHipFringeRepair>.5){
 vec2 source=vUV*vec2(1568.,1003.);float y=source.y;
 if(source.x>620. && source.x<710. && y>315. && y<475.){
  float left=699.;
  if(y<325.)left=mix(703.,695.0,(y-315.)/10.);
  else if(y<335.)left=mix(695.0,687.9,(y-325.)/10.);
  else if(y<345.)left=mix(687.9,683.3,(y-335.)/10.);
  else if(y<355.)left=mix(683.3,676.6,(y-345.)/10.);
  else if(y<365.)left=mix(676.6,669.5,(y-355.)/10.);
  else if(y<375.)left=mix(669.5,664.3,(y-365.)/10.);
  else if(y<385.)left=mix(664.3,659.5,(y-375.)/10.);
  else if(y<395.)left=mix(659.5,656.7,(y-385.)/10.);
  else if(y<405.)left=mix(656.7,654.4,(y-395.)/10.);
  else if(y<415.)left=mix(654.4,652.6,(y-405.)/10.);
  else if(y<425.)left=mix(652.6,651.85,(y-415.)/10.);
  else if(y<435.)left=mix(651.85,651.0,(y-425.)/10.);
  else if(y<445.)left=mix(651.0,650.94,(y-435.)/10.);
  else if(y<455.)left=mix(650.94,651.5,(y-445.)/10.);
  else if(y<465.)left=mix(651.5,652.85,(y-455.)/10.);
  else left=mix(652.85,654.,(y-465.)/10.);
  float dx=source.x-left;
  float vertical=smoothstep(315.,325.,y)*(1.-smoothstep(465.,475.,y));
  if(dx>-3. && dx<8. && vertical>.001){
   vec3 blue=vec3(0.);float total=0.;
   for(int row=-2;row<=2;row++)for(int i=1;i<=10;i++){
    vec2 uv=vec2((left+float(i)+.5)/1568.,(source.y+float(row)*5.)/1003.);
    vec4 v=texture(uTexture,uv);vec3 rgb=v.rgb/max(v.a,.0001);
    if(v.a>.85 && rgb.b-rgb.r>.105 && rgb.b-rgb.g>.055 && rgb.r<.40){
     float weight=1./(1.+abs(float(i)-5.)+abs(float(row))*1.2);blue+=rgb*weight;total+=weight;
    }
   }
   if(total>.05){
    float colour=vertical*(1.-smoothstep(4.,7.,dx));
    c.rgb=mix(c.rgb,blue/total,colour);
    if(dx<1.5){float cleanAlpha=smoothstep(-.65,.65,dx);c.a=mix(c.a,cleanAlpha,vertical);}
   }
  }
 }
}
if(uSharedSurfaceAlpha>.5){vec2 aa=fwidth(vCoverage);vec2 a=smoothstep(vec2(0.),aa,max(vec2(0.),min(vCoverage,1.-vCoverage)));c.a=a.x*a.y;}if(uEyeMask.z>0.){vec2 d=vUV*vec2(1568.,1003.)-uEyeMask.xy;float co=cos(uEyeAngle),si=sin(uEyeAngle);vec2 q=vec2(d.x*co+d.y*si,-d.x*si+d.y*co)/uEyeMask.zw;float mask=1.-smoothstep(.82,1.,length(q));vec3 correction=(uEyeMask.x<780.?vec3(-1.,-6.5,-8.):vec3(-2.,-10.,-11.))/255.;float skin=smoothstep(.45,.8,c.r);c.rgb+=correction*skin;c.rgb=mix(c.rgb,min(c.rgb,vec3(1.,.914,.890)),skin);vec2 local=q*uEyeMask.zw;float op=clamp(uOpen,0.,1.);if(op>.999){c=texture(uOriginal,vUV);}else if(op>.055){float halfHeight=4.3*sqrt(max(0.,1.-pow(local.x/(uEyeMask.z*.91),2.)));float band=1.-smoothstep(halfHeight*op-.45,halfHeight*op+.45,abs(local.y));if(abs(local.y)<5.5){float sy=local.y<0.?-5.5:6.5;vec2 sd=vec2(local.x,sy);vec2 su=uEyeMask.xy+vec2(sd.x*co-sd.y*si,sd.x*si+sd.y*co);vec4 skinPixel=texture(uTexture,su/vec2(1568.,1003.));skinPixel.rgb+=correction;skinPixel.rgb=min(skinPixel.rgb,vec3(1.,.914,.890));c=mix(c,skinPixel,1.-smoothstep(3.3,5.5,abs(local.y)));}vec2 changed=vec2(local.x,local.y/max(op,.025));vec2 src=uEyeMask.xy+vec2(changed.x*co-changed.y*si,changed.x*si+changed.y*co);vec4 opened=texture(uOriginal,src/vec2(1568.,1003.));c=mix(c,opened,band);}c.a*=mask;}if(uNativeMaterial>0.){c.rgb=c.rgb*uNativeMultiply;c.rgb+=uNativeScreen-c.rgb*uNativeScreen;if(uNativeMaterial>1.5){float luminance=dot(c.rgb,vec3(.2126,.7152,.0722));float ink=uNativeMaterial>2.5?smoothstep(.09,.25,luminance):smoothstep(.025,.18,luminance);c.rgb=mix(vec3(.987,.990,1.),vec3(.55,.61,.73),ink);if(uNativeMaskReady){vec2 q=gl_FragCoord.xy/uViewport,dx=vec2(.85/uViewport.x,0.),dy=vec2(0.,.85/uViewport.y);float center=texture(uNativeMask,q).a;float edgeAlpha=min(min(texture(uNativeMask,q+dx).a,texture(uNativeMask,q-dx).a),min(texture(uNativeMask,q+dy).a,texture(uNativeMask,q-dy).a));float edge=(1.-smoothstep(.05,.75,edgeAlpha))*smoothstep(.1,.75,center);c.rgb=mix(c.rgb,vec3(.27,.36,.53),edge*.90);}}}if(c.a<uAlphaThreshold)discard;c.a*=uOpacity;if(uWire)c=vec4(.12,.54,.9,.55);frag=vec4(c.rgb*c.a,c.a);}`;
export class Renderer{
 constructor(canvas,{assetBase='./assets/',hipFringeRepair=true}={}){this.hipFringeRepair=hipFringeRepair;this.assetBase=new URL(assetBase,location.href).href;this.canvas=canvas;const g=this.g=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:true,preserveDrawingBuffer:true});if(!g)throw Error('WebGL2 unavailable');g.pixelStorei(g.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);const shader=(type,src)=>{const s=g.createShader(type);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s};this.program=g.createProgram();g.attachShader(this.program,shader(g.VERTEX_SHADER,VS));g.attachShader(this.program,shader(g.FRAGMENT_SHADER,FS));g.linkProgram(this.program);if(!g.getProgramParameter(this.program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(this.program));this.aC=g.getAttribLocation(this.program,'aCoverage');this.aP=g.getAttribLocation(this.program,'aPosition');this.aU=g.getAttribLocation(this.program,'aUV');this.uNativeMask=g.getUniformLocation(this.program,'uNativeMask');this.uViewport=g.getUniformLocation(this.program,'uViewport');this.uNativeMaskReady=g.getUniformLocation(this.program,'uNativeMaskReady');this.uNativeMaterial=g.getUniformLocation(this.program,'uNativeMaterial');this.uNativeMultiply=g.getUniformLocation(this.program,'uNativeMultiply');this.uNativeScreen=g.getUniformLocation(this.program,'uNativeScreen');this.uSharedSurfaceAlpha=g.getUniformLocation(this.program,'uSharedSurfaceAlpha');this.uHipFringeRepair=g.getUniformLocation(this.program,'uHipFringeRepair');this.uCoverageFilter=g.getUniformLocation(this.program,'uCoverageFilter');this.uMaterialDomainMode=g.getUniformLocation(this.program,'uMaterialDomainMode');this.uMaterialDomain=g.getUniformLocation(this.program,'uMaterialDomain');this.uView=g.getUniformLocation(this.program,'uView');this.uWire=g.getUniformLocation(this.program,'uWire');this.uOpacity=g.getUniformLocation(this.program,'uOpacity');this.uAlphaThreshold=g.getUniformLocation(this.program,'uAlphaThreshold');this.uEyeMask=g.getUniformLocation(this.program,'uEyeMask');this.uEyeAngle=g.getUniformLocation(this.program,'uEyeAngle');this.uOpen=g.getUniformLocation(this.program,'uOpen');this.uOriginal=g.getUniformLocation(this.program,'uOriginal');this.parts=[];this.draws=0;}
 async load(){const g=this.g;const textureCache=new Map(),streamCache=new Map();this.bundle=await (await fetch(new URL('bundle.json',this.assetBase))).json();for(const p of this.bundle.parts){const textureKey=p.texture+'|'+!!p.generatedMaterial;let tex=textureCache.get(textureKey);if(!tex){const image=await new Promise((res,rej)=>{let i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=new URL(p.texture,this.assetBase).href});tex=g.createTexture();g.bindTexture(g.TEXTURE_2D,tex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,image);if(p.generatedMaterial)g.generateMipmap(g.TEXTURE_2D);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,p.generatedMaterial?g.LINEAR_MIPMAP_LINEAR:g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);textureCache.set(textureKey,tex);}const vao=g.createVertexArray();g.bindVertexArray(vao);let pb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,pb);g.bufferData(g.ARRAY_BUFFER,new Float32Array(p.rest.flat()),g.DYNAMIC_DRAW);g.enableVertexAttribArray(this.aP);g.vertexAttribPointer(this.aP,2,g.FLOAT,false,0,0);let ub=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,ub);g.bufferData(g.ARRAY_BUFFER,new Float32Array(p.uv??p.rest.flatMap(([x,y])=>[x/1568,y/1003])),g.STATIC_DRAW);g.enableVertexAttribArray(this.aU);g.vertexAttribPointer(this.aU,2,g.FLOAT,false,0,0);if(p.coverageUV){let cb=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,cb);g.bufferData(g.ARRAY_BUFFER,new Float32Array(p.coverageUV),g.STATIC_DRAW);g.enableVertexAttribArray(this.aC);g.vertexAttribPointer(this.aC,2,g.FLOAT,false,0,0);}let ib=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint16Array(p.indices),g.STATIC_DRAW);const streams={};for(const key of ['main3','idle']){if(!streamCache.has(p[key]))streamCache.set(p[key],new Float32Array(await (await fetch(new URL(p[key],this.assetBase))).arrayBuffer()));streams[key]=streamCache.get(p[key]);}const edges=new Set();for(let k=0;k<p.indices.length;k+=3)for(let i=0;i<3;i++){let a=p.indices[k+i],b=p.indices[k+(i+1)%3];edges.add([Math.min(a,b),Math.max(a,b)].join(','))}let edge=Uint16Array.from([...edges].flatMap(s=>s.split(',').map(Number))),eb=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,eb);g.bufferData(g.ELEMENT_ARRAY_BUFFER,edge,g.STATIC_DRAW);if(p.rigidProjectionModel)p.projectionModel=await(await fetch(new URL(p.rigidProjectionModel,this.assetBase))).json();this.parts.push({...p,streams,tex,vao,pb,ib,eb,edgeCount:edge.length,rest:new Float32Array(p.rest.flat())})}const oi=await new Promise((res,rej)=>{let i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=new URL(this.bundle.headOriginalTexture??'normalized-head__approved-original.png',this.assetBase).href});this.resourceCounts={partTextureUploads:textureCache.size,partCount:this.bundle.parts.length,sharedMotionFiles:streamCache.size};this.originalTex=g.createTexture();g.bindTexture(g.TEXTURE_2D,this.originalTex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,g.RGBA,g.UNSIGNED_BYTE,oi);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);return this.bundle;}

 // Weighted premultiplied primary-hand materials share one source-native order.
 // RGBA8 FBO addition has only ordinary 8-bit quantization; it does not apply
 // source-over between mutually exclusive pose textures. No art is repainted.
 ensurePrimaryHandGroup(){
  const g=this.g;
  if(!this.handGroup){
   const shader=(kind,src)=>{const s=g.createShader(kind);g.shaderSource(s,src);g.compileShader(s);if(!g.getShaderParameter(s,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(s));return s};
   const program=g.createProgram();
   g.attachShader(program,shader(g.VERTEX_SHADER,`#version 300 es\nin vec2 aPosition;in vec2 aUV;out vec2 vUV;void main(){gl_Position=vec4(aPosition,0.,1.);vUV=aUV;}`));
   g.attachShader(program,shader(g.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in vec2 vUV;uniform sampler2D uHandGroup;out vec4 frag;void main(){frag=texture(uHandGroup,vUV);}`));
   g.linkProgram(program);if(!g.getProgramParameter(program,g.LINK_STATUS))throw Error(g.getProgramInfoLog(program));
   const vao=g.createVertexArray();g.bindVertexArray(vao);
   for(const [name,values] of [['aPosition',[-1,-1,1,-1,1,1,-1,1]],['aUV',[0,0,1,0,1,1,0,1]]]){const b=g.createBuffer();g.bindBuffer(g.ARRAY_BUFFER,b);g.bufferData(g.ARRAY_BUFFER,new Float32Array(values),g.STATIC_DRAW);const a=g.getAttribLocation(program,name);g.enableVertexAttribArray(a);g.vertexAttribPointer(a,2,g.FLOAT,false,0,0);}
   const ib=g.createBuffer();g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint16Array([0,1,2,0,2,3]),g.STATIC_DRAW);
   this.handGroup={program,vao,ib,sampler:g.getUniformLocation(program,'uHandGroup'),tex:g.createTexture(),fbo:g.createFramebuffer(),width:0,height:0};
  }
  const h=this.handGroup,w=this.canvas.width,height=this.canvas.height;
  if(h.width!==w||h.height!==height){
   g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,h.tex);
   // WebGL's nine-argument allocation overload: width,height,border,...,null.
   g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,height,0,g.RGBA,g.UNSIGNED_BYTE,null);
   // A 1:1 nearest copy introduces no additional silhouette filtering.
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.NEAREST??9728);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.NEAREST??9728);
   g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);
   g.bindFramebuffer(g.FRAMEBUFFER,h.fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,h.tex,0);
   if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Primary hand RGBA framebuffer incomplete');
   g.bindFramebuffer(g.FRAMEBUFFER,null);h.width=w;h.height=height;
  }
  return h;
 }
 drawPrimaryHandGroup(parts,drawPart){
  const g=this.g,h=this.ensurePrimaryHandGroup();
  g.bindFramebuffer(g.FRAMEBUFFER,h.fbo);g.viewport(0,0,h.width,h.height);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);
  g.blendFunc(g.ONE,g.ONE); // SUM(weight_i * vec4(rgb_i * alpha_i, alpha_i))
  for(const p of parts)drawPart(p);
  g.bindFramebuffer(g.FRAMEBUFFER,null);g.viewport(0,0,this.canvas.width,this.canvas.height);
  g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);g.useProgram(h.program);
  g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,h.tex);g.uniform1i(h.sampler,0);g.bindVertexArray(h.vao);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,h.ib);g.drawElements(g.TRIANGLES,6,g.UNSIGNED_SHORT,0);
  g.useProgram(this.program); // all original eye/view uniforms remain intact
 }


 ensureNativeHandMask(){const g=this.g,w=this.canvas.width,h=this.canvas.height;if(!this.nativeMask){this.nativeMask={tex:g.createTexture(),fbo:g.createFramebuffer(),width:0,height:0};}const m=this.nativeMask;if(m.width!==w||m.height!==h){g.activeTexture(g.TEXTURE0);g.bindTexture(g.TEXTURE_2D,m.tex);g.texImage2D(g.TEXTURE_2D,0,g.RGBA,w,h,0,g.RGBA,g.UNSIGNED_BYTE,null);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MIN_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_MAG_FILTER,g.LINEAR);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_S,g.CLAMP_TO_EDGE);g.texParameteri(g.TEXTURE_2D,g.TEXTURE_WRAP_T,g.CLAMP_TO_EDGE);g.bindFramebuffer(g.FRAMEBUFFER,m.fbo);g.framebufferTexture2D(g.FRAMEBUFFER,g.COLOR_ATTACHMENT0,g.TEXTURE_2D,m.tex,0);if(g.checkFramebufferStatus(g.FRAMEBUFFER)!==g.FRAMEBUFFER_COMPLETE)throw Error('Native hand alpha mask FBO incomplete');g.bindFramebuffer(g.FRAMEBUFFER,null);m.width=w;m.height=h;}return m;}



 // A narrow dark spindle sits underneath the existing socket and cannon.
 // It follows the same rigid pose as the cannon and covers transient daylight
 // between their original alpha cutouts without covering either artwork.
 drawJointSupport(key,frame,blend,upper){
  const g=this.g,p=this.parts.find(x=>x.name==='cannon_body');if(!p?.projectionPoses)return;
  const f=Math.min(frame,(key==='idle'?this.bundle.idleFrames:this.bundle.frames)-1);
  let pose=[...(key==='rest'?p.projectionPoseRest:p.projectionPoses[key][f])];
  const prior=blend?.from.get(p.name)?._rigidPose;
  if(prior){const w=blend.weight;pose=pose.map((v,i)=>i===0?prior[i]+Math.atan2(Math.sin(v-prior[i]),Math.cos(v-prior[i]))*w:prior[i]+(v-prior[i])*w);}
  if(!this.jointSupport){
   const compile=(kind,src)=>{const q=g.createShader(kind);g.shaderSource(q,src);g.compileShader(q);if(!g.getShaderParameter(q,g.COMPILE_STATUS))throw Error(g.getShaderInfoLog(q));return q};
   const prog=g.createProgram();g.attachShader(prog,compile(g.VERTEX_SHADER,`#version 300 es\nin vec2 aPoint;in float aShade;uniform vec4 uView;out float vShade;void main(){vec2 p=(aPoint-uView.xy)/uView.zw;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);vShade=aShade;}`));
   g.attachShader(prog,compile(g.FRAGMENT_SHADER,`#version 300 es\nprecision highp float;in float vShade;out vec4 frag;void main(){vec3 col=vec3(.18,.20,.24)+vShade*vec3(.35,.36,.39);frag=vec4(col,1.);}`));g.linkProgram(prog);if(!g.getProgramParameter(prog,g.LINK_STATUS))throw Error(g.getProgramInfoLog(prog));
   const vao=g.createVertexArray(),buf=g.createBuffer(),ib=g.createBuffer();g.bindVertexArray(vao);g.bindBuffer(g.ARRAY_BUFFER,buf);const pos=g.getAttribLocation(prog,'aPoint'),shade=g.getAttribLocation(prog,'aShade');g.enableVertexAttribArray(pos);g.vertexAttribPointer(pos,2,g.FLOAT,false,12,0);g.enableVertexAttribArray(shade);g.vertexAttribPointer(shade,1,g.FLOAT,false,12,8);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,ib);this.jointSupport={prog,vao,buf,ib,view:g.getUniformLocation(prog,'uView')};
  }
  const [angle,tilt,jx,jy]=pose,co=Math.cos(angle),si=Math.sin(angle),q=Math.cos(tilt),t=Math.sin(tilt),steps=16,verts=[],indices=[];
  for(const x of [-2,48])for(let i=0;i<=steps;i++){const a=-Math.PI/2+Math.PI*i/steps,r=11.5+Math.max(0,x)/48*1.5,y=Math.sin(a)*r,z=Math.cos(a)*r;verts.push(jx+co*q*x-si*y-co*t*z,jy+si*q*x+co*y-si*t*z,.40+.30*Math.cos(a+.35));}
  for(let i=0;i<steps;i++){let a=i,b=i+1,c=i+steps+1,d=i+steps+2;indices.push(a,b,c,b,d,c);}
  const h=this.jointSupport;g.useProgram(h.prog);g.uniform4fv(h.view,upper?[480,0,520,570]:(this.view??[372,-35,824,1054]));g.bindVertexArray(h.vao);g.bindBuffer(g.ARRAY_BUFFER,h.buf);g.bufferData(g.ARRAY_BUFFER,new Float32Array(verts),g.DYNAMIC_DRAW);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,h.ib);g.bufferData(g.ELEMENT_ARRAY_BUFFER,new Uint16Array(indices),g.DYNAMIC_DRAW);g.drawElements(g.TRIANGLES,indices.length,g.UNSIGNED_SHORT,0);g.useProgram(this.program);
 }

 // Diagnostic fixed-model projection. No mesh-axis scale and no alpha crossfade.
 projectRigidSurface(model,pose){
  const [a,phi,jx,jy]=pose,c=Math.cos(a),s=Math.sin(a),q=Math.cos(phi),t=Math.sin(phi),V=model.vertices3d,N=model.normals3d;
  const pos=new Float32Array(V.length*2),depth=new Float64Array(V.length),nz=new Float64Array(V.length);
  for(let i=0;i<V.length;i++){const [x,y,z]=V[i];pos[2*i]=jx+c*q*x-s*y-c*t*z;pos[2*i+1]=jy+s*q*x+c*y-s*t*z;depth[i]=t*x+q*z;nz[i]=t*N[i][0]+q*N[i][2];}
  const faces=model.indices,visible=[];
  for(let k=0;k<faces.length;k++){const ids=faces[k];if(nz[ids[0]]+nz[ids[1]]+nz[ids[2]]>0)visible.push({ids,z:depth[ids[0]]+depth[ids[1]]+depth[ids[2]]});}
  visible.sort((a,b)=>a.z-b.z);return {pos,indices:Uint16Array.from(visible.flatMap(f=>f.ids))};
 }

 draw(key='rest',frame=0,{upper=false,wire=false,blend=null}={}){const g=this.g;g.useProgram(this.program);g.uniform1i(this.uOriginal,1);g.activeTexture(g.TEXTURE1);g.bindTexture(g.TEXTURE_2D,this.originalTex);g.activeTexture(g.TEXTURE0);g.viewport(0,0,this.canvas.width,this.canvas.height);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.enable(g.BLEND);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);g.uniform4fv(this.uView,upper?[480,0,520,570]:(this.view??[372,-35,824,1054]));const actual=[];const drawPart=(p)=>{const layerOpacity=key==='rest'?(((p.generatedMaterial&&!p.rigidArtwork)||p.phaseOnly)?0:1):(p.opacities?.[key]?.[frame]??1);const eyeFrame=Math.min(frame,(key==='idle'?this.bundle.idleFrames:this.bundle.frames)-1);const eyeClosure=p.opacityTracks?(key==='rest'?0:(p.opacityTracks[key]?.[eyeFrame]??0)):0;const opacity=layerOpacity*(p.opacityTracks?Math.min(1,eyeClosure/.16):1);if(opacity<1e-6)return;g.uniform1f(this.uSharedSurfaceAlpha,p.sharedSurfaceAlpha?1:0);g.uniform1f(this.uHipFringeRepair,this.hipFringeRepair&&p.name==='body'?1:0);g.uniform1f(this.uCoverageFilter,p.generatedMaterial?0:1);const md=p.materialDomainTracks?.[key]?.[frame];g.uniform1f(this.uMaterialDomainMode,md?p.materialDomainMode:0);g.uniform4fv(this.uMaterialDomain,md??[0,0,0,0]);g.uniform1f(this.uOpacity,opacity);g.uniform1f(this.uNativeMaterial,p.name==='native_left_hand_923'?3:(p.nativeMaterial??0));g.uniform3fv(this.uNativeMultiply,p.multiplyTracks?.[frame]??[1,1,1]);g.uniform3fv(this.uNativeScreen,p.screenTracks?.[frame]??[0,0,0]);g.uniform4fv(this.uEyeMask,p.eyeMask??[0,0,0,0]);g.uniform1f(this.uEyeAngle,p.eyeAngle??0);g.uniform1f(this.uOpen,1-eyeClosure);g.uniform1f(this.uAlphaThreshold,p.alphaThreshold??0);const f=Math.min(frame,(key==='idle'?this.bundle.idleFrames:this.bundle.frames)-1),n=p.vertexCount*2;let pos=key==='rest'?p.rest:p.streams[key].subarray(f*n,(f+1)*n);if(blend&&!p.rigidProjectionModel){const from=blend.from.get(p.name);if(from){const q=new Float32Array(n);if(p.rigidArtwork){const a=Math.atan2(from[3]-from[1],from[2]-from[0])-Math.atan2(p.rest[3]-p.rest[1],p.rest[2]-p.rest[0]);const b=Math.atan2(pos[3]-pos[1],pos[2]-pos[0])-Math.atan2(p.rest[3]-p.rest[1],p.rest[2]-p.rest[0]);const delta=Math.atan2(Math.sin(b-a),Math.cos(b-a));const ang=a+delta*blend.weight,co=Math.cos(ang),si=Math.sin(ang);const rp=p.rigidPivotRest,rx=rp[0]-p.rest[0],ry=rp[1]-p.rest[1];const pa=[from[0]+Math.cos(a)*rx-Math.sin(a)*ry,from[1]+Math.sin(a)*rx+Math.cos(a)*ry],pb=[pos[0]+Math.cos(b)*rx-Math.sin(b)*ry,pos[1]+Math.sin(b)*rx+Math.cos(b)*ry];const x=pa[0]+(pb[0]-pa[0])*blend.weight,y=pa[1]+(pb[1]-pa[1])*blend.weight;for(let i=0;i<n;i+=2){const dx=p.rest[i]-rp[0],dy=p.rest[i+1]-rp[1];q[i]=x+co*dx-si*dy;q[i+1]=y+si*dx+co*dy;if(p.deformingArtwork){const fa=pa[0]+Math.cos(a)*dx-Math.sin(a)*dy,fb=pa[1]+Math.sin(a)*dx+Math.cos(a)*dy,ta=pb[0]+Math.cos(b)*dx-Math.sin(b)*dy,tb=pb[1]+Math.sin(b)*dx+Math.cos(b)*dy;q[i]+=(from[i]-fa)*(1-blend.weight)+(pos[i]-ta)*blend.weight;q[i+1]+=(from[i+1]-fb)*(1-blend.weight)+(pos[i+1]-tb)*blend.weight}}}else for(let i=0;i<n;i++)q[i]=from[i]+(pos[i]-from[i])*blend.weight;pos=q}}let projectionPose=null,projectionIndices=null;if(p.rigidProjectionModel){projectionPose=[...(key==='rest'?p.projectionPoseRest:p.projectionPoses[key][f])];const prior=blend?.from.get(p.name)?._rigidPose;if(prior){const w=blend.weight;projectionPose=projectionPose.map((v,i)=>i===0?prior[i]+Math.atan2(Math.sin(v-prior[i]),Math.cos(v-prior[i]))*w:prior[i]+(v-prior[i])*w);}const projected=this.projectRigidSurface(p.projectionModel,projectionPose);pos=projected.pos;projectionIndices=projected.indices;}const saved=new Float32Array(pos);if(projectionPose)saved._rigidPose=projectionPose;actual.push([p.name,saved]);g.bindVertexArray(p.vao);g.bindBuffer(g.ARRAY_BUFFER,p.pb);g.bufferSubData(g.ARRAY_BUFFER,0,pos);g.bindTexture(g.TEXTURE_2D,p.tex);g.uniform1i(this.uWire,false);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,p.ib);if(projectionIndices)g.bufferData(g.ELEMENT_ARRAY_BUFFER,projectionIndices,g.DYNAMIC_DRAW);g.drawElements(g.TRIANGLES,projectionIndices?projectionIndices.length:p.indices.length,g.UNSIGNED_SHORT,0);if(wire){g.uniform1i(this.uWire,true);g.bindBuffer(g.ELEMENT_ARRAY_BUFFER,p.eb);g.drawElements(g.LINES,p.edgeCount,g.UNSIGNED_SHORT,0)}};
 const ordered=[...this.parts].sort((a,b)=>(a.orders?.[key==='rest'?'main3':key]?.[frame]??a.order??500)-(b.orders?.[key==='rest'?'main3':key]?.[frame]??b.order??500));

 // Render the ORIGINAL whole-hand alpha once only for outside-contour material shading.
 // Final hand drawables are still independently drawn at native order around the head/body.
 const mask=this.ensureNativeHandMask();g.uniform2fv(this.uViewport,[this.canvas.width,this.canvas.height]);g.uniform1i(this.uNativeMask,2);g.uniform1i(this.uNativeMaskReady,false);g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D,this.originalTex);g.activeTexture(g.TEXTURE0);g.bindFramebuffer(g.FRAMEBUFFER,mask.fbo);g.clearColor(0,0,0,0);g.clear(g.COLOR_BUFFER_BIT);g.blendFunc(g.ONE,g.ONE_MINUS_SRC_ALPHA);for(const p of ordered)if(p.nativeHandDiagnostic)drawPart(p);g.bindFramebuffer(g.FRAMEBUFFER,null);g.activeTexture(g.TEXTURE2);g.bindTexture(g.TEXTURE_2D,mask.tex);g.activeTexture(g.TEXTURE0);g.uniform1i(this.uNativeMaskReady,true);
 const groupNames=[['canonical_mother_material','canonical_donor_material'],['salute_glove_material_phase','point_glove_material_phase','closed_glove_material_phase']];
 const groups=groupNames.map(names=>{const members=ordered.filter(p=>names.includes(p.name));const active=members.filter(p=>(key==='rest'?(((p.generatedMaterial&&!p.rigidArtwork)||p.phaseOnly)?0:1):(p.opacities?.[key]?.[frame]??1))>=1e-6);const grouped=active.length>1&&!wire;const order=p=>p.orders?.[key==='rest'?'main3':key]?.[frame]??p.order??500;if(grouped&&active.some(p=>order(p)!==order(active[0])))throw Error('Material group native orders diverged');return {names,members,grouped,drawn:false}});
 for(const p of ordered){if(p.name==='integrated_upper_yoke_v28')this.drawJointSupport(key,frame,blend,upper);const group=groups.find(q=>q.grouped&&q.names.includes(p.name));if(group){if(!group.drawn){this.drawPrimaryHandGroup(group.members,drawPart);group.drawn=true;}}else drawPart(p);}
 this.last=new Map(actual);this.draws++;return {key,frame,parts:this.parts.length,draws:this.draws,glError:g.getError()};}
}


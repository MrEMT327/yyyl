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
if(uSharedSurfaceAlpha>.5){vec2 aa=fwidth(vCoverage);vec2 a=smoothstep(vec2(0.),aa,max(vec2(0.),min(vCoverage,1.-vCoverage)));c.a=a.x*a.y;}if(uEyeMask.z>0.){vec2 d=vUV*vec2(1568.,1003.)-uEyeMask.xy;float co=cos(uEyeAngle),si=sin(uEyeAngle);vec2 q=vec2(d.x*co+d.y*si,-d.x*si+d.y*co)/uEyeMask.zw;float mask=1.-smoothstep(.82,1.,length(q));vec3 correction=(uEyeMask.x<780.?vec3(-1.,-6.5,-8.):vec3(-2.,-10.,-11.))/255.;float skin=smoothstep(.45,.8,c.r);c.rgb+=correction*skin;c.rgb=mix(c.rgb,min(c.rgb,vec3(1.,.914,.890)),skin);vec2 local=q*uEyeMask.zw;float op=clamp(uOpen,0.,1.);if(op>.999){c=texture(uOriginal,vUV);}else if(op>.055){float halfHeight=4.3*sqrt(max(0.,1.-pow(local.x/(uEyeMask.z*.91),2.)));float band=1.-smoothstep(halfHeight*op-.45,halfHeight*op+.45,abs(local.y));if(abs(local.y)<5.5){float sy=local.y<0.?-5.5:6.5;vec2 sd=vec2(local.x,sy);vec2 su=uEyeMask.xy+vec2(sd.x*co-sd.y*si,sd.x*si+sd.y*co);vec4 skinPixel=texture(uTexture,su/vec2(1568.,1003.));skinPixel.rgb+=correction;skinPixel.rgb=min(skinPixel.rgb,vec3(1.,.914,.890));c=mix(c,skinPixel,1.-smoothstep(3.3,5.5,abs(local.y)));}vec2 changed=vec2(local.x,local.y/max(op,.025));vec2 src=uEyeMask.xy+vec2(changed.x*co-changed.y*si,changed.x*si+changed.y*co);vec4 opened=texture(uOriginal,src/vec2(1568.,1003.));c=mix(c,opened,band);}c.a*=mask;}if(uNativeMaterial>0.){c.rgb=c.rgb*uNativeMultiply;c.rgb+=uNativeScreen-c.rgb*uNativeScreen;if(uNativeMaterial>1.5){float luminance=dot(c.rgb,vec3(.2126,.7152,.0722));float ink=uNativeMaterial>2.5?smoothstep(.09,.25,luminance):smoothstep(.025,.18,luminance);c.rgb=mix(vec3(.987,.990,1.),vec3(.55,.61,.73),ink);if(uNativeMaskReady){vec2 q=gl_FragCoord.xy/uViewport,dx=vec2(.85/uViewport.x,0.),dy=vec2(0.,.85/uViewport.y);float center=texture(uNativeMask,q).a;float edgeAlpha=min(min(texture(uNativeMask,q+dx).a,texture(uNativeMask,q-dx).a),min(texture(uNativeMask,q+dy).a,texture(uNativeMask,q-dy).a));float edge=(1.-smoothstep(.05,.75,edgeAlpha))*smoothstep(.1,.75,center);c.rgb=mix(c.rgb,vec3(.27,.36,.53),edge*.90);}}}if(c.a<uAlphaThreshold)discard;c.a*=uOpacity;if(uWire)c=vec4(.12,.54,.9,.55);frag=vec4(c.rgb*c.a,c.a);}

// Directional crossfades keep leaf lighting consistent across both tile axes.
export const forestCanopyGroundShader=`
vec3 sampleForestCanopy(vec2 uv){
  const float seam=.085;
  vec2 p=fract(uv)*(1.-seam),w=smoothstep(vec2(0.),vec2(seam),p);
  vec2 gx=dFdx(uv)*(1.-seam),gy=dFdy(uv)*(1.-seam);
  vec3 a=textureGrad(artwork,p,gx,gy).rgb;
  vec3 b=textureGrad(artwork,p+vec2(1.-seam,0.),gx,gy).rgb;
  vec3 c=textureGrad(artwork,p+vec2(0.,1.-seam),gx,gy).rgb;
  vec3 d=textureGrad(artwork,p+vec2(1.-seam),gx,gy).rgb;
  return mix(mix(d,c,w.x),mix(b,a,w.x),w.y);
}`;

const masks={
  a:`vec2 q=(p-.5)/vec2(.50,.47);
    float r=length(q)+.045*sin(p.x*19.)*sin(p.y*23.);
    return 1.-smoothstep(.65,1.,r);`,
  // These footprints keep architecture only. The API clearing below them
  // supplies all soil, grass and canopy shadows, so no old grass disc remains.
  b:`return max(forestArch(p),max(forestLeftPillar(p),forestRightPillar(p)));`,
  landmark:`float station=forestRelayStation(p),apron=forestRelayApron(p);
    float crane=forestPath(p,vec2(.245,.549),vec2(.300,.532),.005);
    crane=max(crane,forestPath(p,vec2(.247,.555),vec2(.298,.546),.004));
    crane=max(crane,forestPath(p,vec2(.300,.532),vec2(.331,.563),.006));
    crane=max(crane,forestPath(p,vec2(.244,.551),vec2(.244,.584),.004));
    crane=max(crane,forestEllipse(p,vec2(.245,.587),vec2(.008,.011)));
    crane=max(crane,forestEllipse(p,vec2(.331,.585),vec2(.023,.032)));
    float pipe=forestPath(p,vec2(.602,.328),vec2(.602,.350),.004);
    pipe=max(pipe,forestPath(p,vec2(.602,.350),vec2(.548,.350),.004));
    pipe=max(pipe,forestPath(p,vec2(.548,.350),vec2(.543,.393),.004));
    return max(max(station,apron),max(crane,pipe));`,
  'clearing-b':`float edge=min(min(p.x,1.-p.x),min(p.y,1.-p.y));return smoothstep(.015,.145,edge);`,
  'clearing-landmark':`float edge=min(min(p.x,1.-p.x),min(p.y,1.-p.y));return smoothstep(.015,.145,edge);`,
};

function polygon(name,points){
  const edges=points.map((a,i)=>{const b=points[(i+1)%points.length];
    return `forestContourEdge(d,inside,p,vec2(${a.join(',')}),vec2(${b.join(',')}));`;}).join('\n');
  return `float ${name}(vec2 p){float d=1.;bool inside=false;${edges}return 1.-smoothstep(-.001,.003,(inside?-1.:1.)*sqrt(d));}`;
}
const arch=[[.480,.312],[.515,.317],[.552,.335],[.578,.357],[.597,.391],[.604,.421],[.621,.424],[.620,.445],[.603,.462],[.603,.540],[.619,.548],[.618,.580],[.605,.596],[.537,.591],[.535,.556],[.550,.546],[.550,.460],[.538,.441],[.538,.416],[.519,.393],[.492,.382],[.465,.383],[.441,.397],[.419,.422],[.421,.436],[.437,.437],[.436,.454],[.418,.466],[.418,.501],[.440,.508],[.442,.542],[.431,.557],[.356,.551],[.357,.520],[.367,.510],[.370,.450],[.354,.445],[.353,.427],[.367,.418],[.376,.391],[.396,.365],[.421,.342],[.448,.323]];
const leftPillar=[[.248,.447],[.292,.424],[.302,.424],[.304,.438],[.302,.521],[.314,.532],[.317,.550],[.304,.565],[.263,.574],[.237,.559],[.234,.543],[.244,.531]];
const rightPillar=[[.647,.552],[.679,.540],[.701,.543],[.703,.560],[.698,.614],[.713,.628],[.714,.645],[.697,.661],[.664,.665],[.637,.652],[.634,.637],[.646,.625]];
const paving=[[.490,.488],[.543,.490],[.543,.595],[.515,.646],[.454,.701],[.398,.741],[.354,.740],[.355,.700],[.381,.674],[.335,.672],[.340,.633],[.386,.608],[.400,.576],[.445,.540]];
const station=[[.489,.280],[.498,.274],[.524,.274],[.527,.263],[.522,.251],[.527,.241],[.543,.235],[.550,.239],[.548,.253],[.540,.265],[.540,.272],[.562,.269],[.564,.221],[.569,.220],[.570,.232],[.574,.233],[.574,.209],[.577,.208],[.579,.232],[.582,.231],[.583,.220],[.586,.220],[.586,.240],[.582,.241],[.582,.234],[.579,.234],[.579,.269],[.586,.273],[.593,.276],[.617,.276],[.626,.284],[.626,.327],[.617,.338],[.501,.338],[.490,.329]];
const apron=[[.185,.639],[.192,.629],[.274,.629],[.275,.611],[.286,.600],[.307,.596],[.311,.583],[.347,.583],[.350,.586],[.384,.586],[.387,.568],[.395,.562],[.431,.562],[.440,.571],[.440,.586],[.465,.586],[.480,.588],[.492,.600],[.499,.619],[.500,.667],[.494,.689],[.480,.703],[.461,.708],[.332,.708],[.317,.701],[.314,.674],[.194,.674],[.184,.666]];
const road=[[.518,.337],[.513,.355],[.509,.374],[.512,.392],[.523,.408],[.540,.422],[.563,.438],[.581,.456],[.590,.475],[.590,.493],[.584,.510],[.570,.524],[.551,.534],[.529,.542],[.509,.551],[.495,.566],[.489,.584],[.489,.604]];
const roadCalls=road.slice(0,-1).map((a,i)=>`cover=max(cover,forestPath(p,vec2(${a.join(',')}),vec2(${road[i+1].join(',')}),.019));`).join('\n');
const functions=`
float forestEllipse(vec2 p,vec2 center,vec2 radius){return 1.-smoothstep(.90,1.,length((p-center)/radius));}
float forestPath(vec2 p,vec2 a,vec2 b,float radius){vec2 v=b-a;float t=clamp(dot(p-a,v)/dot(v,v),0.,1.);return 1.-smoothstep(radius-.004,radius,length(p-a-v*t));}
void forestContourEdge(inout float d,inout bool inside,vec2 p,vec2 a,vec2 b){
  vec2 e=b-a,q=p-a;vec2 nearest=q-e*clamp(dot(q,e)/dot(e,e),0.,1.);d=min(d,dot(nearest,nearest));
  if((a.y>p.y)!=(b.y>p.y)){float dy=b.y-a.y;float x=a.x+(p.y-a.y)*(b.x-a.x)/(abs(dy)>.000001?dy:.000001);if(p.x<x)inside=!inside;}
}
${polygon('forestArch',arch)}
${polygon('forestLeftPillar',leftPillar)}
${polygon('forestRightPillar',rightPillar)}
${polygon('forestPaving',paving)}
${polygon('forestRelayStation',station)}
${polygon('forestRelayApron',apron)}
float forestRelayRoad(vec2 p){float cover=0.;${roadCalls}return cover;}
`;

export function forestCanopyMask(shader,asset){
  shader.fragmentShader=functions+`float forestCanopyAlpha(vec2 p){${masks[asset]}}`+shader.fragmentShader;
  const coverage='vec2 forestAssetUv=vec2(vMapUv.x,1.-vMapUv.y);';
  const alpha='diffuseColor.a*=forestCanopyAlpha(forestAssetUv);';
  if(asset!=='b'&&asset!=='landmark'){
    if(asset==='a')return coverage+alpha;
    const shadows=asset==='clearing-b'?
      'forestContact(forestAssetUv,vec2(.402,.551),vec2(.062,.020))+forestContact(forestAssetUv,vec2(.586,.588),vec2(.062,.020))+forestContact(forestAssetUv,vec2(.285,.563),vec2(.048,.017))+forestContact(forestAssetUv,vec2(.683,.655),vec2(.046,.017))':
      'forestContact(forestAssetUv,vec2(.565,.340),vec2(.070,.020))+forestContact(forestAssetUv,vec2(.393,.707),vec2(.130,.018))';
    shader.fragmentShader='float forestContact(vec2 p,vec2 center,vec2 radius){vec2 q=(p-center)/radius;return exp(-2.*dot(q,q));}\n'+shader.fragmentShader;
    return coverage+alpha+`diffuseColor.rgb*=1.-min(.32,.28*(${shadows}));`;
  }
  // Architecture contours stay opaque. Only the disconnected paving and
  // access road need their old green floor keyed out inside narrow footprints.
  return coverage+`
    float forestOldGreen=min(diffuseColor.g-diffuseColor.r,diffuseColor.g-diffuseColor.b);
    float forestFloorRemoved=1.-smoothstep(-.003,.022,forestOldGreen);
    float forestFootprint=max(forestCanopyAlpha(forestAssetUv),${asset==='b'?'forestPaving(forestAssetUv)':'forestRelayRoad(forestAssetUv)'}*forestFloorRemoved);
    diffuseColor.a*=forestFootprint;
  `;
}

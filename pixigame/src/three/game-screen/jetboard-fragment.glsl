precision highp float;
uniform sampler2D rgbaTexture;
uniform sampler2D clipTexture;
uniform sampler2D repairRgbaTexture;
uniform sampler2D repairWeightTexture;
uniform sampler2D rgbRepairTexture;
uniform sampler2D rgbRepairWeightTexture;
uniform sampler2D seamUnderlayTexture;
uniform int seamUnderlayEnabled;
uniform vec4 seamBodyCrop;
uniform vec4 seamUnderlayCrop;
uniform vec2 seamFadeY;
uniform int fixedSkinPatchEnabled;
uniform vec2 fixedSkinPatchSize;
uniform vec4 fixedSkinPatchRect;
uniform vec2 fixedSkinPatchSample;
uniform sampler2D fixedHairTexture;
uniform int fixedHairEnabled;
uniform vec4 fixedHairCrop;
uniform int repairEnabled;
uniform int rgbRepairEnabled;
uniform vec4 repairUVRect;
uniform vec4 rgbRepairUVRect;
uniform int openingCount;
uniform int openingKeepInside;
uniform vec2 openingPoints[48];
uniform vec2 openingArtworkSize;
uniform vec2 openingEdge;
uniform float opacity;
uniform int hemOverlayEnabled;
uniform vec4 hemOverlayCrop;
uniform int operation;
uniform int masked;
uniform int invertedMask;
in vec2 uv;
in vec2 maskUV;
out vec4 colour;
bool insideRect(vec2 point,vec4 rect){
  return all(greaterThanEqual(point,rect.xy))&&all(lessThanEqual(point,rect.xy+rect.zw));
}
vec4 sampleFixedMaterial(vec2 point){
  vec4 c=texture(rgbaTexture,point);
  if(fixedSkinPatchEnabled!=0){
    vec2 p=point*fixedSkinPatchSize;
    vec2 edge=vec2(smoothstep(fixedSkinPatchRect.x,fixedSkinPatchRect.x+3.0,p.x),smoothstep(fixedSkinPatchRect.y,fixedSkinPatchRect.y+3.0,p.y))
      *vec2(1.0-smoothstep(fixedSkinPatchRect.z-3.0,fixedSkinPatchRect.z,p.x),1.0-smoothstep(fixedSkinPatchRect.w-3.0,fixedSkinPatchRect.w,p.y));
    vec4 skin=texture(rgbaTexture,fixedSkinPatchSample/fixedSkinPatchSize);
    c.rgb=mix(c.rgb,skin.rgb*c.a/max(skin.a,.001),edge.x*edge.y);
  }
  if(repairEnabled!=0&&insideRect(point,repairUVRect)){
    vec2 localUV=(point-repairUVRect.xy)/repairUVRect.zw;
    float weight=clamp(texture(repairWeightTexture,localUV).r,0.0,1.0);
    c=mix(c,texture(repairRgbaTexture,localUV),weight);
  }
  if(rgbRepairEnabled!=0&&insideRect(point,rgbRepairUVRect)){
    vec2 localUV=(point-rgbRepairUVRect.xy)/rgbRepairUVRect.zw;
    float weight=clamp(texture(rgbRepairWeightTexture,localUV).r,0.0,1.0);
    c.rgb=mix(c.rgb,texture(rgbRepairTexture,localUV).rgb*c.a,weight);
  }
  if(seamUnderlayEnabled!=0){
    vec2 materialPixel=seamBodyCrop.xy+point*seamBodyCrop.zw;
    vec2 underlayUV=(materialPixel-seamUnderlayCrop.xy)/seamUnderlayCrop.zw;
    if(insideRect(underlayUV,vec4(0.0,0.0,1.0,1.0))){
      float underneath=texture(seamUnderlayTexture,underlayUV).a;
      float safeCoverage=smoothstep(.98,1.0,underneath);
      float fade=smoothstep(seamFadeY.x,seamFadeY.y,materialPixel.y);
      c*=1.0-.85*safeCoverage*fade;
    }
  }
  if(fixedHairEnabled!=0&&c.a>.001){
    vec2 p=seamBodyCrop.xy+point*seamBodyCrop.zw;
    vec2 hairUV=(p-fixedHairCrop.xy)/fixedHairCrop.zw;
    if(insideRect(hairUV,vec4(0.0,0.0,1.0,1.0))){
      vec4 hair=texture(fixedHairTexture,hairUV);
      vec3 source=c.rgb/c.a;
      float hairColour=smoothstep(.12,.20,source.r-source.g)*(1.0-smoothstep(.75,.85,source.r))*smoothstep(.01,.03,source.g-source.b);
      float area=smoothstep(826.0,831.0,p.x)*smoothstep(630.0,640.0,p.y)*smoothstep(.98,1.0,hair.a)*hairColour;
      c.rgb=mix(c.rgb,hair.rgb*c.a/max(hair.a,.001),area);
    }
  }
  if(openingCount>0){
    vec2 p=point*openingArtworkSize;bool inside=false;float distanceToEdge=100000.0;
    for(int i=0;i<48;i++){
      if(i>=openingCount)break;
      int j=i==0?openingCount-1:i-1;
      vec2 a=openingPoints[i],b=openingPoints[j],ab=b-a;
      float t=clamp(dot(p-a,ab)/max(dot(ab,ab),.00001),0.0,1.0);
      distanceToEdge=min(distanceToEdge,length(p-a-t*ab));
      if((a.y>p.y)!=(b.y>p.y))if(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
    }
    float signedDistance=inside?-distanceToEdge:distanceToEdge;
    if(openingKeepInside!=0)signedDistance=-signedDistance;
    float edgeWidth=max(openingEdge.x,.65*fwidth(signedDistance));
    float coverage=smoothstep(-edgeWidth,edgeWidth,signedDistance);
    float ink=openingEdge.y>0.0?1.0-smoothstep(openingEdge.y*.65,openingEdge.y+edgeWidth*.55,signedDistance):0.0;
    c.rgb=mix(c.rgb,vec3(.42,.27,.20)*c.a,ink*.9);
    c*=coverage;
  }
  return c;
}
void main(){
  vec4 c=sampleFixedMaterial(uv);
  if(operation==3){colour=vec4(vec3(c.a),c.a);return;}
  float factor=opacity;
  if(hemOverlayEnabled!=0){
    // Only the near shorts opening belongs in front of the near thigh.
    vec2 p=uv*hemOverlayCrop.zw+hemOverlayCrop.xy;
    float edge;
    if(p.x<650.0)edge=mix(735.0,711.0,clamp((p.x-600.0)/50.0,0.0,1.0));
    else if(p.x<700.0)edge=mix(711.0,698.0,(p.x-650.0)/50.0);
    else if(p.x<740.0)edge=mix(698.0,696.0,(p.x-700.0)/40.0);
    else if(p.x<780.0)edge=mix(696.0,711.0,(p.x-740.0)/40.0);
    else if(p.x<810.0)edge=mix(711.0,733.0,(p.x-780.0)/30.0);
    else edge=mix(733.0,735.0,clamp((p.x-810.0)/20.0,0.0,1.0));
    factor*=smoothstep(595.0,600.0,p.x)*(1.0-smoothstep(830.0,835.0,p.x))*smoothstep(675.0,680.0,p.y)*(1.0-smoothstep(edge-1.0,edge+1.0,p.y));
  }
  if(masked!=0){
    float coverage=0.0;
    if(all(greaterThanEqual(maskUV,vec2(0.0)))&&all(lessThanEqual(maskUV,vec2(1.0))))
      coverage=clamp(texture(clipTexture,maskUV).a,0.0,1.0);
    factor*=invertedMask!=0?1.0-coverage:coverage;
  }
  if(operation==1) colour=vec4(c.rgb*factor,0.0);
  else if(operation==2) colour=vec4(vec3(1.0-c.a*factor)+c.rgb*factor,1.0);
  else colour=c*factor;
}
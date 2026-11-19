import { notifyOwnedCanvasFrame } from './release-owned-canvas.js';

// The fixed target meshes use artwork-space coordinates and top-left UVs.
// Textures are premultiplied before mipmap generation, matching native main.gd.
const VERTEX = `#version 300 es
in vec2 position;
in vec2 texcoord;
uniform vec2 sceneSize;
uniform float cameraScale;
uniform vec2 cameraOffset;
uniform vec2 containFit;
out vec2 uv;
out vec2 maskUV;
void main(){
  vec2 point=position*cameraScale+cameraOffset;
  vec2 normalized=point/sceneSize;
  uv=texcoord;
  // Render textures use the GL bottom-left origin; source PNG UVs use top-left.
  maskUV=vec2(normalized.x,1.0-normalized.y);
  gl_Position=vec4(vec2(normalized.x*2.0-1.0,1.0-normalized.y*2.0)*containFit,0.0,1.0);
}`;

const FRAGMENT = `#version 300 es
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
}`;

export function createGoldenMeshRenderer(canvas, manifest, textures) {
  const gl=canvas.getContext('webgl2',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:true,depth:false,stencil:false});
  if(!gl)throw new Error('当前浏览器无法创建角色 WebGL2 画布');
  const meshRecords=[],textureRecords=new Map(),maskRecords=new Map();
  let program=null,destroyed=false;
  function compile(type,source){
    const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);
    if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){const reason=gl.getShaderInfoLog(shader);gl.deleteShader(shader);throw new Error(reason||'角色着色器编译失败');}
    return shader;
  }
  const vs=compile(gl.VERTEX_SHADER,VERTEX),fs=compile(gl.FRAGMENT_SHADER,FRAGMENT);
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS)){const reason=gl.getProgramInfoLog(program);gl.deleteProgram(program);throw new Error(reason||'角色着色器连接失败');}
  const uniforms=Object.fromEntries(['openingCount','openingKeepInside','openingPoints[0]','openingArtworkSize','openingEdge','sceneSize','cameraScale','cameraOffset','containFit','rgbaTexture','clipTexture','repairRgbaTexture','repairWeightTexture','rgbRepairTexture','rgbRepairWeightTexture','repairEnabled','rgbRepairEnabled','repairUVRect','rgbRepairUVRect','seamUnderlayTexture','seamUnderlayEnabled','seamBodyCrop','seamUnderlayCrop','seamFadeY','fixedSkinPatchEnabled','fixedSkinPatchSize','fixedSkinPatchRect','fixedSkinPatchSample','fixedHairTexture','fixedHairEnabled','fixedHairCrop','hemOverlayEnabled','hemOverlayCrop','opacity','operation','masked','invertedMask'].map(name=>[name,gl.getUniformLocation(program,name)]));
  const positionAt=gl.getAttribLocation(program,'position'),uvAt=gl.getAttribLocation(program,'texcoord');
  gl.useProgram(program);gl.uniform2f(uniforms.sceneSize,manifest.width,manifest.height);gl.uniform1f(uniforms.cameraScale,manifest.camera.scale);gl.uniform2fv(uniforms.cameraOffset,manifest.camera.offset);gl.uniform1i(uniforms.rgbaTexture,0);gl.uniform1i(uniforms.clipTexture,1);
  gl.uniform1i(uniforms.repairRgbaTexture,2);gl.uniform1i(uniforms.repairWeightTexture,3);gl.uniform1i(uniforms.rgbRepairTexture,4);gl.uniform1i(uniforms.rgbRepairWeightTexture,5);
  gl.uniform1i(uniforms.seamUnderlayTexture,6);
  gl.uniform1i(uniforms.fixedHairTexture,7);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);
  gl.clearColor(0,0,0,0);gl.blendEquationSeparate(gl.FUNC_ADD,gl.FUNC_ADD);

  // Every sampler always has a complete texture, including disabled repairs.
  // A dedicated texture also keeps an old mask attachment off the sampling units.
  const defaultTexture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,defaultTexture);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array(4));
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  const weightTextureIds=new Set();
  for(const definition of manifest.meshes)for(const repair of [definition.materialRepair,definition.rgbMaterialRepair])if(repair)weightTextureIds.add(repair.weightTexture);

  // HTML image upload performs premultiplication before sampling and mipmaps.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL,gl.NONE);
  for(const [id,image] of textures){
    const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const isWeight=weightTextureIds.has(id);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,isWeight?gl.LINEAR:gl.LINEAR_MIPMAP_LINEAR);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,gl.RGBA,gl.UNSIGNED_BYTE,image);if(!isWeight)gl.generateMipmap(gl.TEXTURE_2D);textureRecords.set(id,texture);
  }
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
  function fixedRepair(definition,key,textureKey){
    const repair=definition[key];if(!repair)return null;
    if(repair.constantOverTime!==true||repair.coordinateSpace!=='original_target_uv')throw new Error('角色材质修复必须使用固定原始UV：'+definition.id);
    const texture=textureRecords.get(repair[textureKey]),weight=textureRecords.get(repair.weightTexture);
    if(!texture||!weight)throw new Error('角色修复贴图缺失：'+definition.id);
    const rect=repair.uvRect||[0,0,1,1];
    if(!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite)||rect[2]<=0||rect[3]<=0)throw new Error('角色修复UV范围无效：'+definition.id);
    return {texture,weight,rect};
  }
  const byId=new Map();
  // All callers already write their pose into one packed Float32Array.
  // Upload that array once; each VAO reads its own byte range.
  const positionCount=manifest.meshes.reduce((count,mesh)=>Math.max(count,mesh.stateOffset+mesh.vertices.length),0);
  const positionBuffer=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,positionCount*Float32Array.BYTES_PER_ELEMENT,gl.DYNAMIC_DRAW);
  for(const [index,definition] of manifest.meshes.entries()){
    const opening=definition.alphaOpening;
    if(opening&&(!Array.isArray(opening.polygon)||opening.polygon.length<3||opening.polygon.length>48||!opening.polygon.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||opening.artworkSize?.length!==2||!opening.artworkSize.every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(opening.feather)||opening.feather<=0||!Number.isFinite(opening.outline)||opening.outline<0))throw new Error('角色局部镂空配置无效：'+definition.id);
    const texture=textureRecords.get(definition.texture);if(!texture)throw new Error('角色贴图缺失：'+definition.texture);
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);gl.enableVertexAttribArray(positionAt);
    gl.vertexAttribPointer(positionAt,2,gl.FLOAT,false,0,definition.stateOffset*Float32Array.BYTES_PER_ELEMENT);
    const uvs=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvs);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(definition.uvs),gl.STATIC_DRAW);gl.enableVertexAttribArray(uvAt);gl.vertexAttribPointer(uvAt,2,gl.FLOAT,false,0,0);
    const indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(definition.indices),gl.STATIC_DRAW);
    const repair=fixedRepair(definition,'materialRepair','rgbaTexture'),rgbRepair=fixedRepair(definition,'rgbMaterialRepair','rgbTexture');
    let openingPoints;
    if(opening){openingPoints=new Float32Array(96);openingPoints.set(opening.polygon.flat());}
    const record={index,definition,texture,vao,uvs,indices,count:definition.indices.length,mask:null,repair,rgbRepair,openingPoints};meshRecords.push(record);byId.set(definition.id,record);
  }
  gl.bindVertexArray(null);
  for(const record of meshRecords){
    const ids=[...new Set(record.definition.masks||[])].sort();if(!ids.length)continue;
    const key=JSON.stringify(ids);
    if(!maskRecords.has(key)){
      const sources=ids.map(id=>{if(!byId.has(id)||id===record.definition.id)throw new Error('角色遮罩来源无效：'+id);return byId.get(id);});
      const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,manifest.width,manifest.height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      const framebuffer=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
      if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('角色遮罩画布创建失败');
      maskRecords.set(key,{texture,framebuffer,sources});
    }
    record.mask=maskRecords.get(key);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  const boundTextures=[];
  let textureUnit=-1, multiplyBlend, currentOpacity;
  const integers=Object.create(null),vectors=Object.create(null);
  function bindTexture(unit,texture) {
    if(boundTextures[unit]===texture)return;
    if(textureUnit!==unit){gl.activeTexture(gl.TEXTURE0+unit);textureUnit=unit;}
    gl.bindTexture(gl.TEXTURE_2D,texture);boundTextures[unit]=texture;
  }
  // Keep every sampler complete. Material flags decide whether it is sampled.
  for(let unit=0;unit<8;unit++)bindTexture(unit,defaultTexture);
  function integer(name,value) {
    if(integers[name]===value)return;
    gl.uniform1i(uniforms[name],value);integers[name]=value;
  }
  function vec2(name,value) {
    if(vectors[name]===value)return;
    gl.uniform2fv(uniforms[name],value);vectors[name]=value;
  }
  function vec4(name,value) {
    if(vectors[name]===value)return;
    gl.uniform4fv(uniforms[name],value);vectors[name]=value;
  }
  function blend(operation) {
    const multiply=operation===2;
    if(multiplyBlend===multiply)return;
    multiplyBlend=multiply;
    if(multiply)gl.blendFuncSeparate(gl.DST_COLOR,gl.ZERO,gl.ZERO,gl.ONE);
    else gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
  }
  function opacity(value) {
    if(currentOpacity===value)return;
    gl.uniform1f(uniforms.opacity,value);currentOpacity=value;
  }
  function drawRecord(record){
    const {repair,rgbRepair}=record;
    const skinPatch=record.definition.fixedSkinPatch;
    integer('fixedSkinPatchEnabled',skinPatch?1:0);
    if(skinPatch){vec2('fixedSkinPatchSize',skinPatch.size);vec4('fixedSkinPatchRect',skinPatch.rect);vec2('fixedSkinPatchSample',skinPatch.sample);}
    const hairPatch=record.definition.fixedHairPatch;
    integer('fixedHairEnabled',hairPatch?1:0);
    if(hairPatch){vec4('fixedHairCrop',hairPatch.crop);bindTexture(7,textureRecords.get(hairPatch.texture)||defaultTexture);}
    const seam=record.definition.seamUnderlay;
    integer('seamUnderlayEnabled',seam?1:0);
    if(seam){vec4('seamBodyCrop',seam.bodyCrop);vec4('seamUnderlayCrop',seam.underlayCrop);vec2('seamFadeY',seam.fadeY);bindTexture(6,textureRecords.get(seam.texture)||defaultTexture);}
    const opening=record.definition.alphaOpening;
    integer('openingCount',opening?.polygon.length||0);
    if(opening){
      integer('openingKeepInside',opening.keepInside?1:0);
      if(vectors['openingPoints[0]']!==record.openingPoints)gl.uniform2f(uniforms.openingEdge,opening.feather,opening.outline);
      vec2('openingPoints[0]',record.openingPoints);
      vec2('openingArtworkSize',opening.artworkSize);
    }
    integer('repairEnabled',repair?1:0);integer('rgbRepairEnabled',rgbRepair?1:0);
    if(repair){vec4('repairUVRect',repair.rect);bindTexture(2,repair.texture);bindTexture(3,repair.weight);}
    if(rgbRepair){vec4('rgbRepairUVRect',rgbRepair.rect);bindTexture(4,rgbRepair.texture);bindTexture(5,rgbRepair.weight);}
    bindTexture(0,record.texture);gl.bindVertexArray(record.vao);gl.drawElements(gl.TRIANGLES,record.count,gl.UNSIGNED_INT,0);
  }
  const ordered=meshRecords.slice(),previousOrder=new Float32Array(meshRecords.length).fill(NaN);
  function draw(positions,opacities,orders,visibilities){
    if(destroyed)return;
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER,positionBuffer);
    gl.bufferSubData(gl.ARRAY_BUFFER,0,positions.length===positionCount?positions:positions.subarray(0,positionCount));
    // All mask sources use the same updated geometry buffers. Source visibility,
    // opacity, blend mode and own masks do not affect this nonrecursive alpha union.
    if(maskRecords.size){
      gl.uniform2f(uniforms.containFit,1,1);integer('operation',3);integer('masked',0);opacity(1);blend(3);
      // Unbind an old mask before rendering into that mask's attachment.
      bindTexture(1,defaultTexture);
      for(const mask of maskRecords.values()){
        gl.bindFramebuffer(gl.FRAMEBUFFER,mask.framebuffer);gl.viewport(0,0,manifest.width,manifest.height);gl.clear(gl.COLOR_BUFFER_BIT);
        for(const source of mask.sources)drawRecord(source);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clear(gl.COLOR_BUFFER_BIT);
    const scale=Math.min(canvas.width/manifest.width,canvas.height/manifest.height);gl.uniform2f(uniforms.containFit,manifest.width*scale/canvas.width,manifest.height*scale/canvas.height);
    if(previousOrder.some((value,i)=>value!==orders[i])){
      ordered.sort((a,b)=>orders[a.index]-orders[b.index]||a.index-b.index);
      previousOrder.set(orders);
    }
    for(const record of ordered){
      const index=record.index,definition=record.definition,alpha=opacities[index];
      if(definition.maskOnly||!visibilities[index]||alpha<=0)continue;
      const operation=definition.blend==='add'?1:definition.blend==='multiply'?2:0;
      blend(operation);integer('operation',operation);opacity(alpha);integer('masked',record.mask?1:0);
      if(record.mask){integer('invertedMask',definition.invertedMask?1:0);bindTexture(1,record.mask.texture);}
      drawRecord(record);
      const hemOverlay=definition.frontHemOverlay;
      if(hemOverlay){
        const shorts=byId.get(hemOverlay.source);
        if(shorts&&visibilities[shorts.index]&&opacities[shorts.index]>0){
          blend(0);integer('operation',0);opacity(opacities[shorts.index]);integer('masked',0);
          vec4('hemOverlayCrop',hemOverlay.crop);integer('hemOverlayEnabled',1);drawRecord(shorts);integer('hemOverlayEnabled',0);
        }
      }
    }
    gl.bindVertexArray(null);gl.flush();
    notifyOwnedCanvasFrame(canvas);
  }
  function resize(width,height){
    if(destroyed)return false;
    width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
    if(canvas.width===width&&canvas.height===height)return false;
    if(canvas.width!==width)canvas.width=width;
    if(canvas.height!==height)canvas.height=height;
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,width,height);
    return true;
  }
  function destroy(){
    if(destroyed)return;destroyed=true;
    for(const record of meshRecords){gl.deleteVertexArray(record.vao);gl.deleteBuffer(record.uvs);gl.deleteBuffer(record.indices);}
    gl.deleteBuffer(positionBuffer);
    for(const texture of textureRecords.values())gl.deleteTexture(texture);
    gl.deleteTexture(defaultTexture);
    for(const mask of maskRecords.values()){gl.deleteTexture(mask.texture);gl.deleteFramebuffer(mask.framebuffer);}
    gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return {draw,resize,destroy};
}

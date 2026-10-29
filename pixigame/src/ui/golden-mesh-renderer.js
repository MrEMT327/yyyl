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
uniform int repairEnabled;
uniform int rgbRepairEnabled;
uniform vec4 repairUVRect;
uniform vec4 rgbRepairUVRect;
uniform int openingCount;
uniform vec2 openingPoints[48];
uniform vec2 openingArtworkSize;
uniform vec2 openingEdge;
uniform float opacity;
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
  const uniforms=Object.fromEntries(['openingCount','openingPoints[0]','openingArtworkSize','openingEdge','sceneSize','cameraScale','cameraOffset','containFit','rgbaTexture','clipTexture','repairRgbaTexture','repairWeightTexture','rgbRepairTexture','rgbRepairWeightTexture','repairEnabled','rgbRepairEnabled','repairUVRect','rgbRepairUVRect','opacity','operation','masked','invertedMask'].map(name=>[name,gl.getUniformLocation(program,name)]));
  const positionAt=gl.getAttribLocation(program,'position'),uvAt=gl.getAttribLocation(program,'texcoord');
  gl.useProgram(program);gl.uniform2f(uniforms.sceneSize,manifest.width,manifest.height);gl.uniform1f(uniforms.cameraScale,manifest.camera.scale);gl.uniform2fv(uniforms.cameraOffset,manifest.camera.offset);gl.uniform1i(uniforms.rgbaTexture,0);gl.uniform1i(uniforms.clipTexture,1);
  gl.uniform1i(uniforms.repairRgbaTexture,2);gl.uniform1i(uniforms.repairWeightTexture,3);gl.uniform1i(uniforms.rgbRepairTexture,4);gl.uniform1i(uniforms.rgbRepairWeightTexture,5);
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);

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
  for(const [index,definition] of manifest.meshes.entries()){
    const opening=definition.alphaOpening;
    if(opening&&(!Array.isArray(opening.polygon)||opening.polygon.length<3||opening.polygon.length>48||!opening.polygon.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||opening.artworkSize?.length!==2||!opening.artworkSize.every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(opening.feather)||opening.feather<=0||!Number.isFinite(opening.outline)||opening.outline<0))throw new Error('角色局部镂空配置无效：'+definition.id);
    const texture=textureRecords.get(definition.texture);if(!texture)throw new Error('角色贴图缺失：'+definition.texture);
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    const positions=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,positions);gl.bufferData(gl.ARRAY_BUFFER,definition.vertices.length*4,gl.DYNAMIC_DRAW);gl.enableVertexAttribArray(positionAt);gl.vertexAttribPointer(positionAt,2,gl.FLOAT,false,0,0);
    const uvs=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,uvs);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(definition.uvs),gl.STATIC_DRAW);gl.enableVertexAttribArray(uvAt);gl.vertexAttribPointer(uvAt,2,gl.FLOAT,false,0,0);
    const indices=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indices);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,new Uint32Array(definition.indices),gl.STATIC_DRAW);
    const repair=fixedRepair(definition,'materialRepair','rgbaTexture'),rgbRepair=fixedRepair(definition,'rgbMaterialRepair','rgbTexture');
    const record={index,definition,texture,vao,positions,uvs,indices,count:definition.indices.length,mask:null,repair,rgbRepair};meshRecords.push(record);byId.set(definition.id,record);
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
  function drawRecord(record){
    const {repair,rgbRepair}=record;
    const opening=record.definition.alphaOpening;
    gl.uniform1i(uniforms.openingCount,opening?.polygon.length||0);
    if(opening){
      const points=new Float32Array(96);points.set(opening.polygon.flat());
      gl.uniform2fv(uniforms['openingPoints[0]'],points);
      gl.uniform2fv(uniforms.openingArtworkSize,opening.artworkSize);
      gl.uniform2f(uniforms.openingEdge,opening.feather,opening.outline);
    }
    gl.uniform1i(uniforms.repairEnabled,repair?1:0);gl.uniform1i(uniforms.rgbRepairEnabled,rgbRepair?1:0);
    gl.uniform4fv(uniforms.repairUVRect,repair?.rect||[0,0,1,1]);gl.uniform4fv(uniforms.rgbRepairUVRect,rgbRepair?.rect||[0,0,1,1]);
    for(const [unit,texture] of [[2,repair?.texture],[3,repair?.weight],[4,rgbRepair?.texture],[5,rgbRepair?.weight]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture||defaultTexture);}
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,record.texture);gl.bindVertexArray(record.vao);gl.drawElements(gl.TRIANGLES,record.count,gl.UNSIGNED_INT,0);
  }
  function draw(positions,opacities,orders,visibilities){
    if(destroyed)return;
    gl.useProgram(program);gl.enable(gl.BLEND);gl.blendEquationSeparate(gl.FUNC_ADD,gl.FUNC_ADD);
    for(const record of meshRecords){const start=record.definition.stateOffset;gl.bindBuffer(gl.ARRAY_BUFFER,record.positions);gl.bufferSubData(gl.ARRAY_BUFFER,0,positions.subarray(start,start+record.definition.vertices.length));}
    // All mask sources use the same updated geometry buffers. Source visibility,
    // opacity, blend mode and own masks do not affect this nonrecursive alpha union.
    gl.uniform2f(uniforms.containFit,1,1);gl.uniform1i(uniforms.operation,3);gl.uniform1i(uniforms.masked,0);gl.uniform1i(uniforms.invertedMask,0);gl.uniform1f(uniforms.opacity,1);
    gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
    // Unbind any old mask on unit 1 before rendering into that mask's attachment.
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,defaultTexture);
    for(const mask of maskRecords.values()){
      gl.bindFramebuffer(gl.FRAMEBUFFER,mask.framebuffer);gl.viewport(0,0,manifest.width,manifest.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
      for(const source of mask.sources)drawRecord(source);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
    const scale=Math.min(canvas.width/manifest.width,canvas.height/manifest.height);gl.uniform2f(uniforms.containFit,manifest.width*scale/canvas.width,manifest.height*scale/canvas.height);
    const ordered=meshRecords.slice().sort((a,b)=>orders[a.index]-orders[b.index]||a.index-b.index);
    for(const record of ordered){
      const index=record.index,definition=record.definition,opacity=opacities[index];
      if(definition.maskOnly||!visibilities[index]||opacity<=0)continue;
      let operation=0;
      if(definition.blend==='add'){operation=1;gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);}
      else if(definition.blend==='multiply'){operation=2;gl.blendFuncSeparate(gl.DST_COLOR,gl.ZERO,gl.ZERO,gl.ONE);}
      else gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform1i(uniforms.operation,operation);gl.uniform1f(uniforms.opacity,opacity);gl.uniform1i(uniforms.masked,record.mask?1:0);gl.uniform1i(uniforms.invertedMask,definition.invertedMask?1:0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,record.mask?.texture||defaultTexture);drawRecord(record);
    }
    gl.bindVertexArray(null);gl.flush();
  }
  function resize(width,height){if(destroyed)return;canvas.width=Math.max(1,Math.round(width));canvas.height=Math.max(1,Math.round(height));gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);}
  function destroy(){
    if(destroyed)return;destroyed=true;
    for(const record of meshRecords){gl.deleteVertexArray(record.vao);gl.deleteBuffer(record.positions);gl.deleteBuffer(record.uvs);gl.deleteBuffer(record.indices);}
    for(const texture of textureRecords.values())gl.deleteTexture(texture);
    gl.deleteTexture(defaultTexture);
    for(const mask of maskRecords.values()){gl.deleteTexture(mask.texture);gl.deleteFramebuffer(mask.framebuffer);}
    gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
  return {draw,resize,destroy};
}

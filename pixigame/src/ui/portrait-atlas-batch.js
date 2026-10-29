// One ordered color draw for the authored mesh animation. Eye masks and six
// animated lighting corrections stay live; no animation frames are baked.
export function createPortraitAtlasBatch(PIXI,{manifest,atlas,pages,maskScenes}){
  const layers=manifest.layers.map((layer,frameIndex)=>({...layer,frameIndex})).filter(layer=>!layer.isMask);
  if(layers.some(layer=>(layer.blendMode||'normal')!=='normal'))throw Error('立绘图集合批仅支持原始普通混合');
  const vertexCount=layers.reduce((n,l)=>n+l.vertexCount,0),indexCount=layers.reduce((n,l)=>n+l.indices.length,0);
  const positions=new Float32Array(vertexCount*2),uvs=new Float32Array(vertexCount*2),indices=new Uint32Array(indexCount);
  const alpha=new Float32Array(vertexCount),params=new Float32Array(vertexCount*3),bounds=new Float32Array(vertexCount*4);
  const maskIds=[...maskScenes.keys()],lightTargets=[...new Set((manifest.lightingPasses||[]).map(p=>p.targetLayerId))];
  let at=0;
  for(const layer of layers){
    const entry=atlas.entries[layer.texture],page=atlas.pages[entry.page];if(!entry)throw Error(`图集缺少 ${layer.texture}`);
    const [x,y,w,h]=entry.rect,[pw,ph]=page.size;
    layer.batchVertexOffset=at;
    if((layer.masks||[]).length>1)throw Error('立绘合批需要单一眼部遮罩');
    const clip=layer.masks?.length?(maskIds.indexOf(layer.masks[0])+1)*(layer.invertMask?-1:1):0;
    for(let i=0;i<layer.vertexCount;i++,at++){
      uvs[at*2]=(x+layer.uvs[i*2]*w)/pw;uvs[at*2+1]=(y+layer.uvs[i*2+1]*h)/ph;
      params.set([entry.page,clip,lightTargets.indexOf(layer.id)+1],at*3);
      bounds.set([(x+.5)/pw,(y+.5)/ph,(x+w-.5)/pw,(y+h-.5)/ph],at*4);
    }
  }
  const geometry=new PIXI.MeshGeometry({positions,uvs,indices});
  geometry.addAttribute('aAlpha',{buffer:alpha,format:'float32'});
  geometry.addAttribute('aParams',{buffer:params,format:'float32x3'});
  geometry.addAttribute('aBounds',{buffer:bounds,format:'float32x4'});
  const resources={},uniforms={uCanvasSize:{value:new Float32Array(manifest.canvasSize),type:'vec2<f32>'}};
  let declarations='',operations='';
  pages.forEach((texture,i)=>{resources[`uAtlas${i}`]=texture.source;declarations+=`uniform sampler2D uAtlas${i};\n`;});
  maskIds.forEach((id,i)=>{resources[`uMask${i}`]=maskScenes.get(id).texture.source;declarations+=`uniform sampler2D uMask${i};\n`;});
  for(const [i,pass]of (manifest.lightingPasses||[]).entries()){
    const mask=maskIds.indexOf(pass.maskLayerId);if(mask<0)throw Error('立绘合批缺少动态光照遮罩');
    uniforms[`uOpacity${i}`]={value:pass.baselineOpacity,type:'f32'};
    uniforms[`uBase${i}`]={value:pass.baselineOpacity,type:'f32'};
    declarations+=`uniform float uOpacity${i};uniform float uBase${i};\n`;
    const expression=pass.mode==='multiply-ratio'?`color*=(1.0-uOpacity${i}*maskValue)/max(1.0-uBase${i}*maskValue,0.0001);`
      :pass.mode==='screen-ratio'?`color=1.0-(1.0-color)*(1.0-uOpacity${i}*maskValue)/max(1.0-uBase${i}*maskValue,0.0001);`
      :pass.mode==='add-difference'?`color+=(uOpacity${i}-uBase${i})*maskValue;`:null;
    if(!expression)throw Error('不支持的动态光照模式');
    operations+=`if(abs(vParams.z-${lightTargets.indexOf(pass.targetLayerId)+1}.0)<.1&&abs(uOpacity${i}-uBase${i})>.00000001){float maskValue=texture(uMask${mask},vCanvasPos/uCanvasSize).a;${expression}}\n`;
  }
  resources.poseUniforms=uniforms;
  const sampleAtlas=pages.map((_,i)=>`${i?'else ':''}if(vParams.x<${i+.5})base=texture(uAtlas${i},clamp(vUV,vBounds.xy,vBounds.zw));`).join('\n');
  const sampleMask=maskIds.map((_,i)=>`${i?'else ':''}if(abs(vParams.y)<${i+1.5})clipAlpha=texture(uMask${i},vCanvasPos/uCanvasSize).a;`).join('\n');
  const shader=PIXI.Shader.from({gl:{
    vertex:`precision highp float;in vec2 aPosition;in vec2 aUV;in float aAlpha;in vec3 aParams;in vec4 aBounds;
uniform mat3 uProjectionMatrix,uWorldTransformMatrix,uTransformMatrix;uniform vec4 uWorldColorAlpha,uColor;
out vec2 vUV,vCanvasPos;out vec4 vColor,vBounds;out vec3 vParams;out float vAlpha;
void main(){vUV=aUV;vCanvasPos=aPosition;vColor=uColor*uWorldColorAlpha;vBounds=aBounds;vParams=aParams;vAlpha=aAlpha;gl_Position=vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.0)).xy,0.0,1.0);}`,
    fragment:`precision highp float;in vec2 vUV,vCanvasPos;in vec4 vColor,vBounds;in vec3 vParams;in float vAlpha;uniform vec2 uCanvasSize;${declarations}
out vec4 finalColor;void main(){vec4 base=vec4(0.0);${sampleAtlas}vec3 color=base.a>.00001?base.rgb/base.a:vec3(0.0);${operations}
float clipAlpha=1.0;if(abs(vParams.y)>.5){${sampleMask}if(vParams.y<0.0)clipAlpha=1.0-clipAlpha;}
finalColor=vec4(clamp(color,0.0,1.0)*base.a,base.a)*clipAlpha*vColor*vAlpha;}`,
  },resources});
  const mesh=new PIXI.Mesh({geometry,shader,texture:pages[0],blendMode:'normal'});
  return {mesh,update(pose,opacities,orders,lighting){
    for(const layer of layers){const offset=layer.batchVertexOffset;positions.set(pose.subarray(layer.positionFloatOffset,layer.positionFloatOffset+layer.vertexCount*2),offset*2);alpha.fill(opacities[layer.frameIndex],offset,offset+layer.vertexCount);}
    let at=0;
    for(const layer of layers.slice().sort((a,b)=>orders[a.frameIndex]-orders[b.frameIndex]||a.frameIndex-b.frameIndex))for(const index of layer.indices)indices[at++]=index+layer.batchVertexOffset;
    geometry.attributes.aPosition.buffer.update();geometry.attributes.aAlpha.buffer.update();geometry.indexBuffer.update();
    if(lighting)for(const [i,pass]of manifest.lightingPasses.entries())shader.resources.poseUniforms.uniforms[`uOpacity${i}`]=lighting[pass.opacityIndex];
  },destroy(){mesh.removeFromParent();mesh.destroy();geometry.destroy(true);shader.destroy();}};
}

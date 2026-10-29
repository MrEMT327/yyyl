// Project-owned batching adapter. Cubism still chooses drawable order, masks,
// animation and clipping matrices. Only adjacent compatible GPU submissions
// are merged; per-draw uniforms become per-vertex values.
const STRIDE=20;
const VERTEX=`
attribute vec4 a_position;
attribute vec2 a_uv;
attribute vec4 a_base;
attribute vec3 a_multiply;
attribute vec3 a_screen;
attribute vec4 a_clip;
varying vec2 v_uv;
varying vec4 v_base;
varying vec3 v_multiply;
varying vec3 v_screen;
varying vec4 v_clip;
varying vec2 v_position;
void main(){gl_Position=a_position;v_position=a_position.xy/a_position.w;
v_uv=vec2(a_uv.x,1.0-a_uv.y);v_base=a_base;v_multiply=a_multiply;v_screen=a_screen;v_clip=a_clip;}`;
const FRAGMENT=`
precision mediump float;
uniform sampler2D u_texture;
uniform sampler2D u_mask;
uniform float u_maskPass;
varying vec2 v_uv;
varying vec4 v_base;
varying vec3 v_multiply;
varying vec3 v_screen;
varying vec4 v_clip;
varying vec2 v_position;
vec4 channel(float id){return vec4(float(id<1.5),float(id>=1.5&&id<2.5),float(id>=2.5&&id<3.5),float(id>=3.5));}
void main(){
if(mod(v_clip.w,2.0)>0.5&&!gl_FrontFacing)discard;
vec4 tex=texture2D(u_texture,v_uv);
if(u_maskPass>0.5){
float inside=step(v_base.x,v_position.x)*step(v_base.y,v_position.y)*step(v_position.x,v_base.z)*step(v_position.y,v_base.w);
gl_FragColor=channel(abs(v_clip.z))*tex.a*inside;
}else{
tex.rgb*=v_multiply;
tex.rgb=tex.rgb+v_screen*tex.a-tex.rgb*v_screen;
vec4 color=tex*v_base;
if(abs(v_clip.z)>0.5){float mask=dot(1.0-texture2D(u_mask,v_clip.xy),channel(abs(v_clip.z)));color*=v_clip.z<0.0?1.0-mask:mask;}
// Additive premultiplied RGB uses the same ONE/ONE_MINUS_SRC_ALPHA
// equation when the submitted alpha is zero; destination alpha is preserved.
if(v_clip.w>1.5)color.a=0.0;
gl_FragColor=color;
}}`;

export function installCubismBatcher(renderer,gl){
  const shaders=[];
  function compile(type,source){const shader=gl.createShader(type);shaders.push(shader);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;}
  const program=gl.createProgram();
  try{gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));}
  catch(error){gl.deleteProgram(program);throw error;}
  finally{for(const shader of shaders)gl.deleteShader(shader);}
  const vertexBuffer=gl.createBuffer(),indexBuffer=gl.createBuffer();
  const attributes=[['a_position',4],['a_uv',2],['a_base',4],['a_multiply',3],['a_screen',3],['a_clip',4]].map(([name,size])=>({location:gl.getAttribLocation(program,name),size}));
  const textureUniform=gl.getUniformLocation(program,'u_texture'),maskUniform=gl.getUniformLocation(program,'u_mask'),passUniform=gl.getUniformLocation(program,'u_maskPass');
  let vertices=new Float32Array(STRIDE*4096),indices=new Uint16Array(16384),vertexCount=0,indexCount=0,state=null,flushing=false;
  const originalDraw=renderer.drawMeshWebGL,originalModel=renderer.doDrawModel,originalPreDraw=renderer.preDraw;
  const hooks=new Map();
  function flush(){
    if(!indexCount||flushing)return;
    flushing=true;
    try{
      gl.useProgram(program);gl.frontFace(gl.CCW);
      gl.disable(gl.CULL_FACE);
      if(state.mask)gl.blendFuncSeparate(gl.ZERO,gl.ONE_MINUS_SRC_COLOR,gl.ZERO,gl.ONE_MINUS_SRC_ALPHA);
      else if(state.blend===1)gl.blendFuncSeparate(gl.ONE,gl.ONE,gl.ZERO,gl.ONE);
      else if(state.blend===2)gl.blendFuncSeparate(gl.DST_COLOR,gl.ONE_MINUS_SRC_ALPHA,gl.ZERO,gl.ONE);
      else gl.blendFuncSeparate(gl.ONE,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,state.texture);gl.uniform1i(textureUniform,0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,state.maskTexture);gl.uniform1i(maskUniform,1);
      gl.uniform1f(passUniform,state.mask?1:0);
      gl.bindBuffer(gl.ARRAY_BUFFER,vertexBuffer);gl.bufferData(gl.ARRAY_BUFFER,vertices.subarray(0,vertexCount*STRIDE),gl.DYNAMIC_DRAW);
      let offset=0;
      for(const a of attributes){gl.enableVertexAttribArray(a.location);gl.vertexAttribPointer(a.location,a.size,gl.FLOAT,false,STRIDE*4,offset*4);offset+=a.size;}
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices.subarray(0,indexCount),gl.DYNAMIC_DRAW);
      gl.drawElements(gl.TRIANGLES,indexCount,gl.UNSIGNED_SHORT,0);
      vertexCount=indexCount=0;state=null;
    }finally{flushing=false;}
  }
  // The SDK switches/clears mask targets between runs. Submit before those
  // boundaries, while the old framebuffer and viewport still apply.
  for(const name of ['bindFramebuffer','viewport','clear']){
    const original=gl[name],own=Object.getOwnPropertyDescriptor(gl,name);
    const wrapped=function(...args){flush();return original.apply(this,args);};
    gl[name]=wrapped;hooks.set(name,{own,wrapped});
  }
  renderer.preDraw=function(...args){flush();return originalPreDraw.apply(this,args);};
  renderer.doDrawModel=function(...args){try{return originalModel.apply(this,args);}finally{flush();}};
  renderer.drawMeshWebGL=function(model,index){
    const mask=this.getClippingContextBufferForMask(),clip=this.getClippingContextBufferForDraw();
    const context=mask||clip,manager=context?.getClippingManager()||this._clippingManager;
    const texture=this.getBindedTextures().getValue(model.getDrawableTextureIndex(index));
    const maskTexture=mask?texture:manager?.getColorBuffer()?.at(clip?clip._bufferIndex:0)||texture;
    const blend=mask?0:model.getDrawableBlendMode(index);
    const next={mask:Boolean(mask),texture,maskTexture,blend:blend===2?2:0};
    const positions=model.getDrawableVertices(index),uv=model.getDrawableVertexUvs(index),source=model.getDrawableVertexIndices(index),count=positions.length/2;
    if(state&&(Object.keys(next).some(key=>state[key]!==next[key])||vertexCount+count>65535))flush();
    state=next;
    if((vertexCount+count)*STRIDE>vertices.length){const grown=new Float32Array(2**Math.ceil(Math.log2((vertexCount+count)*STRIDE)));grown.set(vertices);vertices=grown;}
    if(indexCount+source.length>indices.length){const grown=new Uint16Array(2**Math.ceil(Math.log2(indexCount+source.length)));grown.set(indices);indices=grown;}
    const matrix=(mask?mask._matrixForMask:this.getMvpMatrix()).getArray();
    const clipMatrix=clip?clip._matrixForDraw.getArray():null;
    const rect=mask?mask._layoutBounds:null;
    const base=mask?null:this.getModelColorWithOpacity(model.getDrawableOpacity(index));
    const multiply=model.getMultiplyColor(index),screen=model.getScreenColor(index);
    const correction=model.getDrawableColorTransform?.(index)?.multiply;
    const channel=context?(context._layoutChannelIndex+1)*(clip&&model.getDrawableInvertedMaskBit(index)?-1:1):0;
    let out=vertexCount*STRIDE;
    for(let i=0;i<count;i++){
      const x=positions[i*2],y=positions[i*2+1];
      vertices[out++]=matrix[0]*x+matrix[4]*y+matrix[12];vertices[out++]=matrix[1]*x+matrix[5]*y+matrix[13];
      vertices[out++]=matrix[2]*x+matrix[6]*y+matrix[14];vertices[out++]=matrix[3]*x+matrix[7]*y+matrix[15];
      vertices[out++]=uv[i*2];vertices[out++]=uv[i*2+1];
      vertices[out++]=mask?rect.x*2-1:base.r;vertices[out++]=mask?rect.y*2-1:base.g;
      vertices[out++]=mask?(rect.x+rect.width)*2-1:base.b;vertices[out++]=mask?(rect.y+rect.height)*2-1:base.a;
      vertices[out++]=multiply.r*(correction?correction[i*3]:1);vertices[out++]=multiply.g*(correction?correction[i*3+1]:1);vertices[out++]=multiply.b*(correction?correction[i*3+2]:1);
      vertices[out++]=screen.r;vertices[out++]=screen.g;vertices[out++]=screen.b;
      const w=clipMatrix?clipMatrix[3]*x+clipMatrix[7]*y+clipMatrix[15]:1;
      vertices[out++]=clipMatrix?(clipMatrix[0]*x+clipMatrix[4]*y+clipMatrix[12])/w:0;
      vertices[out++]=clipMatrix?(clipMatrix[1]*x+clipMatrix[5]*y+clipMatrix[13])/w:0;vertices[out++]=channel;vertices[out++]=(this.isCulling()?1:0)+(blend===1?2:0);
    }
    for(let i=0;i<source.length;i++)indices[indexCount++]=source[i]+vertexCount;
    vertexCount+=count;
    this.setClippingContextBufferForDraw(null);this.setClippingContextBufferForMask(null);
  };
  return {withReferenceDraw(draw){
    flush();const batched=renderer.drawMeshWebGL;renderer.drawMeshWebGL=originalDraw;
    try{return draw();}finally{renderer.drawMeshWebGL=batched;}
  },destroy(){
    vertexCount=indexCount=0;state=null;
    renderer.drawMeshWebGL=originalDraw;renderer.doDrawModel=originalModel;renderer.preDraw=originalPreDraw;
    for(const [name,{own,wrapped}]of hooks)if(gl[name]===wrapped){if(own)Object.defineProperty(gl,name,own);else delete gl[name];}
    gl.deleteBuffer(vertexBuffer);gl.deleteBuffer(indexBuffer);gl.deleteProgram(program);
  }};
}

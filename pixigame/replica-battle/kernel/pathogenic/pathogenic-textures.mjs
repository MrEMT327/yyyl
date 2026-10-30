import { sampleGradient } from './pathogenic-particles.mjs';

const fract = x => x - Math.floor(x);
// Godot GradientTexture2D: linear/radial/square fill, with no/repeat/mirrored repeat.
export function gradientCoordinate(properties, u, v) {
  const from=properties.fill_from??[0,0],to=properties.fill_to??[1,0];
  const dx=to[0]-from[0],dy=to[1]-from[1],den=dx*dx+dy*dy;
  const x=u-from[0],y=v-from[1];
  let t;
  switch(properties.fill??0){
    case 0:t=den ? (x*dx+y*dy)/den : 0;break;
    case 1:t=den ? Math.hypot(x,y)/Math.sqrt(den) : 0;break;
    case 2:t=den ? Math.max(Math.abs(x),Math.abs(y))/Math.max(Math.abs(dx),Math.abs(dy)) : 0;break;
    case 3:t=den ? fract(Math.atan2(dx*y-dy*x,dx*x+dy*y)/(Math.PI*2)) : 0;break;
    default:throw Error(`Unsupported gradient fill ${properties.fill}`);
  }
  switch(properties.repeat??0){
    case 0:return Math.max(0,Math.min(1,t));
    case 1:return fract(t);
    case 2:return 1-Math.abs(1-((t%2)+2)%2);
    default:throw Error(`Unsupported gradient repeat ${properties.repeat}`);
  }
}
export function gradientPixels(graph, descriptor) {
  const resource=graph.resources[descriptor.key];
  if(!resource || !['GradientTexture1D','GradientTexture2D'].includes(resource.type))throw Error(`Not a source gradient: ${descriptor.key}`);
  const p=resource.properties,w=p.width??(resource.type==='GradientTexture1D'?256:64),h=resource.type==='GradientTexture1D'?1:(p.height??64);
  const data=new Float32Array(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const t=resource.type==='GradientTexture1D'?x/Math.max(1,w-1):gradientCoordinate(p,x/Math.max(1,w-1),y/Math.max(1,h-1));
    const color=sampleGradient(graph,p.gradient,t);
    for(let c=0;c<4;c++)data[(y*w+x)*4+c]=p.use_hdr?color[c]:Math.round(Math.max(0,Math.min(1,color[c]))*255)/255;
  }
  return {width:w,height:h,data,hdr:!!p.use_hdr};
}

/** Store source HDR gradient values as floats. An 8-bit canvas silently clips them. */
export function installGradientTexture(scene,graph,descriptor) {
  if(scene.textures.exists(descriptor.key))return descriptor.key;
  const renderer=scene.game.renderer,gl=renderer.gl;
  if(!gl)throw Error('Pathogenic source materials require WebGL');
  const isWebGL2=typeof WebGL2RenderingContext!=='undefined'&&gl instanceof WebGL2RenderingContext;
  if(!isWebGL2&&!gl.getExtension('OES_texture_float'))throw Error('Float textures unavailable: cannot preserve source HDR gradients');
  if(!gl.getExtension('OES_texture_float_linear'))throw Error('Float texture linear filtering unavailable');
  const pixels=gradientPixels(graph,descriptor);
  const wrapper=renderer.createTexture2D(0,gl.LINEAR,gl.LINEAR,gl.CLAMP_TO_EDGE,gl.CLAMP_TO_EDGE,gl.RGBA,null,pixels.width,pixels.height,false,true,false);
  // Phaser's wrapper owns context restoration/deletion. Replace its upload step,
  // so restoration re-uploads the same source Float32 data rather than RGBA8.
  wrapper._processTexture=function(){
    const gl=this.gl;
    if(gl.isContextLost())return;
    // WebGL1 extension enablement is reset with the context. Phaser recreates
    // wrapped textures before its final renderer extension setup, so reacquire
    // the exact float capabilities here before uploading the original HDR data.
    if(!isWebGL2&&!gl.getExtension('OES_texture_float'))throw Error('Float textures unavailable: cannot preserve source HDR gradients');
    if(!gl.getExtension('OES_texture_float_linear'))throw Error('Float texture linear filtering unavailable');
    const previous=gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.bindTexture(gl.TEXTURE_2D,this.webGLTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,isWebGL2?gl.RGBA32F:gl.RGBA,pixels.width,pixels.height,0,gl.RGBA,gl.FLOAT,pixels.data);
    gl.bindTexture(gl.TEXTURE_2D,previous);
  };
  wrapper._processTexture();
  scene.textures.addGLTexture(descriptor.key,wrapper);
  return descriptor.key;
}

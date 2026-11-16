import Phaser from 'phaser';

// Phaser 3.90's framebuffer destructor queries DEPTH_STENCIL_ATTACHMENT, which
// is not a valid attachment query in WebGL1. Our color-only targets own no depth.
export function colorOnlyFramebuffer(framebuffer:Phaser.Renderer.WebGL.Wrappers.WebGLFramebufferWrapper,gl:WebGLRenderingContext){
  framebuffer.destroy=()=>{if(framebuffer.webGLFramebuffer)gl.deleteFramebuffer(framebuffer.webGLFramebuffer);(framebuffer as any).webGLFramebuffer=null;(framebuffer as any).renderTexture=null;};
}

/** RGBA16F attachment with Phaser-owned wrappers (including context restoration). */
export function makeFloatTexture(renderer:Phaser.Renderer.WebGL.WebGLRenderer,width:number,height:number){
  const gl=renderer.gl,half=gl.getExtension('OES_texture_half_float');
  if(!half||!gl.getExtension('EXT_color_buffer_half_float')||!gl.getExtension('OES_texture_half_float_linear'))
    throw new Error('Pathogenic HDR requires renderable, linearly filtered RGBA16F; SDR is not an equivalent fallback');
  const texture=renderer.createTexture2D(0,gl.LINEAR,gl.LINEAR,gl.CLAMP_TO_EDGE,gl.CLAMP_TO_EDGE,gl.RGBA,undefined,width,height,false,true,false);
  const typed=texture as typeof texture & {pathogenicHalfFloat:boolean;_processTexture:()=>void};
  typed.pathogenicHalfFloat=true;
  typed._processTexture=()=>{
    // Extension enablement is lost with the context; wrappers restore textures
    // before the renderer emits contextrestored / recreates our raw program.
    const restoredHalf=gl.getExtension('OES_texture_half_float');
    gl.getExtension('EXT_color_buffer_half_float');gl.getExtension('OES_texture_half_float_linear');
    const active=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0);
    const previous=gl.getParameter(gl.TEXTURE_BINDING_2D);
    gl.bindTexture(gl.TEXTURE_2D,texture.webGLTexture);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,restoredHalf!.HALF_FLOAT_OES,null);
    gl.bindTexture(gl.TEXTURE_2D,previous);gl.activeTexture(active);
  };
  typed._processTexture();return typed;
}

export function makeFloatTarget(renderer:Phaser.Renderer.WebGL.WebGLRenderer,width:number,height:number){
  const gl=renderer.gl,previous=gl.getParameter(gl.FRAMEBUFFER_BINDING),cached=renderer.currentFramebuffer;
  const texture=makeFloatTexture(renderer,width,height),framebuffer=renderer.createFramebuffer(width,height,texture,false);
  gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer.webGLFramebuffer);
  colorOnlyFramebuffer(framebuffer,gl);
  const status=gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER,previous);renderer.currentFramebuffer=cached;
  if(status!==gl.FRAMEBUFFER_COMPLETE){renderer.deleteFramebuffer(framebuffer);renderer.deleteTexture(texture);throw new Error('Incomplete Pathogenic RGBA16F framebuffer: '+status);}
  return{width,height,texture,framebuffer,destroy(){renderer.deleteFramebuffer(framebuffer);renderer.deleteTexture(texture);}};
}

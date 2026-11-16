// Phaser owns and restores the texture from the same completed canvas.
// Only replace the contents on new aircraft frames, leaving size/sampler state
// alone. Keep the previous GL binding so Phaser's batching state stays valid.
export function createProjectAircraftTextureRefresh(source,canvas,measureTransfer) {
  const wrapper=source.glTexture,gl=wrapper?.gl;
  if(!gl)return ()=>{}; // Canvas renderer already uses the source directly.
  let useSubImage=typeof gl.texSubImage2D==='function'?null:false;
  function submit(){
    if(gl.isContextLost()||!wrapper.webGLTexture)return;
    if(useSubImage===false){source.update();return;}
    const previous=gl.getParameter(gl.TEXTURE_BINDING_2D);
    const pma=gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),flipY=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    try{
      gl.bindTexture(gl.TEXTURE_2D,wrapper.webGLTexture);
      if(!pma)gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);
      if(flipY)gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
      if(useSubImage===null)gl.getError();
      gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
      if(useSubImage===null)useSubImage=gl.getError()===gl.NO_ERROR;
      if(useSubImage && wrapper.minFilter!==gl.LINEAR && wrapper.minFilter!==gl.NEAREST)gl.generateMipmap(gl.TEXTURE_2D);
    }catch{
      // Older hosts can reject the canvas overload. Keep Phaser's original
      // upload as a one-way fallback instead of throwing every frame.
      useSubImage=false;
    }finally{
      if(!pma)gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,pma);
      if(flipY)gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flipY);
      gl.bindTexture(gl.TEXTURE_2D,previous);
    }
    if(!useSubImage)source.update();
  }
  return measureTransfer?()=>measureTransfer('aircraftUpload',canvas.width*canvas.height,submit):submit;
}

// Phaser owns and restores the texture from the same completed canvas.
// Only replace the contents on new frames, leaving size and sampler state
// alone. Keep the previous GL binding so Phaser's batching state stays valid.
export function createProjectCanvasTextureRefresh(source,canvas,measureTransfer,transferName) {
  const wrapper=source.glTexture,gl=wrapper?.gl;
  if(!gl)return ()=>{}; // Canvas renderer already uses the source directly.
  let useSubImage=typeof gl.texSubImage2D==='function';
  let checkedTexture;
  function submit(){
    const texture=wrapper.webGLTexture;
    if(gl.isContextLost()||!texture)return;
    if(!useSubImage){source.update();return;}
    if((wrapper.width!==undefined&&wrapper.width!==canvas.width)||(wrapper.height!==undefined&&wrapper.height!==canvas.height)){
      source.update();
      checkedTexture=undefined;
      return;
    }
    const previous=gl.getParameter(gl.TEXTURE_BINDING_2D);
    const pma=gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),flipY=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    const wantedPma=wrapper.pma??true,wantedFlip=wrapper.flipY??false;
    const format=wrapper.format??gl.RGBA;
    const validate=texture!==checkedTexture;
    try{
      gl.bindTexture(gl.TEXTURE_2D,texture);
      if(pma!==wantedPma)gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,wantedPma);
      if(flipY!==wantedFlip)gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,wantedFlip);
      if(validate)gl.getError();
      gl.texSubImage2D(gl.TEXTURE_2D,wrapper.mipLevel??0,0,0,format,gl.UNSIGNED_BYTE,canvas);
      if(validate){useSubImage=gl.getError()===gl.NO_ERROR;checkedTexture=texture;}
      if(useSubImage && wrapper.minFilter!==gl.LINEAR && wrapper.minFilter!==gl.NEAREST)gl.generateMipmap(gl.TEXTURE_2D);
    }catch{
      // Older hosts can reject the canvas overload. Keep Phaser's original
      // upload as a one-way fallback instead of throwing every frame.
      useSubImage=false;
    }finally{
      if(pma!==wantedPma)gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,pma);
      if(flipY!==wantedFlip)gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flipY);
      gl.bindTexture(gl.TEXTURE_2D,previous);
    }
    if(!useSubImage)source.update();
  }
  return measureTransfer?()=>measureTransfer(transferName,canvas.width*canvas.height,submit):submit;
}

export function createProjectAircraftTextureRefresh(source,canvas,measureTransfer) {
  return createProjectCanvasTextureRefresh(source,canvas,measureTransfer,'aircraftUpload');
}

// Draw the completed aircraft tile out of the shared terrain canvas. Some
// native hosts defer this as a reference to the source, so validate the same
// crop and texture upload after the source has changed before using it.
function drawAircraftCanvasTile(surface, target, size) {
  target.clearRect(0, 0, size, size);
  target.drawImage(surface, 0, surface.height - size, size, size, 0, 0, size, size);
}

function readAfterSourceChange(gl, x, y, read) {
  const scissor = gl.getParameter(gl.SCISSOR_BOX);
  const mask = gl.getParameter(gl.COLOR_WRITEMASK);
  const clear = gl.getParameter(gl.COLOR_CLEAR_VALUE);
  const scissorEnabled = gl.isEnabled(gl.SCISSOR_TEST);
  if (!scissor || !mask || !clear) return false;
  try {
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(x, y, 1, 1);
    gl.colorMask(true, true, true, true);
    gl.clearColor(1, 0, 1, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    read();
    return true;
  } finally {
    // The chosen marker pixel was transparent. Restore it and every state
    // touched by this probe so the renderer's cached GL state stays valid.
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.clearColor(...clear);
    gl.colorMask(...mask);
    gl.scissor(...scissor);
    if (!scissorEnabled) gl.disable(gl.SCISSOR_TEST);
  }
}

export function createProjectAircraftCanvasSnapshot(source, createCanvas, now = () => performance.now()) {
  const wrapper = source.glTexture;
  const gl = wrapper?.gl;
  if (!gl || typeof gl.texSubImage2D !== 'function') return null;
  let checkedTexture, checkedSurface, supported = false, slowCopies = 0;

  function verify(surface, from, size) {
    if (from.getContextAttributes()?.premultipliedAlpha === false ||
        from.getParameter(from.FRAMEBUFFER_BINDING) !== null) return false;
    const before = new Uint8Array(size * size * 4);
    from.readPixels(0, 0, size, size, from.RGBA, from.UNSIGNED_BYTE, before);
    let marker = -1, visible = false;
    for (let i = 0; i < before.length; i += 4) {
      visible ||= before[i + 3] > 0;
      if (marker < 0 && !(before[i] || before[i + 1] || before[i + 2] || before[i + 3])) marker = i / 4;
    }
    if (!visible || marker < 0) return false;

    const canvas = createCanvas('2d');
    canvas.width = canvas.height = size;
    const binding = gl.getParameter(gl.TEXTURE_BINDING_2D);
    const framebufferTarget = gl.READ_FRAMEBUFFER ?? gl.FRAMEBUFFER;
    const previousFramebuffer = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING ?? gl.FRAMEBUFFER_BINDING);
    let texture, framebuffer;
    try {
      const context = canvas.getContext('2d');
      if (!context) return false;
      drawAircraftCanvasTile(surface, context, size);
      texture = gl.createTexture();
      framebuffer = gl.createFramebuffer();
      if (!texture || !framebuffer) return false;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const probeSource = {
        glTexture: { gl, webGLTexture: texture, minFilter: gl.LINEAR },
        update() { throw new Error('The snapshot could not be uploaded'); },
      };
      createProjectAircraftTextureRefresh(probeSource, canvas)();
      gl.bindFramebuffer(framebufferTarget, framebuffer);
      gl.framebufferTexture2D(framebufferTarget, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      if (gl.checkFramebufferStatus(framebufferTarget) !== gl.FRAMEBUFFER_COMPLETE) return false;
      const after = new Uint8Array(before.length);
      const read = () => gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, after);
      if (!readAfterSourceChange(from, marker % size, Math.floor(marker / size), read) || gl.getError() !== gl.NO_ERROR) return false;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size * 4; x += 4) {
          const src = ((size - 1 - y) * size * 4) + x;
          const dst = y * size * 4 + x;
          const alpha = before[src + 3];
          if (alpha !== after[dst + 3]) return false;
          for (let channel = 0; channel < 3; channel++) {
            if (Math.abs(Math.min(alpha, before[src + channel]) - after[dst + channel]) > 1) return false;
          }
        }
      }
      return true;
    } finally {
      gl.bindFramebuffer(framebufferTarget, previousFramebuffer);
      gl.bindTexture(gl.TEXTURE_2D, binding);
      if (framebuffer) gl.deleteFramebuffer(framebuffer);
      if (texture) gl.deleteTexture(texture);
      canvas.width = canvas.height = 0;
    }
  }
  return {
    ready(surface, from, size) {
      const texture = wrapper.webGLTexture;
      if (!texture || gl.isContextLost() || from.isContextLost()) return false;
      if (texture !== checkedTexture || surface !== checkedSurface) {
        checkedTexture = texture;
        checkedSurface = surface;
        slowCopies = 0;
        try { supported = verify(surface, from, size); }
        catch { supported = false; }
      }
      return supported;
    },
    paint(surface, target, size, finish) {
      const started = now();
      try {
        drawAircraftCanvasTile(surface, target, size);
        finish();
      } catch {
        supported = false;
        return false;
      }
      // A valid canvas copy can still stall on a driver's readback. Let the
      // asynchronous path handle later frames if copies keep taking budget.
      const elapsed = now() - started;
      slowCopies = elapsed > 5 ? slowCopies + 1 : 0;
      if (elapsed > 1000 / 60 || slowCopies >= 3) supported = false;
      return true;
    },
    reset() {
      checkedTexture = checkedSurface = null;
      supported = false;
    },
  };
}

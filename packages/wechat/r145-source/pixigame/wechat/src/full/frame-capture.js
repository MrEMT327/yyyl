import { createAircraftReadback } from './aircraft-readback.js';

let straightChannels;
function alphaLookup() {
  if (!straightChannels) {
    straightChannels = new Uint8Array(256 * 256);
    for (let alpha = 1; alpha < 255; alpha++) {
      const factor = 255 / alpha;
      for (let channel = 0; channel < 256; channel++)
        straightChannels[(alpha << 8) + channel] = Math.min(255, Math.round(channel * factor));
    }
  }
  return straightChannels;
}

// Snapshot a completed WebGL tile before the same source canvas is reused for
// the world. Native canvas drawImage can otherwise keep that mutable source.
// Only the small aircraft tile crosses the CPU; the full world stays on GPU.
export function createNativeFrameCapture(api,measureTransfer) {
  let pixels, pixelWords, image, imageWords, imageContext, glContext;
  let wakeCanvas,wakeContext;
  let readback, pending;
  let width = 0, height = 0, disposed = false, premultiplied = true;
  function disableReadback() {
    const previous = readback;
    readback = pending = null;
    try { previous?.dispose(); } catch { /* A partial or lost native context may reject cleanup. */ }
  }
  function reset() {
    disableReadback();
    readback = glContext = undefined;
  }
  function prepare(gl,nextWidth,nextHeight) {
    if (!(Number.isInteger(nextWidth) && nextWidth > 0 && Number.isInteger(nextHeight) && nextHeight > 0)) throw new Error('Invalid aircraft snapshot size');
    if(glContext!==gl || width!==nextWidth || height!==nextHeight){
      reset();
      glContext=gl;
      premultiplied=gl.getContextAttributes()?.premultipliedAlpha!==false;
    }
    if(width!==nextWidth||height!==nextHeight){
      width=nextWidth;height=nextHeight;pixels=new Uint8Array(width*height*4);pixelWords=new Uint32Array(pixels.buffer);
    }
  }
  function paint(target, wake, paintWake) {
    if (imageContext!==target || image?.width !== width || image?.height !== height) {
      imageContext=target;
      image = target.createImageData(width, height);
      const data = image.data;
      imageWords = data.byteOffset % 4 === 0 ? new Uint32Array(data.buffer, data.byteOffset, width * height) : null;
    }
    // The screen tile starts at the bottom left in GL coordinates. Match
    // drawImage's top-left rows and ImageData's straight-alpha encoding.
    const out = image.data, table = premultiplied ? alphaLookup() : null;
    for (let y = 0, to = 0; y < height; y++) {
      let from = (height - y - 1) * width;
      const end = from + width;
      for (; from < end; from++, to++) {
        const input = from * 4, alpha = pixels[input + 3];
        // Most pixels are fully clear or opaque. Copy all four bytes in
        // one operation; no channel packing or byte-order assumption.
        if (imageWords && (alpha === 0 || alpha === 255 || !table)) {
          imageWords[to] = alpha === 0 ? 0 : pixelWords[from];
        } else if (table && alpha > 0 && alpha < 255) {
          const output = to * 4;
          const base = alpha << 8;
          out[output] = table[base + pixels[input]];
          out[output + 1] = table[base + pixels[input + 1]];
          out[output + 2] = table[base + pixels[input + 2]];
          out[output + 3] = alpha;
        } else {
          const output = to * 4;
          out[output] = alpha ? pixels[input] : 0;
          out[output + 1] = alpha ? pixels[input + 1] : 0;
          out[output + 2] = alpha ? pixels[input + 2] : 0;
          out[output + 3] = alpha;
        }
      }
    }
    target.putImageData(image, 0, 0);
    if(wake){
      const {x,y,width:w,height:h}=wake;
      if(!wakeCanvas){wakeCanvas=api.createCanvas();wakeCanvas.width=w;wakeCanvas.height=h;wakeContext=wakeCanvas.getContext('2d');}
      // Grow only when needed so turns and thrust pulses can reuse storage.
      if(wakeCanvas.width<w)wakeCanvas.width=w;
      if(wakeCanvas.height<h)wakeCanvas.height=h;
      wakeContext.clearRect(0,0,wakeCanvas.width,wakeCanvas.height);wakeContext.save();
      wakeContext.beginPath();wakeContext.rect(0,0,w,h);wakeContext.clip();wakeContext.translate(-x,-y);
      try{paintWake(wakeContext);}finally{wakeContext.restore();}
      target.save();target.globalCompositeOperation='destination-over';
      try{
        if(measureTransfer)measureTransfer('wakeBlit',w*h,()=>target.drawImage(wakeCanvas,0,0,w,h,x,y,w,h));
        else target.drawImage(wakeCanvas,0,0,w,h,x,y,w,h);
      }
      finally{target.restore();}
    }
  }
  return {
    write(gl, target, nextWidth, nextHeight, wake, paintWake, defer = false) {
      if (disposed || gl.isContextLost?.()) return false;
      prepare(gl,nextWidth,nextHeight);
      if (defer) {
        if (pending) return false;
        if (readback === undefined) readback = createAircraftReadback(gl,pixels.byteLength,measureTransfer);
        if (readback) {
          try {
            readback.queue(width,height);
            pending = {target,wake,paintWake};
            return false;
          } catch { disableReadback(); }
        }
      }
      if (pending) {
        try { readback.cancel(); } catch { disableReadback(); }
        pending = null;
      }
      const read = () => gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      if (measureTransfer) measureTransfer('aircraftRead',width*height,read);
      else read();
      paint(target,wake,paintWake);
      return true;
    },
    poll() {
      if (!pending) return false;
      if (glContext.isContextLost?.()) { reset(); return false; }
      try {
        if (!readback.poll(pixels)) return null;
      } catch { disableReadback(); return false; }
      const {target,wake,paintWake} = pending;
      pending = null;
      paint(target,wake,paintWake);
      return true;
    },
    reset,
    dispose() {
      if (disposed) return;
      disposed = true;
      reset();
      if(wakeCanvas)wakeCanvas.width=wakeCanvas.height=0;
      pixels = pixelWords = image = imageWords = imageContext = glContext = null;
      wakeCanvas=wakeContext=null;
    },
  };
}

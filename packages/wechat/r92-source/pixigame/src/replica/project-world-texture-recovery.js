// A texture restored before its source WebGL canvas cannot upload that canvas.
// Allocate the same texture from a safe canvas while that source is unavailable;
// the owner redraws and uploads the original full-resolution frame on recovery.
export function guardWorldTextureUpload(wrapper, sourceReady, fallbackCanvas) {
  const upload = wrapper._processTexture;
  function guardedUpload() {
    const pixels = this.pixels;
    if (!sourceReady()) this.pixels = fallbackCanvas;
    try { return upload.call(this); }
    finally { this.pixels = pixels; }
  }
  wrapper._processTexture = guardedUpload;
  return () => {
    if (wrapper._processTexture === guardedUpload) wrapper._processTexture = upload;
  };
}

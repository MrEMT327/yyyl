// A texture restored before its source WebGL canvas cannot upload that canvas.
// Phaser can allocate its texture storage from the saved dimensions alone.
export function guardWorldTextureUpload(wrapper, sourceReady) {
  const upload = wrapper._processTexture;
  function guardedUpload() {
    const pixels = this.pixels;
    if (!sourceReady()) this.pixels = null;
    try { return upload.call(this); }
    finally { this.pixels = pixels; }
  }
  wrapper._processTexture = guardedUpload;
  return () => {
    if (wrapper._processTexture === guardedUpload) wrapper._processTexture = upload;
  };
}

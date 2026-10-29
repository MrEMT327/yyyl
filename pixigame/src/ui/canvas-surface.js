// Canvas-only UI drawing. Hosts supply wx.createCanvas/createImage in a mini
// game, or equivalent factories in the development harness. No DOM is needed.
export function drawNineSlice(ctx, image, x, y, width, height, slices, scale = 1) {
  const [top, right, bottom, left] = Array.isArray(slices) ? slices : [slices, slices, slices, slices];
  const sourceW = image.width, sourceH = image.height;
  const factor = Math.max(0, Math.min(scale, width / (left + right), height / (top + bottom)));
  const sx = [0, left, sourceW - right, sourceW], sy = [0, top, sourceH - bottom, sourceH];
  const dx = [x, x + left * factor, x + width - right * factor, x + width];
  const dy = [y, y + top * factor, y + height - bottom * factor, y + height];
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    if (dx[col + 1] > dx[col] && dy[row + 1] > dy[row])
      ctx.drawImage(image, sx[col], sy[row], sx[col + 1] - sx[col], sy[row + 1] - sy[row],
        dx[col], dy[row], dx[col + 1] - dx[col], dy[row + 1] - dy[row]);
  }
}

export function createCanvasAssets({ createImage, invalidate = () => {}, resolve = path => path, limit = 96 }) {
  const images = new Map();
  let disposed = false, revision = 0;
  function get(path) {
    if (!path || disposed) return null;
    let item = images.get(path);
    if (item) { images.delete(path); images.set(path, item); return item.ready ? item.image : null; }
    item = { image: createImage(), ready: false, failed: false };
    images.set(path, item);
    item.image.onload = () => { if (disposed || images.get(path) !== item) return; item.ready = true; revision++; invalidate(); };
    item.image.onerror = error => { if (disposed) return; item.failed = true; console.warn('[canvas-ui] image failed', path, error); };
    item.image.src = resolve(path);
    // Keep the currently visible page warm; release old pages instead of
    // retaining every pilot and catalog image for the entire session.
    while (images.size > limit) {
      const [key, old] = images.entries().next().value;
      old.image.onload = old.image.onerror = null; images.delete(key);
    }
    return item.ready ? item.image : null;
  }
  return { get, get revision() { return revision; }, get size() { return images.size; },
    destroy() { disposed = true; for (const { image } of images.values()) image.onload = image.onerror = null; images.clear(); } };
}

export function createCanvasSurface(canvas, assets) {
  const ctx = canvas.getContext('2d'), controls = [];
  let clip = null;
  function rect(x, y, w, h, color = '#17303f') { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); }
  function image(path, x, y, w, h, fit = 'contain', crop = null) {
    const source = assets.get(path); if (!source) return;
    const [sx,sy,sw,sh]=crop?[crop[0]*source.width,crop[1]*source.height,crop[2]*source.width,crop[3]*source.height]:[0,0,source.width,source.height];
    const ratio = fit === 'cover' ? Math.max(w / sw, h / sh) : Math.min(w / sw, h / sh);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.drawImage(source,sx,sy,sw,sh,x + (w - sw * ratio) / 2,y + (h - sh * ratio) / 2,sw * ratio,sh * ratio); ctx.restore();
  }
  function text(value, x, y, size = 26, color = '#edf5fc', align = 'left', maxWidth = 700) {
    ctx.font = `600 ${size}px sans-serif`; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillText(String(value ?? ''), x, y, maxWidth);
  }
  function wrap(value, x, y, width, size = 23, color = '#b9d0de', maxLines = 6) {
    ctx.font = `500 ${size}px sans-serif`; let line = '', row = 0;
    for (const char of String(value ?? '')) {
      if (char === '\n' || ctx.measureText(line + char).width > width) {
        text(line, x, y + row * size * 1.5, size, color); row++; line = '';
        if (row === maxLines) return y + row * size * 1.5;
      }
      if (char !== '\n') line += char;
    }
    if (line) text(line, x, y + row++ * size * 1.5, size, color);
    return y + row * size * 1.5;
  }
  function nine(path, x, y, w, h, slices = 32, scale = .5) {
    const source = assets.get(path);
    if (source) drawNineSlice(ctx, source, x, y, w, h, slices, scale); else rect(x, y, w, h);
  }
  function hit(id, x, y, width, height, onPress, disabled = false) {
    const c = { id, x, y, width, height, onPress, disabled, clip: clip && { ...clip } }; controls.push(c); return c;
  }
  function button(id, label, x, y, w, h, onPress, disabled = false, primary = false) {
    ctx.save(); if (disabled) ctx.globalAlpha = .55;
    nine(primary ? 'art/psd-equipment-v1/button-gold.png' : 'art/psd-buttons-v1/button-gray.png', x, y, w, h);
    ctx.restore(); text(label, x + w / 2, y + h / 2, 25, disabled ? '#a9bbc7' : '#fff', 'center', w - 16);
    hit(id, x, y, w, h, onPress, disabled);
  }
  return { ctx, controls, rect, text, wrap, image, nine, hit, button,
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); controls.length = 0; clip = null; },
    clipped(box, draw) { const old = clip; clip = box; ctx.save(); ctx.beginPath(); ctx.rect(box.x, box.y, box.width, box.height); ctx.clip(); try { draw(); } finally { ctx.restore(); clip = old; } },
    find(x, y) { for(let i=controls.length-1;i>=0;i--){const c=controls[i];if(!c.disabled && x >= c.x && y >= c.y && x <= c.x + c.width && y <= c.y + c.height && (!c.clip || x >= c.clip.x && y >= c.clip.y && x <= c.clip.x + c.clip.width && y <= c.clip.y + c.clip.height))return c;} },
  };
}

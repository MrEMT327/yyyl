import type Phaser from 'phaser';

export const SUPPLY_CANOPY = 'project-supply-parachute-v1';
export const SUPPLY_SMOKE = 'project-supply-signal-smoke-v1';

/** Small, original reusable textures. No external game artwork or runtime
 * filters; the smoke field is baked once, not sampled again every frame. */
export function ensureSupplyDeliveryArt(scene: Phaser.Scene) {
  if (!scene.textures.exists(SUPPLY_CANOPY)) {
    const texture = scene.textures.createCanvas(SUPPLY_CANOPY, 384, 192);
    if (!texture) throw new Error('Unable to create supply parachute texture');
    const c = texture.context;
    const outline = () => {
      c.beginPath(); c.moveTo(18, 136);
      c.bezierCurveTo(40, -29, 344, -29, 366, 136);
      c.bezierCurveTo(337, 119, 315, 122, 288, 146);
      c.bezierCurveTo(256, 128, 226, 132, 192, 155);
      c.bezierCurveTo(158, 132, 128, 128, 96, 146);
      c.bezierCurveTo(69, 122, 47, 119, 18, 136); c.closePath();
    };
    const fabric = c.createLinearGradient(90, 6, 260, 166);
    fabric.addColorStop(0, '#abb88c'); fabric.addColorStop(.48, '#829365'); fabric.addColorStop(1, '#475a3d');
    outline(); c.fillStyle = fabric; c.fill(); c.save(); c.clip();
    const ivory = c.createLinearGradient(160, 10, 226, 158);
    ivory.addColorStop(0, '#f2edd7'); ivory.addColorStop(.55, '#d5d8ba'); ivory.addColorStop(1, '#8f9f7b');
    c.fillStyle = ivory;
    c.beginPath(); c.moveTo(192, 9); c.bezierCurveTo(125, 18, 110, 63, 96, 146);
    c.lineTo(142, 153); c.bezierCurveTo(149, 65, 163, 20, 192, 9); c.fill();
    c.beginPath(); c.moveTo(192, 9); c.bezierCurveTo(221, 20, 235, 65, 242, 153);
    c.lineTo(288, 146); c.bezierCurveTo(274, 63, 259, 18, 192, 9); c.fill();
    // Shaded lower lip and broad highlights make the inflated fabric legible
    // at its actual ~120 pixel display width, without fine surface detail.
    c.strokeStyle = 'rgba(35,51,40,.35)'; c.lineWidth = 12;
    c.beginPath(); c.moveTo(14, 139); c.quadraticCurveTo(60, 115, 96, 147);
    c.quadraticCurveTo(142, 128, 192, 156); c.quadraticCurveTo(242, 128, 288, 147);
    c.quadraticCurveTo(324, 115, 370, 139); c.stroke();
    c.strokeStyle = 'rgba(247,246,216,.42)'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(37, 95); c.bezierCurveTo(71, 20, 192, 6, 275, 36); c.stroke();
    c.strokeStyle = 'rgba(40,57,43,.48)'; c.lineWidth = 2;
    for (const end of [96, 142, 192, 242, 288]) {
      c.beginPath(); c.moveTo(192, 11); c.quadraticCurveTo(192 + (end - 192) * .7, 38, end, end === 192 ? 155 : 147); c.stroke();
    }
    c.restore(); outline(); c.strokeStyle = '#263d36'; c.lineWidth = 4; c.stroke();
    texture.refresh();
  }
  if (!scene.textures.exists(SUPPLY_SMOKE)) {
    const size = 128, texture = scene.textures.createCanvas(SUPPLY_SMOKE, size, size);
    if (!texture) throw new Error('Unable to create supply smoke texture');
    const c = texture.context, pixels = c.createImageData(size, size);
    const hash = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
    const noise = (x: number, y: number) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      return (hash(ix, iy) * (1 - u) + hash(ix + 1, iy) * u) * (1 - v)
        + (hash(ix, iy + 1) * (1 - u) + hash(ix + 1, iy + 1) * u) * v;
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = (x + .5) / size * 2 - 1, py = (y + .5) / size * 2 - 1;
      const n = noise(px * 3 + 7, py * 3 + 11) * .65 + noise(px * 7 + 4, py * 7 + 8) * .35;
      const rim = Math.max(0, Math.min(1, (1 - Math.hypot(px, py) + (n - .5) * .34) / .52));
      const shade = Math.round(190 + n * 50 - (px + py) * 12), index = (y * size + x) * 4;
      pixels.data[index] = shade; pixels.data[index + 1] = shade; pixels.data[index + 2] = shade;
      pixels.data[index + 3] = Math.round(rim * rim * (3 - 2 * rim) * (0.62 + n * .38) * 255);
    }
    c.putImageData(pixels, 0, 0); texture.refresh();
  }
}

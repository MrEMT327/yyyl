import type Phaser from 'phaser';

export const PROJECT_COIN_ATLAS = 'project-pickup-gold-thick-v1';
export const PROJECT_COIN_FRAME_COUNT = 32;
const FRAME_SIZE = 128, COLUMNS = 8;
const RADIUS = 57, THICKNESS = 24, SEGMENTS = 32;
// Opaque bounds of the approved orthographic face. Normalising this rectangle
// preserves the artwork while giving the disc an exactly circular front.
const FACE = { x: 64, y: 55, width: 1118, height: 1138 };

function wallPath(ctx: CanvasRenderingContext2D, cosine: number, side: number, width: number, from: number, to: number) {
  ctx.beginPath();
  for (let i = 0; i <= SEGMENTS; i++) {
    const y = -RADIUS + 2 * RADIUS * i / SEGMENTS;
    const centre = -side * cosine * Math.sqrt(Math.max(0, RADIUS * RADIUS - y * y));
    const x = centre + (from - .5) * width;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  for (let i = SEGMENTS; i >= 0; i--) {
    const y = -RADIUS + 2 * RADIUS * i / SEGMENTS;
    const centre = -side * cosine * Math.sqrt(Math.max(0, RADIUS * RADIUS - y * y));
    ctx.lineTo(centre + (to - .5) * width, y);
  }
  ctx.closePath();
}

/** Orthographic projection of a short cylinder rotating around its vertical
 * axis. The metal wall has its own geometry, bevels, shading and reeding. */
export function drawProjectCoinFrame(ctx: CanvasRenderingContext2D, face: CanvasImageSource, angle: number) {
  const signedCosine = Math.cos(angle), sine = Math.sin(angle), cosine = Math.abs(signedCosine);
  const side = sine * signedCosine >= 0 ? 1 : -1;
  const width = THICKNESS * Math.abs(sine), shift = side * width / 2;
  ctx.save();ctx.translate(FRAME_SIZE / 2, FRAME_SIZE / 2);
  ctx.imageSmoothingEnabled = true;ctx.imageSmoothingQuality = 'high';
  // Rear cap seals the silhouette behind the separately shaded near wall.
  if (cosine > .002) {
    ctx.beginPath();ctx.ellipse(-shift, 0, RADIUS * cosine, RADIUS, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#713006';ctx.fill();ctx.strokeStyle = '#512304';ctx.lineWidth = 1.5;ctx.stroke();
  }
  if (width > .05) {
    const bands = [
      { from: 0, to: .16, colors: ['#8b3e08','#bc7715','#622a05'] },
      { from: .16, to: .84, colors: ['#ffe293','#dba124','#9d570b'] },
      { from: .84, to: 1, colors: ['#fff2b3','#f4c74c','#b87a14'] },
    ];
    for (const band of bands) {
      const gradient = ctx.createLinearGradient(0, -RADIUS, 0, RADIUS);
      gradient.addColorStop(0, band.colors[0]);gradient.addColorStop(.38, band.colors[1]);gradient.addColorStop(1, band.colors[2]);
      wallPath(ctx, cosine, side, width, band.from, band.to);ctx.fillStyle = gradient;ctx.fill();
    }
    // Reeding runs across the physical thickness. These are engraved wall
    // details, independent of the face bitmap and stable at the edge-on view.
    if (width > 1) for (let i = 1; i <= 12; i++) {
      const y = -RADIUS + 2 * RADIUS * i / 13;
      const centre = -side * cosine * Math.sqrt(Math.max(0, RADIUS * RADIUS - y * y));
      const x1 = centre - width * .31, x2 = centre + width * .31;
      ctx.strokeStyle = 'rgba(103,49,5,.52)';ctx.lineWidth = 1.25;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();
      ctx.strokeStyle = 'rgba(255,232,151,.48)';ctx.lineWidth = .75;ctx.beginPath();ctx.moveTo(x1,y-.9);ctx.lineTo(x2,y-.9);ctx.stroke();
    }
  }
  if (cosine > .015) {
    ctx.save();ctx.translate(shift,0);ctx.scale(signedCosine,1);
    ctx.beginPath();ctx.arc(0,0,RADIUS,0,Math.PI*2);ctx.clip();
    ctx.drawImage(face,FACE.x,FACE.y,FACE.width,FACE.height,-RADIUS,-RADIUS,RADIUS*2,RADIUS*2);
    // The face dims as it turns away; the wall keeps its own metallic lighting.
    ctx.fillStyle = `rgba(45,20,0,${.16*(1-cosine)})`;ctx.fillRect(-RADIUS,-RADIUS,RADIUS*2,RADIUS*2);
    ctx.restore();
  }
  ctx.restore();
}

/** Build the small reusable atlas once per game, before the battle starts.
 * Every live coin then draws one ordinary sprite, with no per-coin geometry. */
export function ensureProjectCoinFrames(scene: Phaser.Scene, faceKey: string): string {
  if (scene.textures.exists(PROJECT_COIN_ATLAS)) return PROJECT_COIN_ATLAS;
  const face = scene.textures.get(faceKey).getSourceImage() as CanvasImageSource;
  const atlas = scene.textures.createCanvas(PROJECT_COIN_ATLAS,FRAME_SIZE*COLUMNS,FRAME_SIZE*(PROJECT_COIN_FRAME_COUNT/COLUMNS));
  if (!atlas) throw new Error('Unable to create project coin animation atlas');
  const ctx = atlas.context;ctx.clearRect(0,0,atlas.width,atlas.height);
  for (let frame = 0; frame < PROJECT_COIN_FRAME_COUNT; frame++) {
    const x = frame % COLUMNS * FRAME_SIZE, y = Math.floor(frame/COLUMNS) * FRAME_SIZE;
    ctx.save();ctx.translate(x,y);drawProjectCoinFrame(ctx,face,frame/PROJECT_COIN_FRAME_COUNT*Math.PI*2);ctx.restore();
    atlas.add(frame,0,x,y,FRAME_SIZE,FRAME_SIZE);
  }
  atlas.refresh();return PROJECT_COIN_ATLAS;
}

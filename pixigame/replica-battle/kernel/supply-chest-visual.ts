import type Phaser from 'phaser';

const TEXTURE = 'licensed-military-supply-chest-front-v2';
const BEAM = 'project-supply-arrival-beam-v1';
const GLOW = 'project-supply-arrival-glow-v1';
const RING = 'project-supply-arrival-ring-v1';
const SIZE = 76;
type ChestPose = { animation: string; animationAge: number; progress: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Original birth timing, with project-authored light geometry. Nothing here
 * advances the simulation or waits for the visual before allowing pickup. */
export function supplyChestPose(chest: ChestPose, duration: number) {
  const age = Number.isFinite(chest.animationAge) ? Math.max(0, chest.animationAge) : 0;
  const length = Number.isFinite(duration) && duration > 0 ? duration : 1.5;
  const progress = clamp(age / length), born = chest.animation === 'Born';
  const time = age * 1.5 / length;
  let scale = 1, alpha = 1, y = -4, rotation = 0, idle = 1;
  if (born) {
    const fall = smooth(.18, .53, time);
    scale = .65 + .35 * fall + Math.exp(-Math.pow((time - .60) / .09, 2)) * .035;
    alpha = smooth(.18, .34, time);
    y -= (1 - fall) * 170;
    if (time > .53) y += Math.sin((time - .53) * 17) * Math.exp(-(time - .53) * 5) * 3;
    idle = smooth(.533333, .78, time);
  } else if (chest.animation === 'Death') {
    scale = 1 - progress * .3; alpha = 1 - progress; y -= progress * 12;
    idle = 1 - progress;
  } else {
    y += Math.sin(age * 3) * 2;
    if (chest.progress > 0 || chest.animation === 'Enter') rotation = Math.sin(age * 36) * .035;
  }
  const active = born && time >= 1 / 60 && time < 1.5;
  const beam = active ? smooth(1 / 60, .09, time) * (1 - smooth(.55, 1.25, time)) : 0;
  const flash = active ? Math.exp(-Math.pow((time - .43) / .075, 2)) : 0;
  return { age, time, active, beam, flash, fall: smooth(1 / 60, .40, time),
    ringA: active ? clamp((time - .15) / .50) : 1,
    ringB: active ? clamp((time - .43) / .55) : 1,
    idle, scale, alpha, y, rotation };
}

export function preloadSupplyChestArt(scene: Phaser.Scene) {
  scene.load.image(TEXTURE, './assets/licensed-supply-chest/military-green-front-v2.png');
}

/** Reusable textures are generated once per game. No extracted competitor
 * bitmap, runtime blur filter, emitter timer or per-frame canvas upload. */
function ensureSupplyLights(scene: Phaser.Scene) {
  for (const key of [BEAM, GLOW, RING]) {
    if (scene.textures.exists(key)) continue;
    const width = key === BEAM ? 64 : 256, height = key === BEAM ? 512 : 256;
    const texture = scene.textures.createCanvas(key, width, height);
    if (!texture) throw new Error('Unable to create supply arrival light texture');
    const ctx = texture.context; ctx.clearRect(0, 0, width, height);
    if (key === BEAM) {
      const across = ctx.createLinearGradient(0, 0, width, 0);
      for (const [stop, color] of [[0,'rgba(255,150,40,0)'],[.20,'rgba(255,170,54,.04)'],[.34,'rgba(255,206,108,.30)'],[.42,'rgba(255,239,192,.72)'],[.46,'rgba(255,255,239,1)'],[.54,'rgba(255,255,239,1)'],[.58,'rgba(255,239,192,.72)'],[.66,'rgba(255,206,108,.30)'],[.80,'rgba(255,170,54,.04)'],[1,'rgba(255,150,40,0)']] as const) across.addColorStop(stop, color);
      ctx.fillStyle = across; ctx.fillRect(0, 0, width, height);
      const along = ctx.createLinearGradient(0, 0, 0, height);
      along.addColorStop(0, 'rgba(255,255,255,0)'); along.addColorStop(.16, 'rgba(255,255,255,.4)');
      along.addColorStop(.56, 'white'); along.addColorStop(1, 'rgba(255,255,255,.92)');
      ctx.globalCompositeOperation = 'destination-in'; ctx.fillStyle = along; ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    } else {
      const radial = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
      const stops = key === RING
        ? [[0,'rgba(255,244,203,0)'],[.68,'rgba(255,244,203,0)'],[.76,'rgba(255,217,133,.14)'],[.80,'rgba(255,248,220,.9)'],[.83,'rgba(255,225,148,.26)'],[.94,'rgba(255,192,82,0)'],[1,'rgba(255,192,82,0)']]
        : [[0,'rgba(255,254,233,1)'],[.12,'rgba(255,241,190,.86)'],[.30,'rgba(255,210,117,.38)'],[.65,'rgba(255,170,70,.08)'],[1,'rgba(255,150,45,0)']];
      for (const [stop, color] of stops) radial.addColorStop(Number(stop), String(color));
      ctx.fillStyle = radial; ctx.fillRect(0, 0, width, height);
    }
    texture.refresh();
  }
}

type SupplyLights = {
  height: number; halo: Phaser.GameObjects.Image; beam: Phaser.GameObjects.Image;
  impact: Phaser.GameObjects.Image; idle: Phaser.GameObjects.Image;
  rings: Phaser.GameObjects.Image[]; streaks: Phaser.GameObjects.Image[];
  dust: Phaser.GameObjects.Image[]; sparks: Phaser.GameObjects.Graphics;
};

export function createSupplyChestVisual(scene: Phaser.Scene): Phaser.GameObjects.Container {
  ensureSupplyLights(scene);
  const light = (key: string) => scene.add.image(0, 0, key).setBlendMode('ADD').setAlpha(0);
  const idle = light(GLOW).setPosition(0, 19).setDisplaySize(138, 47);
  const impact = light(GLOW).setPosition(0, 18);
  const rings = [light(RING), light(RING)];
  const halo = light(BEAM).setOrigin(.5, 1), beam = light(BEAM).setOrigin(.5, 1);
  const streaks = Array.from({ length: 7 }, () => light(BEAM).setOrigin(.5, 1));
  const dust = Array.from({ length: 5 }, () => scene.add.image(0, 0, GLOW).setTint(0x9296a0).setAlpha(0));
  const image = scene.add.image(0, -4, TEXTURE);
  const height = image.width > 0 && image.height > 0 ? SIZE * image.height / image.width : SIZE;
  image.setDisplaySize(SIZE, height);
  const sparks = scene.add.graphics().setBlendMode('ADD');
  const lights: SupplyLights = { height: Math.max(640, Math.min(1200, Number(scene.scale.height) || 960)), halo, beam, impact, idle, rings, streaks, dust, sparks };
  return scene.add.container(0, 0, [idle, ...rings, impact, halo, beam, ...streaks, ...dust, image, sparks])
    .setData('supplyChestBody', image).setData('supplyChestHeight', height).setData('supplyChestLights', lights);
}

/** The parent owns positioning/destruction; the simulation owns all timing. */
export function updateSupplyChestVisual(view: Phaser.GameObjects.Container, chest: ChestPose, duration: number) {
  const pose = supplyChestPose(chest, duration), image = view.getData('supplyChestBody') as Phaser.GameObjects.Image;
  view.setRotation(0).setScale(1).setAlpha(1);
  image.setPosition(0, pose.y).setDisplaySize(SIZE * pose.scale, (view.getData('supplyChestHeight') || SIZE) * pose.scale)
    .setRotation(pose.rotation).setAlpha(pose.alpha);
  const fx = view.getData('supplyChestLights') as SupplyLights | undefined;
  if (!fx) return;
  const tip = 18 - (1 - pose.fall) * fx.height;
  fx.halo.setPosition(0, tip).setDisplaySize(170 + pose.flash * 40, fx.height).setAlpha(pose.beam * .30);
  fx.beam.setPosition(0, tip).setDisplaySize(54 + pose.flash * 18, fx.height).setAlpha(pose.beam * .84);
  fx.impact.setDisplaySize(110 + pose.flash * 130, 42 + pose.flash * 42).setAlpha(pose.flash * .85);
  fx.idle.setAlpha(pose.idle * (.15 + Math.sin(pose.age * 2.4) * .025));
  for (const [i, ring] of fx.rings.entries()) {
    const p = i === 0 ? pose.ringA : pose.ringB, size = 34 + p * (i === 0 ? 160 : 215);
    const ready = pose.active && pose.time > (i === 0 ? .15 : .43) && p < 1;
    ring.setPosition(0, 19).setDisplaySize(size, size * .30).setAlpha(ready ? Math.sin(p * Math.PI) * (i === 0 ? .72 : .52) : 0);
  }
  for (const [i, streak] of fx.streaks.entries()) {
    const p = (pose.time - .018 - i * .032) / (.21 + (i % 3) * .025), visible = pose.active && p > 0 && p < 1;
    streak.setPosition(Math.sin(i * 7.31) * 27, 18 - (1 - clamp(p)) * fx.height)
      .setDisplaySize(2 + i % 3, 80 + i % 4 * 28).setAlpha(visible ? Math.sin(p * Math.PI) * .75 : 0);
  }
  fx.sparks.clear();
  for (let i = 0; i < 18; i++) {
    const p = (pose.time - .40 - (i % 4) * .018) / (.55 + (i % 5) * .055);
    if (!pose.active || p <= 0 || p >= 1) continue;
    const angle = i * 2.399963, radius = 12 + p * (28 + (i % 4) * 12);
    const x = Math.cos(angle) * radius, y = 17 + Math.sin(angle) * radius * .32 - Math.sin(p * Math.PI) * (16 + i % 3 * 14);
    const size = 1 + (1 - p) * 2, alpha = Math.sin(p * Math.PI) * (1 - p) * .9;
    fx.sparks.lineStyle(1, 0xffecc2, alpha).lineBetween(x - size, y, x + size, y).lineBetween(x, y - size, x, y + size);
  }
  for (const [i, dust] of fx.dust.entries()) {
    const p = (pose.time - .42 - i * .025) / .8, visible = pose.active && p > 0 && p < 1, t = clamp(p);
    const side = i % 2 ? -1 : 1;
    dust.setPosition(side * (8 + t * (22 + i * 5)), 20 - t * (15 + i * 2))
      .setDisplaySize(18 + t * 48, 10 + t * 24).setAlpha(visible ? Math.sin(p * Math.PI) * .13 : 0);
  }
}

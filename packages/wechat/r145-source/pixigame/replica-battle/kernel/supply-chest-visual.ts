import type Phaser from 'phaser';
import { ensureSupplyDeliveryArt, SUPPLY_CANOPY, SUPPLY_SMOKE } from './supply-delivery-art.ts';

const TEXTURE = 'project-airdrop-supply-crate-v1';
const BEAM = 'project-supply-arrival-beam-v1';
const GLOW = 'project-supply-arrival-glow-v1';
const RING = 'project-supply-arrival-ring-v1';
const SIZE = 76;
type ChestPose = { animation: string; animationAge: number; progress: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Presentation fits inside the existing birth clip. Nothing here advances
 * the simulation or waits for the parachute before allowing pickup. */
export function supplyChestPose(chest: ChestPose, duration: number) {
  const age = Number.isFinite(chest.animationAge) ? Math.max(0, chest.animationAge) : 0;
  const length = Number.isFinite(duration) && duration > 0 ? duration : 1.5;
  const progress = clamp(age / length), born = chest.animation === 'Born';
  const time = age * 1.5 / length;
  let scale = 1, alpha = 1, y = -4, rotation = 0, idle = 1, x = 0;
  if (born) {
    const fall = smooth(.03, .98, time), suspended = 1 - smooth(.84, 1.04, time);
    scale = .88 + .12 * fall + Math.exp(-Math.pow((time - 1.05) / .07, 2)) * .025;
    alpha = smooth(.015, .13, time);
    y -= (1 - fall) * 170;
    x = Math.sin(time * 6.5) * 5 * suspended;
    rotation = Math.sin(time * 6.5) * .025 * suspended;
    if (time > .98) y += Math.sin((time - .98) * 18) * Math.exp(-(time - .98) * 8) * 3;
    idle = smooth(.98, 1.18, time);
  } else if (chest.animation === 'Death') {
    scale = 1 - progress * .3; alpha = 1 - progress; y -= progress * 12;
    idle = 1 - progress;
  } else {
    y += Math.sin(age * 3) * 2;
    if (chest.progress > 0 || chest.animation === 'Enter') rotation = Math.sin(age * 36) * .035;
  }
  const active = born && time >= 1 / 60 && time < 1.5;
  const beam = active ? smooth(1 / 60, .09, time) * (1 - smooth(.90, 1.12, time)) : 0;
  const flash = active ? Math.exp(-Math.pow((time - 1.02) / .045, 2)) : 0;
  const collapse = born ? smooth(.98, 1.44, time) : 1;
  const canopyAlpha = born ? smooth(.015, .13, time) * (1 - smooth(1.02, 1.44, time)) : 0;
  return { age, time, active, beam, flash, fall: smooth(.03, .98, time),
    ringA: active ? clamp((time - .98) / .34) : 1,
    ringB: active ? clamp((time - 1.05) / .42) : 1,
    canopyAlpha, collapse, smokeTime: born ? time : 1.5 + age,
    smokeStrength: chest.animation === 'Death' ? 0 : 1,
    idle, scale, alpha, x, y, rotation };
}

export function preloadSupplyChestArt(scene: Phaser.Scene) {
  scene.load.image(TEXTURE, './assets/project-airdrop-supply/airdrop-crate-front-v1.png');
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
  canopy: Phaser.GameObjects.Image; cords: Phaser.GameObjects.Graphics;
  smoke: Phaser.GameObjects.Image[];
};

export function createSupplyChestVisual(scene: Phaser.Scene): Phaser.GameObjects.Container {
  ensureSupplyLights(scene);
  ensureSupplyDeliveryArt(scene);
  const light = (key: string) => scene.add.image(0, 0, key).setBlendMode('ADD').setAlpha(0);
  const idle = light(GLOW).setPosition(0, 19).setDisplaySize(138, 47);
  const impact = light(GLOW).setPosition(0, 18);
  const rings = [light(RING), light(RING)];
  const halo = light(BEAM).setOrigin(.5, 1), beam = light(BEAM).setOrigin(.5, 1);
  const streaks = Array.from({ length: 7 }, () => light(BEAM).setOrigin(.5, 1));
  const dust = Array.from({ length: 5 }, () => scene.add.image(0, 0, SUPPLY_SMOKE).setTint(0xc2b8a5).setAlpha(0));
  const smoke = Array.from({ length: 16 }, (_, i) => scene.add.image(0, 0, SUPPLY_SMOKE)
    .setTint(i % 3 === 0 ? 0xe06b6a : i % 3 === 1 ? 0xcc394b : 0xaf263b).setAlpha(0));
  const cords = scene.add.graphics(), canopy = scene.add.image(0, 0, SUPPLY_CANOPY).setAlpha(0);
  const image = scene.add.image(0, -4, TEXTURE);
  const height = image.width > 0 && image.height > 0 ? SIZE * image.height / image.width : SIZE;
  image.setDisplaySize(SIZE, height);
  const sparks = scene.add.graphics().setBlendMode('ADD');
  const lights: SupplyLights = { height: Math.max(640, Math.min(1200, Number(scene.scale.height) || 960)), halo, beam, impact, idle, rings, streaks, dust, sparks, canopy, cords, smoke };
  return scene.add.container(0, 0, [idle, ...rings, impact, halo, beam, ...streaks, ...dust, ...smoke, cords, canopy, image, sparks])
    .setData('supplyChestBody', image).setData('supplyChestHeight', height).setData('supplyChestLights', lights);
}

/** The parent owns positioning/destruction; the simulation owns all timing. */
export function updateSupplyChestVisual(view: Phaser.GameObjects.Container, chest: ChestPose, duration: number) {
  const pose = supplyChestPose(chest, duration), image = view.getData('supplyChestBody') as Phaser.GameObjects.Image;
  view.setRotation(0).setScale(1).setAlpha(1);
  const bodyHeight = view.getData('supplyChestHeight') || SIZE;
  image.setPosition(pose.x, pose.y).setDisplaySize(SIZE * pose.scale, bodyHeight * pose.scale)
    .setRotation(pose.rotation).setAlpha(pose.alpha);
  const fx = view.getData('supplyChestLights') as SupplyLights | undefined;
  if (!fx) return;
  const tip = 18 - (1 - pose.fall) * fx.height;
  fx.halo.setPosition(0, tip).setDisplaySize(70, fx.height).setAlpha(pose.beam * .04);
  fx.beam.setPosition(0, tip).setDisplaySize(12, fx.height).setAlpha(pose.beam * .08);
  fx.impact.setDisplaySize(110 + pose.flash * 70, 42 + pose.flash * 24).setAlpha(pose.flash * .35);
  fx.idle.setAlpha(pose.idle * (.15 + Math.sin(pose.age * 2.4) * .025));
  for (const [i, ring] of fx.rings.entries()) {
    const p = i === 0 ? pose.ringA : pose.ringB, size = 34 + p * (i === 0 ? 160 : 215);
    const ready = pose.active && pose.time > (i === 0 ? .98 : 1.05) && p < 1;
    ring.setPosition(0, 19).setDisplaySize(size, size * .30).setAlpha(ready ? Math.sin(p * Math.PI) * (i === 0 ? .32 : .22) : 0);
  }
  for (const [i, streak] of fx.streaks.entries()) {
    const p = (pose.time - .018 - i * .032) / (.21 + (i % 3) * .025), visible = pose.active && p > 0 && p < 1;
    streak.setPosition(Math.sin(i * 7.31) * 27, 18 - (1 - clamp(p)) * fx.height)
      .setDisplaySize(2 + i % 3, 80 + i % 4 * 28).setAlpha(visible ? Math.sin(p * Math.PI) * .22 : 0);
  }
  fx.sparks.clear();
  for (let i = 0; i < 18; i++) {
    const p = (pose.time - 1.01 - (i % 4) * .018) / (.28 + (i % 5) * .025);
    if (!pose.active || p <= 0 || p >= 1) continue;
    const angle = i * 2.399963, radius = 12 + p * (28 + (i % 4) * 12);
    const x = Math.cos(angle) * radius, y = 17 + Math.sin(angle) * radius * .32 - Math.sin(p * Math.PI) * (16 + i % 3 * 14);
    const size = 1 + (1 - p) * 2, alpha = Math.sin(p * Math.PI) * (1 - p) * .9;
    fx.sparks.lineStyle(1, 0xffecc2, alpha).lineBetween(x - size, y, x + size, y).lineBetween(x, y - size, x, y + size);
  }
  for (const [i, dust] of fx.dust.entries()) {
    const p = (pose.time - 1.01 - i * .025) / .42, visible = pose.active && p > 0 && p < 1, t = clamp(p);
    const side = i % 2 ? -1 : 1;
    dust.setPosition(side * (8 + t * (22 + i * 5)), 20 - t * (15 + i * 2))
      .setDisplaySize(18 + t * 48, 10 + t * 24).setAlpha(visible ? Math.sin(p * Math.PI) * .28 : 0);
  }
  // Both canopy and rope ends use the rendered crate pose, so the cords stay
  // attached while swaying. Landing releases, folds and fades the canopy.
  const canopyX = pose.x + Math.sin(pose.time * 5.3) * 4 + pose.collapse * 22;
  const canopyY = pose.y - bodyHeight * .38 - 82 + pose.collapse * 35;
  fx.canopy.setPosition(canopyX, canopyY).setDisplaySize(138, 69 * (1 - pose.collapse * .70))
    .setRotation(pose.rotation * .7 + pose.collapse * .28).setAlpha(pose.canopyAlpha);
  fx.cords.clear();
  if (pose.canopyAlpha > 0) {
    for (let pass = 0; pass < 2; pass++) {
      fx.cords.lineStyle(pass === 0 ? 2.6 : 1.1, pass === 0 ? 0x243b3b : 0xe6dec5,
        pose.canopyAlpha * (1 - pose.collapse) * (pass === 0 ? .65 : .9));
      for (let i = 0; i < 4; i++) {
        const offset = i === 0 ? -59 : i === 1 ? -31 : i === 2 ? 31 : 59;
        fx.cords.lineBetween(canopyX + offset, canopyY + (i === 0 || i === 3 ? 15 : 19),
          pose.x + (i < 2 ? -24 : 24) * pose.scale, pose.y - bodyHeight * .26 * pose.scale);
      }
    }
  }
  // Fixed-size pool, analytic simulation-age sampling. Pausing cannot emit
  // extra smoke; an early pickup hides all puffs in this same frame.
  const smokeAge = Math.max(0, pose.smokeTime - 1.01), cycle = 2.6;
  for (let i = 0; i < fx.smoke.length; i++) {
    const elapsed = smokeAge - i * cycle / fx.smoke.length;
    const p = ((elapsed % cycle) + cycle) % cycle / cycle;
    const visible = elapsed >= 0 && pose.smokeStrength > 0;
    const size = 17 + p * 62;
    fx.smoke[i].setPosition(-28 - p * 28 + Math.sin(p * 7 + i * .9) * 10 * p, 14 - p * 142)
      .setDisplaySize(size, size * 1.12).setRotation(i * 2.399963 + p * .7)
      .setAlpha(visible ? smooth(0, .08, p) * (1 - smooth(.52, 1, p)) * .55 : 0);
  }
}

import { markEliteDeathVisual } from './elite-death-visual.js';
import { markBossDeathVisual } from './boss-death-visual.js';
// Local visual trial explicitly requested by the user. No gameplay fields change.
// Set false to restore the native ordinary-enemy death particles.
export const SMALL_DEATH_TRIAL_ENABLED = true;
export const SMALL_DEATH_TEXTURE = 'pathogenic-small-death-trial';
export const SMALL_DEATH_FRAME_COUNT = 10;
const ordinaryDeaths = new WeakSet();
// Presentation snapshots stay outside combat objects, including delayed deaths.
const enemyBodies = new WeakMap(),deathBodies = new WeakMap();
export function captureEnemyDeathBody(enemy,width,height,pixelsPerUnit){
  if(!(Number.isFinite(width)&&Number.isFinite(height)&&Number.isFinite(pixelsPerUnit)&&width>0&&height>0&&pixelsPerUnit>0))return false;
  const span=Math.sqrt(width/pixelsPerUnit)*Math.sqrt(height/pixelsPerUnit);
  if(!(Number.isFinite(span)&&span>0))return false;enemyBodies.set(enemy,span);return true;
}
function deathBodySpan(enemy){
  const scale=Number.isFinite(enemy.scale)&&Math.abs(enemy.scale)>0?Math.abs(enemy.scale):1;
  const measured=enemyBodies.get(enemy);if(measured)return measured*scale;
  const rx=enemy.radiusX,rz=enemy.radiusZ??rx;
  return Number.isFinite(rx)&&Number.isFinite(rz)&&rx>0&&rz>0?2*Math.sqrt(rx)*Math.sqrt(rz)*scale:undefined;
}
export function enemyDeathVisualScale(effect){
  const body=deathBodies.get(effect);if(!body||!(effect.size>0)||!Number.isFinite(effect.size))return ordinaryDeaths.has(effect)?.5:1;
  if(!(body.span>0))return body.boss||body.elite?1:.5;
  const gain=body.boss?1.12:body.elite?1.05:1,min=body.boss?1.6:body.elite?.9:.65,max=body.boss?9:body.elite?6:4.5;
  const diameter=Math.max(min,Math.min(max,body.span*.9*gain));return diameter/effect.size;
}
export function isOrdinaryDeathVisual(effect) { return ordinaryDeaths.has(effect); }
export function markOrdinaryDeathVisual(effect, enemy) {
  deathBodies.set(effect,{span:deathBodySpan(enemy),boss:Boolean(enemy.boss),elite:Boolean(enemy.elite)});
  markEliteDeathVisual(effect, enemy);
  markBossDeathVisual(effect, enemy);
  if (!enemy.boss && !enemy.elite) ordinaryDeaths.add(effect);
  return effect;
}
export function smallDeathFrame(effect) {
  if (!SMALL_DEATH_TRIAL_ENABLED || !ordinaryDeaths.has(effect) || effect.age < 0) return null;
  const duration = Math.min(.55, effect.duration);
  if (!(duration > 0)) return null;
  return Math.min(SMALL_DEATH_FRAME_COUNT - 1, Math.floor(effect.age / duration * SMALL_DEATH_FRAME_COUNT));
}
export function preloadSmallDeathVisual(scene) {
  if (SMALL_DEATH_TRIAL_ENABLED) scene.load.spritesheet(SMALL_DEATH_TEXTURE,
    new URL('assets/death-trial/pathogenic-explosion.webp', location.href).href,
    { frameWidth: 256, frameHeight: 256, endFrame: SMALL_DEATH_FRAME_COUNT - 1 });
}
export function drawSmallDeathVisual(scene, effect, point, px, objects, live) {
  const frame = smallDeathFrame(effect);
  if (frame === null || !scene.textures.exists(SMALL_DEATH_TEXTURE)) return false;
  const key = `small-death-trial:${effect.uid}`;
  live.add(key);
  let view = objects.get(key);
  if (!view) { view = scene.add.image(0, 0, SMALL_DEATH_TEXTURE).setDepth(40); objects.set(key, view); }
  view.setFrame(frame).setPosition(point.x, point.y).setDisplaySize(effect.size * px * 1.25, effect.size * px * 1.25);
  return true;
}

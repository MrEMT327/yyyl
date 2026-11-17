import { nativeWeaponBody, drawWeaponAccent } from './weapon-visual-quality.js';
// Local Pathogenic art trial; no projectile/effect fields are modified.
export const MISSILE_WEAPON_TRIAL_ENABLED=true;
export const MISSILE_BODY_TEXTURE='pathogenic-missile-body-trial';
export const MISSILE_EXPLOSION_TEXTURE='pathogenic-missile-explosion-trial';
const explosions=new WeakSet();
export function isMissileBodyVisual(b){return MISSILE_WEAPON_TRIAL_ENABLED&&b.owner==='player'&&b.familyId===200041&&[1000012,1000013].includes(b.modelId)&&!b.beam;}
export function markMissileExplosionVisual(fx,shot){if(shot.owner==='player'&&(shot.familyId===200041||[200040,200044].includes(shot.weaponId))&&fx.modelId===210016)explosions.add(fx);}
export function missileExplosionFrame(fx){if(!MISSILE_WEAPON_TRIAL_ENABLED||!explosions.has(fx)||fx.age<0||!(fx.duration>0))return null;const t=fx.age/Math.min(.55,fx.duration);return t>=1?10:Math.floor(t*10);}
export function preloadMissileWeaponVisual(scene){
 if(!MISSILE_WEAPON_TRIAL_ENABLED)return;
 scene.load.image(MISSILE_BODY_TEXTURE,new URL('assets/missile-trial/pathogenic-rocket.png',location.href).href);
 scene.load.spritesheet(MISSILE_EXPLOSION_TEXTURE,new URL('assets/death-trial/pathogenic-explosion.webp',location.href).href,{frameWidth:256,frameHeight:256,endFrame:9});
}
export function drawTrialMissileBodyVisual(scene,b,live){
 if(!isMissileBodyVisual(b)||!scene.textures.exists(MISSILE_BODY_TEXTURE))return false;
 const key=`missile-body-trial:${b.uid}`;live.add(key);let view=scene.objects.get(key);
 if(!view){view=scene.add.image(0,0,MISSILE_BODY_TEXTURE).setDepth(29);view.preFX.addColorMatrix().hue(-110);scene.objects.set(key,view);}
 const p=scene.screen(b.x,b.z),height=scene.px*1.1*b.scale;
 view.setPosition(p.x,p.y).setDisplaySize(height*40/137*(b.visualScaleX??1),height).setRotation(b.visualAngle??b.angle);
 return true;
}
export function drawTrialMissileExplosionVisual(scene,fx,point,px,objects,live){
 const frame=missileExplosionFrame(fx);if(frame===null||!scene.textures.exists(MISSILE_EXPLOSION_TEXTURE))return false;if(frame>=10)return true;
 const key=`missile-explosion-trial:${fx.uid}`;live.add(key);let view=objects.get(key);
 if(!view){view=scene.add.image(0,0,MISSILE_EXPLOSION_TEXTURE).setDepth(40);objects.set(key,view);}
  const size=px*8*(fx.originalScale??1);view.setPosition(point.x,point.y).setFrame(frame).setDisplaySize(size,size);return true;
}
export const drawMissileBodyVisual = nativeWeaponBody;
export function drawMissileExplosionVisual(scene,fx,point,px,objects,live){return drawWeaponAccent(scene,fx,point,px,objects,live,{owns:explosions.has(fx),texture:MISSILE_EXPLOSION_TEXTURE,key:'missile',frames:10});}

export function isBasicMissileBody(b) {
 return isMissileBodyVisual(b) && b.modelId === 1000013 && !b.visualHidden && b.scale > 0;
}
export function replaceMissileBodySamples(sprites, age, enabled, available) {
 if (!enabled || !available || !Number.isFinite(age) || age < 0) return sprites;
 return sprites.map(p => {
  // Replace only the two body sequences. Never replace smoke, glow, meshes,
  // detached particles or the super/nuclear missile's separate body.
  if (p.mesh || p.layerId || !/^sp_missile_1_(?:ScaleShow_)?\d{4}_/.test(p.key)) return p;
  const birth = p.key.startsWith('sp_missile_1_ScaleShow_');
  const t = Math.min(1, age / .24), grow = t * t * (3 - 2 * t);
  const height = p.height * .7 * (birth ? grow : 1);
  return { ...p, key: MISSILE_BODY_TEXTURE, width: height * 40 / 137, height,
   originX: .5, originY: .5, crop: undefined,
   // Native sequences overlap briefly; do not double the new core at handoff.
   alpha: p.alpha * (birth ? (age < .24 ? grow : 0) : 1), tint: 0xffffff,
  };
 });
}
export function syncMissileBodyHue(view, texture) {
 if (!view.postFX) return;
 const old = view.getData('pathogenicMissileHue');
 if (texture === MISSILE_BODY_TEXTURE) {
  if (!old) { const effect = view.postFX.addColorMatrix(); effect.hue(-110); view.setData('pathogenicMissileHue', effect); }
 } else if (old) {
  view.postFX.remove(old); view.setData('pathogenicMissileHue', undefined);
 }
}

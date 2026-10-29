import { nativeWeaponBody, drawWeaponAccent } from './weapon-visual-quality.js';
// Local Pathogenic texture adaptation. No simulation values are mutated.
export const ACID_WEAPON_TRIAL_ENABLED=true;
export const ACID_BODY_TEXTURE='pathogenic-acid-body-trial';
export const ACID_HIT_TEXTURE='pathogenic-acid-hit-trial';
const hits=new WeakSet();
export function isAcidBodyVisual(b){return ACID_WEAPON_TRIAL_ENABLED&&b.owner==='player'&&b.familyId===200061&&b.modelId===1000031&&!b.beam;}
export function markAcidHitVisual(fx,b){if(b.owner==='player'&&b.familyId===200061&&fx.modelId===210049)hits.add(fx);return fx;}
export function acidHitProgress(fx){if(!ACID_WEAPON_TRIAL_ENABLED||!hits.has(fx)||fx.age<0||!(fx.duration>0))return null;return Math.min(1,fx.age/Math.min(.3,fx.duration));}
export function preloadAcidWeaponVisual(scene){
 if(!ACID_WEAPON_TRIAL_ENABLED)return;
 scene.load.image(ACID_BODY_TEXTURE,new URL('assets/acid-trial/pathogenic-orb.png',location.href).href);
 scene.load.image(ACID_HIT_TEXTURE,new URL('assets/acid-trial/pathogenic-splash.png',location.href).href);
}
export function drawTrialAcidBodyVisual(scene,b,live){
 if(!isAcidBodyVisual(b)||!scene.textures.exists(ACID_BODY_TEXTURE))return false;
 const key=`acid-body-trial:${b.uid}`;live.add(key);let view=scene.objects.get(key);
 if(!view){view=scene.add.image(0,0,ACID_BODY_TEXTURE).setDepth(29);scene.objects.set(key,view);}
 const p=scene.screen(b.x,b.z),size=2*b.radiusX*scene.px;
 view.setPosition(p.x,p.y).setDisplaySize(size*(b.visualScaleX??1),size).setRotation(b.visualAngle??b.angle);return true;
}
export function drawTrialAcidHitVisual(scene,fx,point,px,objects,live){
 const t=acidHitProgress(fx);if(t===null||!scene.textures.exists(ACID_HIT_TEXTURE))return false;if(t>=1)return true;
 const key=`acid-hit-trial:${fx.uid}`;live.add(key);let view=objects.get(key);
 if(!view){view=scene.add.image(0,0,ACID_HIT_TEXTURE).setDepth(40);objects.set(key,view);}
 const size=fx.size*px*(1+1.2*t);view.setPosition(point.x,point.y).setDisplaySize(size,size).setAlpha(1-t);return true;
}
export const drawAcidBodyVisual = nativeWeaponBody;
export function drawAcidHitVisual(scene,fx,point,px,objects,live){return drawWeaponAccent(scene,fx,point,px,objects,live,{owns:hits.has(fx),texture:ACID_HIT_TEXTURE,key:'acid'});}
export function isBasicAcidBody(b) {
 return isAcidBodyVisual(b) && b.weaponId === 200061 && !b.visualHidden && b.scale > 0;
}
export function replaceAcidBodySamples(sprites, age, enabled, available) {
 if (!enabled || !available || !Number.isFinite(age) || age < 0) return sprites;
 return sprites.map(p => {
  if (p.mesh || p.layerId || !p.key.startsWith('sp_Bullet_corrosion_')) return p;
  // The new texture has less transparent padding. Fit its visible ring to
  // the old core, not the entire old sprite rectangle. This is visual only.
  const diameter = Math.min(p.width, p.height) * .72;
  return { ...p, key: ACID_BODY_TEXTURE, width: diameter, height: diameter,
   originX: .5, originY: .5, crop: undefined,
   // Continuous simulation-age motion: no frame flips, no wall-clock drift
   // while paused. Native particle and mesh samples remain untouched.
   rotation: p.rotation + age * Math.PI,
  };
 });
}

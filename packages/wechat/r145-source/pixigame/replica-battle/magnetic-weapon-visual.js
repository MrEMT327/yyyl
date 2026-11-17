import { nativeWeaponBody, drawWeaponAccent } from './weapon-visual-quality.js';
// Presentation only: render the existing sector segments, never recalculate hits.
export const MAGNETIC_TEXTURE='pathogenic-magnetic-lightning';
export const MAGNETIC_HIT_TEXTURE='pathogenic-magnetic-ring';
const hits=new WeakSet();
export function isMagneticVisual(b){return b.owner==='player'&&b.familyId===200011&&[1000023,1000052,1000036].includes(b.modelId)&&!b.beam;}
export function markMagneticHitVisual(fx,b){if(b.owner==='player'&&b.familyId===200011&&fx.modelId===210047)hits.add(fx);return fx;}
export function preloadMagneticWeaponVisual(scene){
 scene.load.image(MAGNETIC_TEXTURE,new URL('assets/magnetic-trial/pathogenic-lightning.png',location.href).href);
 scene.load.image(MAGNETIC_HIT_TEXTURE,new URL('assets/magnetic-trial/pathogenic-ring.png',location.href).href);
}
export function drawTrialMagneticBodyVisual(scene,b,live){
 if(!isMagneticVisual(b)||!scene.textures.exists(MAGNETIC_TEXTURE)||b.age<b.warmup)return false;
 // Sector models have zero collision radius and explicit radial segments.
 if(b.modelId!==1000036){
  for(const [i,segment]of (b.segments||[]).entries()){
   const a=scene.screen(segment.from.x,segment.from.z),z=scene.screen(segment.to.x,segment.to.z),length=Math.hypot(z.x-a.x,z.y-a.y);if(length<.001)continue;
   const key=`magnetic-body-trial:${b.uid}:${i}`;live.add(key);let view=scene.objects.get(key);
   if(!view){view=scene.add.image(0,0,MAGNETIC_TEXTURE).setDepth(29);scene.objects.set(key,view);}
   view.setPosition((a.x+z.x)/2,(a.y+z.y)/2).setDisplaySize(length,scene.px*.4*b.scale).setRotation(Math.atan2(z.y-a.y,z.x-a.x)).setFlipY((Math.floor(b.age*24)+i)%2===1);
  }
 }else{
  const key=`magnetic-body-trial:${b.uid}`;live.add(key);let view=scene.objects.get(key);
  if(!view){view=scene.add.image(0,0,MAGNETIC_TEXTURE).setDepth(29);scene.objects.set(key,view);}
  const p=scene.screen(b.x,b.z),size=2*Math.max(b.radiusX,b.radiusZ)*scene.px;
  view.setPosition(p.x,p.y).setDisplaySize(size,size*.3).setRotation((b.visualAngle??b.angle)-Math.PI/2);
 }return true;
}
export function drawTrialMagneticHitVisual(scene,fx,point,px,objects,live){
 if(!hits.has(fx)||!scene.textures.exists(MAGNETIC_HIT_TEXTURE)||fx.age<0||!(fx.duration>0))return false;
 const t=fx.age/fx.duration;if(t>=1)return true;
 const key=`magnetic-hit-trial:${fx.uid}`;live.add(key);let view=objects.get(key);
 if(!view){view=scene.add.image(0,0,MAGNETIC_HIT_TEXTURE).setDepth(40);objects.set(key,view);}
 const size=fx.size*px*(1+t);view.setPosition(point.x,point.y).setDisplaySize(size,size).setAlpha(1-t);return true;
}
export const drawMagneticBodyVisual = nativeWeaponBody;
export function drawMagneticHitVisual(scene,fx,point,px,objects,live){return drawWeaponAccent(scene,fx,point,px,objects,live,{owns:hits.has(fx),texture:MAGNETIC_HIT_TEXTURE,key:'magnetic'});}


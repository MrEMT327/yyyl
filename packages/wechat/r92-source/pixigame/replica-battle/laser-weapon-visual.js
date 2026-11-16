import { nativeWeaponBody, drawWeaponAccent } from './weapon-visual-quality.js';
// Presentation-only adaptation of extracted Pathogenic textures.
export const LASER_TEXTURE='pathogenic-laser-line';
export const LASER_GLOW='pathogenic-laser-glow';
const hits=new WeakSet();
export function isLaserVisual(b){return b.owner==='player'&&b.familyId===200121&&b.modelId===220009&&b.beam&&b.age>=b.warmup;}
export function markLaserHitVisual(fx,b){if(b.owner==='player'&&b.familyId===200121&&fx.modelId===210062)hits.add(fx);return fx;}
export function preloadLaserWeaponVisual(scene){
 scene.load.image(LASER_TEXTURE,new URL('assets/laser-trial/pathogenic-line.png',location.href).href);
 scene.load.image(LASER_GLOW,new URL('assets/laser-trial/pathogenic-glow.png',location.href).href);
}
function glow(scene,key,point,size,live,alpha=1,objects=scene.objects){
 live.add(key);let view=objects.get(key);
 if(!view){view=scene.add.image(0,0,LASER_GLOW).setDepth(40).setTint(0x9befff);objects.set(key,view);}
 view.setPosition(point.x,point.y).setDisplaySize(size,size).setAlpha(alpha);
}
export function drawTrialLaserWeaponVisual(scene,b,live,widthFactor=1){
 if(!isLaserVisual(b)||!scene.textures.exists(LASER_TEXTURE)||!scene.textures.exists(LASER_GLOW))return false;
 const effect=scene.content.assets.beamEffects.effects[b.modelId],line=effect?.lines?.[0];if(!line)return false;
 const width=(effect.usePrefabWidth?Number(line.parameters.widthMultiplier)*Number(line.parameters.widthCurve?.m_Curve?.[0]?.value??1):b.radiusX*4)*scene.px*widthFactor;
 if(!(width>0))return true;
 for(const [i,segment]of b.segments.entries()){
  const a=scene.screen(segment.from.x,segment.from.z),z=scene.screen(segment.to.x,segment.to.z),length=Math.hypot(z.x-a.x,z.y-a.y);if(length<.001)continue;
  // Keep hue-filter render targets below viewport size: a long offscreen beam
  // otherwise gets clipped by Phaser's pre-FX framebuffer near the muzzle.
  const count=Math.ceil(length/300),part=length/count;
  for(let j=0;j<count;j++){
   const key=`laser-body-trial:${b.uid}:${i}:${j}`;live.add(key);let view=scene.objects.get(key);
   if(!view){view=scene.add.image(0,0,LASER_TEXTURE).setDepth(31);view.preFX.addColorMatrix().hue(150);scene.objects.set(key,view);}
   // Overlap transparent texture borders internally, never extend endpoints.
   const start=j*part-(j?5:0),end=(j+1)*part+(j<count-1?5:0),t=(start+end)/(2*length);
   view.setPosition(a.x+(z.x-a.x)*t,a.y+(z.y-a.y)*t).setRotation(Math.atan2(z.y-a.y,z.x-a.x)).setDisplaySize(end-start,width).setFlipY((Math.floor(b.age*18)+i)%2===1);
  }
 }
 if(b.segments.length){
  const size=scene.px*b.scale*.9;
  glow(scene,`laser-start-trial:${b.uid}`,scene.screen(b.segments[0].from.x,b.segments[0].from.z),size,live);
  const end=b.segments.at(-1).to;glow(scene,`laser-end-trial:${b.uid}`,scene.screen(end.x,end.z),size,live);
 }return true;
}
export function drawTrialLaserHitVisual(scene,fx,point,px,objects,live){
 if(!hits.has(fx)||!scene.textures.exists(LASER_GLOW)||fx.age<0||!(fx.duration>0))return false;
 const t=fx.age/fx.duration;if(t>=1)return true;
 glow(scene,`laser-hit-trial:${fx.uid}`,point,fx.size*px*(1+t),live,1-t,objects);return true;
}
export const drawLaserWeaponVisual = nativeWeaponBody;
export function drawLaserHitVisual(scene,fx,point,px,objects,live){return drawWeaponAccent(scene,fx,point,px,objects,live,{owns:hits.has(fx),texture:LASER_GLOW,key:'laser',tint:0x9befff});}


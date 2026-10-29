import { nativeWeaponBody, drawWeaponAccent } from './weapon-visual-quality.js';
// Render-only Pathogenic adaptation. Simulation segments remain authoritative.
export const SCORCH_LINE='pathogenic-scorch-line',SCORCH_FIRE='pathogenic-scorch-fire';
const hits=new WeakSet();
export function isScorchVisual(b){return b.owner==='player'&&b.familyId===200171&&b.modelId===221001&&b.age>=b.warmup;}
export function markScorchHitVisual(fx,b){if(b.owner==='player'&&b.familyId===200171&&fx.modelId===210001)hits.add(fx);return fx;}
export function preloadScorchWeaponVisual(scene){
 scene.load.image(SCORCH_LINE,new URL('assets/scorch-trial/pathogenic-line.png',location.href).href);
 scene.load.image(SCORCH_FIRE,new URL('assets/scorch-trial/pathogenic-fire.png',location.href).href);
}
function fire(scene,key,p,size,live,alpha=1,objects=scene.objects){
 live.add(key);let view=objects.get(key);
 if(!view){view=scene.add.image(0,0,SCORCH_FIRE).setDepth(40);objects.set(key,view);}
 view.setPosition(p.x,p.y).setDisplaySize(size,size).setAlpha(alpha);
}
export function drawTrialScorchWeaponVisual(scene,b,live,widthFactor=1){
 if(!isScorchVisual(b)||!scene.textures.exists(SCORCH_LINE)||!scene.textures.exists(SCORCH_FIRE))return false;
 if(!b.beam){fire(scene,`scorch-body-trial:${b.uid}`,scene.screen(b.x,b.z),2*Math.max(b.radiusX,b.radiusZ)*scene.px,live);return true;}
 const effect=scene.content.assets.beamEffects.effects[b.modelId],line=effect?.lines?.[0];if(!line)return false;
 const width=(effect.usePrefabWidth?Number(line.parameters.widthMultiplier)*Number(line.parameters.widthCurve?.m_Curve?.[0]?.value??1):b.radiusX*4)*scene.px*widthFactor;
 if(!(width>0))return true;
 for(const [i,segment]of b.segments.entries()){
  const a=scene.screen(segment.from.x,segment.from.z),z=scene.screen(segment.to.x,segment.to.z),length=Math.hypot(z.x-a.x,z.y-a.y);if(length<.001)continue;
  const key=`scorch-body-trial:${b.uid}:${i}`;live.add(key);let view=scene.objects.get(key);
  if(!view){view=scene.add.image(0,0,SCORCH_LINE).setDepth(31).setTint(0xff7040);scene.objects.set(key,view);}
  view.setPosition((a.x+z.x)/2,(a.y+z.y)/2).setRotation(Math.atan2(z.y-a.y,z.x-a.x)).setDisplaySize(length,width).setFlipY((Math.floor(b.age*18)+i)%2===1);
 }
 if(b.segments.length){
  const size=scene.px*b.scale*.9,start=b.segments[0].from,end=b.segments.at(-1).to;
  fire(scene,`scorch-start-trial:${b.uid}`,scene.screen(start.x,start.z),size,live);
  fire(scene,`scorch-end-trial:${b.uid}`,scene.screen(end.x,end.z),size,live);
 }return true;
}
export function drawTrialScorchHitVisual(scene,fx,point,px,objects,live){
 if(!hits.has(fx)||!scene.textures.exists(SCORCH_FIRE)||fx.age<0||!(fx.duration>0))return false;
 const t=fx.age/fx.duration;if(t>=1)return true;
 fire(scene,`scorch-hit-trial:${fx.uid}`,point,fx.size*px*(1+t),live,1-t,objects);return true;
}
export const drawScorchWeaponVisual = nativeWeaponBody;
export function drawScorchHitVisual(scene,fx,point,px,objects,live){return drawWeaponAccent(scene,fx,point,px,objects,live,{owns:hits.has(fx),texture:SCORCH_FIRE,key:'scorch'});}


import { nativeWeaponBody, drawWeaponAccent } from './weapon-visual-quality.js';
// Pathogenic blade art adapted in the render layer only.
export const ICE_BODY_TEXTURE='pathogenic-ice-blade-trial';
const hits=new WeakSet();
export function isIceBodyVisual(b){return b.owner==='player'&&b.familyId===200031&&[1000006,1000032,1000043].includes(b.modelId)&&!b.beam;}
export function markIceHitVisual(fx,b){if(b.owner==='player'&&b.familyId===200031&&fx.modelId===210051)hits.add(fx);return fx;}
export function preloadIceWeaponVisual(scene){scene.load.spritesheet(ICE_BODY_TEXTURE,new URL('assets/ice-trial/pathogenic-blade.png',location.href).href,{frameWidth:955,frameHeight:835,endFrame:3});}
export function drawTrialIceBodyVisual(scene,b,live){
 if(!isIceBodyVisual(b)||!scene.textures.exists(ICE_BODY_TEXTURE))return false;
 const key=`ice-body-trial:${b.uid}`;live.add(key);let view=scene.objects.get(key);
 if(!view){view=scene.add.image(0,0,ICE_BODY_TEXTURE,1).setDepth(29).setTint(0x79dfff);scene.objects.set(key,view);}
 const p=scene.screen(b.x,b.z),size=2*Math.max(b.radiusX,b.radiusZ)*scene.px;
 view.setPosition(p.x,p.y).setDisplaySize(size*(b.visualScaleX??1),size*835/955).setRotation((b.visualAngle??b.angle)-Math.PI/2);return true;
}
export function drawTrialIceHitVisual(scene,fx,point,px,objects,live){
 if(!hits.has(fx)||!scene.textures.exists(ICE_BODY_TEXTURE)||fx.age<0||!(fx.duration>0))return false;
 const t=fx.age/fx.duration;if(t>=1)return true;
 const key=`ice-hit-trial:${fx.uid}`;live.add(key);let view=objects.get(key);
 if(!view){view=scene.add.image(0,0,ICE_BODY_TEXTURE).setDepth(40).setTint(0x79dfff);objects.set(key,view);}
 const size=fx.size*px*2;view.setPosition(point.x,point.y).setFrame(Math.min(3,Math.floor(t*4))).setDisplaySize(size,size*835/955).setAlpha(1-t);return true;
}
export const drawIceBodyVisual = nativeWeaponBody;
export function drawIceHitVisual(scene,fx,point,px,objects,live){return drawWeaponAccent(scene,fx,point,px,objects,live,{owns:hits.has(fx),texture:ICE_BODY_TEXTURE,key:'ice',frames:4,tint:0x79dfff});}


import Phaser from 'phaser';
import {registerPathogenicShader,PathogenicShaderCoverageError,type PathogenicShaderDraw} from './pathogenic-shader-pipeline';

/** Exact source state: freeze_effect.gd and dissolve_canvasgroup.gdshader.
 * Only the hit-color mix is transplanted; body texture/geometry remain the host's.
 * Original outline, dissolve, CanvasGroup compositing and lighting are not claimed.
 */
export const SOURCE_FREEZE_COLOR = Object.freeze([0.658,0.809,1.441] as const);
export const SOURCE_FREEZE_HIT_VALUE=0.5;
export const SOURCE_FREEZE_EXIT_SECONDS=0.3;
const SOURCE_STATUS_SHADER={path:'pathogenic-source-freeze-hit-mix',code:`shader_type canvas_item;
render_mode unshaded;
uniform vec3 hit_color = vec3(0.658, 0.809, 1.441);
uniform float hit_value = 0.5;
void fragment() {
  COLOR.rgb = mix(COLOR.rgb, hit_color, hit_value);
}`};

export interface SourceFreezeTintState {wasActive:boolean;fadeStart:number|null;lastTime:number}
export function newSourceFreezeTintState():SourceFreezeTintState{return {wasActive:false,fadeStart:null,lastTime:-Infinity};}
/** time/endTime are simulation seconds, so pause does not consume fade duration.
 * A supplied endTime preserves exact expiry when it falls between rendered frames.
 */
export function advanceSourceFreezeTint(state:SourceFreezeTintState,active:boolean,time:number,endTime?:number){
  if(!Number.isFinite(time)||endTime!==undefined&&!Number.isFinite(endTime))throw new Error('Non-finite source status time');
  if(time<state.lastTime){state.wasActive=false;state.fadeStart=null;}
  if(active)state.fadeStart=null;
  else if(state.wasActive)state.fadeStart=endTime??time;
  state.wasActive=active;state.lastTime=time;
  const elapsed=state.fadeStart===null?Infinity:Math.max(0,time-state.fadeStart);
  const suppressHitFlash=active||elapsed<SOURCE_FREEZE_EXIT_SECONDS;
  const hitValue=active?SOURCE_FREEZE_HIT_VALUE:elapsed<SOURCE_FREEZE_EXIT_SECONDS?
    SOURCE_FREEZE_HIT_VALUE*Math.pow(1-elapsed/SOURCE_FREEZE_EXIT_SECONDS,3):0;
  if(!suppressHitFlash)state.fadeStart=null;
  return {hitValue,hitColor:SOURCE_FREEZE_COLOR,suppressHitFlash};
}
/** CPU reference for numeric verification, with no 8-bit packing or RGB clamp. */
export function sourceFreezeColorMix(color:readonly number[],hitValue:number):number[]{
  return color.map((c,i)=>i<3?c+(SOURCE_FREEZE_COLOR[i]-c)*hitValue:c);
}

const identity3=[1,0,0,0,1,0,0,0,1],identity4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const rootStates=new WeakMap<Phaser.GameObjects.GameObject,SourceFreezeTintState>();
const bossHitStates=new WeakMap<Phaser.GameObjects.GameObject,{start:number;lastTime:number}>();
const BOSS_HIT_DURATION=.12;
const BOSS_HIT_INTERVAL=.4;
const BOSS_HIT_MIX=.35;
const imageStates=new WeakMap<Phaser.GameObjects.Image,{
  pipeline:Phaser.Renderer.WebGL.WebGLPipeline;blendMode:number|string;previousDraw:unknown;
}>();
function imagesOf(view:Phaser.GameObjects.GameObject):Phaser.GameObjects.Image[]{
  if(view instanceof Phaser.GameObjects.Image)return [view];
  if(view instanceof Phaser.GameObjects.Container)return view.list.flatMap(imagesOf);
  if(/spine/i.test(view.type))throw new PathogenicShaderCoverageError(view.type,'freeze tint needs a Spine batch/postprocess integration; Image adapter cannot claim Spine support');
  return [];
}
function restoreImage(image:Phaser.GameObjects.Image){
  const saved=imageStates.get(image);if(!saved)return;
  image.setPipeline(saved.pipeline).setBlendMode(saved.blendMode);
  if(saved.previousDraw===undefined)image.data?.remove('pathogenicShader');else image.setData('pathogenicShader',saved.previousDraw);
  imageStates.delete(image);
}

/** Call once per rendered frame for each enemy container or Image, even after
 * freezeActive becomes false. Freeze/its .3s exit tween suppress ordinary hit
 * flash, matching enemy._hit_anim's `if hit_tween.is_running(): return` rule.
 * Boss hit feedback uses a bounded texture-preserving pulse.
 */
export function applySourceStatusTint(view:Phaser.GameObjects.Image|Phaser.GameObjects.Container,
  flash:boolean,freezeActive:boolean,time:number,options:{freezeEndTime?:number;boss?:boolean}={}){
  let state=rootStates.get(view);if(!state){state=newSourceFreezeTintState();rootStates.set(view,state);}
  const sample=advanceSourceFreezeTint(state,freezeActive,time,options.freezeEndTime),images=imagesOf(view);
  let bossHitValue=0;
  if(options.boss){
    let hit=bossHitStates.get(view);
    if(!hit||time<hit.lastTime){hit={start:-Infinity,lastTime:time};bossHitStates.set(view,hit);}
    if(sample.suppressHitFlash)hit.start=-Infinity;
    else if(flash&&time-hit.start>=BOSS_HIT_INTERVAL)hit.start=time;
    hit.lastTime=time;
    bossHitValue=BOSS_HIT_MIX*Math.pow(Math.max(0,1-(time-hit.start)/BOSS_HIT_DURATION),2);
  }
  if(sample.suppressHitFlash||bossHitValue>0){
    const renderer=view.scene.game.renderer;
    if(!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer))throw new PathogenicShaderCoverageError('freeze_effect.gd','WebGL float-uniform mix required; an 8-bit tint is not equivalent');
    const registered=registerPathogenicShader(view.scene.game,SOURCE_STATUS_SHADER);
    for(const image of images){
      if(!imageStates.has(image)){
        const name=image.pipeline?.name;
        if(name!=='MultiPipeline'&&name!=='SinglePipeline'&&name!=='MobilePipeline')throw new PathogenicShaderCoverageError(name??image.type,'existing custom body shader requires explicit composition with freeze mix');
        imageStates.set(image,{pipeline:image.pipeline,blendMode:image.blendMode,previousDraw:image.getData('pathogenicShader')});
      }
      const source=image.frame?.source;
      if(!source)throw new PathogenicShaderCoverageError(image.texture.key,'missing Image texture source');
      const draw:PathogenicShaderDraw={time,color:[1,1,1,1],screenToLocal:identity3,localToScreen:identity3,modelMatrix:identity4,
        textureSize:[source.width,source.height],uvRect:[0,0,1,1],mainPremultiplied:source.glTexture?.pma!==false,
        uniforms:{hit_color:sample.suppressHitFlash?[...SOURCE_FREEZE_COLOR]:[1,1,1],hit_value:sample.suppressHitFlash?sample.hitValue:bossHitValue},lighting:'unlit'};
      image.setData('pathogenicShader',draw);
      image.clearTint().setPipeline(registered.key).setBlendMode(registered.blendMode);
    }
  }else for(const image of images){restoreImage(image);if(flash&&!options.boss)image.setTintFill(0xffffff);else image.clearTint();}
  return {...sample,bossHitValue,affectedImages:images.length};
}
/** Use if a pooled view is reassigned without being destroyed. */
export function resetSourceStatusTint(view:Phaser.GameObjects.Image|Phaser.GameObjects.Container){
  for(const image of imagesOf(view)){restoreImage(image);image.clearTint();}rootStates.delete(view);bossHitStates.delete(view);
}

/** BurnEffect.update_particles uses its current pre-hit burn damage, not the
 * enemy's remaining HP or the projectile's visual size. Missing data must be
 * bridged explicitly instead of silently forcing full-density particles. */
export function sourceBurnAmountRatio(damage:number):number {
  if(!Number.isFinite(damage)||damage<0)throw new Error('Burn particle density requires a finite non-negative damage snapshot');
  return Math.max(0.3,Math.min(1,damage/200));
}

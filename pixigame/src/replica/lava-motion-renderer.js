import {sampleLavaFlow,sampleLavaBubble} from './lava-motion.js';

const fragment=`
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uMainSampler;
uniform vec3 uMotionPhases;
uniform float uMotionMode;
uniform float uMotionSeed;
varying vec2 outTexCoord;
varying float outTintEffect;
varying vec4 outTint;
const float TAU=6.28318530718;
void main(){
  vec4 painted=texture2D(uMainSampler,outTexCoord);
  if(painted.a<.002){gl_FragColor=vec4(0.);return;}
  vec4 tint=vec4(outTint.bgr*outTint.a,outTint.a);
  vec4 color=painted*tint;
  if(outTintEffect==1.)color.rgb=mix(painted.rgb,outTint.bgr*outTint.a,painted.a);
  else if(outTintEffect==2.)color=tint;
  vec2 uv=outTexCoord;
  vec2 direction=uMotionMode>3.5?vec2(.14,7.1):uMotionMode<1.5?vec2(.35,6.2):uMotionMode<2.5?vec2(2.1,2.7):vec2(3.8,4.6);
  float warp=sin(uv.x*11.7+uMotionPhases.y*TAU)*.23+cos(uv.y*9.3-uMotionPhases.z*TAU)*.18;
  if(uMotionMode>1.5&&uMotionMode<2.5)warp*=2.;
  float phase=dot(uv,direction)+warp-uMotionPhases.x+uMotionSeed;
  float current=pow(max(0.,sin(phase*TAU)),7.);
  float fine=sin((uv.x*4.3-uv.y*2.1+uMotionPhases.y)*TAU);
  float gain=.87+.34*current+.055*fine;
  gl_FragColor=vec4(color.rgb*gain,color.a);
}`;

function createFlowPipeline(game,BasePipeline){
class LavaFlowPipeline extends BasePipeline{
  constructor(game){super({game,fragShader:fragment});}
  destroy(){
    // Phaser 3.90's shader teardown expects wrappers, but optimized-out
    // vertex attributes retain the numeric -1 sentinel. Only our shaders
    // need this normalization; valid wrappers still use normal destruction.
    for(const shader of this.shaders??[])for(const attribute of shader.attributes??[])
      if(attribute.location===-1)attribute.location=null;
    return super.destroy();
  }
  onBind(image){
    const motion=image?.pipelineData?.lavaMotion;if(!motion)return;
    // Finish previous surfaces before changing the per-object uniforms.
    this.flush();this.set3f('uMotionPhases',...motion.phases);
    this.set1f('uMotionMode',motion.mode);this.set1f('uMotionSeed',motion.seed);
  }
}
return new LavaFlowPipeline(game);
}

/** GPU light modulation and one batched graphics object. Painted terrain and
 * cached emission textures are never redrawn or uploaded per animation frame. */
export function createLavaMotion(scene,key){
  let pipeline=null,bubbles=null,reduced=false,flows=0,events=0,disposed=false;
  const renderer=scene.game?.renderer,gameEvents=scene.game?.events;
  function dispose(){
    if(disposed)return;disposed=true;flows=events=0;
    gameEvents?.off?.('destroy',dispose);
    bubbles?.destroy();bubbles=null;
    const owned=pipeline;pipeline=null;
    if(!owned||!renderer?.gl)return;
    const manager=renderer.pipelines;
    if(manager?.pipelines){
      if(manager.current===owned)manager.clear();
      if(manager.get(key)===owned)manager.remove(key,false,false);
    }
    if(owned.renderer)owned.destroy();
  }
  function resetCore(image){if(pipeline&&image.pipeline===pipeline)image.resetPipeline();}
  function drawBubble(light,stamps,bubble){
    if(!bubbles)bubbles=scene.add.graphics().setDepth(18.2).setScrollFactor(0).setName('project-lava-bubbles');
    const g=bubbles,sx=light.coreWidth/stamps.core.width,sy=light.coreHeight/stamps.core.height;
    const x=bubble.site.x-stamps.core.width/2,y=bubble.site.y-stamps.core.height/2;
    g.setVisible(true);g.save();g.translateCanvas(light.x,light.y);g.rotateCanvas(light.angle??0);g.scaleCanvas(sx,sy);
    const r=bubble.radius,a=bubble.alpha;
    if(bubble.stage==='grow'){
      g.fillStyle(0x742b12,a*.90).fillEllipse(x,y,r*2.25,r*1.52);
      g.fillStyle(0xec721c,a*.94).fillEllipse(x,y-r*.14,r*1.93,r*1.29);
      g.fillStyle(0xffbf54,a*.72).fillEllipse(x-r*.25,y-r*.37,r*.78,r*.31);
    }else{
      g.lineStyle(.8,0xf9942a,a*.84).strokeEllipse(x,y,bubble.ringRadius*2,bubble.ringRadius*1.36);
      if(bubble.progress<.78){
        const p=bubble.progress/.78,travel=bubble.burstRadius*.68*p,jump=Math.sin(p*Math.PI)*bubble.burstRadius*.32;
        for(let i=0;i<3;i++){
          const angle=bubble.rotation+i*2.0944,dx=Math.cos(angle)*travel,dy=Math.sin(angle)*travel*.58-jump;
          g.fillStyle(i===0?0xffc365:0xf58525,a*.90).fillEllipse(x+dx,y+dy,(1-p)*1.75,(1-p)*2.15);
        }
      }
    }
    g.restore();events++;
  }
  return {
    begin(reducedMotion=false){if(disposed)return;reduced=reducedMotion;flows=events=0;if(bubbles)bubbles.clear().setVisible(false);},
    bindCore(image,light,stamps){
      if(disposed)return;
      const motion=sampleLavaFlow(light.emissionAsset,light.id,light.time??0,reduced);
      if(motion&&renderer?.gl&&renderer.pipelines){
        if(!pipeline){
          // Reuse the host's registered Phaser class only when WebGL is
          // actually available; importing this module must not boot Phaser.
          const BasePipeline=renderer.pipelines.get?.('SinglePipeline')?.constructor;
          if(BasePipeline){
            pipeline=createFlowPipeline(scene.game,BasePipeline);renderer.pipelines.add(key,pipeline);
            // Phaser emits Game DESTROY before invalidating its renderer and
            // pipeline maps. The later skin cleanup may run after both are gone.
            gameEvents?.once?.('destroy',dispose);
          }
        }
        if(pipeline){image.setPipeline(key,{lavaMotion:motion},false);flows++;}
      }else resetCore(image);
      const bubble=sampleLavaBubble(light.time??0,light.id,stamps.bubbleSites??[],reduced);
      if(bubble)drawBubble(light,stamps,bubble);
    },
    resetCore,
    snapshot(){return {flows,bubbles:events,reducedMotion:reduced};},
    dispose,
  };
}

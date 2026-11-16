import Phaser from 'phaser';
import nativeSpriteFragment from 'phaser/src/renderer/webgl/shaders/Single-frag.js';
import type {PathogenicSceneView} from './pathogenic-scene-view';

// Project combat profile. Select HDR highlights before blurring so ordinary
// map pixels do not feed the halo. Keep the existing three-level pyramid;
// stronger bloom adds no render targets or blur passes to the first chapter.
export const COMBAT_BLOOM=Object.freeze({
  glowEnabled:true,intensity:1.45,threshold:1,scale:.25,bloom:0,cap:3.0,
  bloomLevels:3,prefilterBrightPixels:true,
});
// Compatibility export for existing callers and preview tools.
export const FIRST_CHAPTER_BLOOM=COMBAT_BLOOM;
export const FIRST_CHAPTER_SPRITE_PIPELINE='ProjectFirstChapterEmission';
export function chapterBloomSettings(chapterId:number){return Number.isInteger(chapterId)&&chapterId>0?COMBAT_BLOOM:undefined;}
export function firstChapterEmissionFragment(source:string){
  const anchor='    gl_FragColor = color;';
  if(typeof source!=='string'||source.split(anchor).length!==2)throw Error('First-chapter bloom requires the Phaser single-sprite shader');
  // Preserve native UV, tint modes, premultiplication and alpha. Only the
  // projectile core emits above 1.0 into the existing HDR world attachment.
  return source.replace(anchor,'    float projectShotPeak=max(color.r,max(color.g,color.b));\n    float projectShotCore=smoothstep(0.65,0.98,projectShotPeak)*smoothstep(0.25,0.8,color.a);\n    color.rgb *= 1.0+0.28*projectShotCore;\n'+anchor);
}
export function registerFirstChapterSpriteBloom(scene:Phaser.Scene){
  const renderer=scene.game.renderer;
  if(!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer))throw Error('First-chapter bloom requires WebGL');
  if(!renderer.pipelines.has(FIRST_CHAPTER_SPRITE_PIPELINE)){
    renderer.pipelines.add(FIRST_CHAPTER_SPRITE_PIPELINE,new Phaser.Renderer.WebGL.Pipelines.SinglePipeline({game:scene.game,fragShader:firstChapterEmissionFragment(nativeSpriteFragment)}));
  }
  return FIRST_CHAPTER_SPRITE_PIPELINE;
}
export function applyFirstChapterShotBloom(group:Phaser.GameObjects.Container,pipeline:string){
  for(const child of group.list){
    if(child instanceof Phaser.GameObjects.Sprite||child instanceof Phaser.GameObjects.Image)child.setPipeline(pipeline);
    else if(child instanceof Phaser.GameObjects.Container)applyFirstChapterShotBloom(child,pipeline);
  }
}
export function setupFirstChapterBloom(scene:Phaser.Scene,source:PathogenicSceneView,chapterId:number){
  const profile=chapterBloomSettings(chapterId);if(!profile)return undefined;
  source.configureDisplay(profile);return registerFirstChapterSpriteBloom(scene);
}

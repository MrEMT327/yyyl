import test from 'node:test';
import assert from 'node:assert/strict';
import {LinearFilter,LinearMipmapLinearFilter,LinearMipmapNearestFilter} from 'three';
import {BattleArt} from '../../../../../pixigame/src/three/game-screen/h5-battle-screen.js';
import {createBattleColorTargets} from '../../../../../pixigame/src/three/game-screen/battle-color-targets.js';
import {createBattleStage} from '../../../../../pixigame/src/three/game-screen/three-battle-stage.js';
import {useArtworkLoader} from '../../../../../pixigame/src/three/game-screen/image-loading.js';
import {MISSILE_ART_KEYS} from '../../../../../pixigame/replica-battle/kernel/pathogenic/missile-presentation.mjs';
import {openWechatBattleSurface} from '../wechat/src/three/battle-surface.js';

test('Battle coin minification blends premultiplied atlas pixels',async t=>{
  const restore=useArtworkLoader(async()=>({width:1024,height:512}));
  const art=new BattleArt({},'https://example.invalid/');
  t.after(()=>{art.dispose();restore();});

  const coin=await art.preload('coins','/coins.png');
  assert.equal(coin.texture.minFilter,LinearMipmapLinearFilter);
  assert.equal(coin.texture.magFilter,LinearFilter);
  assert.equal(coin.texture.generateMipmaps,true);
  assert.equal(coin.texture.premultiplyAlpha,true);
  assert.equal(coin.premultiplied,true);

  const glyphs=await art.preload('digits','/digits.png');
  assert.equal(glyphs.texture.minFilter,LinearFilter);
  assert.equal(glyphs.texture.generateMipmaps,false);
  assert.equal(glyphs.premultiplied,false);
});

test('Compact missile textures preserve authored crops and filter their solid and glowing edges separately',async t=>{
  const authoredSizes=[[948,1659],[724,2172]],sizes=[[64,128],[32,128]];
  const restore=useArtworkLoader(async url=>{
    const [width,height]=url.endsWith('/body.png')?sizes[0]:sizes[1];
    return {width,height};
  });
  const art=new BattleArt({},'https://example.invalid/');
  t.after(()=>{art.dispose();restore();});

  for(const [index,key] of MISSILE_ART_KEYS.entries()){
    art.expectSize(key,...authoredSizes[index]);
    const binding=await art.preload(key,index===0?'body.png':'exhaust.png');
    assert.deepEqual([binding.width,binding.height],sizes[index]);
    assert.deepEqual(binding.pathogenicLogicalSize,authoredSizes[index]);
    assert.equal(binding.texture.minFilter,index===0?LinearMipmapNearestFilter:LinearFilter);
    assert.equal(binding.texture.magFilter,LinearFilter);
    assert.equal(binding.texture.generateMipmaps,index===0);
    assert.equal(binding.texture.premultiplyAlpha,true);
    assert.equal(binding.premultiplied,true);
  }
});

test('Battle hull keeps its mipmaps when the canvas reports zero MSAA samples',t=>{
  const renderer={capabilities:{maxSamples:4},getContext:()=>({SAMPLES:0x80a9,getParameter:()=>0})};
  const targets=createBattleColorTargets(renderer,540,960,256);
  t.after(()=>targets.dispose());
  assert.equal(targets.hull.minFilter,LinearMipmapLinearFilter);
  assert.equal(targets.hull.generateMipmaps,true);
  assert.deepEqual([targets.hull.image.width,targets.hull.image.height],[256,256]);
  assert.equal(targets.ground.minFilter,LinearFilter);
  assert.equal(targets.ground.generateMipmaps,false);
});

test('Enemy minification can be enabled for a sprite without affecting other battle sprites',t=>{
  const renderer={capabilities:{maxSamples:0},getContext:()=>({SAMPLES:0x80a9,getParameter:()=>0})};
  const webStage=createBattleStage(renderer),wechatStage=createBattleStage(renderer,{smoothEnemyMinification:true});
  t.after(()=>{webStage.dispose();wechatStage.dispose();});

  const enemy=wechatStage.makeSprite(wechatStage.white,20);
  const pickup=wechatStage.makeSprite(wechatStage.white,20);
  wechatStage.smoothEnemySprite(enemy);

  assert.equal(enemy.material.defines.ENEMY_MINIFICATION,1);
  assert.equal(pickup.material.defines.ENEMY_MINIFICATION,undefined);
  assert.equal(wechatStage.hull.material.defines.ENEMY_MINIFICATION,undefined);
  assert.equal(webStage.smoothEnemySprite,undefined);
  assert.deepEqual(wechatStage.viewport,webStage.viewport);
});

test('WeChat draws the battle at higher output resolution with the original terrain and glow sizes',t=>{
  const draws=[],displaySizes=[];
  let target=null;
  const renderer={capabilities:{maxSamples:0},getContext:()=>({SAMPLES:0x80a9,getParameter:()=>0}),
    getRenderTarget:()=>target,setRenderTarget(next){target=next;},
    getViewport:v=>v,getScissor:v=>v,getScissorTest:()=>false,getClearColor:c=>c,getClearAlpha:()=>0,
    setPixelRatio(){},setScissorTest(){},setScissor(){},setViewport(){},setClearColor(){},clear(){},
    render(){draws.push(target?[target.width,target.height]:null);}};
  let bounds={width:390,height:844};
  const display={begin(_bounds,width,height){target=null;displaySizes.push([width,height]);},present(){}};
  const device={three:renderer,display};
  const surface=openWechatBattleSurface(device,{display},{bounds:()=>bounds,enter(){},leave(){}});
  t.after(()=>surface.close());
  const {stage}=surface;
  stage.glow.needsBackground=true;
  stage.render();
  assert.deepEqual([stage.viewport.width,stage.viewport.height],[540,1169]);
  const ground=stage.ground.userData.binding.texture.image;
  assert.deepEqual([ground.width,ground.height],[540,1169]);
  assert.deepEqual(draws.slice(0,4),[[720,1559],[540,1169],[720,1559],[270,584]]);
  assert.deepEqual(displaySizes,[[720,1559]]);

  bounds={width:360,height:640};
  stage.refreshViewport();
  const coverTarget={setSize(width,height){Object.assign(this,{width,height});}};
  device.cover={battleTarget:coverTarget};
  stage.render();
  assert.deepEqual([coverTarget.width,coverTarget.height],[720,1280]);
  assert.deepEqual(draws.at(-1),[720,1280]);
  assert.equal(displaySizes.length,1);
});

test('Busy battle scene prepares its transforms once and skips an empty foreground pass',t=>{
  const passes=[];
  const renderer={autoClear:true,capabilities:{maxSamples:0},getContext:()=>({SAMPLES:0x80a9,getParameter:()=>0}),
    setScissorTest(){},setRenderTarget(){},setViewport(){},setClearColor(){},clear(){},
    render(scene,camera){
      if(scene.matrixWorldAutoUpdate)scene.updateMatrixWorld();
      if(scene===stage.scene)passes.push(camera.layers.mask);
    }};
  const stage=createBattleStage(renderer);
  t.after(()=>stage.dispose());
  const update=stage.scene.updateMatrixWorld.bind(stage.scene);
  let transforms=0;
  stage.scene.updateMatrixWorld=(...args)=>{transforms++;update(...args);};
  for(let i=0;i<200;i++)stage.makeSprite(stage.white,29);
  const foreground=stage.makeSprite(stage.white,50);
  foreground.visible=false;
  stage.render();
  assert.deepEqual(passes,[3]);
  assert.equal(transforms,1);

  passes.length=transforms=0;
  stage.glow.needsBackground=true;
  foreground.visible=true;
  stage.render();
  assert.deepEqual(passes,[1,2,4]);
  assert.equal(transforms,1);
  assert.equal(stage.scene.matrixWorldAutoUpdate,true);
  assert.equal(stage.camera.layers.mask,1);
});

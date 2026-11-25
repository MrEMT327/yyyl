import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {LinearFilter,LinearMipmapLinearFilter,LinearMipmapNearestFilter} from 'three';
import {BattleArt} from '../../../../../pixigame/src/three/game-screen/h5-battle-screen.js';
import {createBattleColorTargets} from '../../../../../pixigame/src/three/game-screen/battle-color-targets.js';
import {createBattleStage} from '../../../../../pixigame/src/three/game-screen/three-battle-stage.js';
import {createNightLights} from '../../../../../pixigame/src/three/game-screen/night-lights.js';
import {useArtworkLoader} from '../../../../../pixigame/src/three/game-screen/image-loading.js';
import {icon as resultIcon} from '../../../../../pixigame/src/ui/result-icon-art.js';
import {createThreeSurface} from '../../../../../pixigame/src/ui/three-surface.js';
import {MISSILE_ART_KEYS} from '../../../../../pixigame/replica-battle/kernel/pathogenic/missile-presentation.mjs';
import {supplyResultRows} from '../../../../../pixigame/src/ui/battle-supply-results.js';
import {sampleBattleFlightTrail,sampleVictoryTrail} from '../../../../../pixigame/src/replica/project-victory-trail.js';
import {createFlightLaunch} from '../../../../../pixigame/replica-battle/battle-launch.js';
import {openWechatBattleSurface} from '../wechat/src/three/battle-surface.js';

test('Supply reward plates follow completed weapon breakthroughs',()=>{
  const cards=[
    {nativeSkillId:10000101,star:2,breakthroughs:0},
    {nativeSkillId:10000103,star:3,opensBreakthrough:true,breakthroughs:0},
    {nativeSkillId:10400105,star:3,breakthroughs:1},
    {nativeSkillId:10400108,star:6,breakthroughs:2},
    {nativeSkillId:10400110,star:9,breakthroughs:3},
    {nativeSkillId:10000109,star:9},
    {nativeSkillId:11000102,star:2,breakthroughs:2},
  ];
  const rows=supplyResultRows(cards);
  assert.deepEqual(rows.map(row=>row.plate.accent),
    [0x82c9ed,0x82c9ed,0xff7166,0xc9abff,0xc9abff,0x82c9ed,0x82c9ed]);
  assert.equal(rows[0].plate.gradient,undefined);
  assert.equal(rows[2].plate.gradient[0],rows[2].plate.gradient[1]);
  assert.notEqual(rows[3].plate.gradient[0],rows[3].plate.gradient[1]);
  assert.deepEqual(rows.map(row=>row.card),cards);
  assert.deepEqual(rows.slice(1,4).map(row=>row.lit),[3,3,3]);
  assert.equal(rows[6].marks,2);
});

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

test('Elite health marker darkens its outer stroke while keeping interior highlights',async t=>{
  const source={width:9,height:9},data=new Uint8ClampedArray(9*9*4);
  const at=(x,y)=>(y*9+x)*4;
  for(let y=1;y<8;y++)for(let x=1;x<8;x++){
    const edge=x===1||x===7||y===1||y===7;
    data.set(edge?[255,250,255,192]:[120,20,75,255],at(x,y));
  }
  data.set([246,232,209,255],at(4,4));
  const ctx={drawImage(image){assert.equal(image,source);},getImageData:()=>({data,width:9,height:9}),putImageData(){}};
  const prepared={getContext:()=>ctx};
  const wx=globalThis.wx,restore=useArtworkLoader(async()=>source);
  globalThis.wx={createCanvas:()=>prepared};
  const art=new BattleArt({},'https://example.invalid/');
  t.after(()=>{art.dispose();restore();if(wx===undefined)delete globalThis.wx;else globalThis.wx=wx;});

  const marker=await art.preload('original_hp_progress_icon_EliteMonster','/elite.png');
  assert.equal(marker.texture.image,prepared);
  assert.equal(marker.texture.minFilter,LinearMipmapLinearFilter);
  assert.equal(marker.premultiplied,true);
  assert.deepEqual([...data.slice(at(1,4),at(1,4)+4)],[60,34,70,192]);
  assert.deepEqual([...data.slice(at(4,4),at(4,4)+4)],[246,232,209,255]);

  art.dispose();
  assert.equal(prepared.width,0);
  assert.equal(prepared.height,0);
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

test('Fitted result icons use mipmaps and finish their crop on the first visible draw',async t=>{
  const surface=createThreeSurface(),restore=useArtworkLoader(async()=>({width:512,height:256}));
  const wx=globalThis.wx;
  globalThis.wx={createCanvas:()=>({getContext:()=>({
    drawImage(){},
    getImageData(_x,_y,w,h){
      const data=new Uint8ClampedArray(w*h*4);
      for(let y=8;y<28;y++)for(let x=24;x<104;x++)data[(y*w+x)*4+3]=255;
      return {data};
    }
  })})};
  t.after(()=>{restore();surface.destroy();if(wx===undefined)delete globalThis.wx;else globalThis.wx=wx;});
  const frame=resultIcon(surface,'/settlement-frame.png',0,0,88,88,false);
  const reward=resultIcon(surface,'/settlement-reward.png',0,0,70,62);
  const full=resultIcon(surface,'/settlement-weapon.png',0,0,120,120,false);
  await Promise.resolve();
  const texture=full.material.map,version=texture.version;
  const weapon=resultIcon(surface,'/settlement-weapon.png',77,10,48,42);
  assert.equal(frame.material.map.generateMipmaps,false);
  assert.equal(frame.material.map.minFilter,LinearFilter);
  assert.equal(reward.material.map.generateMipmaps,true);
  assert.equal(reward.material.map.minFilter,LinearMipmapLinearFilter);
  assert.equal(weapon.material.map,texture);
  assert.equal(texture.minFilter,LinearMipmapLinearFilter);
  assert.equal(texture.version,version+1);

  surface.group.updateMatrixWorld(true);
  weapon.onBeforeRender();
  assert.equal(weapon.scale.x,48);
  assert(weapon.scale.y < 0 && weapon.scale.y > -42);
  assert.equal(weapon.matrixWorld.elements[5],weapon.scale.y);
  const uv=weapon.geometry.attributes.uv;
  assert(uv.getX(0)>0 && uv.getY(0)<1);
  const uvVersion=uv.version;
  weapon.onBeforeRender();
  assert.equal(uv.version,uvVersion);
});

test('Lava flow writes to the declared GLSL 3 fragment output',t=>{
  const renderer={capabilities:{maxSamples:0},getContext:()=>({SAMPLES:0x80a9,getParameter:()=>0})};
  const stage=createBattleStage(renderer);
  const lights=createNightLights(stage,{sprite:layer=>stage.makeSprite(stage.white,layer),place(){},lava:{}});
  t.after(()=>{lights.dispose();stage.dispose();});
  lights.update([{shape:'lava-surface',emissionAsset:'lava',coreWidth:16,coreHeight:8,strength:1}],{profile:{id:'day'}},{});
  const lit=stage.scene.children.find(mesh=>mesh.material?.uniforms?.flowMode);
  assert(lit);
  assert.match(lit.material.fragmentShader,/out vec4 color;/);
  assert.match(lit.material.fragmentShader,/color\.rgb\*=/);
  assert.doesNotMatch(lit.material.fragmentShader,/gl_FragColor/);
});

test('Player hull and enemy sprites use separate minification settings',t=>{
  const renderer={capabilities:{maxSamples:0},getContext:()=>({SAMPLES:0x80a9,getParameter:()=>0})};
  const webStage=createBattleStage(renderer),wechatStage=createBattleStage(renderer,{smoothEnemyMinification:true});
  t.after(()=>{webStage.dispose();wechatStage.dispose();});

  const enemy=wechatStage.makeSprite(wechatStage.white,20);
  const pickup=wechatStage.makeSprite(wechatStage.white,20);
  const afterimage=wechatStage.makeSprite(wechatStage.hull.userData.binding,24);
  wechatStage.smoothEnemySprite(enemy);

  assert.equal(enemy.material.defines.ENEMY_MINIFICATION,1);
  assert.equal(pickup.material.defines.ENEMY_MINIFICATION,undefined);
  assert.equal(wechatStage.hull.material.defines.ENEMY_MINIFICATION,undefined);
  for(const stage of [webStage,wechatStage])assert.equal(stage.hull.material.defines.HULL_MIP_LOD_BIAS,-.5);
  for(const sprite of [enemy,pickup,afterimage,wechatStage.ground])assert.equal(sprite.material.defines.HULL_MIP_LOD_BIAS,undefined);
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
  draws.length=0;
  stage.render();
  assert.deepEqual([coverTarget.width,coverTarget.height],[720,1280]);
  assert.deepEqual(draws.filter(size=>size&&size[0]===720),[[720,1280],[720,1280],[720,1280]]);
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

test('victory flyaway clears retained combat effects on the first rendered frame',async()=>{
  const root=fileURLToPath(new URL('../../../../../',import.meta.url));
  const {outputFiles:[bundle]}=await build({stdin:{resolveDir:root,contents:[
    "export {NativeBattleView} from './pixigame/src/three/game-screen/three-battle-view.js';",
    "export {CombatEffectDirector} from './pixigame/replica-battle/kernel/pathogenic/combat-effect-director.ts';",
    "export {default as graph} from './pixigame/replica-battle/kernel/pathogenic/scene-graph.json';",
    "export {sampleScene} from './pixigame/replica-battle/kernel/pathogenic/source-scene-sampler.mjs';",
  ].join('\n')},bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent'});
  const module={exports:{}};
  new Function('module','exports',bundle.text)(module,module.exports);
  const {NativeBattleView,CombatEffectDirector,graph,sampleScene}=module.exports;
  const draws=[],removed=[];
  let resets=0,frames=0;
  const output={beginFrame(){draws.length=0;},endFrame(){},reset(){resets++;},setCameraOffset(){},
    draw(id,path,options){draws.push(id);return sampleScene(graph,path,options);},drawMeshes(id){draws.push(id);}};
  const stage={width:540,height:960,remove(node){removed.push(node);},render(){frames++;}};
  const trail={beginFrame(){},projectile(){},endFrame(){},reset(){}};
  const fx=new CombatEffectDirector({stage},graph,.25,{view:output},undefined,()=>trail);
  const beam={uid:1,owner:'player',familyId:200121,modelId:220009,bulletId:1,scale:1,age:.1,lifetime:3,
    x:0,z:1,beam:true,segments:[{from:{x:0,z:1},to:{x:0,z:20}}]};
  const rocket={uid:3,owner:'player',familyId:200151,modelId:1000013,bulletId:1,scale:1,age:.1,lifetime:3,x:1,z:2};
  const impact={uid:4,kind:'hit',modelId:210062,age:.05,duration:.16,size:1,x:0,z:5};
  const sim={phase:'playing',clock:270,runId:1,player:{x:0,z:1,hp:100,invincible:0,hitFlash:0},
    enemies:[],treasures:[],pickups:[],projectiles:[beam,{...beam,uid:2,owner:'enemy'},rocket],effects:[impact],
    equipmentProjectileAccent:()=>undefined,playerPhantomActive:true};
  const view=Object.assign(Object.create(NativeBattleView.prototype),{sim,stage,fx,
    content:{chapter:{player:{entityId:1,weaponEntityId:2},entities:{1:{stats:{shape:[1]}}},bullets:{1:{parameters:{}}}}},
    active:new Set(),objects:new Map(),enemyPositions:new Map(),advanceCameraView(){},
    cameraView:{position:{x:0,z:0}},mapCameraOffsets:{position:()=>({x:0,z:0})},
    renderSamples:{beginFrame:clock=>clock,projectile:b=>b},statusIndex:{update:()=>({visuals:[],targets:new Map()})},
    shots:{update:(_enemies,bullets)=>bullets.filter(b=>b.owner==='player').length},
    missileMounts:{beginFrame(){},projectile:b=>b},project:(x,z)=>({x:270+x*20,y:800-z*20}),
    appearance:{update(frame){this.frame=frame;}},
    source:{player:()=>({layers:[]}),thunder:b=>b,deathScale:()=>1,passiveShot:()=>undefined,feedback:()=>[]},
  });
  view.update(0);
  for(const id of ['projectile:1:0','projectile:2:0','projectile:3'])assert(draws.includes(id),id);
  assert(draws.some(id=>id.startsWith('combat-feedback:contact')));
  assert.equal(resets,1);
  const stale={userData:{}};view.objects.set('pickup:8',stale);
  sim.victoryDeparturePresentation={fromZ:1,targetZ:24,elapsed:0};
  for(const elapsed of [0,.1,.5,1,1.3]){
    sim.victoryDeparturePresentation.elapsed=elapsed;sim.player.z=1+23*Math.min(1,elapsed)**2;
    if(elapsed===1.3)sim.phase='won';
    view.update(0);
    assert.deepEqual(draws,[]);
    assert.equal(fx.entries.size,0);
    assert.equal(view.appearance.frame.flight.z,sim.player.z);
    assert.equal(view.appearance.frame.phantomActive,false);
    assert.deepEqual(view.appearance.frame.lightingEffects,[]);
  }
  assert.deepEqual(removed,[stale]);assert.equal(frames,6);assert.equal(resets,2);
  delete sim.victoryDeparturePresentation;sim.phase='playing';sim.runId=2;sim.clock=.1;
  view.update(0);
  assert(draws.includes('projectile:1:0'));assert.equal(resets,3);
});

test('victory draws the paired engine streaks through departure, fades offscreen and clears them before the next run',t=>{
  const renderer={capabilities:{maxSamples:0},getContext:()=>({SAMPLES:0x80a9,getParameter:()=>0})};
  const stage=createBattleStage(renderer);
  t.after(()=>stage.dispose());
  const from={x:215,y:680},pose={x:from.x,y:from.y,height:78,scaleY:1,visible:true};
  function frame(elapsed){
    const sample=sampleVictoryTrail({departure:{elapsed},from,pose:{...pose,y:from.y-800*Math.min(elapsed,1)**2}});
    stage.victory(sample);
    return sample;
  }
  const layers=()=>stage.scene.children.filter(n=>n.renderOrder===24.65||n.renderOrder===24.7);
  stage.victory(null);frame(0);
  assert.deepEqual(layers(),[]);
  const takeoff=frame(.2),cruise=frame(.75);
  assert.equal(takeoff.tail.x,from.x);
  assert.ok(cruise.head.y<takeoff.head.y);
  assert.ok(new Set(cruise.segments.map(row=>row.x1)).size===2);
  const active=layers();
  assert.equal(active.length,2);
  assert.ok(active.every(n=>n.visible&&n.geometry.drawRange.count>0));
  const offscreen=frame(1),fading=frame(1.15);
  assert.ok(offscreen.head.y<0&&offscreen.tail.y>0);
  assert.ok(Math.abs(fading.power-.5)<1e-6);
  assert.ok(active.every(n=>n.visible));
  assert.equal(frame(1.3),null);
  assert.ok(active.every(n=>!n.visible&&n.geometry.drawRange.count===0));
  frame(.4);assert.deepEqual(layers(),active);
  stage.victory(null);
  assert.ok(active.every(n=>!n.visible));
});

test('battle launch draws the paired engine streaks and clears them when control resumes',t=>{
  const renderer={capabilities:{maxSamples:0},getContext:()=>({SAMPLES:0x80a9,getParameter:()=>0})};
  const stage=createBattleStage(renderer);
  t.after(()=>stage.dispose());
  const player={x:0,z:0,oldX:0,oldZ:0};
  const projectPoint=(x,z)=>({x:215+x*40,y:400-z*40});
  let visual=null,completed=false;
  const launch=createFlightLaunch({
    player:()=>player,bounds:()=>({left:-5,right:5,bottom:-10,top:10}),
    clearInput:()=>{},onVisual:value=>{visual=value;},onComplete:()=>{completed=true;},
  });
  function frame(){
    const pose={...projectPoint(player.x,player.z),height:78,scaleY:1,visible:true};
    const sample=sampleBattleFlightTrail({flight:player,projectPoint},pose,visual);
    stage.victory(sample);
    return sample;
  }
  launch.begin();
  launch.update(.08);
  assert.equal(frame(),null);
  launch.reveal();
  for(let i=0;i<8;i++)launch.update(.08);
  const flying=frame();
  assert.ok(flying.head.y<flying.tail.y);
  assert.equal(new Set(flying.segments.map(row=>row.x1)).size,2);
  const layers=stage.scene.children.filter(node=>node.renderOrder===24.65||node.renderOrder===24.7);
  assert.equal(layers.length,2);
  assert.ok(layers.every(node=>node.visible&&node.geometry.drawRange.count>0));
  for(let i=0;i<7;i++)launch.update(.08);
  assert.ok(frame().power<flying.power);
  launch.update(.08);
  assert.equal(completed,true);
  assert.equal(frame(),null);
  assert.ok(layers.every(node=>!node.visible&&node.geometry.drawRange.count===0));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {openWechatBattleSurface} from '../wechat/src/three/battle-surface.js';
import {createWechatDebugLog} from '../wechat/src/three/debug-log.js';
import {prewarmBattleArtwork} from '../wechat/src/three/frame-artwork.js';
import {createBattleUiFrame} from '../../../../../pixigame/replica-battle/battle-ui-frame.js';
import {createNativeBattleRenderBudget} from '../../../../../pixigame/src/replica/native-battle-render-budget.js';
import {flightPoseNeedsRefresh} from '../../../../../pixigame/src/replica/project-flight-visual.js';
import {createPortraitPaintGate} from '../../../../../pixigame/src/ui/portrait-render-budget.js';
import {createBattleGlow} from '../../../../../pixigame/src/three/game-screen/three-battle-glow.js';

const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const {outputFiles:[bundle]}=await build({stdin:{resolveDir:root,contents:[
  "export {NativeBattleView} from './pixigame/src/three/game-screen/three-battle-view.js';",
  "export {floatingText} from './pixigame/src/three/game-screen/three-battle-items.js';",
  "export {createBattleStage} from './pixigame/src/three/game-screen/three-battle-stage.js';",
  "export {createBattleEffectPass} from './pixigame/src/three/game-screen/three-battle-effect.js';",
  "export {openWechatPortraitDecoder,createWechatVideoPortrait} from './packages/wechat/r145-source/pixigame/wechat/src/three/video.js';",
  "export {createHomeHud} from './pixigame/src/three/game-screen/three-home-hud.js';",
].join('\n')},bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',loader:{'.glsl':'text'}});
const mod={exports:{}};
new Function('module','exports',bundle.text)(mod,mod.exports);
const {NativeBattleView,openWechatPortraitDecoder,createWechatVideoPortrait,createHomeHud,floatingText,createBattleStage,createBattleEffectPass}=mod.exports;

function frameClock(){
  let next=1;
  const queue=new Map();
  return {queue,requestFrame(fn){queue.set(next,fn);return next++;},cancelFrame:id=>queue.delete(id),
    step(time){for(const [id,fn] of [...queue]){if(queue.delete(id))fn(time);}}};
}

test('native phone terrain uses a smaller target without scaling hull, HUD coordinates or display',t=>{
  let bounds={width:390,height:844};
  const phone=createNativeBattleRenderBudget({...bounds,pixelRatio:2},20,{phoneTerrainWidth:504});
  const renderer={capabilities:{maxSamples:4},getContext:()=>({getParameter:()=>4}),getRenderTarget:()=>null,
    getViewport:v=>v,getScissor:v=>v,getClearColor:c=>c,getClearAlpha:()=>0,getScissorTest:()=>false,
    setScissor(){},setViewport(){},setScissorTest(){},setClearColor(){},setRenderTarget(){},setPixelRatio(){}};
  const surface=openWechatBattleSurface({three:renderer},{display:{}},{bounds:()=>bounds,enter(){},leave(){}},phone);
  t.after(()=>surface.close());
  const {stage}=surface;
  assert.equal(stage.ground.userData.binding.texture.renderTarget.samples,0);
  assert.equal(stage.ground.material.defines.TERRAIN_MAGNIFICATION,1);
  assert.equal(stage.hull.material.defines.TERRAIN_MAGNIFICATION,undefined);
  const unscaledStage=createBattleStage(renderer);
  t.after(()=>unscaledStage.dispose());
  assert.equal(unscaledStage.ground.material.defines.TERRAIN_MAGNIFICATION,undefined);
  assert.equal(stage.hull.userData.binding.texture.renderTarget.samples,4);
  function sizes(){
    const ground=stage.ground.userData.binding.texture.image,hull=stage.hull.userData.binding.texture.image;
    return [ground.width,ground.height,hull.width,hull.height,stage.viewport.width,stage.viewport.height,stage.glow.outputSize.width,stage.glow.outputSize.height];
  }
  assert.deepEqual(sizes(),[504,1091,256,256,540,1169,720,1559]);
  bounds={width:360,height:640};stage.refreshViewport();
  assert.deepEqual(sizes(),[504,896,256,256,540,960,720,1280]);
  let terrain=0;
  for(let i=0;i<600;i++)if(phone.shouldDrawTerrain(i/60,1,'day',0,i*.01))terrain++;
  assert.equal(terrain,200);
  assert.equal(phone.planTerrain(599/60,1,'day',4,5.99),'immediate');
  assert.equal(phone.planTerrain(599/60,1,'storm',0,5.99),'immediate');
  assert.equal(phone.planTerrain(0,2,'storm',0,0),'immediate');
});

test('native HDR hull composition skips unused depth and MSAA while direct models retain both',t=>{
  let target=null,clears=0;
  const renderer={capabilities:{maxSamples:4},getContext:()=>({getParameter:()=>4}),
    getRenderTarget:()=>target,getViewport:v=>v,getScissor:v=>v,getClearColor:c=>c,
    getClearAlpha:()=>0,getScissorTest:()=>false,setViewport(){},setScissor(){},setScissorTest(){},
    setClearColor(){},setRenderTarget(value){target=value;},clear(){clears++;}};
  const stage=createBattleStage(renderer,{compactGlow:true});t.after(()=>stage.dispose());
  const hull=stage.hull.userData.binding.texture.renderTarget;
  let switches=0;
  hull.addEventListener('dispose',()=>switches++);
  const draw=(samples,depth)=>()=>{
    assert.equal(target,hull);
    assert.equal(hull.samples,samples);
    assert.equal(hull.depthBuffer,depth);
    assert.equal(hull.texture.generateMipmaps,true);
  };
  stage.drawHull(stage.scene,draw(0,false),true);
  stage.drawHull(stage.scene,draw(0,false),true);
  assert.equal(target,null);
  assert.equal(clears,0);
  assert.equal(switches,1);
  stage.drawHull(stage.scene,draw(4,true));
  assert.equal(clears,1);
  assert.equal(switches,2);
});

test('regular HUD paints at 20 Hz while input, phase changes and simulation keep their timing',()=>{
  let time=0,paints=0,steps=0,regular=true;
  const frame=createBattleUiFrame(()=>paints++,{interval:50,now:()=>time,canDefer:()=>regular});
  const simulate=()=>frame.run(()=>{steps++;frame.request();frame.run(()=>frame.request());});
  for(let i=0;i<600;i++){time=i*1000/60;simulate();}
  assert.equal(steps,600);assert.equal(paints,200);
  time+=1;frame.request();assert.equal(paints,201);
  time+=1;simulate();assert.equal(paints,201);
  regular=false;simulate();assert.equal(paints,202);
  regular=true;time+=1;simulate();frame.destroy();time+=100;simulate();assert.equal(paints,202);
});

test('moderate phone pressure keeps terrain and aircraft cadence while glow pressure recovers after stable frames',()=>{
  const changes=[];
  const phone=createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20,{adaptive:true,onPressureChange:p=>changes.push(p)});
  phone.observeFrame(.2);
  for(let i=0;i<100;i++)phone.observeFrame(1/60);
  assert.deepEqual(changes,[]);
  for(let i=0;i<160;i++)phone.observeFrame(1/47);
  assert.deepEqual(changes,[true]);
  let paints=0;
  for(let i=0;i<600;i++)if(phone.shouldDrawTerrain(i/60,1,'day',0,i*.001))paints++;
  assert.equal(paints,200);
  assert.equal(phone.planTerrain(599/60,1,'day',3,0),'immediate');
  assert.equal(phone.planTerrain(599/60,1,'storm',0,0),'immediate');
  assert.equal(phone.shouldDrawAircraft(.043,false,true),true);
  assert.equal(phone.shouldDrawAircraft(.043,true,true),false);
  assert.equal(phone.shouldDrawAircraft(.05,false,false),true);
  assert.equal(phone.shouldDrawAircraft(.034,false,true),true);
  assert.equal(phone.shouldDrawAircraft(.034,false,true,true),false);
  assert.equal(phone.shouldDrawAircraft(.05,true,true,true),true);
  assert.equal(phone.shouldDrawAircraft(.05,false,false,true),false);
  assert.equal(phone.shouldDrawAircraft(1/15,true,false,true),true);
  for(let i=0;i<120;i++)phone.observeFrame(1/60);
  assert.equal(phone.underLoad,true);
  for(let i=0;i<210;i++)phone.observeFrame(1/60);
  assert.deepEqual(changes,[true,false]);
  assert.equal(phone.shouldDrawAircraft(.034,false,false,true),true);
  const desktop=createNativeBattleRenderBudget({width:1280,height:1920,pixelRatio:2},20,{adaptive:true});
  for(let i=0;i<120;i++){phone.observeFrame(.04);desktop.observeFrame(.04);}
  assert.equal(desktop.underLoad,false);
  phone.observeFrame(0);assert.equal(phone.underLoad,false);
});

test('sustained low frame delivery reduces redraws and restores them after recovery',()=>{
  const changes=[];
  const phone=createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20,{
    adaptive:true,phoneTerrainWidth:504,onSustainedLoadChange:limited=>changes.push(limited),
  });
  function frames(fps,seconds){for(let i=0;i<fps*seconds;i++)phone.observeFrame(1/fps);}
  phone.observeFrame(.2);frames(60,2);assert.deepEqual(changes,[]);
  frames(44,2);assert.deepEqual(changes,[]);
  frames(44,1);assert.deepEqual(changes,[true]);
  let paints=0;
  for(let i=0;i<600;i++)if(phone.shouldDrawTerrain(i/60,1,'day',0,i*.001))paints++;
  assert.equal(paints,160);
  assert.equal(phone.terrainWidth,504);
  assert.equal(phone.planTerrain(599/60,1,'day',3,0),'immediate');
  assert.equal(phone.planTerrain(599/60,1,'storm',0,0),'immediate');
  assert.equal(phone.shouldDrawAircraft(.034,false,true),false);
  assert.equal(phone.shouldDrawAircraft(.05,false,true),false);
  assert.equal(phone.shouldDrawAircraft(.064,false,true),true);
  assert.equal(phone.shouldDrawAircraft(.05,false,false,true),false);
  frames(50,6);frames(60,2);assert.deepEqual(changes,[true]);
  frames(60,4);assert.deepEqual(changes,[true,false]);
  paints=0;
  for(let i=600;i<1200;i++)if(phone.shouldDrawTerrain(i/60,1,'day',0,i*.001))paints++;
  assert.equal(paints,200);
  assert.equal(phone.shouldDrawAircraft(.034,false,true),true);
});

test('sustained aircraft pacing keeps the first and last roll poses while coalescing routine motion',()=>{
  const budget=createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20,{adaptive:true});
  for(let i=0;i<130;i++)budget.observeFrame(1/42);
  assert.equal(budget.sustainedLoad,true);
  const moving={bank:.18,pitch:0,thrust:.7,rollActive:false,rollSerial:1};
  const stopped={...moving,bank:0,thrust:0};
  const rolling={...moving,rollActive:true,rollSerial:2};
  const landed={...stopped,rollSerial:2};
  assert.equal(flightPoseNeedsRefresh(moving,stopped),true);
  assert.equal(flightPoseNeedsRefresh(moving,stopped,false),false);
  assert.equal(flightPoseNeedsRefresh(moving,rolling,false),true);
  assert.equal(flightPoseNeedsRefresh(rolling,landed,false),true);
  assert.equal(budget.shouldDrawAircraft(1/17,false,true,false),false);
  assert.equal(budget.shouldDrawAircraft(1/16,false,true,false),true);
  assert.equal(budget.shouldDrawAircraft(1/25,false,true,false,true),false);
  assert.equal(budget.shouldDrawAircraft(1/24,false,true,false,true),true);
});

test('native glow filters completed inputs and preserves the full chain for refraction and sword cuts',t=>{
  let target=null,lastOutput,worldTexture,modes=[],checkChain=true;
  const content={},view={layers:{mask:1}};
  const renderer={setRenderTarget:value=>{target=value;},setViewport(){},setClearColor(){},clear(){},
    render(scene){
      if(scene!==content){
        const u=scene.children[0].material.uniforms;
        if(checkChain)assert.equal(u.uInput.value,lastOutput);
        if(u.uMode.value>=4)assert.equal(u.uScene.value,worldTexture);
        modes.push(u.uMode.value);
      }else worldTexture=target.texture;
      lastOutput=target?.texture;
    }};
  let glow=createBattleGlow(renderer,540,960,4/3);
  const desktop=glow;t.after(()=>desktop.dispose());
  const paint=p=>{modes=[];glow.paint(content,view,null,undefined,false,p);return modes;};
  glow.begin();assert.deepEqual(paint(false),[1,2,2,3,3,4]);
  assert.deepEqual(paint(true),[1,2,3,5]);
  glow.addCut({uid:1,line:[0,0,1,1],shape:[1,1,0,0],style:[1,1,1,1]});
  assert.deepEqual(paint(true),[1,2,2,3,3,4]);
  glow.begin();checkChain=false;glow.needsBackground=true;
  assert.deepEqual(paint(true),[0,1,2,2,3,3,4]);
  glow.begin();checkChain=true;assert.deepEqual(paint(false),[1,2,2,3,3,4]);
  glow=createBattleGlow(renderer,540,960,4/3,true);t.after(()=>glow.dispose());
  glow.begin();assert.deepEqual(paint(false),[1,2,2,3,5]);
  assert.deepEqual(paint(true),[1,2,3,5]);
  glow.addCut({uid:2,line:[0,0,1,1],shape:[1,1,0,0],style:[1,1,1,1]});
  assert.deepEqual(paint(true),[1,2,2,3,3,4]);
  glow.begin();checkChain=false;glow.needsBackground=true;assert.deepEqual(paint(false),[0,1,2,2,3,3,4]);
});

test('sustained native rendering pressure scales the world pass and keeps the full HUD output',t=>{
  const budget=createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20,{adaptive:true});
  let target,stage;
  const outputs=[],views=[];
  const renderer={capabilities:{maxSamples:0},getContext:()=>({getParameter:()=>0}),
    setScissorTest(){},setClearColor(){},clear(){},setViewport(){},setRenderTarget:value=>{target=value;},
    render(scene,camera){if(scene===stage.scene)views.push({mask:camera.layers.mask,width:target?.width,height:target?.height});}};
  stage=createBattleStage(renderer,{compactGlow:true,outputScale:4/3,renderBudget:budget});
  t.after(()=>stage.dispose());
  stage.beginOutput=()=>{outputs.push({...stage.glow.outputSize});renderer.setRenderTarget(null);};
  const hud=stage.makeSprite(stage.white,50);
  stage.render();
  assert.deepEqual(views[0],{mask:3,width:720,height:1280});
  assert.equal(stage.viewport.width,540);
  const texture=hud.material.uniforms.art.value;
  budget.observeFrame(.145);stage.render();
  assert.equal(stage.glow.worldSize.width,720,'one stall leaves quality unchanged');
  for(let i=0;i<120;i++)budget.observeFrame(1/38);
  assert(budget.sustainedLoad);
  views.length=0;stage.render();
  assert.deepEqual(views,[{mask:3,width:540,height:960},{mask:4,width:undefined,height:undefined}]);
  assert.equal(hud.material.uniforms.art.value,texture);
  assert(outputs.every(({width,height})=>width===720&&height===1280));
  for(let i=0;i<360;i++)budget.observeFrame(1/60);
  assert(!budget.sustainedLoad);
  stage.render();
  assert.deepEqual(stage.glow.worldSize,stage.glow.outputSize);
});

test('damage labels batch each string, reuse released buffers and dispose them when the battle closes',()=>{
  let warmed;
  const renderer={capabilities:{maxSamples:0},getContext:()=>({getParameter:()=>0}),
    compile(scene){scene.traverse(node=>{if(node.material?.defines?.GLYPH_RUN)warmed=node.material;});}};
  const stage=createBattleStage(renderer);
  for(const job of stage.warmupJobs())job();
  const atlas={texture:stage.white.texture,width:512,height:256};
  const host={stage,art:new Map([['digits',atlas],['combat-labels',atlas]]),objects:new Map(),active:new Set(),project:(x,z)=>({x,y:z})};
  const layout={fontSize:25,depth:52,scale:1,x:0,y:0,color:'#ff4400',alpha:.8,slant:.2};
  const show=(uid,value,style=layout)=>{floatingText(host,{uid,value,x:90,z:70},style);return host.objects.get('text:'+uid);};
  const label=show(1,'-125'),next=show(2,'+200'),mesh=label.children[0],buffer=mesh.geometry;
  assert.equal(mesh.material,warmed);
  assert.equal(label.children.length,1);assert.equal(buffer.drawRange.count,24);
  assert.notEqual(next.children[0].geometry,buffer);
  const version=buffer.getAttribute('position').version;
  show(1,'-125',{...layout,fontSize:34,alpha:.3});
  assert.equal(mesh.geometry,buffer);assert.equal(buffer.getAttribute('position').version,version);
  assert.equal(mesh.material.uniforms.opacity.value,.3);
  stage.remove(label);
  const reused=show(3,'暴击').children[0];
  assert.equal(reused.geometry,buffer);assert.equal(reused.material,mesh.material);
  assert(reused.id>next.children[0].id);assert.equal(buffer.drawRange.count,12);
  assert(buffer.getAttribute('position').version>version);
  let releases=0;buffer.addEventListener('dispose',()=>releases++);
  stage.remove(host.objects.get('text:3'));assert.equal(releases,0);
  stage.dispose();assert.equal(releases,1);
});

test('a pressured battle groups overlapping digit and status labels in draw order',t=>{
  const budget={underLoad:false},drawn=[],compiled=[];
  let stage,fail=false;
  const renderer={capabilities:{maxSamples:0},getContext:()=>({getParameter:()=>0}),
    setScissorTest(){},setRenderTarget(){},setViewport(){},setClearColor(){},clear(){},
    compile(scene){scene.traverse(node=>{if(node.material?.defines?.GLYPH_BATCH)compiled.push(node);});},
    render(scene,camera){
      if(scene!==stage.scene)return;
      if(fail)throw Error('interrupted world render');
      scene.traverseVisible(node=>{
        if(node.material?.defines?.GLYPH_RUN&&node.layers.test(camera.layers))drawn.push(node);
      });
    }};
  stage=createBattleStage(renderer,{renderBudget:budget});t.after(()=>stage.dispose());
  for(const job of stage.warmupJobs())job();
  assert.equal(compiled.length,1);
  const [batch]=compiled,depth=42;
  const digits={...stage.white,width:512,height:256},words={...digits,texture:digits.texture.clone(),premultiplied:true};
  t.after(()=>words.texture.dispose());
  const host={stage,active:new Set(),objects:new Map(),art:new Map([['digits',digits],['combat-labels',words]]),project:(x,z)=>({x,y:z})};
  const layout={fontSize:25,depth,scale:1.4,x:0,y:0,color:'#ffaa55',alpha:.6,slant:-.24};
  const labels=Array.from({length:8},(_,uid)=>{
    floatingText(host,{uid,value:uid%2?'闪避':'125',x:200,z:350},layout);
    return host.objects.get('text:'+uid).children[0];
  });
  const render=()=>{drawn.length=0;return stage.render(()=>0).labelDrawsSaved;};
  assert.equal(render(),0);assert.deepEqual(drawn,labels);
  budget.underLoad=true;
  // Scene traversal is independent of Three's stable transparent mesh order.
  const first=labels[0];stage.scene.add(first.parent);
  assert.equal(render(),7);assert.deepEqual(drawn,[batch]);
  assert(labels.every(label=>label.visible));assert.equal(batch.visible,false);
  assert.equal(batch.geometry.drawRange.count,(3+2)*4*6);
  const attrib=batch.geometry.getAttribute('position'),data=attrib.data.array;
  assert.deepEqual([data[9],data[3*4*10+9]],[1,0]);
  const m=first.matrixWorld.elements,p=first.geometry.getAttribute('position');
  assert.equal(data[0],Math.fround(m[0]*p.getX(0)+m[4]*p.getY(0)+m[12]));
  assert.equal(data[1],Math.fround(m[1]*p.getX(0)+m[5]*p.getY(0)+m[13]));
  assert.equal(data[8],Math.fround(layout.alpha));
  const barrier=stage.makeSprite(stage.white,depth);
  assert.equal(render(),0);assert.equal(drawn.length,8);stage.remove(barrier);
  first.parent.visible=false;
  assert.equal(render(),0);assert.equal(drawn.length,7);first.parent.visible=true;
  fail=true;assert.throws(render,/interrupted world render/);
  assert(labels.every(label=>label.visible));assert.equal(batch.visible,false);
  fail=false;assert.equal(render(),7);assert.equal(batch.geometry.getAttribute('position'),attrib);
});

test('a shrinking effect uploads the written prefix and keeps pending writes for regrowth',()=>{
  const pass=createBattleEffectPass({},540,960);
  try{
    const main={texture:{isTexture:true},width:1,height:1};
    const source={path:'line',code:'shader_type canvas_item; void fragment() {}'};
    const full=Array.from({length:7},(_,i)=>({position:[i,0],uv:[i/7,0],color:[1,0,0,1]}));
    const submit=(vertices,indices,line=true)=>pass.submit('trail',{source,geometry:{vertices,indices},main,draw:{time:1},line});
    const indices=[0,1,2,2,3,0,4,5,6];
    const mesh=submit(full,indices);
    const {geometry}=mesh,position=geometry.getAttribute('inPosition'),index=geometry.index,tint=geometry.getAttribute('inTint');
    const version=position.version;
    submit(full,indices);assert.equal(position.version,version);
    position.clearUpdateRanges();index.clearUpdateRanges();tint.clearUpdateRanges();
    full[0].position[0]=.25;
    submit(full.slice(0,3),[1,0,2]);
    assert.deepEqual(position.updateRanges,[{start:0,count:6}]);
    assert.deepEqual(index.updateRanges,[{start:0,count:3}]);
    full[6].position[0]=9;full[6].color=[0,1,0,1];
    submit(full,[0,1,2,2,3,0,4,5,6]);
    full[0].position[0]=.5;
    submit(full.slice(0,3),[1,0,2]);
    assert.deepEqual(position.updateRanges,[{start:0,count:14}]);
    assert.deepEqual(index.updateRanges,[{start:0,count:9}]);
    assert.deepEqual(tint.updateRanges,[{start:0,count:28}]);
    submit(full.slice(0,3),[1,0,2],false);
    assert.deepEqual(tint.updateRanges,[{start:0,count:32}]);
    assert(tint.array.every(byte=>byte===255));
  }finally{pass.dispose();}
});

test('a returning trail reuses its larger mesh buffers and oversized meshes are released',t=>{
  const pass=createBattleEffectPass({},540,960);t.after(()=>pass.dispose());
  const main={texture:{isTexture:true},width:1,height:1};
  const source={path:'trail',code:'shader_type canvas_item; void fragment() {}'};
  const submit=(id,count)=>{
    const vertices=Array.from({length:count},(_,i)=>({position:[i,0],uv:[0,0],color:[1,1,1,1]}));
    return pass.submit(id,{source,geometry:{vertices,indices:[0,1,2]},main,draw:{time:1},line:true});
  };
  pass.begin();
  const trail=submit('first',128),position=trail.geometry.getAttribute('inPosition');
  pass.begin();pass.finish();
  assert.equal(pass.scene.children.length,0);
  const reused=submit('second',128);
  assert.equal(reused,trail);
  assert.equal(reused.geometry.getAttribute('inPosition'),position);
  const giant=submit('giant',4096);
  let released=0;giant.geometry.addEventListener('dispose',()=>released++);
  pass.begin();pass.finish();
  assert.equal(released,1);
});

test('a changing regular HUD interval always lets critical and direct input updates through',()=>{
  let at=0,interval=50,critical=false,draws=0;
  const ui=createBattleUiFrame(()=>draws++,{interval:()=>interval,now:()=>at,canDefer:()=>!critical});
  const tick=ms=>{at=ms;ui.run(ui.request);};
  tick(0);interval=75;tick(51);assert.equal(draws,1);tick(75);assert.equal(draws,2);
  critical=true;tick(76);assert.equal(draws,3);critical=false;
  at=77;ui.request();assert.equal(draws,4);
  interval=50;tick(127);assert.equal(draws,5);ui.destroy();
});

test('a suspended battle drops pending frames, resumes without a catch-up and releases its observer',async()=>{
  const clock=frameClock(),deltas=[];
  let visible=true,time=100,listener,finishLoad;
  const loaded=new Promise(resolve=>{finishLoad=resolve;});
  const view={preload:()=>loaded,paintFrame:fn=>fn(),update:dt=>deltas.push(dt),stage:{remove(){}},fx:{destroy(){}},art:{dispose(){}},objects:new Map()};
  const close=NativeBattleView.prototype.start.call(view,()=>{},()=>{},assert.fail,{...clock,now:()=>time,isVisible:()=>visible,
    watchVisibility:fn=>{listener=fn;return ()=>{listener=null;};}});
  visible=false;listener();finishLoad();await loaded;await Promise.resolve();
  assert.equal(clock.queue.size,0);
  visible=true;time=5000;listener();time+=16;clock.step(time);
  const stale=[...clock.queue.values()][0];assert.deepEqual(deltas,[16]);
  visible=false;listener();assert.equal(clock.queue.size,0);
  visible=true;time=905000;listener();stale(time);assert.equal(clock.queue.size,1);
  time+=17;clock.step(time);assert.deepEqual(deltas,[16,17]);
  close();assert.equal(listener,null);assert.equal(clock.queue.size,0);
});

test('battle callback timing attributes the wait to the previous delivered frame and resets on resume',async t=>{
  const clock=frameClock(),samples=[];
  let now=0,visible=true,watch;
  const view={profileClock:()=>now,preload:async()=>{},paintFrame:fn=>fn(),update(dt){
    samples.push({dt,delivery:this.frameDelivery&&{...this.frameDelivery}});now+=20;
  },sim:{phase:'playing'},stage:{remove(){}},fx:{destroy(){}},art:{dispose(){}},objects:new Map()};
  const frame=()=>{now+=5;};
  t.after(NativeBattleView.prototype.start.call(view,()=>{},frame,assert.fail,{...clock,now:()=>now,
    isVisible:()=>visible,watchVisibility:fn=>{watch=fn;return ()=>{};}}));
  await Promise.resolve();
  clock.step(now=16);clock.step(now=161);
  assert.deepEqual(samples,[{dt:16,delivery:undefined},
    {dt:145,delivery:{callbackMs:25,afterPaintMs:5,waitMs:120}}]);
  visible=false;watch();now=2500;visible=true;watch();clock.step(now=2517);
  assert.deepEqual(samples.at(-1),{dt:17,delivery:undefined});
});

test('optional battle uploads share the paint callback and wait through busy frames',t=>{
  const clock=frameClock();
  const warm=prewarmBattleArtwork({...clock,visible:true,renderer:{getContext:()=>({isContextLost:()=>false})}});
  t.after(warm.close);
  const jobs=[];
  warm.push(()=>jobs.push('loading'));
  assert.equal(clock.queue.size,1);
  warm.reset();
  warm.push(()=>jobs.push('boss'));
  warm.push(()=>jobs.push('result'));
  assert.equal(clock.queue.size,0);
  warm.afterPaint(16,8,true);
  warm.afterPaint(70,8,true);
  warm.afterPaint(16,14,true);
  warm.afterPaint(16,7,true);
  warm.afterPaint(16,8,true);
  assert.deepEqual(jobs,[]);
  warm.afterPaint(16,9,true);
  assert.deepEqual(jobs,['boss']);
  warm.afterPaint(33,10,false);
  assert.deepEqual(jobs,['boss','result']);
  assert.equal(clock.queue.size,0);
});

test('deferred battle art and boss warmup wait for the first active battle frame',async t=>{
  const clock=frameClock(),events=[];
  const queued=[];
  const warmTextures={
    add(){},push(job){queued.push(job);},reset(){queued.length=0;},close(){queued.length=0;},
  };
  const view={sim:{phase:'ready'},preload:async()=>()=>events.push('deferred art'),
    paintFrame:fn=>fn(),update(){events.push(this.sim.phase);},
    warmBossArtwork:()=>events.push('boss art'),
    stage:{warmupJobs:()=>[],remove(){}},fx:{destroy(){}},art:{dispose(){}},objects:new Map()};
  t.after(NativeBattleView.prototype.start.call(view,()=>{},()=>events.push('presented'),assert.fail,
    {...clock,warmTextures,now:()=>0}));
  await Promise.resolve();
  clock.step(16);
  assert.deepEqual(events,['ready','presented']);
  assert.equal(queued.length,0);
  view.sim.phase='playing';
  clock.step(32);
  assert.deepEqual(events.slice(2),['playing','presented','deferred art']);
  assert.equal(queued.length,1);
  queued.shift()();
  clock.step(48);
  assert.deepEqual(events.slice(5),['boss art','playing','presented']);
  assert.equal(queued.length,0);
});

test('a visible sortie presents every host frame even when its aircraft and terrain use lower update rates',async t=>{
  const clock=frameClock(),budget=createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20,{adaptive:true});
  let now=0,painted=0,presented=0,ground=0,underPressure=0;
  const view={preload:async()=>{},paintFrame:fn=>fn(),update(dt){
    painted++;budget.observeFrame(dt/1000);if(budget.underLoad)underPressure++;
    if(budget.shouldDrawTerrain(now/1000,1,'day',0,now*.0001))ground++;
  },stage:{remove(){}},fx:{destroy(){}},art:{dispose(){}},objects:new Map()};
  t.after(NativeBattleView.prototype.start.call(view,()=>{},()=>presented++,assert.fail,{...clock,now:()=>now}));
  await Promise.resolve();
  for(let i=0;i<600;i++){now+=1000/(i<90?30:60);clock.step(now);}
  assert.deepEqual([painted,presented],[600,600]);assert(ground<painted);
  assert(underPressure>0);assert.equal(budget.underLoad,false);
});

test('30 fps portraits consume only 30 decoder frames per second on a 120 Hz display',async t=>{
  const clock=frameClock(),buffer=new ArrayBuffer(4);
  let reads=0,frames=0;
  const api={createVideoDecoder:()=>({on(){},start(){},seek(){},stop(){},remove(){},
    getFrameData(){reads++;return {data:buffer,width:1,height:1,pkPts:reads*1000/30};}})};
  const player=openWechatPortraitDecoder(api,clock,{localFile:async path=>path},bytes=>{
    assert.equal(bytes.buffer,buffer);frames++;
  },()=>{},assert.fail,30);
  t.after(()=>player.close());
  await player.play('idle.mp4');const meshGate=createPortraitPaintGate(30);
  let meshFrames=0;
  for(let i=0;i<120;i++){const time=i*1000/120;clock.step(time);if(meshGate(time))meshFrames++;}
  assert.deepEqual([reads,frames,meshFrames],[30,30,30]);
  player.pause();clock.step(1000);assert.equal(reads,30);
  await player.play('feedback.mp4',0);clock.step(1001);assert.equal(frames,31);
});

test('a static home HUD only requests chest motion, the final resting pose and active guides',async t=>{
  const hud=await createHomeHud(async url=>({url,width:256,height:256}),{chapter:0},()=>{});
  t.after(()=>hud.dispose());
  assert.equal(hud.animationDue(3,3.1),false);
  assert.equal(hud.animationDue(.1,.3),true);
  assert.equal(hud.animationDue(1.1,1.3),true);
  assert.equal(hud.animationDue(1.3,1.4),false);
  hud.setGuide({id:'nav-assembly'});assert.equal(hud.animationDue(3,3.1),true);
  hud.setGuide(null);assert.equal(hud.animationDue(3,3.1),false);
});

test('portrait buffer errors resume the same motion on a smaller clip and keep that size across visits',async t=>{
  t.mock.method(console,'info',()=>{});
  for(const failedStage of ['start','seek','frame']){
    const clock=frameClock(),starts=[],seeks=[],events=[];
    let failNext=false,frameDraws=0,ended;
    const failure=new Error('errMsg: insertNativeArrayBuffer failed');
    function check(stage){if(failNext&&stage===failedStage){failNext=false;throw failure;}}
    const api={createVideoDecoder:()=>{
      let compact;
      return {on(event,fn){if(event==='ended')ended=fn;},start({source}){starts.push(source);events.push('start');
        compact=source.endsWith('.compact.mp4');check('start');},seek(time){seeks.push(time);check('seek');},stop(){},
        remove(){events.push('remove');},getFrameData(){check('frame');
          const width=compact?4:8,height=compact?2:4;
          return {width,height,data:new Uint8Array(width*height*4),pkPts:800};
        }};
    }};
    const manifest={width:8,packedWidth:16,height:8,fps:30,clips:{
      idle:{file:'idle.mp4',loop:true,startFrame:3},touch_head:{file:'touch.mp4',returnToIdleFrame:6}}};
    const services={localFile:async path=>path,fetchResource:async()=>({ok:true,json:async()=>manifest})};
    const host={...clock,baseURL:'https://game.test/',hidden:()=>false,makeAbort:()=>new AbortController(),
      bounds:()=>({width:40,height:50}),renderSize:(w,h)=>[w,h],watchBounds:()=>()=>{},watchVisibility:()=>()=>{},
      render:model=>({resize(){},draw(){frameDraws++;},destroy(){model.dispose();}})};
    const open=id=>createWechatVideoPortrait(api,services,{three:{}},host,id);
    const drain=()=>new Promise(setImmediate);
    const player=open('pilot-08');
    await player.attach();await drain();clock.step(0);
    assert.equal(frameDraws,1);
    if(failedStage!=='frame')player.setVisible(false);
    await drain();failNext=true;
    if(failedStage==='frame')clock.step(35);else player.setVisible(true);
    await drain();
    assert.equal(player.playing,true);
    assert(starts.at(-1).endsWith('/idle.compact.mp4'));
    assert.equal(seeks.at(-1),800);
    assert.deepEqual(events.slice(-2),['remove','start']);
    clock.step(75);assert.equal(frameDraws,2);
    await player.playMotion('touch_head',{returnToIdle:true});await drain();
    assert(starts.at(-1).endsWith('/touch.compact.mp4'));ended();await drain();
    assert(starts.at(-1).endsWith('/idle.compact.mp4'));assert.equal(seeks.at(-1),200);
    player.destroy();await drain();
    const next=open('pilot-08');await next.attach();await drain();assert(starts.at(-1).endsWith('/idle.compact.mp4'));next.destroy();
    const other=open('pilot-02');await other.attach();await drain();assert(starts.at(-1).endsWith('/idle.mp4'));other.destroy();
    await drain();assert.equal(clock.queue.size,0);
  }
});

test('a failing compact clip stops after one fallback, and a closed portrait cannot restart',async t=>{
  let destroyed=0,starts=0,unblock;
  const warnings=[];t.mock.method(console,'info',()=>{});t.mock.method(console,'warn',(...args)=>warnings.push(args));
  const clock=frameClock(),error={errMsg:'insertNativeArrayBuffer failed'};
  const api={createVideoDecoder:()=>({on(){},start(){starts++;throw error;},remove(){}})};
  const host={...clock,baseURL:'https://game.test/',hidden:()=>false,makeAbort:()=>new AbortController(),
    bounds:()=>({width:1,height:1}),renderSize:()=>[1,1],watchBounds:()=>()=>{},watchVisibility:()=>()=>{},
    render:model=>({resize(){},destroy(){destroyed++;model.dispose();}})};
  const services={fetchResource:async()=>({ok:true,json:async()=>({packedWidth:16,height:8,width:8,fps:30,clips:{idle:{file:'idle.mp4'}}})}),
    localFile:async path=>path};
  let view=createWechatVideoPortrait(api,services,{three:{}},host,'pilot-02');
  await view.attach();await new Promise(setImmediate);
  assert.equal(starts,2);assert.equal(view.playing,false);assert.equal(warnings.length,1);assert.equal(destroyed,1);
  view.destroy();
  services.localFile=path=>path.endsWith('.compact.mp4')?new Promise(resolve=>{unblock=()=>resolve(path);}):Promise.resolve(path);
  view=createWechatVideoPortrait(api,services,{three:{}},host,'pilot-08');
  await view.attach();await new Promise(setImmediate);assert.equal(starts,3);
  view.destroy();unblock();await new Promise(setImmediate);assert.equal(starts,3);assert.equal(clock.queue.size,0);
});

test('five-second render diagnostics report actual pixels and reset terrain CPU counters',t=>{
  const logs=[];t.mock.method(console,'info',()=>{});
  const debug=createWechatDebugLog({getDeviceInfo:()=>({platform:'ios'}),
    getAppBaseInfo:()=>({enableDebug:true}),getLogManager:()=>({info:message=>logs.push(message)})},'test');
  let renderPixels={terrain:[504,1091],output:[720,1559],terrainSamples:0};
  const counts={terrain:10,aircraft:20,hud:30};
  let memoryReads=0;
  const battle=debug.beginBattle(1,counts,()=>renderPixels,()=>({
    heapMiB:null,resources:{textures:++memoryReads, cachedArtworkRgbaMiB:1.5},
  }));
  const last=()=>JSON.parse(logs.at(-1).slice(logs.at(-1).indexOf('{')));
  assert(logs.at(-1).includes('战斗渲染配置'));
  assert.deepEqual(last(),{buildId:'test',chapter:1,renderPixels});
  counts.hud+=50;battle.sample(20,1,{terrainDrawCpuMs:99,labelDrawsSaved:99});battle.reset();
  assert.equal(memoryReads,0);
  for(let i=0;i<100;i++){
    counts.terrain++;counts.hud++;battle.sample(50,1,{terrainDrawCpuMs:i%2?.4:.2,labelDrawsSaved:i%2?11:0});
  }
  assert.deepEqual(last().renderPixels,renderPixels);
  assert.deepEqual(last().visualHz,{terrain:20,aircraft:0,hud:20});
  assert.deepEqual(last().terrainDrawCpu,{count:100,meanMs:.3,maxMs:.4});
  assert.deepEqual(last().labelBatch,{frames:50,drawsSaved:550});
  assert.deepEqual(last().memory,{heapMiB:null,resources:{textures:1,cachedArtworkRgbaMiB:1.5}});
  assert.equal(memoryReads,1);
  assert.equal(last().frameBeforeMaxGap,undefined);
  renderPixels={terrain:[504,896],output:[720,1280],terrainSamples:0};
  battle.sample(5000,2,{});
  assert.deepEqual(last().renderPixels,renderPixels);
  assert.deepEqual(last().visualHz,{terrain:0,aircraft:0,hud:0});
  assert.equal(last().terrainDrawCpu,undefined);
  assert.equal(last().labelBatch,undefined);
  assert.equal(memoryReads,2);
});

test('sortie average counts active intervals across windows and reports the partial final window once',t=>{
  const logs=[];t.mock.method(console,'info',message=>logs.push(message));
  const battle=createWechatDebugLog({getDeviceInfo:()=>({platform:'devtools'})},'test').beginBattle(1);
  battle.sample(3000,1,{},4);
  for(let i=0;i<250;i++)battle.sample(20,1,{},4);
  battle.reset();
  battle.sample(2000,2,{},4);
  for(let i=0;i<25;i++)battle.sample(40,2,{},4);
  battle.finish(4);battle.finish(4);
  const summaries=()=>logs.filter(line=>line.includes('战斗平均帧率')).map(line=>JSON.parse(line.slice(line.indexOf('{'))));
  assert.deepEqual(summaries(),[{chapter:1,run:4,activeFrames:275,activeMs:6000,avgFps:45.8,targetFps:50}]);
  battle.sample(500,1,{},5);battle.sample(20,1,{},5);battle.finish(5);
  assert.equal(summaries()[1].avgFps,50);assert.equal(summaries()[1].activeMs,20);
});

test('sustained 46 fps engages mobile glow relief and single frame spikes do not',()=>{
  const budget=createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20,{adaptive:true});
  budget.observeFrame(.095);
  for(let i=0;i<90;i++)budget.observeFrame(1/60);
  assert.equal(budget.underLoad,false);
  for(let i=0;i<150;i++)budget.observeFrame(1/46);
  assert.equal(budget.underLoad,true);
  for(let i=0;i<300;i++)budget.observeFrame(1/52);
  assert.equal(budget.underLoad,true);
  for(let i=0;i<360;i++)budget.observeFrame(1/60);
  assert.equal(budget.underLoad,false);
});

test('the two wingtip lights keep their buffers across movement and invisibility',t=>{
  const renderer={capabilities:{maxSamples:4},getContext:()=>({getParameter:()=>4})};
  const stage=createBattleStage(renderer);t.after(()=>stage.dispose());
  const lamp=stage.scene.children.find(n=>n.renderOrder===25.05);
  const options={visible:true,clock:1,width:80,thrust:1,rollActive:false};
  stage.wings([],[{x:80,y:340},{x:140,y:340}],options);
  const position=lamp.geometry.getAttribute('position'),color=lamp.geometry.getAttribute('color');
  const initial=[position.version,color.version],gain=lamp.material.uniforms.tipIntensity.value.clone();
  assert(lamp.visible);assert.equal(position.getZ(0),0);assert.equal(position.getZ(lamp.count-1),1);
  stage.wings([],[],{...options,visible:false});assert.equal(lamp.visible,false);
  stage.wings([],[{x:90,y:350},{x:151,y:353}],{...options,clock:2,thrust:.4});
  assert.equal(lamp.visible,true);
  assert.deepEqual([position.version,color.version],initial);
  assert.deepEqual(lamp.material.uniforms.tipPositions.value.toArray(),[90,350,151,353]);
  assert(!lamp.material.uniforms.tipIntensity.value.equals(gain));
  stage.wings([],[{x:90,y:350},{x:151,y:353}],{...options,width:120});
  assert(position.version>initial[0]);
});

test('a battle gap uses the preceding frame even across sample windows and accounts for time outside the update',t=>{
  const logs=[];t.mock.method(console,'info',message=>logs.push(message));
  const debug=createWechatDebugLog({getDeviceInfo:()=>({platform:'devtools'})},'test');
  const battle=debug.beginBattle(1);
  const frame={logic:2,terrainAndPlane:9,entitiesAndEffects:6,draw:3,worldDraw:2,uiDraw:1,
    terrainMs:5,aircraftMs:3,enemiesMs:2,projectilesMs:3,pickupsAndEffectsMs:1,
    pickupMs:0,statusAndEffectsMs:1,effectCleanupMs:0,textEffects:4};
  for(let i=0;i<250;i++)battle.sample(20,1,frame);
  const other={...frame,terrainMs:0,aircraftMs:0,statusAndEffectsMs:0,textEffects:0};
  const delivery={callbackMs:26,afterPaintMs:4,waitMs:74};
  battle.sample(100,2,other,undefined,delivery);
  Object.assign(delivery,{callbackMs:13,afterPaintMs:1,waitMs:7});
  for(let i=0;i<245;i++)battle.sample(20,2,other,undefined,delivery);
  const item=JSON.parse(logs.at(-1).slice(logs.at(-1).indexOf('{')));
  assert.equal(item.maxGapMs,100);
  assert.equal(item.frameDelivery.count,246);assert.equal(item.frameDelivery.waitOver50ms,1);
  assert.deepEqual(item.frameDelivery.beforeMaxGap,{callbackMs:26,afterPaintMs:4,waitMs:74});
  assert.deepEqual(item.frameBeforeMaxGap,{wave:1,...frame,outsideUpdateMs:80});
});

test('result diagnostics separate the departure, first presented panel, receipt and missing images',t=>{
  let now=0;const logs=[];
  t.mock.method(console,'info',line=>logs.push(line));
  assert.equal(createWechatDebugLog({getDeviceInfo:()=>({platform:'ios'})},'test'),null);
  const trace=createWechatDebugLog({getDeviceInfo:()=>({platform:'devtools'})},'test').beginResult(2,()=>now);
  const texture={userData:{artworkUrl:'https://assets.test/art/rewards/icon.png?token=private'}};
  const panel={motion:{ready:false},resultSnapshot:{pending:true,rewards:[]},resultTextures:new Set([texture])};
  trace.departure(1);now=1300;trace.start(1,'won');
  now+=16;trace.painted(panel);trace.painted(panel);
  now+=2;trace.receipt(1,'won');panel.resultSnapshot.pending=false;panel.motion.ready=true;
  now+=2000;trace.painted(panel);trace.painted(panel);
  texture.userData.artworkFailed=true;now+=15;trace.painted(panel);trace.close();
  const events=logs.slice(1).map(line=>[line.slice(0,line.indexOf('{')).trim(),JSON.parse(line.slice(line.indexOf('{')))]);
  assert.deepEqual(events.map(([name])=>name),['[Three 调试] 结算首帧','[Three 调试] 结算仍在等待','[Three 调试] 结算就绪']);
  assert.equal(events[0][1].departureMs,1300);assert.equal(events[0][1].firstPaintMs,16);
  assert.equal(events[2][1].receiptMs,18);assert.equal(events[2][1].failed,1);
  assert.deepEqual(events[2][1].failedAssets,['rewards/icon.png']);assert(!logs.join('').includes('private'));
  trace.start(2,'lost');trace.close();assert(logs.at(-1).includes('结算离开'));
});

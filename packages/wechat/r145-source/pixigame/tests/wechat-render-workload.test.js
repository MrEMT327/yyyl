import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {openWechatBattleSurface} from '../wechat/src/three/battle-surface.js';
import {createWechatDebugLog} from '../wechat/src/three/debug-log.js';
import {createBattleUiFrame} from '../../../../../pixigame/replica-battle/battle-ui-frame.js';
import {createNativeBattleRenderBudget} from '../../../../../pixigame/src/replica/native-battle-render-budget.js';
import {createPortraitPaintGate} from '../../../../../pixigame/src/ui/portrait-render-budget.js';
import {createBattleGlow} from '../../../../../pixigame/src/three/game-screen/three-battle-glow.js';

const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const {outputFiles:[bundle]}=await build({stdin:{resolveDir:root,contents:[
  "export {NativeBattleView} from './pixigame/src/three/game-screen/three-battle-view.js';",
  "export {openWechatPortraitDecoder,createWechatVideoPortrait} from './packages/wechat/r145-source/pixigame/wechat/src/three/video.js';",
  "export {createHomeHud} from './pixigame/src/three/game-screen/three-home-hud.js';",
].join('\n')},bundle:true,write:false,platform:'node',format:'cjs',logLevel:'silent',loader:{'.glsl':'text'}});
const mod={exports:{}};
new Function('module','exports',bundle.text)(mod,mod.exports);
const {NativeBattleView,openWechatPortraitDecoder,createWechatVideoPortrait,createHomeHud}=mod.exports;

function frameClock(){
  let next=1;
  const queue=new Map();
  return {queue,requestFrame(fn){queue.set(next,fn);return next++;},cancelFrame:id=>queue.delete(id),
    step(time){for(const [id,fn] of [...queue]){if(queue.delete(id))fn(time);}}};
}

test('native phone terrain uses a smaller target without scaling hull, HUD coordinates or display',t=>{
  let bounds={width:390,height:844};
  const phone=createNativeBattleRenderBudget({...bounds,pixelRatio:2},20);
  const renderer={capabilities:{maxSamples:0},getContext:()=>({getParameter:()=>0}),getRenderTarget:()=>null,
    getViewport:v=>v,getScissor:v=>v,getClearColor:c=>c,getClearAlpha:()=>0,getScissorTest:()=>false,
    setScissor(){},setViewport(){},setScissorTest(){},setClearColor(){},setRenderTarget(){},setPixelRatio(){}};
  const surface=openWechatBattleSurface({three:renderer},{display:{}},{bounds:()=>bounds,enter(){},leave(){}},phone);
  t.after(()=>surface.close());
  const {stage}=surface;
  function sizes(){
    const ground=stage.ground.userData.binding.texture.image,hull=stage.hull.userData.binding.texture.image;
    return [ground.width,ground.height,hull.width,hull.height,stage.viewport.width,stage.viewport.height,stage.glow.outputSize.width,stage.glow.outputSize.height];
  }
  assert.deepEqual(sizes(),[450,974,256,256,540,1169,720,1559]);
  bounds={width:360,height:640};stage.refreshViewport();
  assert.deepEqual(sizes(),[450,800,256,256,540,960,720,1280]);
  let terrain=0;
  for(let i=0;i<600;i++)if(phone.shouldDrawTerrain(i/60,1,'day',0,i*.01))terrain++;
  assert.equal(terrain,200);
  assert.equal(phone.planTerrain(599/60,1,'day',4,5.99),'immediate');
  assert.equal(phone.planTerrain(599/60,1,'storm',0,5.99),'immediate');
  assert.equal(phone.planTerrain(0,2,'storm',0,0),'immediate');
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

test('sustained phone load reduces cached draws and recovers only after stable display frames',()=>{
  const changes=[];
  const phone=createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20,{adaptive:true,onPressureChange:p=>changes.push(p)});
  phone.observeFrame(.2);
  for(let i=0;i<100;i++)phone.observeFrame(1/60);
  assert.deepEqual(changes,[]);
  for(let i=0;i<100;i++)phone.observeFrame(1/30);
  assert.deepEqual(changes,[true]);
  let paints=0;
  for(let i=0;i<600;i++)if(phone.shouldDrawTerrain(i/60,1,'day',0,i*.001))paints++;
  assert.equal(paints,150);
  assert.equal(phone.planTerrain(599/60,1,'day',3,0),'immediate');
  assert.equal(phone.planTerrain(599/60,1,'storm',0,0),'immediate');
  assert.equal(phone.shouldDrawAircraft(.043,false,true),true);
  assert.equal(phone.shouldDrawAircraft(.043,true,true),false);
  assert.equal(phone.shouldDrawAircraft(.05,false,false),false);
  for(let i=0;i<120;i++)phone.observeFrame(1/60);
  assert.equal(phone.underLoad,true);
  for(let i=0;i<210;i++)phone.observeFrame(1/60);
  assert.deepEqual(changes,[true,false]);
  const desktop=createNativeBattleRenderBudget({width:1280,height:1920,pixelRatio:2},20,{adaptive:true});
  for(let i=0;i<120;i++){phone.observeFrame(.04);desktop.observeFrame(.04);}
  assert.equal(desktop.underLoad,false);
  phone.observeFrame(0);assert.equal(phone.underLoad,false);
});

test('pressure drops two glow passes while every displayed pass reads its completed input',t=>{
  let target=null,lastOutput,modes=[],checkChain=true;
  const content={},view={layers:{mask:1}};
  const renderer={setRenderTarget:value=>{target=value;},setViewport(){},setClearColor(){},clear(){},
    render(scene){
      if(scene!==content){
        const u=scene.children[0].material.uniforms;
        if(checkChain)assert.equal(u.uInput.value,lastOutput);
        modes.push(u.uMode.value);
      }
      lastOutput=target?.texture;
    }};
  const glow=createBattleGlow(renderer,540,960,4/3);t.after(()=>glow.dispose());
  const paint=p=>{modes=[];glow.paint(content,view,null,undefined,false,p);return modes;};
  glow.begin();assert.deepEqual(paint(false),[1,2,2,3,3,4]);
  assert.deepEqual(paint(true),[1,2,3,4]);
  glow.addCut({uid:1,line:[0,0,1,1],shape:[1,1,0,0],style:[1,1,1,1]});
  assert.deepEqual(paint(true),[1,2,2,3,3,4]);
  glow.begin();checkChain=false;glow.needsBackground=true;
  assert.deepEqual(paint(true),[0,1,2,2,3,3,4]);
  glow.begin();checkChain=true;assert.deepEqual(paint(false),[1,2,2,3,3,4]);
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

test('five-second rendering counters omit paused work and restart at each window',t=>{
  const logs=[];t.mock.method(console,'info',message=>logs.push(message));
  const debug=createWechatDebugLog({getDeviceInfo:()=>({platform:'devtools'})},'test');
  const counts={terrain:10,aircraft:20,hud:30},battle=debug.beginBattle(1,counts);
  counts.hud+=50;battle.reset();
  for(let i=0;i<100;i++){counts.terrain++;counts.hud++;battle.sample(50,1,{});}
  const last=()=>JSON.parse(logs.at(-1).slice(logs.at(-1).indexOf('{')));
  assert.deepEqual(last().visualHz,{terrain:20,aircraft:0,hud:20});
  battle.sample(5000,2,{});
  assert.deepEqual(last().visualHz,{terrain:0,aircraft:0,hud:0});
});

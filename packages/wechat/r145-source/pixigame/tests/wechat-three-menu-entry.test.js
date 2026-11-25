import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {PORTRAIT_FRAMING} from '../../../../../pixigame/src/ui/portrait-framing.js';
import {pilotSupplySnapshot} from '../../../../../pixigame/src/replica/pilot-supply.js';
import {createWechatDebugLog} from '../wechat/src/three/debug-log.js';
import {retireNativeVideo} from '../wechat/src/full/video-player.js';
import talentCatalog from '../../../../../pixigame/src/replica/native-research-source.json' with {type:'json'};
import economyCatalog from '../../../../../pixigame/src/replica/native-economy-catalog.json' with {type:'json'};

const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const {outputFiles:[bundle]}=await build({
  stdin:{resolveDir:root,contents:`
    export {mountWechatMenu} from './packages/wechat/r145-source/pixigame/wechat/src/three/menu-surface.js';
    export {showWechatStartup} from './packages/wechat/r145-source/pixigame/wechat/src/three/startup.js';
    export {createSortieController} from './pixigame/src/replica/sortie-controller.js';
    export {startLobbySession} from './pixigame/src/lobby-runtime/host-session.js';
    export {createReplicaConfiguration} from './pixigame/src/replica/loadout-contract.js';
    export {createReplicaProgression} from './pixigame/src/replica/native-progression.js';
    export {mountWechatLobby} from './packages/wechat/r145-source/pixigame/wechat/src/three/lobby.js';
    export {createWechatPortraits} from './packages/wechat/r145-source/pixigame/wechat/src/three/portraits.js';
    export {createWechatPanelInput} from './packages/wechat/r145-source/pixigame/wechat/src/three/panel-input.js';
    export {createMenuArtworkWarmup} from './packages/wechat/r145-source/pixigame/wechat/src/three/frame-artwork.js';
    export {createLobbyPanel} from './pixigame/src/three/game-screen/lobby-panel.js';
    export {createHomeHud} from './pixigame/src/three/game-screen/three-home-hud.js';
    export {createLobbyFeedback} from './pixigame/src/three/game-screen/lobby-feedback.js';
    export {createHomeStage,homePictures} from './pixigame/src/three/game-screen/home-stage.js';
    export {homeControls,createHomePointer} from './pixigame/src/three/game-screen/home-input.js';
    export {homePresentation} from './pixigame/src/three/game-screen/home-state.js';
    export {homePortraitSize} from './pixigame/src/three/game-screen/home-view.js';
    export {default as homeArt} from './pixigame/src/three/game-screen/home-art.json';
    export {paintLobbyPaper,paintSecondaryPaper} from './pixigame/src/three/game-screen/panel-paper.js';
    export {openChapterPanel} from './pixigame/src/three/game-screen/chapter-panel.js';
    export {lobbyPanels} from './pixigame/src/three/game-screen/lobby-panels.js';
    export {createThreeLobbyController} from './pixigame/src/ui/three-lobby-controller.js';
    export {createPeripheralSystem} from './pixigame/src/peripheral/system.js';
    export {createInitialGachaState} from './pixigame/src/gacha-engine.js';
    export {openTaskPanel} from './pixigame/src/three/game-screen/task-panel.js';
    export {taskReward} from './pixigame/src/three/game-screen/task-model.js';
    export {flightRewardsSnapshot} from './pixigame/src/replica/flight-rewards.js';
    export {openCarnivalPanel} from './pixigame/src/three/game-screen/carnival-panel.js';
    export {openRecruitResults} from './pixigame/src/three/game-screen/recruit-results.js';
    export {DRAW_GATE_ART} from './pixigame/src/ui/draw-gate.js';
    export {createArtworkLoader,useArtworkLoader} from './pixigame/src/three/game-screen/image-loading.js';
    export {openWechatPortraitDecoder} from './packages/wechat/r145-source/pixigame/wechat/src/three/video.js';
    export {art,qualityFrame} from './pixigame/src/three/game-screen/menu-art.js';
    export {atlas} from './pixigame/src/three/game-screen/catalog-art.js';
    export {catalogPortrait} from './pixigame/src/three/game-screen/catalog-portrait.js';
    export {PILOT_PORTRAITS} from './pixigame/src/ui/character-portraits.js';
    export {researchArt,researchCardQuality} from './pixigame/src/ui/research-art.js';
    export {nativeCollectionArt,nativeLabArt} from './pixigame/src/replica/native-collection-art.js';
    export {projectIconUrl} from './pixigame/src/ui/project-ui-art.js';
    export {optimizeUiAssetUrls} from './pixigame/src/ui/ui-image-source.js';
  `},
  bundle:true,write:false,format:'cjs',loader:{'.glsl':'text'},logLevel:'silent',
  define:{'import.meta.env':'{"BASE_URL":"/","DEV":false,"PROD":true}','import.meta.url':'"https://example.invalid/game.js"'},
});
const mod={exports:{}};
new Function('module','exports',bundle.text)(mod,mod.exports);
const {mountWechatMenu,showWechatStartup,mountWechatLobby,createSortieController,startLobbySession,createReplicaConfiguration,createReplicaProgression,createWechatPortraits,createWechatPanelInput,createArtworkLoader,useArtworkLoader,openWechatPortraitDecoder,
  createLobbyPanel,paintLobbyPaper,paintSecondaryPaper,createMenuArtworkWarmup,openChapterPanel,openTaskPanel,openCarnivalPanel,openRecruitResults,DRAW_GATE_ART,
  art,atlas,catalogPortrait,PILOT_PORTRAITS,qualityFrame,researchArt,researchCardQuality,taskReward,flightRewardsSnapshot,
  createHomeStage,homePictures,createHomeHud,createLobbyFeedback,homeControls,createHomePointer,homePortraitSize,homePresentation,homeArt,lobbyPanels,createThreeLobbyController,
  nativeCollectionArt,nativeLabArt,projectIconUrl,optimizeUiAssetUrls,createPeripheralSystem,createInitialGachaState}=mod.exports;

const screen={x:0,y:0,left:0,top:0,width:390,height:844,right:390,bottom:844};
const content={...screen,y:78,top:78,height:766};
const lateGear='/art/project-flight-gear-v1/sets-v3/4500400.webp';
const recruitPortrait=id=>'/art/recruit-portraits-v2/'+id+'.png?v=redraw-20261109-v2';

test('WeChat lobby skips affection artwork and excludes the hidden hotspot from touch controls',async t=>{
  const artwork=[];
  const hud=await createHomeHud(async url=>{artwork.push(url);return {url,width:256,height:256};},{chapter:0},()=>{});
  t.after(()=>hud.dispose());
  assert(!artwork.some(url=>url.endsWith('/heart.png')));
  for(const carnival of [false,true]){
    const controls=homeControls({carnival},screen,[200,400,350,600]);
    assert(!controls.some(c=>c.id==='affection'||c.action==='pilotAffection'));
    assert(controls.some(c=>c.action==='portraitFeedback'));
    assert.equal(controls.some(c=>c.action==='carnival'),carnival);
  }
});

test('WeChat lobby keeps the full head and its motion below the chapter reward bar',()=>{
  for(const [width,height,safeTop,safeBottom] of [[320,640,52,0],[375,667,32,0],[390,844,78,34],[430,932,84,34]]){
    const viewport={width,height,safeTop,safeBottom};
    for(const id of Object.keys(PILOT_PORTRAITS)){
      const portrait=homePortraitSize(id,viewport);
      const [,rewardY,,rewardHeight]=homeControls({},viewport,portrait).find(row=>row.id==='star-rewards').box;
      const [,y,,h]=portrait;
      const top=y+PORTRAIT_FRAMING[id].bounds[1]*h;
      assert(top*1624/height>=rewardY+rewardHeight+18,id+" at "+width+"x"+height);
    }
  }
});

test('WeChat tab switch draws a full yellow outline on the destination first frame',()=>{
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,a+' vs '+b);
  for(const [width,height,safeBottom] of [[320,640,34],[390,844,34],[430,932,34],[375,667,0]]){
    const viewport={x:0,y:0,width,height,safeTop:48,safeBottom};
    for(const name of ['battle','assembly']){
      const id='nav-'+name,control=homeControls({},viewport,[0,0,0,0]).find(row=>row.id===id);
      const [x,y,w,h]=control.box.map((n,i)=>i%2?n*height/1624:n*width/750);
      for(const screen of [{homeView:{controls:()=>[control]}},{menuView:{state:()=>({controls:[{id,x,y,w,h}]})}}]){
        let now=0;
        const feedback=createLobbyFeedback(screen,{now:()=>now,reducedMotion:()=>false,layout:()=>({bounds:viewport})});
        try{
          feedback.pulse(id);now=950;
          let edges;
          feedback.draw({render(scene){edges=scene.children[1].children;}},width,height);
          assert.equal(edges.length,4);
          const [top,bottom,left,right]=edges;
          near(top.position.y-Math.abs(top.scale.y)/2,y);
          near(bottom.position.y+Math.abs(bottom.scale.y)/2,y+151*width/750);
          near(top.material.opacity,.9);
          near(left.position.x-left.scale.x/2,x);
          near(right.position.x+right.scale.x/2,x+w);
        }finally{feedback.close();}
      }
    }
  }
});

test('WeChat lobby renders its text with delayed artwork and switches to the loaded atlas',async t=>{
  fixture(t);
  const canvas=globalThis.wx.createCanvas;
  t.mock.method(globalThis.wx,'createCanvas',()=>{
    const target=canvas();
    target.getContext('2d').fillText=(_text,_x,_y,width)=>assert(Number.isFinite(width));
    return target;
  });
  let ready,redraws=0;
  const font=homeArt.fonts.system.image;
  const hud=await createHomeHud(url=>url===font?new Promise(resolve=>{ready=resolve;}):
    Promise.reject(Error('artwork timeout')),{chapter:0,name:'逐星旅人',power:'250',
    wallet:{stamina:22,coins:0,diamonds:200},total:0,maximum:3},()=>{redraws++;});
  t.after(()=>hud.dispose());
  hud.layout({width:390,height:844,safeTop:48,safeBottom:34});
  const seen=new Set(),renderer={render(scene){scene.traverseVisible(node=>{
    const text=node.userData.uiText;
    const image=node.material?.uniforms?.art.value.image;
    if(text)seen.add(text);
    if(image?.url)seen.add(image.url);
  });}};
  hud.paint(renderer,0);
  for(const text of ['逐星旅人','250','22','0','200','第一章·蔚蓝海岸','战役','装备'])assert(seen.has(text),text);
  ready({url:font,width:2048,height:2048});
  await new Promise(resolve=>setImmediate(resolve));
  seen.clear();hud.paint(renderer,0);
  assert(redraws>0);assert(seen.has(font));assert(!seen.has('22'));
  assert(seen.has('第一章·蔚蓝海岸'));
});

test('WeChat guides frame the entire navigation tab, with touches still opening it',async t=>{
  fixture(t);
  const hud=await createHomeHud(async url=>({url,width:256,height:256}),{chapter:0},()=>{});
  await new Promise(resolve=>setImmediate(resolve));
  t.after(()=>hud.dispose());
  await new Promise(resolve=>setImmediate(resolve));
  const centerX=mesh=>mesh.position.x+mesh.scale.x/2;
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} does not match ${b}`);
  for(const [width,height,safeBottom] of [[320,640,34],[390,844,34],[430,932,34],[375,667,0]]){
    const viewport={x:0,y:0,width,height,safeTop:48,safeBottom};
    const controls=homeControls({},viewport,[200,400,350,600]);
    hud.layout(viewport);
    for(const [tab,text] of [['assembly','进入装备页'],['shop','进入商城']]){
      const id='nav-'+tab,control=controls.find(c=>c.id===id);
      const guide={id,text,strong:true,reduced:true,target:control.box};
      hud.setGuide(guide);
      const [left,top,tabWidth,hitHeight]=control.box;
      const railHeight=151*width/750*1624/height;
      let meshes;
      const renderer={render(scene){meshes=scene.children.filter(mesh=>mesh.visible);}};
      const inspect=()=>{
        const matches=url=>meshes.filter(mesh=>mesh.material?.uniforms?.art?.value?.image?.url===url);
        const [ring]=matches('/art/psd-equipment-v1/frame-gold.png');
        assert(ring);
        near(ring.position.x,left);near(ring.position.y,top);
        near(ring.scale.x,tabWidth);near(ring.scale.y,railHeight);
        assert(ring.position.y+ring.scale.y<=1624+1e-6);
        if(safeBottom)assert(ring.scale.y>hitHeight);
        const arrows=matches(homeArt.pointer);
        assert.equal(arrows.length,2);
        for(const arrow of arrows)near(centerX(arrow),left+tabWidth/2);
      };
      hud.paint(renderer,0);inspect();
      hud.paintGuide(renderer,0,guide,viewport);inspect();
      const scales=[];
      const pointer=createHomePointer({bounds:()=>viewport,controls:()=>controls,enabled:()=>true,guide:()=>guide,
        immediateTabs:true,scale(...args){scales.push(args);}},
        {request:()=>0,cancel(){},now:()=>0});
      const y=(top+hitHeight/2)*height/1624;
      for(const fraction of [.12,.5,.88]){
        const x=(left+tabWidth*fraction)*width/750;
        assert.equal(pointer.start(x,y,1)?.id,id);
        assert(scales.at(-1)?.[0]===id&&scales.at(-1)[1]<1,'tab responds on touch start');
        assert.equal(pointer.end(x,y,1)?.id,id);
        assert.deepEqual(scales.at(-1),[id,1]);
      }
      pointer.close();
    }
  }
});

function fixture(t,debugLog,options={}) {
  const requests=new Map(),frames=new Map(),commands=[],events=[],texts=new Set(),textMeshes=new Map(),images=new Map();
  let touch,nextFrame=0,now=0,canvases=0,touchBindings=0,visible=!options.parked;
  const wx=globalThis.wx;
  globalThis.wx={createCanvas(){
    canvases++;
    const ctx={measureText:value=>({width:value.length*9}),scale(){},fillText(){},strokeText(){}};
    return {getContext:()=>ctx};
  }};
  const restore=useArtworkLoader(url=>new Promise(resolve=>requests.set(url,resolve)));
  const platform={
    visible:true,viewport:{screen,density:2,safeBottom:34,...options.viewport},now:()=>now,debugLog,
    requestFrame(fn){frames.set(++nextFrame,fn);return nextFrame;},
    cancelFrame:id=>frames.delete(id),
    onViewport:()=>()=>{},
    bindTouches(handler){touchBindings++;touch=handler;return ()=>{touch=null;};},
    display:{begin(){},present(){events.push('paint');}},
  };
  const renderer={
    capabilities:{maxTextureSize:4096},getContext:()=>({isContextLost:()=>false}),initTexture(){},
    info:{},getClearColor:color=>color,getClearAlpha:()=>0,setClearColor(){},clear(){},
    getViewport:v=>v.set(0,0,780,1688),getScissor:v=>v.set(0,0,780,1688),
    getScissorTest:()=>false,setScissor(){},setScissorTest(){},
    render(scene){
      for(const mesh of scene.children[0].children){
        if(!mesh.visible)continue;
        if(mesh.userData.uiText){
          texts.add(mesh.userData.uiText);textMeshes.set(mesh.userData.uiText,mesh);
        }
        const image=mesh.material.map?.image;
        if(image?.url)images.set(image.url,mesh);
      }
    },
  };
  platform.renderer=renderer;
  const device={three:renderer,display:platform.display,
    createPanelInput:host=>createWechatPanelInput({},platform,host)};
  const region={bounds:()=>content,frameBounds:()=>screen,visible:()=>visible,main:options.main,
    catalog:options.catalog,completeEntry:options.completeEntry,workshop:options.workshop,
    openPortrait:(refresh,redraw)=>catalogPortrait(device,null,refresh,redraw,{
      bounds:()=>content,
      open(){events.push('portrait');return {layout(){},close(){}};},
    }),
    openAircraft:(_panel,_refresh,_request,_available,settings)=>{
      assert.equal(settings.stageModel,true);
      assert.equal(settings.prefetchModel,false);
      return options.aircraftPreview?.(_refresh)??{ready:false,update(){},tick(){events.push('aircraft');},pause(){},close(){}};
    },
  };
  const view=mountWechatMenu(device,platform,region,(...args)=>commands.push(args),()=>true,()=>{},options);
  t.after(()=>{view.close();restore();if(wx===undefined)delete globalThis.wx;else globalThis.wx=wx;});
  function point(phase,x,y){touch({phase,x,y,pointerId:1});}
  return {view,requests,commands,events,texts,textMeshes,images,device,region,renderer,platform,point,
    get canvases(){return canvases;},get touchBindings(){return touchBindings;},
    paint(delta=16){
      now+=delta;
      const callbacks=[...frames.values()];
      if(!callbacks.length)return;
      frames.clear();texts.clear();textMeshes.clear();images.clear();
      for(const fn of callbacks)fn(now);
    },
    control:id=>view.state().controls.find(c=>c.id===id),
    click(c,vertical=.5){const x=c.x+c.w/2,y=c.y+c.h*vertical;point('start',x,y);point('end',x,y);},
    drag(x,y,distance){point('start',x,y);point('move',x,y-distance);point('end',x,y-distance);},
    park(){visible=false;view.park();},
    activate(){visible=true;view.activate();},
  };
}

test('WeChat startup waits for its backdrop before painting or accepting the start button',async t=>{
  const f=fixture(t);
  const startup=showWechatStartup(f.platform,{bounds:()=>screen,retry:assert.fail,copyReport:assert.fail,onRelease(){}});
  t.after(startup.close);
  startup.stage(1,'正在读取游戏资源…');
  const [url,resolveBackdrop]=[...f.requests].find(([path])=>path.endsWith('/entry-screens-v4/startup-wechat.jpg'));
  for(const [name,resolve] of f.requests)if(name!==url)resolve({url:name,width:224,height:80});
  await Promise.resolve();
  f.paint();
  assert.equal(f.images.size,0);
  assert.equal(f.texts.size,0);

  let started=0;
  const ready=startup.ready(()=>{started++;});
  f.paint();
  const tapStart=()=>{f.point('start',195,784);f.point('end',195,784);};
  tapStart();
  assert.equal(f.texts.size,0);
  assert.equal(started,0);
  resolveBackdrop({url,width:780,height:1690});
  await Promise.resolve();
  f.paint();
  assert.equal(f.images.keys().next().value,url);
  assert(f.texts.has('开始游戏'));
  assert(f.texts.has('准备就绪'));
  assert([...f.images.keys()].some(name=>name.endsWith('/health-track.png')));
  tapStart();
  await ready;
  assert.equal(started,1);
});


test('WeChat sends a fresh save directly to chapter one when the start screen becomes visible',async t=>{
  const f=fixture(t,undefined,{viewport:{safeTop:content.top}}),{device,platform}=f;
  const commands=[],closed=[],retries=[],storage=new Map();
  const viewportListeners=new Set();
  platform.onViewport=fn=>{viewportListeners.add(fn);return ()=>viewportListeners.delete(fn);};
  Object.assign(device,{subscribeHome:()=>()=>{},
    publishHome(snapshot,chapter,developer){device.homeState=homePresentation(snapshot,chapter,developer);}});
  const portraits={openHome(){assert.fail('first launch mounts the lobby portrait');},setVisible(){},sync(){},destroy(){}};
  let leaveBattle;
  const game=await startLobbySession({app:{renderer:device},
    sessionHost:{
      isCurrent:()=>true,storage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
      audio:{},frames:{requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,isVisible:()=>platform.visible,watchVisibility:()=>()=>{}},
      setTimeout(){assert.fail('attribute catalog competes with first sortie');},clearTimeout(){},
      showFirstSortieRetry(){retries.push(true);},
    },
    createAudio:()=>({feedback:{stop(){}},sync(){},destroy(){}}),
    createBattle({onEnter,onLeave}){
      leaveBattle=onLeave;
      return {start(options){commands.push(options);onEnter();return Promise.resolve(true);},leavePage(){},dispose(){}};
    },
    mountLobby:options=>mountWechatLobby({},platform,device,{...options,portraits}),
  });
  t.after(()=>game.closeGameSession({save:false}));
  assert.equal(game.pixiLobby.snapshot.firstSortieRequired,true);
  assert.equal(game.pixiLobby.state.visible,false);
  assert.equal(device.homeView,undefined);
  assert.equal(device.panel,undefined);
  assert(!f.requests.has(optimizeUiAssetUrls('/art/psd-main-v1/main-background.png')));
  assert.deepEqual(await game.pixiLobby.prepareMenus(),[]);

  platform.visible=false;
  const startup=showWechatStartup(platform,{bounds:()=>screen,retry:assert.fail,copyReport:assert.fail,onRelease(){
    device.cover=null;closed.push(true);
  }});
  device.cover=startup;t.after(startup.close);
  let sent;
  const handoff=startup.ready(()=>{sent=game.peripheralAction('start',{index:0});},{automatic:true});
  f.paint();assert.deepEqual(commands,[]);
  platform.visible=true;
  for(const notify of viewportListeners)notify(screen,true);
  f.paint();
  await handoff;
  assert.equal((await sent).started,true);
  assert.deepEqual(closed,[true]);
  assert.deepEqual(commands,[{trial:false,chapterId:1}]);
  assert.equal(game.game.state,'replica-battle');
  assert.equal(device.homeView,undefined);
  assert(!f.texts.has('开始游戏'));
  f.paint();
  assert.equal(commands.length,1);
  leaveBattle();
  assert.deepEqual(retries,[true]);
  assert.equal(game.pixiLobby.state.visible,false);
  assert.equal(device.homeView,undefined);
});

test('WeChat first visible lobby is complete for a returning pilot',async t=>{
  const returningPilot='pilot-10';
  const f=fixture(t,undefined,{viewport:{safeTop:content.top}});
  const {platform,renderer,device}=f;
  const requests=new Map(),visible=[],prewarmed=new Set();
  const pending=new Map();
  const restore=useArtworkLoader(url=>{
    if(!pending.has(url))pending.set(url,new Promise(resolve=>requests.set(url,resolve)));
    return pending.get(url);
  });
  t.after(restore);
  let target=null,startupTouch;
  Object.assign(renderer,{
    setPixelRatio(){},getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},setViewport(){},
    render(scene){
      scene.traverseVisible(mesh=>{
        const image=mesh.material?.uniforms?.art?.value?.image??mesh.material?.map?.image;
        if(image?.url)(target?prewarmed:visible.at(-1)?.art)?.add(image.url);
        const text=mesh.userData.uiText;
        if(text&&!target)visible.at(-1)?.text.add(text);
      });
    },
  });
  platform.display.begin=(_box,_w,_h,_refresh,cover=false)=>{
    assert.equal(target,null);
    visible.push({cover,art:new Set(),text:new Set()});
  };
  platform.bindTouches=(handler,priority)=>{
    if(priority===40)startupTouch=handler;
    return ()=>{};
  };
  const startup=showWechatStartup(platform,{bounds:()=>screen,retry:assert.fail,copyReport:assert.fail,
    onRelease(){device.cover=null;}});
  device.cover=startup;
  t.after(startup.close);
  Object.assign(device,{subscribeHome:()=>()=>{},
    publishHome(snapshot,chapter,developer){device.homeState=homePresentation(snapshot,chapter,developer);}});
  const snapshot={pilotId:returningPilot,firstSortieRequired:false,wallet:{stamina:30,coins:0,diamonds:200},
    stages:[{index:0,unlocked:true}]};
  const bridge={app:{renderer:device},getPeripheralSnapshot:()=>snapshot};
  const portraits={openHome:()=>({layout(){},close(){}}),setVisible(){},sync(){},destroy(){}};
  const lobby=mountWechatLobby({},platform,device,{bridge,portraits,deferPortraits:true});
  t.after(lobby.destroy);

  let entries=0;
  startup.stage(2,'正在准备大厅界面…');
  const entry=device.homeView.prepareEntry().then(()=>startup.ready(()=>{
    entries++;device.homeView.paintNow();
  }));
  const tap=()=>{
    const point={x:195,y:784,pointerId:1};
    startupTouch({...point,phase:'start'});startupTouch({...point,phase:'end'});
  };
  const background=optimizeUiAssetUrls('/art/psd-main-v1/main-background.png');
  const pilot=optimizeUiAssetUrls(PILOT_PORTRAITS[returningPilot].image);
  const currencyText=optimizeUiAssetUrls(homeArt.fonts.system.image);
  const lastImage=optimizeUiAssetUrls(PILOT_PORTRAITS[returningPilot].scene);
  const held=[background,pilot,currencyText,lastImage];
  function decode(url,resolve){
    const side=url===lastImage?1024:256;
    resolve({url,width:side,height:side,naturalWidth:side,naturalHeight:side});
  }
  function decodeOtherImages(){
    for(const [url,resolve] of requests)if(!held.includes(url))decode(url,resolve);
  }
  decodeOtherImages();
  for(const url of held){
    await new Promise(setImmediate);
    f.paint(1300);
    tap();
    assert.equal(entries,0);
    assert(visible.at(-1).cover);
    assert(!visible.at(-1).text.has('开始游戏'));
    assert.equal(prewarmed.size,0);
    assert(requests.has(url),url);
    decode(url,requests.get(url));
  }

  await new Promise(setImmediate);
  for(let frame=0;frame<5;frame++){f.paint();await Promise.resolve();}
  const complete=visible.at(-1);
  assert(complete.cover&&complete.text.has('开始游戏'));
  assert(visible.every(frame=>frame.cover));
  for(const url of held)assert(prewarmed.has(url),url);
  tap();
  await entry;
  assert.equal(entries,1);
  const first=visible.find(frame=>!frame.cover);
  const nav=optimizeUiAssetUrls(homeArt.nav.shop);
  const start=optimizeUiAssetUrls('/art/psd-main-v1/buttons/start.png');
  for(const url of [...held,nav,start])assert(first.art.has(url),url);
});

test('WeChat startup waits for the original backdrop if its packaged image fails',async t=>{
  const f=fixture(t);
  const packaged='/art/entry-screens-v4/startup-wechat.jpg';
  const fallback='/art/entry-screens-v4/startup.png';
  const requests=[];
  let resolveFallback;
  const original=useArtworkLoader(url=>{
    requests.push(url);
    if(url===packaged)return Promise.reject(Error('packaged backdrop decode failed'));
    if(url===fallback)return new Promise(resolve=>{resolveFallback=resolve;});
    return Promise.resolve({url,width:224,height:80});
  });
  const startup=showWechatStartup(f.platform,{bounds:()=>screen,retry:assert.fail,copyReport:assert.fail,onRelease(){}});
  try{
    let started=0;
    const ready=startup.ready(()=>{started++;});
    await Promise.resolve();
    assert.deepEqual(requests.filter(url=>url.startsWith('/art/entry-screens-v4/')),[packaged,fallback]);
    f.paint();
    assert.equal(f.texts.size,0);
    f.point('start',195,784);f.point('end',195,784);
    assert.equal(started,0);
    resolveFallback({url:fallback,width:852,height:1846});
    await Promise.resolve();
    f.paint();
    assert.equal(f.images.keys().next().value,fallback);
    assert(f.texts.has('准备就绪'));
    assert(f.texts.has('开始游戏'));
    f.point('start',195,784);f.point('end',195,784);
    await ready;
    assert.equal(started,1);
  }finally{startup.close();original();}
});

test('WeChat startup stays usable if its backdrop cannot be decoded',async t=>{
  const f=fixture(t);
  const original=useArtworkLoader(url=>url.startsWith('/art/entry-screens-v4/')?
    Promise.reject(Error('startup backdrop decode failed')):Promise.resolve({url,width:224,height:80}));
  let startup;
  try{
    startup=showWechatStartup(f.platform,{bounds:()=>screen,retry:assert.fail,copyReport:assert.fail,onRelease(){}});
    await Promise.resolve();
    await Promise.resolve();
  }finally{original();}
  t.after(startup.close);
  let started=false;
  const ready=startup.ready(()=>{started=true;});
  f.paint();
  assert(f.texts.has('封面加载失败，可继续游戏'));
  assert(f.texts.has('开始游戏'));
  f.point('start',195,784);f.point('end',195,784);
  await ready;
  assert(started);
});

for(const clipped of [false,true]){
  test(`WeChat ${clipped?'clipped secondary':'primary'} dialog shades the entire viewport and accepts safe-area taps`,t=>{
    const {device,region,renderer,point}=fixture(t);
    const commands=[],draws=[];
    const bounds={...content,x:12,left:12,width:366,height:714};
    const host={...region,bounds:()=>bounds};
    let scissor;
    renderer.setScissor=(...args)=>{scissor=args.length===1?args[0].toArray():args;};
    renderer.render=(scene,camera)=>{draws.push({scissor,rect:[camera.left,camera.top,camera.right,camera.bottom],
      meshes:scene.children[0].children});};
    const panel=createLobbyPanel(device,host,'弹窗',(data,w,h,tools)=>{
      if(clipped){
        tools.region('content',{x:0,y:0,w,h:h-100},h-100);
        const a=tools.layer('clipped','content').art;
        paintSecondaryPaper(tools,w,h,260,350,'购买确认',{a});
      }else paintLobbyPaper(tools,data,w,h,260,350,48,'七日嘉年华');
    },action=>commands.push(action.type));
    t.after(panel.close);
    panel.update({},'paper');
    panel.draw(renderer);
    const {meshes,rect}=draws[0],shade=meshes[0];
    assert.equal(shade.material.color.getHex(),0x000000);
    assert.equal(shade.material.opacity,clipped?.55:.6);
    assert.deepEqual(draws[0].scissor,[0,0,780,1688]);
    assert.deepEqual([shade.position.x-shade.scale.x/2,shade.position.y-Math.abs(shade.scale.y)/2,
      shade.position.x+shade.scale.x/2,shade.position.y+Math.abs(shade.scale.y)/2],rect);
    if(clipped){
      assert.equal(meshes.length,1);
      assert(draws[1].scissor[3]<1688);
    }
    for(const y of [10,840]){
      point('start',screen.width/2,y);point('end',screen.width/2,y);
    }
    assert.deepEqual(commands,['close','close']);
  });
}

for(const [phase,image] of [['opening','draw-receiver'],['pilot result','recruit-result'],['weapon result','logistics-bay']]){
  test(`WeChat recruitment ${phase} covers the screen before and after decoding its backdrop`,async t=>{
    const {device,region,renderer,requests}=fixture(t);
    const bounds={...content,x:12,left:12,right:378,width:366,height:714,bottom:792};
    const host={...region,bounds:()=>bounds},opening=phase==='opening',grid=phase==='pilot result';
    device.reducedMotion=()=>!opening&&!grid;
    device.viewportHeight=()=>screen.height;
    const handle=openRecruitResults(device,host,()=>{});
    t.after(handle.close);
    const pilot={id:'pilot-01',name:'测试驾驶员',rarity:'SSR'};
    const reward=grid?{type:'pilot',pilotId:pilot.id,isNew:true}:{type:'coins',amount:100};
    handle.update({pilots:[pilot],weapons:[],aircraft:[]},{
      type:'rewards',recruit:grid,recruitPool:grid?'pilot':'weapon',recruitGrid:grid,rewards:[reward],
    });
    const meshes=[];
    renderer.render=scene=>{meshes.push(...scene.children[0].children.filter(mesh=>mesh.visible));};
    const rect=mesh=>{
      assert(mesh,'expected a visible backdrop mesh');
      const {position,scale}=mesh,halfW=scale.x/2,halfH=Math.abs(scale.y)/2;
      return [position.x-halfW,position.y-halfH,position.x+halfW,position.y+halfH];
    };
    const frame=[-12,-78,378,766];
    device.panel.draw(renderer);
    const shade=meshes.find(mesh=>!mesh.material.map&&mesh.material.color.getHex()===0x0b1b2d);
    assert.deepEqual(rect(shade),frame);
    assert.equal(shade.material.opacity,1);
    const url=optimizeUiAssetUrls('/art/project-scene-backgrounds-v3/'+image+'.png');
    const gate=optimizeUiAssetUrls(DRAW_GATE_ART);
    requests.get(url)({url,width:768,height:1624});
    if(opening)requests.get(gate)({url:gate,width:768,height:1624});
    await Promise.resolve();
    await new Promise(resolve=>setTimeout(resolve,70));
    meshes.length=0;
    device.panel.draw(renderer);
    assert.deepEqual(rect(meshes.find(mesh=>mesh.material.map?.image?.url===url)),frame);
    if(opening){
      const doors=meshes.filter(mesh=>mesh.material.map?.image?.url===gate);
      assert.deepEqual(doors.map(rect),[[-12,-78,183,766],[183,-78,378,766]]);
    }
  });
}

test('Memory warnings keep the main WeChat tabs warm and release idle catalog pages',async t=>{
  const {platform,renderer,device}=fixture(t,undefined,{viewport:{safeTop:content.top}});
  platform.inputIdle=true;
  Object.assign(renderer,{setPixelRatio(){},setRenderTarget(){}});
  Object.assign(device,{subscribeHome:()=>()=>{},publishHome(snapshot){device.homeState=snapshot;}});
  const snapshot={...shopSnapshot(),...catalogFixture('pilot').snapshot,stages:[]};
  const bridge={app:{renderer:device},getPeripheralSnapshot:()=>snapshot};
  const portraits={openHome:()=>({layout(){},close(){}}),openCatalog:()=>({select(){},resize(){},setActive(){},changed:()=>false,close(){}}),
    setVisible(){},sync(){},destroy(){}};
  const lobby=mountWechatLobby({},platform,device,{bridge,portraits,deferPortraits:true});
  t.after(lobby.destroy);
  lobby.switchTab('shop');const shop=device.menuView;
  lobby.switchTab('loadout');const catalog=device.menuView;
  assert.equal(lobby.state.subpage,'pilot');
  lobby.switchTab('research');const research=device.menuView;
  assert(shop&&research&&catalog&&new Set([shop,research,catalog]).size===3);
  let warmed=false;const warming=lobby.prepareMenus().then(pages=>{warmed=true;return pages;});
  lobby.trimMemory();await Promise.resolve();
  assert.equal(device.menuView,research,'the visible menu stays mounted');
  assert.equal(warmed,false,'the main pages can finish prewarming');
  lobby.switchTab('shop');assert.equal(device.menuView,shop);
  lobby.switchTab('loadout');assert.notEqual(device.menuView,catalog);
  lobby.switchTab('research');assert.equal(device.menuView,research);
  lobby.setVisible(false);assert.deepEqual(await warming,[]);
});

test('WeChat first-sortie dialog returns touch routing to battle when the lobby hides',t=>{
  const {platform,renderer,device}=fixture(t,undefined,{viewport:{safeTop:content.top}});
  Object.assign(renderer,{setPixelRatio(){},setRenderTarget(){}});
  Object.assign(device,{subscribeHome:()=>()=>{},publishHome(snapshot){device.homeState=snapshot;}});
  const routes=new Set();
  platform.bindTouches=(handler,priority=0,accepts=()=>true)=>{
    const route={handler,priority,accepts};routes.add(route);return ()=>routes.delete(route);
  };
  const snapshot={firstSortieRequired:true,wallet:{},stages:[{index:0,unlocked:true}]};
  const bridge={app:{renderer:device},getPeripheralSnapshot:()=>snapshot};
  const portraits={openHome:()=>({layout(){},close(){}}),setVisible(){},sync(){},destroy(){}};
  const lobby=mountWechatLobby({},platform,device,{bridge,portraits,deferPortraits:true});
  t.after(lobby.destroy);
  assert.equal(lobby.state.modal,'firstSortie');
  const dialog=device.panel;
  const phases=[],battle=point=>phases.push(point.phase);
  t.after(platform.bindTouches(battle,5));
  const start={phase:'start',x:195,y:540,pointerId:1};
  const target=()=>[...routes].filter(route=>route.accepts(start)).sort((a,b)=>b.priority-a.priority)[0];
  assert.equal(target().priority,10);
  lobby.setVisible(false);
  assert.equal(device.panel,dialog,'the first-sortie dialog is retained for the return to the lobby');
  const claimed=target();
  assert.equal(claimed.priority,5,'the hidden dialog must yield the swipe to battle');
  claimed.handler(start);
  claimed.handler({...start,phase:'move',x:260});
  claimed.handler({...start,phase:'end',x:260});
  assert.deepEqual(phases,['start','move','end']);
  lobby.setVisible(true);
  assert.equal(target().priority,10);
});

test('WeChat warms settled equipment offscreen and opens it only on a lobby tap',async t=>{
  let modelReady=false,modelSteps=0,modelLayouts=0;
  const aircraftPreview=refresh=>({ready:false,target:{width:100,height:80},update(){},tick(){},pause(){},close(){},
    prepare(){modelSteps++;if(modelReady&&!this.ready){this.ready=true;refresh();}return this.ready;},paint(){modelLayouts++;}});
  const f=fixture(t,undefined,{viewport:{safeTop:content.top},aircraftPreview});
  const {platform,renderer,device,region}=f;
  const routes=new Set();
  platform.bindTouches=(handler,priority=0,accepts=()=>true)=>{
    const route={handler,priority,accepts};routes.add(route);return ()=>routes.delete(route);
  };
  platform.inputIdle=false;
  const warmAvatars=[];
  platform.warmArtworkFiles=async (urls,signal)=>{warmAvatars.push({urls,signal});};
  let output=null;
  Object.assign(renderer,{setPixelRatio(){},setViewport(){},getRenderTarget:()=>output,setRenderTarget:value=>{output=value;}});
  Object.assign(device,{subscribeHome:()=>()=>{},
    publishHome(snapshot,chapter,developer){device.homeState=homePresentation(snapshot,chapter,developer);}});
  let snapshot={...shopSnapshot(),...equipmentSnapshot(),nativeAcquisition:undefined,firstSortieRequired:true,
    onboarding:{version:1,completed:[1,4]},stages:[{index:0,unlocked:true}],pilots:[{id:'pilot-01',name:'夜莺',rarity:'R'}],
    pools:{pilot:{singleCost:10}},research:{cards:[]}};
  const bridge={app:{renderer:device},getPeripheralSnapshot:()=>snapshot};
  const portraits={openHome:()=>({layout(){},close(){}}),openCatalog(){return region.openPortrait(()=>{},()=>{});},
    setVisible(){},sync(){},destroy(){}};
  const loading=[];
  const api={showLoading(){loading.push('show');},hideLoading(){loading.push('hide');}};
  const lobby=mountWechatLobby(api,platform,device,{bridge,portraits,deferPortraits:true,deferFirstSortieLobby:true,
    openAircraft:(_device,_bounds,...args)=>region.openAircraft(...args)});
  t.after(lobby.destroy);
  const signal={aborted:false},uploads=new Set(),settled=new Set();
  const homeBackdrop=optimizeUiAssetUrls('/art/psd-main-v1/main-background.png');
  let releaseHome=false;
  renderer.initTexture=texture=>uploads.add(texture.image.url);
  const gear=optimizeUiAssetUrls('/art/psd-equipment-v1/equipment-background.webp');
  const aircraft=optimizeUiAssetUrls('/art/aircraft-ui-v1/'+snapshot.aircraftId+'-hangar.webp');
  const portrait=recruitPortrait('pilot-01');
  assert.deepEqual(await lobby.prepareMenus(),[]);
  assert.equal(lobby.state.visible,false);
  assert(!f.requests.has(homeBackdrop));
  const touches=routes.size;
  device.cover={};
  assert.equal(device.warmFirstSortieMenus(signal),false);
  assert.equal(f.requests.has(gear),false,'the rotating loading cover owns the renderer');
  assert.deepEqual(warmAvatars,[]);
  device.cover=null;
  function decode(){
    for(const [url,resolve] of f.requests)if(!settled.has(resolve)&&(releaseHome||url!==homeBackdrop)){
      settled.add(resolve);
      resolve({url,width:256,height:256});
    }
  }
  assert.equal(device.warmFirstSortieMenus(signal),true);
  assert(f.requests.has(gear));
  assert.equal(f.requests.has(portrait),false,'equipment work starts before recruitment');
  assert.equal(warmAvatars.length,1,'equipment portrait files are warmed during play');
  assert.equal(warmAvatars[0].signal,signal);
  assert(warmAvatars[0].urls[0].endsWith('/pilot-01-320.png'));
  platform.visible=false;
  assert.equal(device.warmFirstSortieMenus(signal),false);
  platform.visible=true;
  let pending=true;
  for(let frame=0;frame<180&&pending;frame++){
    decode();await Promise.resolve();
    const before=uploads.size;
    pending=device.warmFirstSortieMenus(signal);
    assert(uploads.size-before<=1,'each battle frame uploads at most one background texture');
  }
  assert.equal(pending,false);
  assert.equal(routes.size,touches,'hidden menus never interrupt combat touches');
  for(const url of [gear,aircraft,portrait,...['shop','research'].map(tab=>optimizeUiAssetUrls(art[tab+'-background']))])
    assert(uploads.has(url),url);
  assert.equal(lobby.state.visible,false);
  assert(!f.requests.has(homeBackdrop),'the active fight does not load lobby art');
  assert.equal(modelSteps,0,'active combat only prepares 2D menu artwork');
  const messages=[],errors=[];
  let deliver,leaveCount=0;
  const configuration=createReplicaConfiguration({items:[],slots:{},levels:{}},createReplicaProgression());
  const peripheral={snapshot:()=>snapshot,replicaConfiguration:()=>configuration,
    prepareSortie:()=>({ok:true,snapshot:{id:'first-run',replicaConfiguration:configuration}}),
    recordSortie(result){
      const equipment=structuredClone(snapshot.equipment),item=equipment.items[0];
      item.art='saint-ring-v4/4110100';item.equipped=true;equipment.slots[1]=item.uid;
      snapshot={...snapshot,firstSortieRequired:false,equipment};
      return {ok:true,rewards:[],replica:result};
    }};
  const sortie=createSortieController({peripheral:()=>peripheral,onProgress(){},onState(){},onError:message=>errors.push(message),
    onEnter:()=>lobby.setVisible(false),onLeave(){leaveCount++;lobby.setVisible(true);},screen:device,
    host:{baseURL:'https://example.invalid/',now:platform.now,hidden:()=>false,setLaunching(){},makeSessionId:()=> 'first-sortie',
      bind:()=>()=>{},prepareResultReturn:isCurrent=>device.prepareFirstSortieEquipment(isCurrent),
      createSurface:()=>({show(){},close(){},mount({emit}){deliver=emit;return {receive:message=>messages.push(message),dispose(){}};}})},
    showSortieLoading:()=>({update(){},close(){},fail({message}){errors.push(message);}})});
  t.after(sortie.dispose);
  const started=sortie.start({chapterId:1});
  const send=(type,payload={})=>deliver({channel:'shnh-replica-battle-v1',session:'first-sortie',type,...payload});
  await send('ready');
  const config=messages.find(message=>message.type==='configure');
  await send('configured',{requestId:config.requestId,configurationKey:config.configurationKey});
  await send('started',{runId:'first-run',configurationKey:config.configurationKey});
  assert.equal(await started,true);
  await send('result',{result:{runId:'first-run',chapterId:1,won:false,endReason:'defeat'}});
  await send('home');await send('home');
  assert.equal(leaveCount,0);
  assert.equal(lobby.state.visible,false,'an immediate return keeps the result view active');
  f.events.length=0;
  const equippedIcon=optimizeUiAssetUrls('/art/project-flight-gear-v1/saint-ring-v4/4110100.webp');
  for(let frame=0;frame<30&&!modelSteps;frame++){f.paint();decode();await Promise.resolve();}
  assert(f.requests.has(equippedIcon),'preparation uses the saved equipment data');
  assert(modelSteps>0);
  assert.equal(leaveCount,0,'the first aircraft render must finish before returning');
  assert(f.requests.has(homeBackdrop),'the returning lobby is prepared after settlement');
  assert([...routes].every(route=>!route.accepts({x:100,y:100})));
  assert.deepEqual(f.events,[]);
  modelReady=true;
  for(let frame=0;frame<8;frame++){f.paint();decode();await new Promise(setImmediate);}
  assert.equal(leaveCount,0,'flight results stay visible while the returning lobby art is pending');
  releaseHome=true;
  for(let frame=0;frame<40&&!leaveCount;frame++){f.paint();decode();await new Promise(setImmediate);}
  assert.equal(leaveCount,1);
  assert.deepEqual(errors,[]);
  assert.equal(lobby.tab,'battle');
  assert.equal(device.homeView.guide?.id,'nav-assembly');
  for(let frame=0;frame<4;frame++){decode();await new Promise(setImmediate);f.paint();}
  function tapHome(id){
    const [x,y,w,h]=device.homeView.controls().find(control=>control.id===id).box;
    const point={phase:'start',x:(x+w/2)*screen.width/750,y:(y+h/2)*screen.height/1624,pointerId:1};
    const route=[...routes].filter(entry=>entry.accepts(point)).sort((a,b)=>b.priority-a.priority)[0];
    route.handler(point);route.handler({...point,phase:'end'});
  }
  tapHome('nav-shop');
  assert.equal(lobby.tab,'battle');
  tapHome('nav-assembly');
  assert.equal(lobby.tab,'assembly');
  f.paint();
  assert(f.images.has(equippedIcon));
  assert(modelLayouts>0);
  assert.deepEqual(loading,[]);
  lobby.switchTab('supply');f.paint();
  assert(f.images.has(portrait),'the full portrait is ready on entry');
  lobby.update(.016);lobby.setVisible(false);
  assert.equal(device.warmFirstSortieMenus(signal),false);
});

test('WeChat shows a locked-stage message without flashing the last navigation button',async t=>{
  const f=fixture(t),{device,platform,region}=f;
  const messages=[],actions=[];
  const feedback=createLobbyFeedback(device,{
    now:platform.now,reducedMotion:()=>true,layout:()=>({bounds:screen}),
  });
  device.feedback=feedback;
  device.toast={show:message=>messages.push(message),clear(){},draw(){}};
  Object.assign(device,lobbyPanels(device,{inspectItems:()=>({open(){},close(){},destroy(){}})}));
  let menu,sendHome;
  device.supportsMenu=tab=>tab==='shop';
  device.mountMenu=(_page,...args)=>menu=mountWechatMenu(device,platform,region,...args);
  device.mountHome=(page,send)=>{
    sendHome=send;
    return {page,selectPilot(){},setGuide(){},close(){}};
  };
  const snapshot={...shopSnapshot(),stages:[{index:0,unlocked:true},{index:1,unlocked:false}]};
  const bridge={
    app:{renderer:device},activeLobbyTab:'shop',getPeripheralSnapshot:()=>snapshot,
    peripheralAction(action,data){
      actions.push([action,data.index]);
      return {ok:false,message:'关卡未解锁或暂不可用'};
    },
  };
  const presentation={
    root:{},modalRoot:region,hidden:()=>false,busy(){},
    portraitPlayer:{setVisible(){},sync(){},destroy(){}},
    showPage:()=>region,blockPage(){},clearModal(){},setVisible(){},close(){},
  };
  const lobby=createThreeLobbyController({bridge,presentation});
  t.after(()=>{lobby.destroy();feedback.close();});
  f.paint();
  const battle=menu.state().controls.find(control=>control.id==='nav-battle');
  assert(battle);
  f.click(battle);
  assert.equal(lobby.tab,'battle');

  await sendHome('chapterNext',{},region);
  await sendHome('start',{},region);

  assert.deepEqual(actions,[['start',1]]);
  assert.deepEqual(messages,['关卡未解锁或暂不可用']);
  assert.equal(feedback.active,false);
});

test('WeChat first-sortie guide dims the lobby and unlocks lobby navigation after play',async t=>{
  const f=fixture(t,undefined,{viewport:{safeTop:content.y}}),sent=[],meshes=[];
  const {device,region,renderer}=f;
  device.reducedMotion=()=>true;device.safeBottom=()=>34;
  device.feedback={pulse(){},power(){},wallet(){},clear(){}};
  device.toast={show(){},clear(){}};
  Object.assign(device,lobbyPanels(device,{inspectItems:()=>({open(){},close(){},destroy(){}})}));
  let homeSend,escape,menuMounts=0;
  device.mountHome=(page,send)=>{homeSend=send;return {page,selectPilot(){},setGuide(){},close(){}};};
  device.supportsMenu=tab=>tab==='assembly';
  device.mountMenu=page=>{menuMounts++;return {page,update(){},portraitChanged(){},setGuide(){},close(){}};};
  const page={},portraitPlayer={setVisible(){},sync(){},destroy(){}};
  const presentation={root:{},modalRoot:region,portraitPlayer,hidden:()=>false,busy(){},
    showPage:()=>page,blockPage(){},clearModal(){},setVisible(){},close(){},
    bindBack(fn){escape=fn;return ()=>{};}};
  let snapshot={firstSortieRequired:true,selectedStageIndex:2,wallet:{},pilots:[],aircraft:[],weapons:[],stages:[0,1,2].map(index=>({index,unlocked:true}))};
  const bridge={app:{renderer:device},activeLobbyTab:'assembly',getPeripheralSnapshot:()=>snapshot,
    peripheralAction(action,data){sent.push([action,data]);return {ok:true,started:true};}};
  const lobby=createThreeLobbyController({bridge,presentation});
  t.after(lobby.destroy);
  assert.equal(lobby.tab,'battle');
  assert.equal(lobby.state.modal,'firstSortie');
  assert.equal(device.panel.fullscreen,false);
  const stage=createHomeStage(new Map(homePictures.map(([id])=>[id,{id,width:256,height:256}])));
  t.after(stage.dispose);
  const startVisible=[];
  const lobbyRenderer={render(scene){
    startVisible.push(scene.children.some(mesh=>mesh.visible&&mesh.material.uniforms.art.value.image.id==='start'));
  }};
  stage.drawInFront(lobbyRenderer,true);
  stage.drawInFront(lobbyRenderer);
  assert.deepEqual(startVisible,[false,true],'the ordinary lobby start returns after onboarding');
  renderer.render=scene=>meshes.push(...scene.children[0].children.filter(mesh=>mesh.visible));
  device.panel.draw(renderer);
  const cover=meshes[0];
  assert.equal(cover.material.color.getHex(),0x020b13);
  assert.equal(cover.material.opacity,.6);
  assert.equal(cover.scale.x,screen.width);
  assert.equal(Math.abs(cover.scale.y),screen.height);
  assert.equal(cover.position.y,screen.height/2-content.y);
  assert.deepEqual(device.panel.state().controls.map(c=>c.id),['start']);
  const start=device.panel.state().controls[0];
  f.point('start',4,4);f.point('end',4,4);
  escape({key:'Escape'});lobby.switchTab('assembly');
  await homeSend('tab',{tab:'shop'},region);
  await homeSend('chapterNext',{},region);
  assert.equal(lobby.state.modal,'firstSortie');
  assert.equal(menuMounts,0);assert.deepEqual(sent,[]);
  const robot='/art/onboarding-assistant-v1/expressions.png';
  for(const [url,resolve] of f.requests)resolve({url,width:url===robot?1024:256,height:256});
  await Promise.resolve();
  meshes.length=0;device.panel.invalidate();device.panel.draw(renderer);
  const findArt=url=>meshes.find(mesh=>mesh.material.map?.image?.url===optimizeUiAssetUrls(url));
  const frameArt='/art/psd-equipment-v1/frame-gold.png',captionArt='/art/onboarding-dialogue-v2/panel.webp';
  for(const url of [robot,homeArt.pointer,'/art/psd-main-v1/buttons/start.png',frameArt,captionArt])
    assert(findArt(url),url);
  const [x,y,w,h]=homeControls({}, {width:screen.width,height:screen.height,safeTop:content.y,safeBottom:34},[]).find(c=>c.id==='start').box;
  const expected=[x*screen.width/750,y*screen.height/1624,w*screen.width/750,h*screen.height/1624];
  [start.x,start.y,start.w,start.h].forEach((value,i)=>assert(Math.abs(value-expected[i])<1e-6));
  const ring=findArt(frameArt);
  assert.equal(ring.geometry.attributes.position.count,48,'the gold frame leaves the start button visible');
  assert.equal(ring.scale.x,start.w+8);
  assert.equal(Math.abs(ring.scale.y),start.h+8);
  assert.equal(ring.position.x,start.x+start.w/2);
  assert.equal(ring.position.y,start.y-content.y+start.h/2);
  const caption=findArt(captionArt),assistant=findArt(robot),arrow=findArt(homeArt.pointer);
  const captionWords=meshes.find(mesh=>mesh.userData.uiText==='第一关');
  assert(captionWords,'the first-level caption is drawn');
  const assistantLeft=assistant.position.x-assistant.scale.x/2,assistantRight=assistant.position.x+assistant.scale.x/2;
  const captionLeft=caption.position.x-caption.scale.x/2,captionRight=caption.position.x+caption.scale.x/2;
  assert(assistantRight<captionLeft,'the assistant and the caption plate have a gap');
  assert(Math.abs(caption.position.y-assistant.position.y)<1e-6,'the caption plate and the assistant share a row');
  assert(Math.abs(captionWords.position.x-caption.position.x)<1e-6,'the text is centered horizontally on the caption plate');
  assert(Math.abs(captionWords.position.y-caption.position.y)<1e-6,'the text is centered vertically on the caption plate');
  assert(Math.abs((assistantLeft+captionRight)/2-ring.position.x)<1e-6,'the guide row is centered over Start');
  assert.equal(arrow.position.x,ring.position.x);
  assert(arrow.position.y+Math.abs(arrow.scale.y)/2<ring.position.y-Math.abs(ring.scale.y)/2);
  f.click(start);
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(sent,[['start',{index:0,stageIndex:0}]]);
  lobby.setVisible(false);lobby.setVisible(true);
  assert.equal(lobby.state.modal,'firstSortie','returning without a recorded run keeps the guide');
  lobby.setVisible(false);snapshot={...snapshot,firstSortieRequired:false};lobby.setVisible(true);
  assert.equal(lobby.state.modal,null);assert.equal(device.panel,null);
  assert.equal(lobby.tab,'battle');assert.equal(menuMounts,0);
  await homeSend('tab',{tab:'assembly'},region);
  assert.equal(lobby.tab,'assembly');assert.equal(menuMounts,1);
});

for(const won of [false,true]){
  test('WeChat guides a new player through equipping after first-battle '+(won?'victory':'defeat'),async t=>{
    const {device,region,renderer}=fixture(t);
    const save=new Map(),storage={getItem:key=>save.get(key)??null,setItem:(key,value)=>save.set(key,value)};
    const collection=createInitialGachaState();
    const system=createPeripheralSystem({storage,profile:{coins:0,diamonds:0},stages:[{id:'stage-0',name:'第一章'}],
      now:()=>Date.UTC(2026,10,24,4),rng:()=>.5,saveProfile:()=>true,
      collectionApi:{get:()=>collection,transact:change=>change(collection)},
      pilotApi:{get:()=>({selected:'pilot-01',persistentSelected:'pilot-01',owned:['pilot-01'],resonance:{}})}});
    device.reducedMotion=()=>true;device.safeBottom=()=>34;
    device.feedback={pulse(){},power(){},wallet(){},clear(){}};
    device.toast={show(){},clear(){}};
    Object.assign(device,lobbyPanels(device,{inspectItems:()=>({open(){},close(){},destroy(){}})}));
    let sendHome,send,guide,settled=false;
    const tabs=[];
    device.mountHome=(page,action)=>{
      sendHome=action;
      return {page,selectPilot(){},setGuide(value){guide=value;},close(){}};
    };
    device.supportsMenu=tab=>tab==='assembly';
    device.mountMenu=(page,action)=>{
      send=action;
      return {page,update(){},tick(){},portraitChanged:()=>false,close(){},
        canGuidePanel:id=>device.panel?.state().controls.some(control=>control.id===id&&!control.disabled),
        setGuide(value){guide=value;device.panel?.setGuideTarget(value?.modal?value.id:null);}};
    };
    const page={},portraitPlayer={setVisible(){},sync(){},destroy(){}};
    const presentation={root:{},modalRoot:region,portraitPlayer,hidden:()=>false,busy(){},
      showPage:()=>page,blockPage(){},clearModal(){},setVisible(){},close(){},retainModal:()=>({overlay:region,restore(){}})};
    const bridge={app:{renderer:device},switchLobbyTab:tab=>tabs.push(tab),getPeripheralSnapshot(){
      const snapshot=system.snapshot();
      if(won)snapshot.accountExperience={...snapshot.accountExperience,level:settled?2:1};
      return snapshot;
    }};
    const lobby=createThreeLobbyController({bridge,system,presentation,deferFirstSortieLobby:true});
    t.after(lobby.destroy);
    assert.equal(lobby.state.visible,false);
    assert.equal(lobby.state.modal,null);
    assert.equal(sendHome,undefined);
    assert(lobby.snapshot.equipment.items.every(item=>!item.equipped));
    const run=system.prepareSortie({engine:'danke-replica-v1',chapterId:1,replicaConfiguration:system.replicaConfiguration()});
    assert(run.ok,run.message);lobby.setVisible(false);
    const receipt=system.recordSortie({engine:'danke-replica-v1',runId:run.snapshot.id,chapterId:1,stageIndex:0,
      endReason:won?'victory':'defeat',won,wave:won?15:1,clock:won?270:35,gold:0,level:2});
    assert(receipt.ok,receipt.message);settled=true;lobby.setVisible(true);
    assert.equal(lobby.tab,'battle');assert.equal(lobby.state.modal,null);
    assert.deepEqual(tabs,[]);
    assert.deepEqual(guide,{id:'nav-assembly',text:'点击装备',strong:true,modal:false});
    assert.equal(lobby.snapshot.firstSortieRequired,false);
    assert.deepEqual(lobby.snapshot.replicaCampaign.clearedChapterIds,won?[1]:[]);
    await sendHome('tab',{tab:'assembly'},region);lobby.update(.016);
    assert.deepEqual(tabs,['assembly']);
    assert.equal(lobby.tab,'assembly');
    const item=lobby.snapshot.equipment.items.find(row=>!row.equipped);
    assert.deepEqual(guide,{id:'gear-'+item.uid,text:'查看这件装备',strong:true,modal:false});
    await send('gearDetail',{id:item.uid,gearOrigin:'warehouse'},region);
    assert.equal(lobby.state.modal,'gearDetail');device.panel.draw(renderer);lobby.update(.016);
    assert.deepEqual(guide,{id:'gearEquip',text:'装配这件装备',strong:true,modal:true});
    await send('gearEquip',{id:item.uid},region);
    assert.equal(system.snapshot().equipment.slots[item.type],item.uid);
    assert(system.state.onboarding.completed.includes(9));
    lobby.update(.016);
    assert.equal(guide,null);
    assert.equal(lobby.state.modal,won?'processFeedback':null,'queued feedback resumes after teaching equipment');
  });
}

for(const [width,height,safeTop,safeBottom,pending] of [[390,844,85,34,false],[320,568,24,0,true]]){
  test('WeChat chapter reward covers the viewport and fits without scrolling at '+width+' × '+height,async t=>{
    const f=fixture(t),frame={x:0,y:0,left:0,top:0,right:width,bottom:height,width,height};
    const bounds={...frame,y:safeTop,top:safeTop,height:height-safeTop};
    const host={...f.region,bounds:()=>bounds,frameBounds:()=>frame};
    f.platform.viewport={...f.platform.viewport,screen:frame,safeTop,safeBottom};
    f.device.reducedMotion=()=>true;
    f.device.safeBottom=()=>safeBottom;
    const dialog=openChapterPanel(f.device,host,(...args)=>f.commands.push(args),'chapterChest');
    t.after(dialog.close);
    const rewards=[{id:1,count:1000}];
    if(pending)rewards.push({id:105,count:10},{id:107,count:10,unverified:true});
    dialog.update({wallet:{coins:2173,diamonds:220,stamina:32},rewardPending:pending,
      nativeAcquisition:{revision:3,rewards:[{id:1,missionId:1,wave:5,canClaim:true,rewards}]},
      starRewards:{native:true,modes:[{id:'easy'}]}}, {type:'chapterChest'},'chapter');
    const meshes=[];
    f.renderer.render=scene=>{meshes.push(...scene.children[0].children.filter(mesh=>mesh.visible));};
    const {panel}=f.device;
    const draw=()=>{meshes.length=0;panel.draw(f.renderer);};
    const control=id=>panel.state().controls.find(c=>c.id===id);
    const rect=mesh=>{
      assert(mesh,'expected a visible chapter reward mesh');
      const {position,scale}=mesh,halfW=scale.x/2,halfH=Math.abs(scale.y)/2;
      return [position.x-halfW,position.y-halfH,position.x+halfW,position.y+halfH];
    };
    const image=path=>meshes.find(mesh=>mesh.material.map?.image?.url===optimizeUiAssetUrls(path));
    draw();
    const ids=['reward-item-0','claim','stars','close'],before=ids.map(control);
    const reward=before[0];
    f.drag(width/2,reward.y+reward.h/2,120);
    assert.deepEqual(ids.map(control),before,'dragging must leave the reward layout fixed');
    f.drag(width/2,reward.y+reward.h/2,-120);
    assert.deepEqual(ids.map(control),before);
    draw();
    const frameRect=[0,-safeTop,width,height-safeTop];
    assert(meshes.some(mesh=>!mesh.material.map&&mesh.material.opacity===1&&
      rect(mesh).every((edge,i)=>Math.abs(edge-frameRect[i])<1e-6)), 'opaque fallback covers the safe areas');
    const scene='/art/chapter-reward-scene-v2/background.png',node='/art/chapter-reward-node-v1/node.png';
    const banner='/art/psd-choice-v1/banner.png',tray='/art/chapter-details-tray-v1/tray.png';
    const sizes={[scene]:[852,1846],[node]:[1157,1360],[banner]:[756,239]};
    for(const [url,resolve] of f.requests){
      const path=Object.keys(sizes).find(path=>optimizeUiAssetUrls(path)===url);
      const [width,height]=sizes[path]||[128,128];
      resolve({url,width,height});
    }
    await Promise.resolve();
    panel.invalidate();draw();
    const bg=rect(image(scene));
    assert(bg[0]<=0&&bg[1]<=-safeTop&&bg[2]>=width&&bg[3]>=height-safeTop);
    assert(rect(image(banner))[3]<=rect(image(node))[1], 'badge starts below the title');
    assert(rect(image(node))[3]<=rect(image(tray))[1], 'reward tray starts below the badge');
    const claim=control('claim'),stars=control('stars'),back=control('close');
    assert(rect(image(tray))[3]<=claim.y-safeTop, 'claim stays below the reward tray');
    assert(claim.y+claim.h<=stars.y);
    assert(stars.y+stars.h<=height-safeBottom&&back.y+back.h<=height-safeBottom);
    assert.equal(claim.disabled,pending);
    f.click(claim);
    if(pending){
      assert.equal(f.commands.length,0);
      f.click(control('save-retry'));
      assert.equal(f.commands.at(-1)[0],'recoverDailyRewards');
    }else assert.deepEqual(f.commands.at(-1).slice(0,2),['nativeChapterReward',{id:1,revision:3}]);
    f.click(stars);f.click(back);
    assert.deepEqual(f.commands.slice(-2).map(([action])=>action),['nativeStarRewards','close']);
  });
}

const activityFrames=Array.from({length:9},(_,i)=>optimizeUiAssetUrls('/art/psd-popup-v1/primary-'+Math.floor(i/3)+'-'+i%3+'.png'));
const activityClose=optimizeUiAssetUrls('/art/psd-popup-v1/close.png');
function makeActivityDialog(t,f,kind,{entryWaitMs}={}){
  f.device.reducedMotion=()=>true;
  const send=(...args)=>f.commands.push(args),prepareArtwork=createMenuArtworkWarmup(f.platform);
  const options={prepareArtwork,entryWaitMs};
  const snapshot={weapons:[],aircraft:[],pilots:[],
    activity:{daily:{points:10,items:[{id:'first',points:20}]}},
    tasks:[{type:'daily',id:'battle1',name:'完成出战任务',progress:0,target:1,activityPoints:20,reward:{coins:100}}],
  };
  const reward={name:'金币',amount:100,type:'coins',image:'/art/example-reward.png',qualityRank:1};
  snapshot.carnival={day:1,days:[{day:1,unlocked:true,tasks:[
    {id:'login',name:'累计登录',progress:0,target:1},{id:'ready',name:'通关第一章',progress:1,target:1,canClaim:true},
  ]},{day:2,unlocked:false,tasks:[]}],
    points:100,maxPoints:700,milestones:[{points:100,canClaim:true,reward:{kind:'resource'},rewards:[reward]}],
    taskReward:reward,taskPoints:10,revision:3,inventoryRevision:4,equipmentRevision:5,observedAt:0,expiresAt:3600000,
  };
  const dialog=kind==='tasks'?openTaskPanel(f.device,f.region,send,'tasks',new Map(),options):
    openCarnivalPanel(f.device,f.region,send,options);
  t.after(dialog.close);
  const modal=kind==='tasks'?{type:'tasks',period:'daily'}:{type:'carnival',day:1};
  dialog.update(snapshot,modal,'lobby');
  return {dialog,snapshot};
}

for(const [kind,title,control] of [['tasks','任务','action-battle1'],['carnival','七日嘉年华','action-login']]){
  test(`WeChat ${kind} prepares its complete first frame offscreen and binds input only when opened`,async t=>{
    const f=fixture(t),uploads=new Set(),bound=f.touchBindings;
    f.renderer.initTexture=texture=>uploads.add(texture);
    const {dialog,snapshot}=makeActivityDialog(t,f,kind);
    assert(!dialog.prepareOffscreen());
    assert.equal(f.touchBindings,bound);
    assert.equal(f.device.panel,undefined);
    for(const [url,resolve] of f.requests)resolve({url,width:90,height:70});
    await Promise.resolve();
    let ready=false;
    for(let frame=0;frame<50&&!ready;frame++)ready=dialog.prepareOffscreen();
    assert(ready);
    assert(f.texts.size===0,'background preparation does not paint');
    assert(f.touchBindings===bound,'background preparation never owns touch input');
    const canvases=f.canvases;
    dialog.activate();
    f.device.panel.draw(f.renderer);
    assert(f.texts.has(title));
    assert(f.device.panel.state().ready);
    assert.equal(f.canvases,canvases,'first visible frame reuses the prepared text');
    for(const url of [...activityFrames,activityClose]){
      assert(f.images.has(url),url);
      assert(uploads.has(f.images.get(url).material.map),url);
    }
    assert.equal(f.touchBindings,bound+1);
    const find=id=>f.device.panel.state().controls.find(c=>c.id===id);
    f.click(find(control));
    assert.equal(f.commands.at(-1)?.[0],kind==='tasks'?'dailyGo':'carnivalGo');
    if(kind==='carnival'){
      const artwork=['/art/project-tabs-v1/tab-active.png','/art/project-tabs-v1/tab-inactive.png',
        '/art/project-task-icons-v1/activity-medal.png','/art/project-action-buttons-v1/task-claim.png',
        '/art/psd-equipment-v1/button-gold.png'];
      for(const url of artwork)assert(f.images.has(optimizeUiAssetUrls(url)),url);
      assert(f.texts.has('+10'));
      assert(!f.texts.has('待开启'),'locked dates have no subtitle');
      const tab=style=>f.images.get(optimizeUiAssetUrls('/art/project-tabs-v1/tab-'+style+'.png'));
      const shade=style=>{
        const shader={fragmentShader:'#include <map_fragment>',uniforms:{}};
        tab(style).material.onBeforeCompile(shader);
        return shader.uniforms.dateTabShade.value;
      };
      const black=[.006,.026],gray=[.225,.335];
      assert.deepEqual(shade('active'),black,'the unlocked date is black');
      assert.deepEqual(shade('inactive'),gray,'the upcoming date is gray');
      assert.equal(tab('inactive').scale.y,tab('active').scale.y,'both date buttons have the same height');
      f.click(find('day-2'));
      assert.deepEqual(f.commands.at(-1).slice(0,2),['carnivalDay',{id:2}]);
      for(const [id,kind,reward] of [['action-ready','task','ready'],['claim-milestone','milestone',100]]){
        f.click(find(id));
        assert.deepEqual(f.commands.at(-1).slice(0,2),['carnivalClaim',{
          expectedRevision:3,expectedInventoryRevision:4,expectedEquipmentRevision:5,kind,id:reward,
        }]);
      }
      const nextDay={type:'carnival',day:2};
      dialog.update(snapshot,nextDay,'lobby');
      f.device.panel.draw(f.renderer);
      assert.deepEqual(shade('active'),gray,'a selected date stays gray while locked');
      assert.deepEqual(shade('inactive'),black,'an unlocked date stays black when deselected');
      const {carnival}=snapshot;
      const days=carnival.days.map(day=>({...day,unlocked:true}));
      dialog.update({...snapshot,carnival:{...carnival,day:2,days}},nextDay,'lobby');
      f.device.panel.draw(f.renderer);
      assert.deepEqual(shade('active'),black,'the selected date turns black at unlock');
    }
  });
}

test('WeChat carnival shows milestone details on the reward icon and keeps counts on tiles',async t=>{
  const f=fixture(t),{dialog,snapshot}=makeActivityDialog(t,f,'carnival');
  const blueprint={id:10010007,amount:100,name:'随机装备图纸',
    image:'/art/project-equipment-blueprints-v2/equipment-blueprints.svg'};
  const ticket={id:112,amount:5,name:'高级装备箱券',image:'/art/project-supplement-icons-v1/advanced-ticket.png'};
  const epic={id:923,amount:1,name:'随机史诗圣环装备',image:'/art/project-supplement-icons-v1/gear-choice-box.png',
    qualityRank:3,qualityKnown:true};
  snapshot.nativeAcquisition={materials:[{id:112,count:3}]};
  snapshot.carnival.milestones=[
    {points:100,canClaim:true,reward:{kind:'materials'},rewards:[blueprint]},
    {points:200,canClaim:false,reward:{kind:'item'},rewards:[ticket]},
    {points:700,canClaim:false,reward:{kind:'equipment',rank:1},rewards:[epic]},
  ];
  const update=milestone=>dialog.update(snapshot,{type:'carnival',day:1,milestone},'lobby');
  update(200);
  dialog.activate();
  const panel=f.device.panel,find=id=>panel.state().controls.find(c=>c.id===id);
  async function paint(){
    for(let i=0;i<10;i++){
      for(const [url,resolve] of f.requests)resolve({url,width:90,height:70});
      await Promise.resolve();
      f.paint(40);
    }
    panel.draw(f.renderer);
  }
  await paint();
  assert(f.texts.has('200 活跃奖励'));
  assert(f.texts.has('×100'));
  assert(![...f.texts].some(text=>text.includes('随机装备图纸')||text.includes('高级装备箱券')));
  const claim=find('claim-milestone'),heading=f.textMeshes.get('200 活跃奖励');
  assert.equal(heading.position.y,claim.y-f.region.bounds().y+claim.h/2);

  f.click(find('milestone-reward-100'));
  assert.deepEqual(f.commands.map(command=>command.slice(0,2)),[['carnivalMilestone',{id:100}]]);
  update(100);
  await paint();
  assert(f.texts.has('随机装备图纸'));
  assert(f.texts.has('随机获得五种装备部位图纸中的一种。'));
  assert(find('inspect-close'));
  assert.equal(find('claim-milestone'),undefined);
  f.click(find('inspect-close'));
  await paint();
  assert.equal(find('inspect-close'),undefined);
  assert(f.texts.has('100 活跃奖励'));
  assert(find('claim-milestone'));

  f.click(find('milestone-reward-200'));
  update(200);
  await paint();
  assert(f.texts.has('高级装备箱券'));
  assert(f.texts.has('开启高级装备箱时消耗。'));
  assert(f.texts.has('持有数量：'));
  assert(f.texts.has('3'));
  f.click(find('inspect-close'));
  await paint();

  f.click(find('milestone-reward-700'));
  update(700);
  await paint();
  assert(f.texts.has('随机史诗圣环装备'));
  assert(f.texts.has('领取时随机获得一件史诗圣环装备。'));
  assert(!f.texts.has('随机杰出S装备宝箱'));
  assert(f.commands.every(([action])=>action==='carnivalMilestone'));
});

test('WeChat task dialog has a complete fallback frame and reveals slow artwork together',async t=>{
  const f=fixture(t),{dialog}=makeActivityDialog(t,f,'tasks',{entryWaitMs:0});
  dialog.activate();
  f.device.panel.draw(f.renderer);
  assert(f.texts.has('任务'));
  assert(f.device.panel.state().controls.some(c=>c.id==='close'));
  const resolve=url=>{f.requests.get(url)({url,width:90,height:70});f.requests.delete(url);};
  resolve(activityFrames[0]);resolve(activityClose);
  await Promise.resolve();
  f.device.panel.draw(f.renderer);
  assert(!f.images.has(activityFrames[0]));
  assert(!f.images.has(activityClose));
  f.click(f.device.panel.state().controls.find(c=>c.id==='close'));
  assert.equal(f.commands.at(-1)?.[0],'close');
  for(const url of f.requests.keys())resolve(url);
  await Promise.resolve();
  f.device.panel.draw(f.renderer);
  for(const url of [...activityFrames,activityClose])assert(f.images.has(url),url);
});

test('WeChat locked task tabs show their chapter condition without switching pages',async t=>{
  const f=fixture(t),time=Date.UTC(2026,0,1),inventory={version:1,revision:0,items:{}};
  const {device,region}=f,messages=[];
  const progression=createReplicaProgression();
  const snapshotFor=replicaCampaign=>({weapons:[],aircraft:[],pilots:[],replicaCampaign,
    signIn:flightRewardsSnapshot(undefined,inventory,replicaCampaign,time).signIn,
    pilotSupply:pilotSupplySnapshot(undefined,inventory,progression,time,replicaCampaign),
    achievements:{items:[{id:'login-achievement',name:'累计登录',progress:0,target:2,destination:'signin'}]},
  });
  const beforeSignIn=snapshotFor({clearedChapterIds:[1],passedWaves:{2:13}});
  const atSignIn=snapshotFor({clearedChapterIds:[1],passedWaves:{2:14}});
  const atRecurring=snapshotFor({clearedChapterIds:[1,2,3]});
  let snapshot=beforeSignIn,sendHome;
  device.reducedMotion=()=>true;
  device.feedback={pulse(){},power(){},wallet(){},clear(){}};
  device.toast={show:message=>messages.push(message),clear(){}};
  device.supportsMenu=()=>false;
  device.mountHome=(page,send)=>{
    sendHome=send;
    return {page,selectPilot(){},setGuide(){},tick(){},close(){}};
  };
  Object.assign(device,lobbyPanels(device,{inspectItems:()=>({open(){},close(){},destroy(){}})}));
  const bridge={app:{renderer:device},getPeripheralSnapshot:()=>snapshot,
    peripheralAction(){assert.fail('a task tab never requests a reward');}};
  const presentation={root:{},modalRoot:region,hidden:()=>false,busy(){},
    portraitPlayer:{setVisible(){},sync(){},destroy(){}},
    showPage:()=>region,blockPage(){},clearModal(){},setVisible(){},close(){}};
  const lobby=createThreeLobbyController({bridge,presentation});
  t.after(lobby.destroy);
  await sendHome('tasks',{},region);

  const controls=()=>device.panel.state().controls;
  function draw(lockedIds){
    f.texts.clear();
    device.panel.draw(f.renderer);
    const rows=controls(),tabs=rows.filter(row=>row.id.startsWith('tab-'));
    assert.deepEqual(tabs.map(tab=>tab.id),['tab-signin','tab-daily','tab-weekly','tab-achievements']);
    assert.deepEqual(tabs.filter(tab=>tab.label.endsWith('，未解锁')).map(tab=>tab.id),lockedIds.map(id=>'tab-'+id));
    assert(![...f.texts].some(text=>text.startsWith('到达第')));
    return rows;
  }
  function tap(id){f.click(controls().find(control=>control.id==='tab-'+id));}
  const allLocked=['signin','daily','weekly'],recurringLocked=['daily','weekly'];
  function assertAchievements(rows){
    assert(f.texts.has('累计登录'));
    assert(!rows.some(c=>c.id.startsWith('chest-')||c.id.startsWith('day-')));
  }
  assertAchievements(draw(allLocked));
  assert(!controls().some(c=>c.id==='action-login-achievement'));
  for(const period of allLocked){
    tap(period);
    assertAchievements(draw(allLocked));
  }
  assert.deepEqual(messages,[beforeSignIn.signIn.gate.reason,beforeSignIn.pilotSupply.taskGate.reason,beforeSignIn.pilotSupply.taskGate.reason]);

  snapshot=atSignIn;lobby.update(1);
  assert(draw(recurringLocked).some(c=>c.id==='action-login-achievement'));
  tap('signin');draw(recurringLocked);
  assert(f.texts.has('第 1 天'));
  assert.equal(messages.length,3,'the newly unlocked tab switches pages without a toast');
  snapshot=atRecurring;lobby.update(1);
  tap('daily');draw([]);
  assert(f.texts.has('每日活跃'));
  tap('weekly');draw([]);
  assert(f.texts.has('每周活跃'));

  snapshot={...beforeSignIn,signIn:{...beforeSignIn.signIn,starterPending:true,canClaim:true}};
  lobby.update(1);draw(recurringLocked);
  assert(f.texts.has('第 1 天'),'a pending sign-in reward is still accessible');
  const dateWarning='日期异常，请恢复设备日期';
  const timeChanged=snapshot=>({...snapshot,pilotSupply:{...snapshot.pilotSupply,clockRollback:true,
    taskGate:{...snapshot.pilotSupply.taskGate,reached:false,reason:dateWarning}}});
  snapshot=timeChanged(beforeSignIn);lobby.update(1);draw(allLocked);
  tap('daily');
  assert.equal(messages.at(-1),beforeSignIn.pilotSupply.taskGate.reason);
  snapshot=timeChanged(atRecurring);lobby.update(1);
  tap('daily');draw([]);
  assert(f.texts.has(dateWarning),'an already unlocked tab still explains a device date issue');
});

test('WeChat unlocked sign-in shows late reward artwork after switching tabs',async t=>{
  const f=fixture(t),prepareArtwork=createMenuArtworkWarmup(f.platform);
  f.device.reducedMotion=()=>true;
  f.device.repaintHome=()=>f.device.panel?.draw(f.renderer);
  const {signIn}=flightRewardsSnapshot(undefined, {items:{}}, {passedWaves:{2:14}}, Date.UTC(2026,0,1));
  const snapshot={weapons:[],aircraft:[],pilots:[],signIn};
  const dialog=openTaskPanel(f.device,f.region,(action,data)=>{
    if(action==='taskPeriod')update(data.period);
    else if(action==='close')dialog.close();
  },'tasks',new Map(),{prepareArtwork,entryWaitMs:0});
  t.after(dialog.close);
  function update(period){dialog.update(snapshot,{type:'tasks',period},'lobby');}
  const control=id=>f.device.panel.state().controls.find(c=>c.id===id);
  async function resolveRequests(){
    for(const [url,resolve] of f.requests)resolve({url,width:90,height:70});
    f.requests.clear();
    await Promise.resolve();
  }
  update('daily');
  dialog.prepareOffscreen();
  await resolveRequests();
  let ready=false;
  for(let frame=0;frame<50&&!ready;frame++)ready=dialog.prepareOffscreen();
  assert(ready);
  dialog.activate();
  f.paint();
  f.click(control('tab-signin'));
  f.paint();
  assert(!f.texts.has(signIn.gate.reason));
  assert.equal(control('day-1').disabled,false);
  const rewards=new Set(signIn.days.flatMap(day=>day.rewards.map(row=>optimizeUiAssetUrls(taskReward(row,snapshot,true).image))));
  assert(rewards.size>4);
  for(const url of rewards)assert(f.requests.has(url),url);
  f.click(control('tab-weekly'));
  f.paint();
  assert(f.texts.has('每周活跃'));
  f.click(control('tab-signin'));
  f.paint();
  await resolveRequests();
  await new Promise(resolve=>setTimeout(resolve,65));
  for(let frame=0;frame<12&&!f.device.panel.state().ready;frame++)f.paint();
  for(const url of rewards)assert(f.images.has(url),url);
  assert(f.device.panel.state().ready);
  f.click(control('close'));
  assert.equal(f.device.panel,null);
});

function equipmentSnapshot(){
  const items=Array.from({length:80},(_,i)=>({
    uid:String(i+1).padStart(3,'0'),type:i===79?5:1,name:'测试装备 '+(i+1),quality:10,qualityRank:0,level:i+1,
    art:i===79?'sets-v3/4500400':'cockpit',
  }));
  return {wallet:{},pilots:[],aircraft:[],aircraftId:'pilot-01',
    equipment:{items,slots:{},fodder:{'1:40':2},blueprints:[{type:1,id:'cockpit',name:'头盔'}]}};
}

function shopSnapshot(){
  const offer=(id,reward,section)=>({id,reward,section,remaining:1,available:true,cost:{type:'diamonds',amount:2}});
  const items=Array.from({length:9},(_,i)=>offer('daily-'+i,{['blueprint'+(i%5+1)]:i+1},'daily'));
  items.push(offer('exchange-coins',{coins:1000}),offer('exchange-coins-medium',{coins:10000}),
    offer('exchange-coins-large',{coins:50000}));
  return {wallet:{diamonds:100},equipment:{keys:{}},shop:{items,refresh:{freeRemaining:1,available:true}},
    nativeAcquisition:{equipmentBoxes:[3,4].map(id=>({id,quotes:[{count:1,payment:'free',canDraw:true}]}))}};
}

test('WeChat pilot catalog can return or change tabs before artwork and starts the portrait after painting',t=>{
  const f=fixture(t),stage={star:1,skills:[]};
  const pilot={id:40100,name:'测试驾驶员',quality:10,owned:true,star:1,stage,stages:[stage]};
  f.view.update({tab:'pilot',catalog:{id:pilot.id},snapshot:{replicaCollection:{pilots:[pilot]}}},'pilot');
  f.paint();
  assert.ok(f.requests.size>0);
  assert.deepEqual(f.events,['paint']);
  assert.ok(f.texts.has('返回'));
  assert.ok(f.texts.has('技能'));
  f.paint();
  assert.deepEqual(f.events,['paint','portrait']);
  f.click(f.control('mode-skills'));
  f.click(f.control('back'));
  assert.deepEqual(f.commands.map(([command])=>command),['catalogMode','catalogBack']);
  f.events.length=0;
  f.park();
  f.activate();
  f.paint();
  assert.deepEqual(f.events,['paint']);
  f.park();
  f.paint();
  assert.deepEqual(f.events,['paint']);
});

test('WeChat menu image reuse shares a pending decode and evicts small images in access order',async()=>{
  const reads=[];
  const load=createArtworkLoader({address:url=>url,cachePixels:400,openImage:async url=>{
    reads.push(url);
    return {width:url==='large'?20:10,height:10};
  }});
  const pending=load('a');
  assert.equal(load('a',2,true),pending);
  const image=await pending;
  for(const url of ['b','c','d'])await load(url,1,true);
  assert.equal(await load('a',1,true),image);
  await load('e',1,true);
  assert.equal(await load('a',1,true),image);
  await load('b',1,true);
  await load('large',1,true);await load('large',1,true);
  await load('ordinary');await load('ordinary');
  assert.deepEqual(reads,['a','b','c','d','e','b','large','large','ordinary','ordinary']);
});

test('Two WeChat panels share an immutable texture source without asking Three to upload it again',async t=>{
  const {device,region,requests}=fixture(t);
  const image={width:512,height:512};
  async function prepare(){
    let texture;
    const panel=createLobbyPanel(device,region,'面板',(_data,_w,_h,tools)=>{
      texture=tools.texture('/art/shared.png');
    },()=>{},{prepareArtwork:()=>true});
    panel.update({},'first','first');panel.prepareOffscreen();
    requests.get(optimizeUiAssetUrls('/art/shared.png'))(image);
    await new Promise(setImmediate);panel.prepareOffscreen();
    return {panel,texture};
  }
  const first=await prepare();t.after(first.panel.close);
  const version=first.texture.source.version;
  const second=await prepare();t.after(second.panel.close);
  assert.notEqual(first.texture,second.texture);
  assert.equal(first.texture.source,second.texture.source);
  assert.equal(second.texture.source.version,version);
  assert(second.texture.version>0);
  first.panel.close();
  assert.equal(second.texture.image,image);
});

test('Trimming decoded artwork lets existing loads finish without filling the cache again',async()=>{
  let resolveVisible;
  const image={width:10,height:10};
  const load=createArtworkLoader({address:url=>url,cachePixels:400,openImage:url=>{
    if(url==='visible'&&!resolveVisible)return new Promise(resolve=>{resolveVisible=resolve;});
    return Promise.resolve({...image});
  }});
  const cached=await load('idle',1,true);
  const requested=load('visible',2,true);
  await Promise.resolve();
  load.clearDecoded();
  resolveVisible(image);
  assert.equal(await requested,image);
  assert.notEqual(await load('idle',1,true),cached);
  assert.notEqual(await load('visible',2,true),image);
});

test('Catalog artwork leaves room for foreground reads and drops queued work when the view closes',async()=>{
  const reads=new Map();
  let parked=true;
  const load=createArtworkLoader({address:url=>url,openImage:url=>new Promise(resolve=>reads.set(url,resolve))});
  const first=load('one',-2),second=load('two',-2);
  const discarded=assert.rejects(load('discarded',()=>parked?-2:-Infinity),/已取消/);
  await Promise.resolve();
  assert.deepEqual([...reads.keys()],['one','two']);
  const foreground=load('visible',2);
  await Promise.resolve();
  assert.deepEqual([...reads.keys()],['one','two','visible']);
  parked=false;
  for(const resolve of reads.values())resolve({width:10,height:10});
  await Promise.all([discarded,first,second,foreground]);
  assert.equal(reads.has('discarded'),false);
});

test('Leaving a pilot cancels the rest of its real texture list and preserves a new owner of a shared read',async t=>{
  const art=JSON.parse(await readFile(new URL('../../../../../pixigame/public/art/golden-yoga-v12/runtime.json',import.meta.url),'utf8'));
  const read=[],failures=[],flush=()=>new Promise(setImmediate);
  const base='https://example.invalid/',assets=Object.values(art.textures);
  const shared=new URL(assets.at(-1),base+'art/golden-yoga-v12/').href;
  const loader=createArtworkLoader({address:url=>url,onFailure:(_url,error)=>failures.push(error),
    openImage:url=>new Promise(resolve=>read.push({url,resolve}))});
  t.after(useArtworkLoader(loader));
  const platform={visible:true,onViewport:()=>()=>{},requestFrame:()=>1,cancelFrame(){}};
  const services={makeAbort:()=>new AbortController(),fetchResource:async()=>({ok:true,json:async()=>art})};
  const portraits=createWechatPortraits({},platform,services,{},base);
  t.after(()=>portraits.destroy());
  const pilot=portraits.openHome('pilot-05');
  pilot.layout({width:250,height:360});await flush();
  assert.equal(read.length,6);assert(!read.some(row=>row.url===shared));
  portraits.setVisible(false,{leavePage:true});
  const nextPage=loader(shared,2);
  for(const row of read)row.resolve({width:4,height:4});
  await flush();
  assert.equal(read.length,7);assert.equal(read[6].url,shared);
  const image={width:8,height:8};read[6].resolve(image);
  assert.equal(await nextPage,image);await flush();
  assert.deepEqual(failures,[]);
  portraits.setVisible(true);await flush();
  assert.equal(read.length,13);
  pilot.close();
  for(const row of read.slice(7))row.resolve(image);
  await flush();assert.equal(read.length,13);
});

test('WeChat keeps the portrait ready for ordinary sorties and releases it under memory pressure',async t=>{
  const calls=[],frames=new Map();
  let frameId=0,disposals=0;
  const api={createVideoDecoder:()=>({on(){},
    start(){calls.push('start');},stop(){calls.push('stop');},remove(){calls.push('remove');},
    getFrameData:()=>({width:4,height:2,data:new ArrayBuffer(32)}),
  })};
  const platform={visible:true,onViewport:()=>()=>{},
    requestFrame(fn){frames.set(++frameId,fn);return frameId;},
    cancelFrame:id=>frames.delete(id),
  };
  const manifest={width:2,height:2,packedWidth:4,fps:30,clips:{idle:{file:'idle.mp4'}}};
  const services={makeAbort:()=>new AbortController(),localFile:async path=>path,
    fetchResource:async()=>({ok:true,json:async()=>manifest}),
  };
  const device={three:{render(scene){
    scene.children[0].material.uniforms.frame.value.addEventListener('dispose',()=>disposals++);
  }}};
  const portraits=createWechatPortraits(api,platform,services,device,'https://example.invalid/');
  t.after(()=>portraits.destroy());
  const portrait=portraits.openHome('pilot-02');
  device.homeView={owns:surface=>surface===portrait.surface,setPose(_surface,_w,_h,draw){draw();},forget(){}};
  const flush=()=>new Promise(setImmediate);
  portrait.layout({width:200,height:200});await flush();
  assert.deepEqual(calls,['start']);
  const [frame,paint]=frames.entries().next().value;frames.delete(frame);paint();
  portraits.setVisible(false,{suspendLoading:true});await flush();
  assert.deepEqual(calls,['start','stop']);
  assert.equal(disposals,0);assert.equal(frames.size,0);
  portraits.setVisible(true);await flush();
  assert.deepEqual(calls,['start','stop','start']);
  portraits.releaseHidden();await flush();
  assert.equal(disposals,0);
  portraits.setVisible(false);await flush();
  portraits.releaseHidden();await flush();
  assert.deepEqual(calls,['start','stop','start','stop','remove']);
  assert.equal(disposals,1);assert.equal(frames.size,0);
  assert.equal(portrait.closed,false);
  portraits.setVisible(true);await flush();
  assert.deepEqual(calls,['start','stop','start','stop','remove','start']);
});

test('Packed portrait video accepts half-resolution bridge views and releases each uploaded frame',async t=>{
  const backing=new Uint8Array(48),frame=backing.subarray(8,40);
  let paint,uploaded=0,forgotten=0;
  const api={createVideoDecoder:()=>({on(){},start(){},stop(){},remove(){},
    getFrameData:()=>({width:4,height:2,data:frame})})};
  const platform={visible:true,onViewport:()=>()=>{},requestFrame(fn){paint=fn;return 1;},cancelFrame(){}};
  const manifest={width:4,height:4,packedWidth:8,fps:30,clips:{idle:{file:'idle.mp4'}}};
  const services={makeAbort:()=>new AbortController(),localFile:async path=>path,
    fetchResource:async()=>({ok:true,json:async()=>manifest})};
  const device={three:{render(scene){
    const {frame:uniform,repairSourceSize,packedSize}=scene.children[0].material.uniforms,texture=uniform.value;
    assert.deepEqual(packedSize.value.toArray(),[4,2]);
    assert.deepEqual(repairSourceSize.value.toArray(),[8,4]);
    assert.equal(texture.image.data.buffer,backing.buffer);assert.equal(texture.image.data.byteOffset,8);
    texture.onUpdate(texture);assert.equal(texture.image.data,null);uploaded++;
  }}};
  const portraits=createWechatPortraits(api,platform,services,device,'https://example.invalid/');
  t.after(()=>portraits.destroy());
  const view=portraits.openHome('pilot-08');
  device.homeView={owns:surface=>surface===view.surface,setPose(_id,_w,_h,draw){draw();},forget(){forgotten++;}};
  view.layout({width:200,height:200});await new Promise(setImmediate);
  paint();paint();assert.equal(uploaded,2);
  device.homeView=null;
  portraits.setVisible(false,{leavePage:true});
  assert.equal(forgotten,1);
});

test('WeChat native portrait waits for an in-flight start before restarting or replacing the decoder',async()=>{
  const calls=[],errors=[];
  let unblock;
  const firstStart=new Promise(resolve=>{unblock=resolve;});
  const platform={requestFrame:()=>1,cancelFrame(){}};
  const services={localFile:async path=>path};
  const api={createVideoDecoder:()=>({
    on(){},
    start({source}){calls.push('start '+source);if(source==='first')return firstStart;},
    stop(){calls.push('stop');},
    remove(){calls.push('remove');},
  })};
  const open=()=>openWechatPortraitDecoder(api,platform,services,()=>{},()=>{},error=>errors.push(error));
  const decoder=open();
  const first=decoder.play('first');
  await new Promise(setImmediate);
  assert.deepEqual(calls,['start first']);
  decoder.pause();
  const restart=decoder.play('second');
  await new Promise(setImmediate);
  assert.deepEqual(calls,['start first']);
  unblock();
  await Promise.all([first,restart]);
  assert.equal(decoder.active,true);
  assert.deepEqual(calls,['start first','stop','start second']);
  decoder.close();
  const replacement=open();
  await replacement.play('third');
  assert.deepEqual(calls,['start first','stop','start second','remove','start third']);
  assert.deepEqual(errors,[]);
  replacement.close();
});

test('WeChat shop centers its title beside the capsule and docks its five tabs',async t=>{
  const menuButton={left:306,top:50,bottom:78},safeBottom=34;
  const f=fixture(t,undefined,{viewport:{menuButton,safeContentTop:50,safeBottom}});
  f.view.update({tab:'shop',shopSection:'boxes',snapshot:shopSnapshot()},'shop');
  f.paint();

  const navArt=optimizeUiAssetUrls(art['shop-footer']);
  const navBackground=optimizeUiAssetUrls('/art/project-navigation-v2/background.png');
  f.requests.get(navArt)({url:navArt,width:738,height:148});
  f.requests.get(navBackground)({url:navBackground,width:750,height:151});
  await Promise.resolve();
  f.paint();
  const center=(menuButton.top+menuButton.bottom)/2;
  const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-6,actual+' vs '+expected);
  near(f.textMeshes.get('商城').position.y+content.top,center);
  const heading=optimizeUiAssetUrls(art['shop-heading']);
  f.requests.get(heading)({url:heading,width:242,height:88});
  await Promise.resolve();
  f.paint();
  assert(!f.textMeshes.has('商城'));
  near(f.images.get(heading).position.y+content.top,center);

  const top=screen.height-safeBottom/4-151*screen.width/750;
  for(const id of ['shop','assembly','battle','research','supply']){
    const control=f.control('nav-'+id);
    near(control.y,top);
    near(control.y+control.h,screen.height-safeBottom);
    assert(control.h>=44);
  }
  const face=f.images.get(navArt),trim=f.images.get(navBackground);
  near(face.position.y+content.top+face.scale.y/2,top);
  near(trim.position.y+content.top-trim.scale.y/2,screen.height);
  const tab=f.control('nav-battle');
  f.click(tab);
  assert.deepEqual(f.commands.at(-1).slice(0,2),['tab',{tab:'battle'}]);
  const actions=f.commands.length;
  f.click({...tab,y:screen.height-8,h:1});
  assert.equal(f.commands.length,actions);
});

test('WeChat main footer paints its press on the next frame and accepts normal thumb drift',t=>{
  const f=fixture(t,undefined,{main:true});
  let footer;
  const render=f.renderer.render;
  f.renderer.render=(scene,camera)=>{
    footer=scene.children[0].children.filter(mesh=>mesh.visible);
    render(scene,camera);
  };
  f.view.update({tab:'shop',shopSection:'coins',snapshot:shopSnapshot()},'shop');
  f.paint();
  const count=footer.length,tab=f.control('nav-research');
  const x=tab.x+tab.w/2,y=tab.y+tab.h/2;
  f.point('start',x,y);f.paint();
  assert.equal(footer.length,count+1);
  const outline=footer.at(-1);
  assert.equal(outline.position.x,x);
  assert.ok(Math.abs(Math.abs(outline.scale.y)-screen.width*151/750)<1e-6);
  assert.equal(outline.geometry.attributes.position.count,48);
  assert.deepEqual(f.commands,[]);
  f.point('move',x+8,y);f.point('end',x+8,y);f.paint();
  assert.equal(footer.length,count);
  assert.deepEqual(f.commands[0].slice(0,2),['tab',{tab:'research'}]);
  f.point('start',x,y);f.paint();
  f.point('move',x+16,y);f.paint();
  assert.equal(footer.length,count);
  f.point('end',x+16,y);
  assert.equal(f.commands.length,1);
});

test('WeChat stops an invisible portrait decoder and only restarts when the portrait is shown again',async t=>{
  const calls=[];
  const api={createVideoDecoder:()=>({on(){},start({source}){calls.push('start '+source);},
    stop(){calls.push('stop');},seek(ms){calls.push('seek '+ms);},remove(){calls.push('remove');}})};
  const decoder=openWechatPortraitDecoder(api,{requestFrame:()=>1,cancelFrame(){}},{localFile:async path=>path},()=>{},()=>{},assert.fail);
  t.after(()=>decoder.close());
  await decoder.play('idle.mp4');
  decoder.pause();
  await new Promise(setImmediate);
  assert.deepEqual(calls,['start idle.mp4','stop']);
  assert.equal(decoder.active,false);
  await decoder.play('idle.mp4',1.25);
  assert.deepEqual(calls,['start idle.mp4','stop','start idle.mp4','seek 1250']);
  assert.equal(decoder.active,true);
});

test('WeChat catches native video teardown failures without leaving the old video on screen',async t=>{
  const warnings=[];
  t.mock.method(console,'warn',(...args)=>warnings.push(args));
  const destroyed=[];
  const video={x:0,y:0,width:200,height:100,muted:false,
    stop(){return Promise.reject({errMsg:'operateVideoPlayer:fail type error'});},
    destroy(){destroyed.push(true);return Promise.reject({errMsg:'operateVideoPlayer:fail type error'});}};
  retireNativeVideo(video,390,844);
  assert.deepEqual([video.x,video.y,video.width,video.height,video.muted],[391,845,1,1,true]);
  await new Promise(setImmediate);
  assert.equal(destroyed.length,1);
  assert.deepEqual(warnings,[['[wechat-video-dispose]','operateVideoPlayer:fail type error']]);
});

test('WeChat equipment can be used before images and 3D, then loads additional rows while scrolling',t=>{
  const f=fixture(t);
  f.view.update({tab:'assembly',gearFilter:'all',gearSort:'quality',snapshot:equipmentSnapshot()},'equipment');
  f.view.tick();
  assert.deepEqual(f.events,[]);
  f.paint();
  assert.deepEqual(f.events,['paint']);
  assert(f.texts.has('Lv.1'));
  assert(!f.texts.has('Lv.80'));
  assert(!f.requests.has(optimizeUiAssetUrls(lateGear)));
  f.click(f.control('gear-001'));
  assert.deepEqual(f.commands.at(-1).slice(0,2),['gearDetail',{id:'001',gearOrigin:'warehouse'}]);
  f.view.tick();assert.deepEqual(f.events,['paint','aircraft']);

  for(let i=0;i<8;i++){f.drag(190,678,161);f.paint();}
  assert(f.texts.has('Lv.80'));
  assert(f.requests.has(optimizeUiAssetUrls(lateGear)));
  assert(f.texts.has('×2'));
  f.click(f.control('gear-080'));
  assert.deepEqual(f.commands.at(-1).slice(0,2),['gearDetail',{id:'080',gearOrigin:'warehouse'}]);
  f.park();f.view.tick();f.activate();f.paint();
  assert(f.texts.has('Lv.80'),'retained equipment keeps the warehouse position');
});

test('WeChat prepares the parked hangar before the first visible equipment frame',async t=>{
  const f=fixture(t,undefined,{main:true,atomicEntry:true,parked:true});
  let compiled=0;
  f.renderer.compile=()=>{compiled++;};
  f.view.update({tab:'assembly',gearFilter:'all',gearSort:'quality',snapshot:equipmentSnapshot()},'equipment');
  assert.equal(f.view.prepareOffscreen(),false);
  const background=optimizeUiAssetUrls('/art/psd-equipment-v1/equipment-background.webp');
  const aircraft=optimizeUiAssetUrls('/art/aircraft-ui-v1/pilot-01-hangar.webp');
  assert(f.requests.has(background)&&f.requests.has(aircraft));
  for(const [url,read] of f.requests)read({url,width:96,height:80});
  await Promise.resolve();
  let ready=false;
  for(let step=0;step<40&&!ready;step++){
    const before=compiled;
    ready=f.view.prepareOffscreen();
    assert(compiled-before<=1,'only one layer compiles in a warmup step');
  }
  assert(ready);
  assert(compiled>0,'the menu programs are prepared before entry');
  assert.deepEqual(f.events,[],'the prepared view does not replace startup or the lobby');
  f.activate();
  f.paint();
  assert.deepEqual(f.events,['paint']);
  assert(f.images.has(background)&&f.images.has(aircraft));
  assert(f.view.state().ready);
  f.click(f.control('gear-001'));
  assert.equal(f.commands.at(-1)[0],'gearDetail');
  f.view.tick();
  assert.deepEqual(f.events,['paint','aircraft']);
});

test('WeChat equipment waits for both the visible art and the first aircraft frame',async t=>{
  let draws=0,previewReady=false;
  const aircraftPreview=refresh=>({ready:false,target:{width:100,height:80},update(){},tick(){},pause(){},close(){},
    prepare(){if(previewReady&&!this.ready){this.ready=true;refresh();}return this.ready;},paint(){draws++;}});
  const f=fixture(t,undefined,{main:true,atomicEntry:true,completeEntry:true,aircraftPreview});
  const data={tab:'assembly',gearFilter:'all',gearSort:'quality',snapshot:equipmentSnapshot()};
  f.view.update(data,'equipment');f.paint();
  const delayed=['assembly-heading','equipment-deck'].map(key=>optimizeUiAssetUrls(art[key]));
  for(const [url,read] of f.requests)if(!delayed.includes(url))read({url,width:96,height:80});
  await Promise.resolve();f.paint(1250);
  assert.deepEqual(f.events,[]);
  f.requests.get(delayed[0])({url:delayed[0],width:96,height:80});
  await Promise.resolve();f.paint();assert.deepEqual(f.events,[]);
  f.requests.get(delayed[1])({url:delayed[1],width:96,height:80});
  await Promise.resolve();f.paint();assert.deepEqual(f.events,[]);
  previewReady=true;
  for(let frame=0;frame<12&&!f.events.length;frame++)f.paint();
  assert.deepEqual(f.events,['paint']);
  assert.equal(draws,1);
  assert(delayed.every(url=>f.images.has(url)));
  const changed=structuredClone(data);
  const item=changed.snapshot.equipment.items[0];
  item.art='saint-ring-v4/4110100';item.equipped=true;
  changed.snapshot.equipment.slots[1]=item.uid;
  f.view.update(changed,'equipped');f.paint();
  assert.deepEqual(f.events,['paint'],'switching gear retains the previous complete frame');
  const icon=optimizeUiAssetUrls('/art/project-flight-gear-v1/saint-ring-v4/4110100.webp');
  assert(f.requests.has(icon));
  f.requests.get(icon)({url:icon,width:100,height:100});
  await Promise.resolve();
  for(let frame=0;frame<12&&f.events.length<2;frame++)f.paint();
  assert(f.images.has(icon));
});

test('post-battle equipment presents the equipped aircraft still and controls while its 3D preview is pending',async t=>{
  let steps=0,draws=0,ready=false;
  const aircraftPreview=refresh=>({ready:false,target:{width:100,height:80},update(){},tick(){},pause(){},close(){},
    prepare(){steps++;if(ready&&!this.ready){this.ready=true;refresh();}return this.ready;},paint(){draws++;}});
  const f=fixture(t,undefined,{main:true,atomicEntry:true,completeEntry:true,aircraftPreview});
  f.region.allowAircraftStill=()=>true;
  const data={tab:'assembly',gearFilter:'all',gearSort:'quality',snapshot:equipmentSnapshot()};
  f.view.update(data,'after-battle');f.paint();
  const still=optimizeUiAssetUrls('/art/aircraft-ui-v1/'+data.snapshot.aircraftId+'-hangar.webp');
  for(const [url,read] of f.requests)if(url!==still)read({url,width:96,height:80});
  await Promise.resolve();f.paint(1250);assert.deepEqual(f.events,[]);
  f.requests.get(still)({url:still,width:96,height:80});await Promise.resolve();
  for(let i=0;i<8&&!f.events.length;i++)f.paint();
  assert.deepEqual(f.events,['paint']);assert.equal(steps,0);assert(f.images.has(still));
  f.click(f.control('gear-001'));assert.equal(f.commands.at(-1)[0],'gearDetail');
  f.park();f.view.tick();assert.equal(steps,0);
  f.activate();f.paint();f.view.tick();assert(steps>0);assert.equal(draws,0);
  ready=true;f.view.tick();f.paint();assert(draws>0);assert(!f.images.has(still));
});

function catalogFixture(tab,owned=true){
  const stage={star:1,skills:[],attributes:[]};
  const common={quality:10,owned:true,equipped:true,star:1,stage,stages:[stage]};
  const gun={...common,id:10001,name:'测试武器',weaponType:1,owned,equipped:owned};
  const aircraft={...common,id:10101,name:'测试战机'};
  const pilot={...common,id:40100,name:'测试驾驶员'};
  const replicaCollection={guns:[gun],skins:[aircraft],pilots:[pilot],slots:[],useWeaponMap:[gun.id],
    weaponSkillMap:{},attributeNames:{}};
  return {snapshot:{replicaCollection,aircraftId:'pilot-01'},catalog:{id:tab==='weapon'?gun.id:'pilot-01'}};
}



test('WeChat catalogs fill both safe areas and dock their controls like the main pages',async t=>{
  for(const {width,height,safeTop,safeBottom} of [
    {width:390,height:844,safeTop:78,safeBottom:34},
    {width:360,height:640,safeTop:55,safeBottom:16},
  ]){
    for(const tab of ['weapon','aircraft','pilot'])for(const skillTab of [false,true]){
      const mode=skillTab?'skill':'list';
      await t.test(tab+' '+mode+' '+width+' × '+height,async t=>{
        const screen={x:0,y:0,left:0,top:0,width,height,right:width,bottom:height};
        const menuButton={left:width-84,top:safeTop-28,bottom:safeTop};
        const f=fixture(t,undefined,{atomicEntry:true,parked:true,catalog:true,viewport:{screen,safeTop,safeBottom,menuButton}});
        f.region.bounds=()=>({...screen,y:safeTop,top:safeTop,height:height-safeTop});
        f.region.frameBounds=()=>screen;
        const data=catalogFixture(tab),roomUrl=optimizeUiAssetUrls(atlas[tab+'-hero']);
        const footerUrl=optimizeUiAssetUrls(atlas[tab+'-'+mode+'-footer']);
        const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-6,actual+' vs '+expected);
        f.view.update({tab,...data,catalog:{...data.catalog,skillTab}},tab+mode);
        assert.equal(f.view.prepareOffscreen(),false);
        for(const [url,decode] of f.requests)decode({url,width:738,height:url===footerUrl?124:810});
        await Promise.resolve();
        let ready=false;
        for(let step=0;step<40&&!ready;step++)ready=f.view.prepareOffscreen();
        assert(ready);
        f.activate();f.paint();
        const room=f.images.get(roomUrl);
        assert(room);
        near(room.position.y+safeTop-Math.abs(room.scale.y)/2,0);
        near(room.position.x-room.scale.x/2,0);
        near(room.position.x+room.scale.x/2,width);
        const face=f.images.get(footerUrl),trim=f.images.get(optimizeUiAssetUrls('/art/project-navigation-v2/background.png'));
        assert(face&&trim);
        near(trim.position.y+safeTop+Math.abs(trim.scale.y)/2,height);
        const expected=height-safeBottom/4-151*width/750;
        for(const id of ['back','mode-list','mode-skills']){
          const area=f.control(id);
          near(area.y,expected);
          near(area.y+area.h,height-safeBottom);
          assert(area.h>=44);
        }
        const heading=tab==='weapon'?f.images.get(optimizeUiAssetUrls(atlas[mode==='skill'?'weapon-skill-title':'weapon-list-title'])):
          f.textMeshes.get(tab==='aircraft'?'测试战机':'测试驾驶员');
        assert(heading);
        near(heading.position.y+safeTop,(menuButton.top+menuButton.bottom)/2);
        assert(!f.texts.has('出战武器'));
        const next=f.control(skillTab?'mode-list':'mode-skills');
        f.click(next);
        assert.deepEqual(f.commands.at(-1).slice(0,2),['catalogMode',{mode:skillTab?'list':'skills'}]);
        const actions=f.commands.length;
        f.click({...next,y:height-5,h:2});
        assert.equal(f.commands.length,actions,'system gesture area is not a tab hitbox');
        f.click(f.control('back'));
        assert.equal(f.commands.at(-1)[0],'catalogBack');
      });
    }
  }
});

test('WeChat activation and star buttons give the material icons a readable slot',async t=>{
  for(const [tab,id,operation,available] of [['aircraft',10103,'unlock',0],['pilot',40100,'star',12]]){
    await t.test(tab,async t=>{
      const f=fixture(t,undefined,{atomicEntry:true,parked:true,catalog:true});
      const data=catalogFixture(tab),group=tab==='aircraft'?'skins':'pilots';
      const item={...data.snapshot.replicaCollection[group][0],id,owned:operation==='star',equipped:false,
        costs:[{id,count:1,available}]};
      data.snapshot.replicaCollection[group]=[item];data.catalog.id=id;
      const icon=optimizeUiAssetUrls(nativeCollectionArt(item));
      f.view.update({tab,...data},tab);
      f.view.prepareOffscreen();
      assert(f.requests.has(icon),icon);
      for(const [url,decode] of f.requests)decode({url,width:url===icon?320:96,height:url===icon&&tab==='aircraft'?208:url===icon?320:80});
      await Promise.resolve();
      let ready=false;
      for(let step=0;step<40&&!ready;step++)ready=f.view.prepareOffscreen();
      assert(ready);
      f.activate();
      const button=f.control(operation),centerY=button.y+button.h/2-content.y,drawn=[];
      f.renderer.render=scene=>scene.traverseVisible(mesh=>{if(Math.abs(mesh.position.y-centerY)<.001)drawn.push(mesh);});
      f.paint();
      const material=drawn.find(mesh=>mesh.material?.map?.image?.url===icon);
      const count=drawn.find(mesh=>mesh.userData.uiText===available+'/1');
      const title=drawn.find(mesh=>mesh.userData.uiText===(operation==='unlock'?'激活':'升星'));
      assert(material&&count&&title);
      assert(material.scale.x>=29);
      assert(title.position.x+title.scale.x/2<=material.position.x-material.scale.x/2);
      assert(material.position.x+material.scale.x/2<count.position.x-count.scale.x/2);
      assert(count.position.x+count.scale.x/2<=button.x+button.w);
      if(tab==='aircraft'){
        const uv=material.geometry.attributes.uv;
        const left=Math.min(...Array.from({length:uv.count},(_,i)=>uv.getX(i)));
        assert(left>.1,'trim the aircraft thumbnail margin');
      }
      f.click(button);
      assert.deepEqual(f.commands.at(-1)?.slice(0,2),['nativeOperation',{
        kind:group,operation,id,revision:undefined,shortage:available===0,
      }]);
    });
  }
});

const firstScreens=[
  {tab:'shop',data:()=>({shopSection:'boxes',snapshot:shopSnapshot()}),control:'rates-advanced',action:'shopBoxRates',
    art:()=>[art['advanced-tray'],art['basic-tray']]},
  {tab:'research',data:()=>{
    const first=talentCatalog.cards[0];
    const card={id:String(first.ID),name:first.name,icon:first.icon,quality:first.Quality,owned:true,level:1};
    return {section:'talent',snapshot:{wallet:{},research:{native:true,cards:[card],owned:1,normalCost:100,cores:0}}};
  },control:'summary',action:'researchSummary',art:()=>[researchArt(talentCatalog.cards[0].icon)]},
  {tab:'supply',data:()=>({snapshot:{wallet:{diamonds:100},pilots:[{id:'pilot-01',name:'夜莺',rarity:'R'}],
    pools:{pilot:{singleCost:10,tenCost:100}}}}),control:'draw-1',action:'recruit',
    art:()=>[recruitPortrait('pilot-01'),art['roster-active-pilot-01'],art['recruit-button-single']]},
  ...['改造','获取'].map(label=>({tab:'weapon',label,catalog:true,data:()=>catalogFixture('weapon',label==='改造'),
    control:'detail-10001',action:'nativeCollectionDetail',art:()=>[atlas['weapon-hero'],'/art/psd-equipment-v1/button-gold.png']})),
  ...['aircraft','pilot'].map(tab=>({tab,catalog:true,data:()=>catalogFixture(tab),control:'back',action:'catalogBack',
    art:()=>[atlas[tab+'-hero'],tab==='aircraft'?nativeCollectionArt({id:10101},'preview'):PILOT_PORTRAITS['pilot-01'].image]})),
];
for(const page of [
  ...firstScreens.filter(page=>!page.catalog),
  {tab:'assembly',data:()=>({gearFilter:'all',gearSort:'quality',snapshot:equipmentSnapshot()})},
]){
  test(`WeChat ${page.tab} opens with usable tabs before its prewarm finishes`,t=>{
    const completeEntry=page.tab==='supply'||page.tab==='assembly';
    const f=fixture(t,undefined,{main:true,atomicEntry:true,parked:true,completeEntry});
    f.view.update({tab:page.tab,...page.data()},page.tab);
    assert.equal(f.view.prepareOffscreen(),false);
    f.activate();f.paint();
    if(completeEntry)f.paint(1250);
    assert.deepEqual(f.events,completeEntry?[]:['paint']);
    assert.equal(f.images.size,0);
    for(const tab of ['shop','assembly','battle','research','supply']){
      f.click(f.control('nav-'+tab));
      assert.deepEqual(f.commands.at(-1).slice(0,2),['tab',{tab}]);
    }
  });
}

for(const page of firstScreens){
  test(`WeChat paints the prepared ${page.tab} artwork and controls together on its first visible frame`,async t=>{
    const f=fixture(t,undefined,{main:!page.catalog,atomicEntry:true,parked:true,catalog:page.catalog,completeEntry:page.tab==='supply'});
    const data={tab:page.tab,...page.data()};
    f.view.update(data,page.tab);
    assert.equal(f.view.prepareOffscreen(),false);
    const chrome=page.catalog?[atlas[page.tab+'-wall'],atlas[page.tab+'-list-footer']]:
      [art[page.tab+'-background'],art[page.tab+'-footer']];
    const assets=[...chrome,...page.art()].map(optimizeUiAssetUrls);
    for(const url of assets)assert(f.requests.has(url),url);
    for(const [url,read] of f.requests)read({url,width:96,height:80});
    await Promise.resolve();
    let ready=false;
    for(let step=0;step<40&&!ready;step++)ready=f.view.prepareOffscreen();
    assert(ready);
    f.view.tick();
    assert.deepEqual(f.events,[]);
    f.activate();
    f.view.update(data,page.tab);
    if(page.tab==='shop')f.view.section('boxes');
    assert.equal(f.view.state().ready,true);
    let actionLabels=0;
    if(page.label){
      const render=f.renderer.render;
      f.renderer.render=(scene,camera)=>{
        scene.traverseVisible(node=>{if(node.userData.uiText===page.label)actionLabels++;});
        render(scene,camera);
      };
    }
    f.paint();
    assert.deepEqual(f.events,['paint']);
    for(const url of assets)assert(f.images.has(url),url);
    const control=f.control(page.control);
    if(page.label){
      assert.equal(actionLabels,1);
      assert.equal(control.label,page.label);
      assert.equal(control.h,44);
      assert(!f.requests.has(optimizeUiAssetUrls('/art/three-ui/three-art-cb458762868d.png')));
    }
    f.click(control);
    assert.equal(f.commands.at(-1)[0],page.action);
  });
}

function resolveWorkshopArt(f){
  for(const [url,read] of f.requests)read({url,width:96,height:80});
}
async function prepareWorkshop(f,data){
  f.view.update(data,'workshop');
  assert.equal(f.view.prepareOffscreen(),false);
  resolveWorkshopArt(f);
  await Promise.resolve();
  for(let frame=0;frame<60;frame++)if(f.view.prepareOffscreen())return;
  assert.fail('Workshop first frame did not finish warming');
}


test('WeChat workshops extend their room and dock without putting actions in the gesture area',async t=>{
  for(const {width,height,safeTop,safeBottom} of [
    {width:390,height:844,safeTop:78,safeBottom:34},
    {width:320,height:584,safeTop:68,safeBottom:34},
  ]){
    for(const [kind,mode] of [['gear','level'],['weapon','level'],['weapon','quality']]){
      await t.test(kind+' '+mode+' '+width,async t=>{
        const screen={x:0,y:0,left:0,top:0,width,height,right:width,bottom:height};
        const menuButton={left:width-84,top:safeTop-28,bottom:safeTop};
        const f=fixture(t,undefined,{atomicEntry:true,parked:true,workshop:kind,viewport:{screen,safeTop,safeBottom,menuButton}});
        f.region.bounds=()=>({...screen,y:safeTop,top:safeTop,height:height-safeTop});
        f.region.frameBounds=()=>screen;
        const snapshot=equipmentSnapshot(),id='sample-workshop-weapon';
        snapshot.equipment.revision=1;
        for(const item of snapshot.equipment.items)item.merge={available:false,candidates:[]};
        snapshot.weapons=[{id,appearance:'aux_cannon',level:1,damage:120,canUpgrade:true,cost:{coins:80,weaponParts:1}}];
        snapshot.workshop={items:[{id,name:'测试武器',qualityRank:1,owned:true,canSynthesize:true}],universalFragments:0};
        const data={tab:'workshop',snapshot,workshop:{kind,mode,id,filter:'all',backLabel:'返回装备',
          draft:{revision:1,targetId:null,materialIds:[],tokens:0}}};
        await prepareWorkshop(f,data);
        f.activate();f.paint();
        const near=(a,b)=>assert(Math.abs(a-b)<1e-6,a+' vs '+b);
        const room=f.images.get(optimizeUiAssetUrls(atlas['workshop-stage']));
        const title=f.images.get(optimizeUiAssetUrls(atlas['workshop-header']));
        const dock=f.images.get(optimizeUiAssetUrls(atlas['workshop-footer']));
        const trim=f.images.get(optimizeUiAssetUrls('/art/project-navigation-v2/background.png'));
        assert(room&&title&&dock&&trim);
        near(room.position.y+safeTop-Math.abs(room.scale.y)/2,0);
        near(room.position.x-room.scale.x/2,0);
        near(room.position.x+room.scale.x/2,width);
        near(title.position.y+safeTop,(menuButton.top+menuButton.bottom)/2);
        near(trim.position.y+safeTop+Math.abs(trim.scale.y)/2,height);
        const rail=151*width/750,offset=Math.min(safeBottom*.75,rail-44);
        const top=height-safeBottom-rail+offset;
        near(dock.position.y+safeTop-Math.abs(dock.scale.y)/2,top);
        for(const id of ['back','compose']){
          const action=f.control(id);
          near(action.y+action.h/2,(top+height-safeBottom)/2);
          assert(action.h>=44&&action.y>=top-1e-6&&action.y+action.h<=height-safeBottom+1e-6);
        }
        if(kind==='weapon'){
          f.click(f.control('compose'));
          assert.equal(f.commands.at(-1)[0],mode==='level'?'upgrade':'workshopSynthesize');
        }
        const back=f.control('back'),commands=f.commands.length;
        f.click({...back,y:height-8,h:4});
        assert.equal(f.commands.length,commands);
        f.click(back);
        assert.equal(f.commands.at(-1)[0],'catalogBack');
      });
    }
  }
});

test('WeChat gear workshop warms its shell and defers stocks below the first screen',async t=>{
  const f=fixture(t,undefined,{atomicEntry:true,parked:true,workshop:'gear'});
  const snapshot=equipmentSnapshot();
  snapshot.equipment.revision=1;
  for(const item of snapshot.equipment.items)item.merge={available:true,candidates:[]};
  const data={tab:'workshop',snapshot,workshop:{kind:'gear',filter:'all',mode:'level',backLabel:'返回装备',
    draft:{revision:1,targetId:null,materialIds:[],tokens:0}}};
  await prepareWorkshop(f,data);
  assert(!f.requests.has(lateGear));
  f.activate();f.view.update(data,'workshop');f.paint();
  assert.deepEqual(f.events,['paint']);
  for(const url of [atlas['workshop-wall'],atlas['workshop-stage'],atlas['workshop-footer'],'/art/onboarding-assistant-v1/expressions.png']){
    assert(f.images.has(optimizeUiAssetUrls(url)),url);
  }
  const firstY=f.control('gear-001').y;
  f.click(f.control('gear-001'));
  assert.equal(f.commands.at(-1)[0],'workshopGearPick');
  for(let i=0;i<12&&!f.requests.has(lateGear);i++){f.drag(190,674,175);f.paint();}
  assert(f.requests.has(lateGear));
  f.park();f.activate();f.view.update(data,'workshop');f.paint();
  assert.equal(f.control('gear-001').y,firstY);
});

test('WeChat weapon workshop stages the real selection before revealing a prepared page',async t=>{
  const f=fixture(t,undefined,{atomicEntry:true,parked:true,workshop:'weapon'});
  const snapshot=equipmentSnapshot();
  const ids=Array.from({length:80},(_,i)=>'test-weapon-'+i);
  snapshot.weapons=ids.map((id,i)=>({id,appearance:i===79?'aux_pyro':'aux_cannon',level:1,damage:120,canUpgrade:true}));
  snapshot.workshop={items:ids.map(id=>({id,name:id,qualityRank:1,owned:true,canSynthesize:true})),universalFragments:0};
  const data={tab:'workshop',snapshot,workshop:{kind:'weapon',id:ids[0],mode:'level',filter:'all',backLabel:'返回装备'}};
  const selectedArt=optimizeUiAssetUrls('/art/project-weapon-clean-v2/aux_pyro.webp');
  await prepareWorkshop(f,data);
  assert(!f.requests.has(selectedArt));
  f.activate();
  f.view.update({...data,workshop:{...data.workshop,id:ids.at(-1),mode:'quality',backLabel:'返回武器目录'}},'workshop');
  f.paint();
  assert.deepEqual(f.events,[],'the previous selection does not flash while the new target is prepared');
  assert(f.requests.has(selectedArt));
  resolveWorkshopArt(f);
  await Promise.resolve();
  for(let frame=0;frame<24&&!f.events.length;frame++)f.paint();
  assert.deepEqual(f.events,['paint']);
  assert(f.images.has(selectedArt));
  const card=f.control('weapon-'+ids.at(-1));
  assert(card.y>400&&card.y+card.h<760);
  f.click(card);
  assert.deepEqual(f.commands.at(-1).slice(0,2),['workshopSelect',{id:ids.at(-1)}]);
});

test('WeChat lets an early catalog tap open before slow background artwork finishes',t=>{
  const f=fixture(t,undefined,{atomicEntry:true,catalog:true});
  f.view.update({tab:'aircraft',...catalogFixture('aircraft')},'aircraft');
  for(let step=0;step<9;step++)f.paint();
  assert.deepEqual(f.events,['paint']);
  assert.equal(f.images.size,0);
  f.click(f.control('back'));
  assert.equal(f.commands.at(-1)[0],'catalogBack');
});

test('WeChat recruitment reveals complete original artwork on entry and when choosing a pilot',async t=>{
  const f=fixture(t,undefined,{main:true,atomicEntry:true,parked:true,completeEntry:true});
  const data={tab:'supply',snapshot:{wallet:{diamonds:100},pools:{pilot:{singleCost:10}},pilots:[
    {id:'pilot-01',name:'夜莺',rarity:'R'},{id:'pilot-03',name:'桃乐丝',rarity:'SSR'},
  ]}};
  const first=recruitPortrait('pilot-01'),second=recruitPortrait('pilot-03');
  f.view.update(data,'roster');assert.equal(f.view.prepareOffscreen(),false);
  assert(f.requests.has(first));
  const cards=['roster-active-pilot-01','roster-pilot-03'].map(key=>optimizeUiAssetUrls(art[key]));
  for(const url of cards)assert(f.requests.has(url));
  for(const [url,resolve] of f.requests)if(url!==first)resolve({url,width:96,height:96});
  await Promise.resolve();f.activate();f.paint(1400);
  assert.deepEqual(f.events,[]);
  f.requests.get(first)({url:first,width:1254,height:1254});
  await Promise.resolve();
  for(let frame=0;frame<32&&!f.events.length;frame++)f.paint();
  assert.deepEqual(f.events,['paint']);
  for(const url of [first,...cards])assert(f.images.has(url),url);
  f.view.update({...data,selected:'pilot-03'},'roster');f.paint();
  assert(f.requests.has(second));
  const secondCards=['roster-pilot-01','roster-active-pilot-03'].map(key=>optimizeUiAssetUrls(art[key]));
  for(const url of secondCards)f.requests.get(url)({url,width:180,height:180});
  await Promise.resolve();f.paint(1300);
  assert.deepEqual(f.events,['paint']);
  f.requests.get(second)({url:second,width:1254,height:1254});
  await Promise.resolve();
  for(let frame=0;frame<32&&f.events.length<2;frame++)f.paint();
  assert.deepEqual(f.events,['paint','paint']);
  assert(f.texts.has('桃乐丝'));
  for(const url of [second,...secondCards])assert(f.images.has(url),url);
});

test('WeChat recruitment returns with a retry message when the original portrait fails',async t=>{
  const notices=[],f=fixture(t,undefined,{main:true,atomicEntry:true,completeEntry:true});
  f.device.toast={show:message=>notices.push(message)};
  const snapshot={wallet:{},pools:{pilot:{singleCost:10}},pilots:[{id:'pilot-01',name:'夜莺',rarity:'R'}]};
  f.view.update({tab:'supply',snapshot},'roster');f.paint(350);
  const failed=recruitPortrait('pilot-01');
  for(const [url,read] of f.requests)read(url===failed?null:{url,width:96,height:80});
  await Promise.resolve();
  f.paint();
  assert.deepEqual(f.events,[]);
  assert.equal(f.view.entryFailed,true);
  assert.deepEqual(f.commands.at(-1).slice(0,2),['tab',{tab:'battle'}]);
  assert.deepEqual(notices,['界面资源加载失败，请重新进入']);
});

test('WeChat shop paints the requested section first and can return to the box controls while artwork is pending',t=>{
  const f=fixture(t);
  f.view.update({tab:'shop',shopSection:'coins',snapshot:shopSnapshot()},'shop');
  f.view.section('coins');f.paint();
  assert.deepEqual(f.events,['paint']);
  assert(f.texts.has('一箱金币'));
  assert(!f.requests.has(optimizeUiAssetUrls('/art/weapon-catalog-psd-v1/frame-blue.png')));
  assert(!f.requests.has(optimizeUiAssetUrls(art['advanced-tray'])));
  f.click(f.control('offer-exchange-coins-large'),.9);
  assert.equal(f.commands.at(-1)[0],'shopOffer');
  assert.equal(f.commands.at(-1)[1].id,'exchange-coins-large');
  f.view.section('boxes');f.paint();
  assert(f.requests.has(optimizeUiAssetUrls(art['advanced-tray'])));
  assert(!f.texts.has('一箱金币'));
  f.click(f.control('open-advanced-1'));
  assert.equal(f.commands.at(-1)[0],'shopBoxConfirm');
});

test('WeChat shop reveals decoded artwork in small batches and reuses unchanged text',async t=>{
  const f=fixture(t);
  f.view.update({tab:'shop',shopSection:'boxes',snapshot:shopSnapshot()},'shop');f.paint();
  const canvases=f.canvases,background=optimizeUiAssetUrls(art['shop-background']);
  for(const [url,resolve] of f.requests){
    const size=url===background?1024:64;
    resolve({url,width:size,height:size});
  }
  await new Promise(resolve=>setTimeout(resolve,70));
  f.paint();
  assert.deepEqual([...f.images.keys()],[background],'the large background is alone in its upload frame');
  let total=f.images.size;
  for(let i=0;i<20;i++){
    f.paint();
    assert(f.images.size-total<=4);
    total=f.images.size;
  }
  assert(f.images.has(optimizeUiAssetUrls(art['advanced-tray'])));
  assert.equal(f.canvases,canvases);
});

test('WeChat shop installs late tray and chrome without rebuilding its controls or text meshes',async t=>{
  const f=fixture(t);
  f.view.update({tab:'shop',shopSection:'boxes',snapshot:shopSnapshot()},'shop');f.paint();
  const boxTitle=f.textMeshes.get('高级装备箱');
  assert(boxTitle);
  assert(f.texts.has('商城'),'temporary heading and navigation are visible');
  const urls=['advanced-tray','shop-heading','shop-footer'].map(key=>optimizeUiAssetUrls(art[key]));
  for(const url of urls)f.requests.get(url)({url,width:80,height:64});
  await Promise.resolve();
  f.paint();
  for(const url of urls)assert(f.images.has(url),url);
  assert.equal(f.textMeshes.get('高级装备箱'),boxTitle);
  assert(!f.texts.has('商城'),'the final chrome replaces the temporary labels');
  f.click(f.control('open-advanced-1'));
  assert.equal(f.commands.at(-1)[0],'shopBoxConfirm');
});

async function assertResearchArtworkOrientation(t,page,artwork){
  const f=fixture(t);
  const pending=new Set([art['research-background'],...artwork].map(optimizeUiAssetUrls));
  f.view.update(page,'first-research');f.paint();

  // The talent grid requests more art as its lower rows scroll into view.
  for(let step=0;step<5&&pending.size;step++){
    if(step){f.drag(195,561,268);f.paint();}
    const urls=[...pending].filter(url=>f.requests.has(url));
    if(!urls.length)continue;
    for(const url of urls){
      assert(!f.images.has(url),url);
      f.requests.get(url)({url,width:120,height:80});
    }
    await Promise.resolve();
    for(let frame=0;frame<urls.length;frame++)f.paint();
    const late=urls.map(url=>{
      const mesh=f.images.get(url);
      assert(mesh,url);
      return mesh;
    });

    f.view.update(page,'cached-research-'+step);f.paint();
    for(const [i,url] of urls.entries()){
      const cached=f.images.get(url);
      assert(cached,url);
      assert.notEqual(late[i],cached,url);
      assert(cached.scale.y<0,url);
      assert.deepEqual(late[i].scale.toArray(),cached.scale.toArray(),url);
      assert.deepEqual(late[i].position.toArray(),cached.position.toArray(),url);
      assert.deepEqual(late[i].geometry.attributes.uv.array,cached.geometry.attributes.uv.array,url);
      pending.delete(url);
    }
  }
  assert.deepEqual([...pending],[],'every expected asset was drawn');
}

test('WeChat keeps the first-load orientation across the talent catalog',t=>{
  // One locked card shares its icon with an owned card, so all icon variants and
  // the locked placeholder are exercised together.
  const cards=talentCatalog.cards.map(row=>({
    id:String(row.ID),name:row.name,icon:row.icon,quality:row.Quality,owned:row.ID!==53003,level:row.ID===53003?0:1,
  }));
  const research={native:true,cards,owned:cards.filter(card=>card.owned).length,normalCost:100,cores:0};
  const snapshot={wallet:{coins:0},research};
  const artwork=cards.flatMap(card=>card.owned
    ?[researchArt(card.icon),qualityFrame(researchCardQuality(card.quality))]
    :[art['unknown-talent']]);
  return assertResearchArtworkOrientation(t,{tab:'research',section:'talent',snapshot},artwork);
});

test('WeChat keeps the first-load orientation of lab icons and lock and grade markers',t=>{
  const labs=economyCatalog.labs.map((row,i)=>({...row,level:row.levels[0].level,active:i%2===0}));
  const clearedChapterIds=[Math.max(6,...labs.map(row=>row.unlockChapter))];
  const snapshot={wallet:{},replicaCampaign:{clearedChapterIds},replicaCollection:{labs}};
  const artwork=[...labs.map(nativeLabArt),projectIconUrl('lock'),'/art/project-supplement-icons-v1/grade.png',qualityFrame(0)];
  return assertResearchArtworkOrientation(t,{tab:'research',section:'lab',snapshot},artwork);
});

function details(lines,event){
  const prefix='[Three 调试] '+event+' ';
  return lines.filter(line=>line.startsWith(prefix)).map(line=>JSON.parse(line.slice(prefix.length)));
}

function captureDebug(t,platform='devtools',enableDebug=false){
  const lines=[],native=[];
  t.mock.method(console,'info',line=>lines.push(line));
  const debug=createWechatDebugLog({
    getDeviceInfo:()=>({platform}),getAppBaseInfo:()=>({enableDebug,SDKVersion:'3.8.0'}),
    getLogManager(options){assert.deepEqual(options,{level:1});return {info:line=>native.push(line)};},
  },'three-test');
  t.after(()=>debug?.activeMenu?.stop('测试结束'));
  return {debug,lines,native};
}

test('normal mobile play leaves diagnostics off while the native debug switch enables the WeChat log',t=>{
  let managerCalls=0;
  const normal=createWechatDebugLog({
    getDeviceInfo:()=>({platform:'ios'}),getAppBaseInfo:()=>({enableDebug:false}),
    getLogManager(){managerCalls++;},
  },'three-test');
  assert.equal(normal,null);
  assert.equal(managerCalls,0);
  const enabled=captureDebug(t,'ios',true);
  assert.deepEqual(enabled.lines,enabled.native);
  assert.deepEqual(details(enabled.native,'环境'),[{buildId:'three-test',platform:'ios',sdk:'3.8.0'}]);
});

test('debug timing separates the menu paint, initial images and 3D, and bounds slow asset output',t=>{
  const {debug,lines,native}=captureDebug(t);
  let now=100;
  const trace=debug.beginMenu(()=>now,'assembly',false);
  const loading={userData:{}},discarded={userData:{}};
  trace.prepare(3);
  now=116;
  assert(trace.paint(new Set([loading,discarded]),false,undefined,6));
  assert.deepEqual(details(lines,'页面首帧'),[{entry:1,page:'assembly',retained:false,firstPaintMs:16,paintCpuMs:6,prepareCpuMs:3,
    artwork:{ready:0,pending:2,failed:0,skipped:0},modelReady:false}]);
  for(let i=0;i<8;i++)trace.slowArtwork('https://example.invalid/art/room.png?internal=1','CDN/缓存',175,8);
  const slow=details(lines,'慢贴图');
  assert.equal(slow.length,6);
  assert.deepEqual(slow[0],{entry:1,page:'assembly',asset:'art/room.png',source:'CDN/缓存',fileMs:175,decodeMs:8});
  now=200;loading.image={};
  const artwork=new Set([loading]);
  assert(trace.paint(artwork,false,undefined,12));
  now=280;
  assert.equal(trace.paint(artwork,true,undefined,8),false);
  assert.deepEqual(details(lines,'页面首进结果'),[{entry:1,page:'assembly',retained:false,status:'完成',elapsedMs:180,firstPaintMs:16,
    artworkMs:100,modelMs:180,artwork:{ready:1,pending:0,failed:0,skipped:1},maxPaintCpuMs:12}]);
  assert.deepEqual(native,lines);
  assert.equal(debug.activeMenu,null);
});

test('WeChat debug FPS includes long frames and excludes a discarded pause window',t=>{
  const {debug,native}=captureDebug(t,'ios',true),battle=debug.beginBattle(1);
  for(let i=0;i<100;i++)battle.sample(20,3);
  battle.reset();
  for(let i=0;i<248;i++)battle.sample(20,8);
  assert.deepEqual(details(native,'局内帧率'),[]);
  battle.sample(40,8);
  assert.deepEqual(details(native,'局内帧率'),[
    {chapter:1,wave:8,frames:249,elapsedMs:5000,fps:49.8,framesOver33ms:1,maxGapMs:40},
  ]);
});

test('a late-wave frame gap keeps the preceding render timings across summary windows',t=>{
  const {debug,native}=captureDebug(t,'ios',true),battle=debug.beginBattle(1);
  const busy={logic:2,terrainAndPlane:18,entitiesAndEffects:7,draw:8,worldDraw:6,uiDraw:2};
  for(let i=0;i<250;i++)battle.sample(20,9,busy);
  battle.sample(628,10,{...busy,terrainAndPlane:2});
  for(let i=0;i<219;i++)battle.sample(20,10,busy);
  const [,late]=details(native,'局内帧率');
  assert.equal(late.maxGapMs,628);
  assert.deepEqual(late.frameBeforeMaxGap,{wave:9,...busy});
});

test('a stalled entry still reports a timeout without another draw',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {debug,lines}=captureDebug(t);
  let now=0;
  const trace=debug.beginMenu(()=>now,'shop',false);
  now=6000;t.mock.timers.tick(6000);
  const [result]=details(lines,'页面首进结果');
  assert.equal(result.status,'超时');
  assert.equal(result.firstPaintMs,null);
  assert.equal(debug.activeMenu,null);
  assert.equal(trace.paint(new Set(),undefined,'boxes',1),false);
});

test('shop logs the first paint while assets are pending and distinguishes a retained return',t=>{
  const {debug,lines}=captureDebug(t);
  const f=fixture(t,debug);
  f.view.update({tab:'shop',shopSection:'daily',snapshot:shopSnapshot()},'shop');
  f.paint();
  assert(!f.requests.has(optimizeUiAssetUrls('/art/weapon-catalog-psd-v1/frame-blue.png')));
  const [first]=details(lines,'页面首帧');
  assert.equal(first.firstPaintMs,16);
  assert.equal(first.section,'daily');
  assert.equal(first.retained,false);
  assert(first.artwork.pending>0);
  f.park();
  assert.equal(details(lines,'页面首进结果')[0].status,'离开页面');
  f.activate();f.paint();
  assert.equal(details(lines,'页面首帧')[1].retained,true);
  f.park();
});

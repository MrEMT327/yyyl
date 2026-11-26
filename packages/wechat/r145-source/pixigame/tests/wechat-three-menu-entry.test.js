import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {PORTRAIT_FRAMING} from '../../../../../pixigame/src/ui/portrait-framing.js';
import {createLobbyNavigationMotion} from '../../../../../pixigame/src/three/game-screen/lobby-navigation-motion.js';
import {pilotSupplySnapshot} from '../../../../../pixigame/src/replica/pilot-supply.js';
import {SECOND_SORTIE_GUIDE} from '../../../../../pixigame/src/peripheral/onboarding.js';
import {createWechatDebugLog,rememberMemoryWarning,reportPreviousMemoryWarning} from '../wechat/src/three/debug-log.js';
import {retireNativeVideo} from '../wechat/src/full/video-player.js';
import talentCatalog from '../../../../../pixigame/src/replica/native-research-source.json' with {type:'json'};
import economyCatalog from '../../../../../pixigame/src/replica/native-economy-catalog.json' with {type:'json'};

const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const {outputFiles:[bundle]}=await build({
  stdin:{resolveDir:root,contents:`
    export {mountWechatMenu} from './packages/wechat/r145-source/pixigame/wechat/src/three/menu-surface.js';
    export {mountWechatHome} from './packages/wechat/r145-source/pixigame/wechat/src/three/home-surface.js';
    export {showWechatStartup} from './packages/wechat/r145-source/pixigame/wechat/src/three/startup.js';
    export {showWechatSortie} from './packages/wechat/r145-source/pixigame/wechat/src/three/sortie-cover.js';
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
    export {boxOpeningRank} from './pixigame/src/ui/shop-box-result-cards.js';
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
const {mountWechatMenu,showWechatStartup,showWechatSortie,mountWechatLobby,createSortieController,startLobbySession,createReplicaConfiguration,createReplicaProgression,createWechatPortraits,createWechatPanelInput,createArtworkLoader,useArtworkLoader,openWechatPortraitDecoder,
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
  const pending=new Map();
  const restore=useArtworkLoader(url=>{
    if(pending.has(url))return pending.get(url);
    const image=new Promise(resolve=>requests.set(url,resolve));
    if(options.reuseArtwork)pending.set(url,image);
    return image;
  });
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

test('lobby navigation starts on presentation and reverses from the last visible pose',()=>{
  const motion=createLobbyNavigationMotion();
  motion.select('battle',true,false);
  motion.select('assembly',false);
  const pose=motion.frame(5000);
  assert.equal(pose.weights[2],1);assert.equal(pose.dock,1);
  motion.frame(5100);assert.equal(pose.weights[1],.5);
  const before=[...pose.edges],dock=pose.dock;
  motion.select('supply',false);motion.select('battle',true);
  motion.frame(5300);assert.deepEqual(pose.edges,before);assert.equal(pose.dock,dock);
  motion.frame(5500);assert.deepEqual(pose.edges,[0,139,279.5,467.5,608,750]);
  assert.equal(pose.navMoving,false);assert(pose.dockMoving);
  motion.frame(5767);assert.equal(pose.dock,1);assert.equal(pose.dockMoving,false);
  motion.select('research',false);motion.frame(5800);motion.frame(6133);
  assert.equal(pose.dock,0);assert.equal(pose.dockMoving,false);
  motion.select('shop',false,false);assert.deepEqual(pose.weights,[1,0,0,0,0]);
});

test('navigation diagnostics join quick reversals and omit the time spent in background',()=>{
  const samples=[],motion=createLobbyNavigationMotion(row=>samples.push(row));
  motion.select('battle',true,false);
  motion.select('assembly',false,true,0);motion.frame(12);motion.frame(32);
  motion.select('battle',true,true,40);motion.frame(84);motion.frame(552);
  assert.deepEqual(samples,[{tab:'battle',changes:2,frames:4,firstPaintMs:12,maxFrameGapMs:468,framesOver40Ms:2}]);
  motion.select('assembly',false,true,600);motion.frame(612);motion.resetTiming();
  motion.frame(15000);motion.frame(16000);
  assert.equal(samples.length,1);
});

test('the moving footer shares its visible cell bounds with touch and returns to cached art',t=>{
  const f=fixture(t,undefined,{main:true}),motion=f.device.lobbyNavigation=createLobbyNavigationMotion();
  let animated=0,exits=0;
  motion.homeArtwork={navigation(){animated++;return true;},dock(){exits++;}};
  motion.select('battle',true,false);motion.select('shop',false);
  f.view.update({tab:'shop',shopSection:'coins',snapshot:shopSnapshot()},'shop');
  f.paint();
  const first=f.control('nav-shop'),originalCanvases=f.canvases;
  assert(Math.abs(first.w-139*screen.width/750)<1e-6);
  f.paint(100);
  const middle=f.control('nav-shop');assert(middle.w>first.w&&middle.w<188*screen.width/750);
  f.point('start',middle.w-1,middle.y+15);f.point('end',middle.w-1,middle.y+15);
  assert.equal(f.commands.at(-1)[1].tab,'shop');
  f.paint(100);assert.equal(animated,2);assert(exits>=3);
  assert(Math.abs(f.control('nav-shop').w-screen.width*.2506)<1e-6);
  f.paint(140);
  assert.equal(f.canvases,originalCanvases);
  const idle=f.events.length;f.paint(1000);assert.equal(f.events.length,idle);
});

test('weapon detail button shrinks its face and label without changing the hit or repeating a command',async t=>{
  const f=fixture(t,undefined,{catalog:true}),data=catalogFixture('weapon');
  f.view.update({tab:'weapon',...data},'weapon');
  f.paint();
  for(const [url,decode] of f.requests)decode({url,width:128,height:96});
  await new Promise(resolve=>setImmediate(resolve));f.paint();
  const hit=f.view.state().controls.find(c=>c.id.startsWith('detail-'));
  assert(hit);const label=f.textMeshes.get(hit.label),width=label.scale.x;
  const x=hit.x+hit.w/2,y=hit.y+hit.h*.75;
  f.point('start',x,y);f.paint(112);f.paint(16);
  assert(Math.abs(label.scale.x/width-.9)<1e-6);assert.deepEqual(f.control(hit.id),hit);
  f.point('end',x,y);f.paint(160);
  assert.equal(label.scale.x,width);assert.equal(f.commands.filter(([id])=>id==='nativeCollectionDetail').length,1);
  f.point('start',x,y);f.paint(100);f.point('move',x,y-20);f.point('end',x,y-20);
  assert.equal(label.scale.x,width);assert.equal(f.commands.length,1);
  f.point('start',x,y);f.paint(100);f.park();assert.equal(label.scale.x,width);
});

test('campaign guide follows the visible button through a state refresh, repeated touches and page changes',async t=>{
  const f=fixture(t),motion=f.device.lobbyNavigation=createLobbyNavigationMotion(),ids=['patrol','start','backpack'];
  const bounds=new Map(),commands=[];
  let sync,ring;
  Object.assign(f.device,{homeState:{pilotId:'guide-test',chapter:0,total:0,maximum:3,showTasks:true},
    subscribeHome(fn){sync=fn;return ()=>{};}});
  f.platform.viewport.safeTop=48;
  Object.assign(f.renderer,{setPixelRatio(){},setRenderTarget(){},render(scene,camera){
    scene.traverseVisible(mesh=>{
      if(!mesh.isMesh||!mesh.layers.test(camera.layers))return;
      const u=mesh.material.uniforms,path=u?.art?.value?.image?.url;
      const id=ids.find(key=>path?.includes('/buttons/'+key+'.'));
      if(id&&u.box?.value?.isVector4)bounds.set(id,u.box.value.toArray());
      if(mesh.userData.art==='gold')ring=[mesh.position.x,mesh.position.y,mesh.scale.x,mesh.scale.y];
    });
  }});
  motion.select('battle',true);
  const home=mod.exports.mountWechatHome(f.device,f.platform,{stageEntry:true,getBounds:()=>screen,
    visible:()=>true,accepts:()=>true,openPortrait:()=>({surface:{},layout(){},close(){}})},
    action=>commands.push(action),()=>true);
  t.after(()=>home.close());
  for(let i=0;i<3;i++){
    for(const [url,resolve] of f.requests)resolve({url,width:256,height:256});
    await new Promise(resolve=>setImmediate(resolve));
  }
  function paint(delta=0){f.paint(delta);ring=null;bounds.clear();home.paintNow();}
  function guide(id){home.setGuide({id,text:'点击按钮',strong:false});}
  function touch(phase,id){
    const [x,y,w,h]=bounds.get(id);
    f.point(phase,(x+w/2)*screen.width/750,(y+h/2)*screen.height/1624);
  }
  function encloses(id){
    const [x,y,w,h]=bounds.get(id),padding=4*750/screen.width;
    assert(ring,'visible button should have a guide');
    [x-padding,y-padding,w+2*padding,h+2*padding].forEach((v,i)=>assert(Math.abs(v-ring[i])<1e-5,id+' guide edge '+i));
  }
  guide('start');paint();assert(bounds.has('start'));assert.equal(ring,null);
  paint(260);sync();paint();assert.equal(ring,null,'partly hidden face must not cover the tab bar with a guide');
  paint(210);encloses('start');
  for(const id of ids){
    guide(id);paint();
    const rest=bounds.get(id)[2];
    touch('start',id);paint(115);assert(bounds.get(id)[2]<rest*.92);encloses(id);
    sync();paint();encloses(id);
    touch('end',id);
    const next=ids[(ids.indexOf(id)+1)%ids.length];touch('start',next);
    paint(20);assert.equal(bounds.get(id)[2],rest,'another dock button cancels the previous rebound');
    home.park();home.activate();paint();touch('end',next);
    assert.equal(commands.at(-1),id);
  }
  assert.deepEqual(commands,ids);
});

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


test('WeChat keeps the startup cover until chapter one is ready for a fresh save',async t=>{
  const f=fixture(t,undefined,{viewport:{safeTop:content.top}}),{device,platform}=f;
  const commands=[],messages=[],closed=[],retries=[],storage=new Map();
  const viewportListeners=new Set();
  platform.onViewport=fn=>{viewportListeners.add(fn);return ()=>viewportListeners.delete(fn);};
  Object.assign(device,{subscribeHome:()=>()=>{},
    publishHome(snapshot,chapter,developer){device.homeState=homePresentation(snapshot,chapter,developer);}});
  const portraits={openHome(){assert.fail('first launch mounts the lobby portrait');},setVisible(){},sync(){},destroy(){}};
  let leaveBattle,emit;
  const game=await startLobbySession({app:{renderer:device},
    sessionHost:{
      isCurrent:()=>true,storage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},
      audio:{},frames:{requestFrame:platform.requestFrame,cancelFrame:platform.cancelFrame,isVisible:()=>platform.visible,watchVisibility:()=>()=>{}},
      setTimeout(){assert.fail('attribute catalog competes with first sortie');},clearTimeout(){},
      showFirstSortieRetry(){retries.push(true);},
    },
    createAudio:()=>({feedback:{stop(){}},sync(){},destroy(){}}),
    createBattle(setup){
      leaveBattle=setup.onLeave;
      const host={baseURL:'https://example.invalid/',now:platform.now,hidden:()=>!platform.visible,
        makeSessionId:()=> 'first-sortie',setLaunching(){},bind:()=>()=>{},
        createSurface:()=>({show(){},close(){},mount(request){
          emit=request.emit;return {receive:message=>messages.push(message),dispose(){}};
        }})};
      const sortie=createSortieController({...setup,screen:device,host,
        showSortieLoading:options=>showWechatSortie(platform,{},options,()=>startup)});
      return {...sortie,start(options){commands.push(options);return sortie.start(options);}};
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
  startup.startFirstSortie(()=>{sent=game.peripheralAction('start',{index:0});});
  f.paint();assert.deepEqual(commands,[]);
  platform.visible=true;
  for(const notify of viewportListeners)notify(screen,true);
  f.paint();
  await Promise.resolve();
  assert.deepEqual(commands,[{trial:false,chapterId:1}]);
  assert.equal(device.cover,startup);
  assert.deepEqual(closed,[]);
  const send=(type,payload={})=>emit({channel:'shnh-replica-battle-v1',session:'first-sortie',type,...payload});
  await send('boot');
  await send('loading-progress',{phase:'textures',progress:.5});
  for(const [url,resolve] of f.requests)resolve({url,width:256,height:256});
  await Promise.resolve();f.paint();
  assert(f.texts.has('正在加载战斗贴图…'));
  assert(![...f.requests.keys()].some(url=>url.includes('sortie-hangar-v1')));
  await send('ready');
  const config=messages.find(message=>message.type==='configure');
  await send('configured',{requestId:config.requestId,configurationKey:config.configurationKey});
  const start=messages.find(message=>message.type==='start');
  assert.equal(device.cover,startup,'configuration keeps the startup cover until the first battle frame');
  assert(!messages.some(message=>message.type==='launch-visible'));
  await send('started',{runId:start.runId,configurationKey:config.configurationKey});
  assert.equal((await sent).started,true);
  assert.deepEqual(closed,[true]);
  assert.equal(device.cover,null);
  assert(messages.some(message=>message.type==='launch-visible'));
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

test('WeChat retries a failed first sortie on the same startup screen',async t=>{
  const f=fixture(t),{device,platform}=f;
  let retries=0;
  const startup=showWechatStartup(platform,{bounds:()=>screen,retry:assert.fail,copyReport:assert.fail,
    onRelease(){device.cover=null;}});
  device.cover=startup;
  t.after(startup.close);
  const createLoading=()=>showWechatSortie(platform,{}, {screen:device,firstSortie:true},()=>startup);
  let loading=createLoading();
  loading.fail({message:'战斗贴图读取失败',onRetry(){retries++;loading=createLoading();}});
  for(const [url,resolve] of f.requests)resolve({url,width:256,height:256});
  await Promise.resolve();f.paint();
  assert(f.texts.has('战斗贴图读取失败'));
  const {x,y}=f.textMeshes.get('重新加载').position;
  f.point('start',x,y);f.point('end',x,y);
  loading.update(.5,'正在加载战斗贴图…');f.paint();
  assert.equal(retries,1);
  assert.equal(device.cover,startup);
  assert(f.texts.has('正在加载战斗贴图…'));
  assert(![...f.requests.keys()].some(url=>url.includes('sortie-hangar-v1')));
  loading.close();
  assert.equal(device.cover,null);
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

test('WeChat prepares returning lobby menus behind the cover even on slow frames',async t=>{
  let modelSteps=0;
  const aircraftPreview=()=>({ready:false,target:{width:100,height:80},update(){},tick(){},pause(){},close(){},
    prepare(){modelSteps++;return false;}});
  const f=fixture(t,undefined,{viewport:{safeTop:content.top},aircraftPreview,reuseArtwork:true});
  const {platform,renderer,device}=f;
  platform.inputIdle=true;
  Object.assign(renderer,{setPixelRatio(){},setRenderTarget(){}});
  Object.assign(device,{subscribeHome:()=>()=>{},
    publishHome(snapshot,chapter,developer){device.homeState=homePresentation(snapshot,chapter,developer);}});
  const snapshot={...shopSnapshot(),...equipmentSnapshot(),stages:[],research:{cards:[]},replicaCollection:{pilots:[]}};
  const bridge={app:{renderer:device},getPeripheralSnapshot:()=>snapshot};
  const portraits={openHome:()=>({layout(){},close(){}}),openCatalog:(...args)=>f.region.openPortrait(...args),
    setVisible(){},sync(){},destroy(){}};
  device.cover={};
  const lobby=mountWechatLobby({},platform,device,{bridge,portraits,deferPortraits:true,
    openAircraft:(_device,_bounds,...args)=>f.region.openAircraft(...args)});
  t.after(lobby.destroy);
  let ready;
  void lobby.prepareMenus().then(pages=>{ready=pages;});
  for(let frame=0;frame<96&&!ready;frame++){
    f.paint(54);
    for(const [url,resolve] of f.requests)resolve({url,width:96,height:80});
    await new Promise(setImmediate);
  }
  assert.deepEqual(new Set(ready),new Set(['assembly','shop','supply','research']),
    'the main destination frames warm before the cover is released');
  assert.deepEqual(f.events,[]);
  assert.equal(modelSteps,0);
  device.cover=null;
  lobby.switchTab('assembly');f.paint();
  const still=optimizeUiAssetUrls('/art/aircraft-ui-v1/'+snapshot.aircraftId+'-hangar.webp');
  assert(f.images.has(still),'equipment displays its complete still on the first frame');
  assert.equal(modelSteps,0,'the studio does not block the first equipment frame');
  lobby.update(.016);
  assert(modelSteps>0,'the live model starts after the complete equipment frame');
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

test('Memory pressure releases parked main and secondary pages and stops background warmup across returns',async t=>{
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
  await warming;assert(warmed,'canceled background work settles its caller');
  lobby.switchTab('shop');assert.notEqual(device.menuView,shop);
  lobby.switchTab('loadout');assert.notEqual(device.menuView,catalog);
  lobby.switchTab('research');assert.notEqual(device.menuView,research);
  lobby.setVisible(false);lobby.setVisible(true);
  assert.deepEqual(await lobby.prepareMenus(),[]);
});

test('WeChat keeps one prepared 2D page across a sortie and drops it on memory pressure',async t=>{
  const f=fixture(t,undefined,{viewport:{safeTop:content.top}}),{platform,renderer,device}=f;
  platform.inputIdle=false;
  Object.assign(renderer,{setPixelRatio(){},setRenderTarget(){}});
  Object.assign(device,{subscribeHome:()=>()=>{},publishHome(snapshot,chapter,developer){device.homeState=homePresentation(snapshot,chapter,developer);}});
  const snapshot={...shopSnapshot(),stages:[],research:{cards:[],owned:0},pilots:[]};
  const bridge={app:{renderer:device},getPeripheralSnapshot:()=>snapshot};
  const portraits={openHome:()=>({layout(){},close(){}}),openCatalog:(...args)=>f.region.openPortrait(...args),
    setVisible(){},sync(){},destroy(){}};
  const lobby=mountWechatLobby({},platform,device,{bridge,portraits,deferPortraits:true});
  t.after(lobby.destroy);
  async function finish(){
    for(let frame=0;frame<35&&!device.menuView.state().ready;frame++){
      for(const [url,resolve] of f.requests)resolve({url,width:96,height:80});
      await Promise.resolve();f.paint();
    }
    assert(device.menuView.state().ready);
  }
  lobby.switchTab('research');await finish();const research=device.menuView;
  lobby.switchTab('shop');await finish();const shop=device.menuView;
  assert(f.texts.has('装备宝箱'));
  lobby.switchTab('battle');lobby.setVisible(false);lobby.setVisible(true);
  lobby.switchTab('shop');
  assert.equal(device.menuView,shop);
  assert.equal(device.menuView.preparing,false);
  f.paint();
  assert(f.texts.has('装备宝箱'));
  lobby.switchTab('research');assert.notEqual(device.menuView,research);
  lobby.switchTab('battle');lobby.setVisible(false);lobby.trimMemory();lobby.setVisible(true);
  lobby.switchTab('shop');assert.notEqual(device.menuView,shop);
});

test('the next launch reports the last memory warning once, including the equipment subpage',t=>{
  const rows=new Map(),messages=[];
  const api={getStorageSync:key=>rows.get(key),setStorageSync:(key,value)=>rows.set(key,value),removeStorageSync:key=>rows.delete(key)};
  t.mock.method(console,'warn',(...args)=>messages.push(args));
  rememberMemoryWarning(api,{buildId:'previous',page:{tab:'assembly',subpage:'pilot'}});
  const warning={buildId:'current',level:10,page:{tab:'assembly',subpage:'aircraft'},geometriesBefore:102};
  rememberMemoryWarning(api,warning);
  reportPreviousMemoryWarning(api);reportPreviousMemoryWarning(api);
  assert.deepEqual(messages,[['[Three 上次内存告警]',JSON.stringify(warning)]]);assert.equal(rows.size,0);
});

test('a post-battle tour of aircraft, weapons and pilots never retains a hidden 3D studio',async t=>{
  const f=fixture(t,undefined,{viewport:{safeTop:content.top}});
  const {device,renderer,platform}=f,routes=new Set(),live=new Set(),decoded=new Set();
  let cacheReleases=0,lowMemory=false,aircraftBuilds=0,portraitBuilds=0,portraitLoaded=false;
  platform.bindTouches=(handler,priority=0,accepts=()=>true)=>{
    const route={handler,priority,accepts};routes.add(route);return ()=>routes.delete(route);
  };
  Object.assign(renderer,{setPixelRatio(){},setRenderTarget(){},setViewport(){}});
  Object.assign(device,{subscribeHome:()=>()=>{},publishHome(snapshot,chapter,developer){device.homeState=homePresentation(snapshot,chapter,developer);}});
  const snapshot={...shopSnapshot(),...equipmentSnapshot(),...catalogFixture('pilot').snapshot,stages:[]};
  const bridge={app:{renderer:device},getPeripheralSnapshot:()=>snapshot};
  const portraits={openHome:()=>({layout(){},close(){}}),openCatalog:(_d,_b,...args)=>f.region.openPortrait(...args),sync(){},destroy(){},
    setVisible(show,{leavePage,suspendLoading}={}){
      if(show&&!portraitLoaded){assert.equal(live.size,0);portraitBuilds++;portraitLoaded=true;}
      if(!show&&(leavePage||suspendLoading))portraitLoaded=false;
    }};
  function openAircraft(_device,_bounds,_panel,refresh){
    const preview={ready:false,target:{width:200,height:120},update(){},paint(){},pause(){},
      tick(){if(!this.ready){this.ready=true;aircraftBuilds++;live.add(this);refresh();}assert.equal(live.size,1);},
      prepare(){this.tick();return true;},releaseModel(){live.delete(this);this.ready=false;},close(){this.releaseModel();}};
    return preview;
  }
  const lobby=mountWechatLobby({},platform,device,{bridge,portraits,openAircraft,deferPortraits:true,releaseBattleCache:()=>cacheReleases++});
  t.after(lobby.destroy);
  lobby.setVisible(false);lobby.setVisible(true);
  assert.equal(cacheReleases,0,'the battle cache can still serve an immediate replay');
  lobby.switchTab('assembly');
  assert.equal(cacheReleases,1,'release the battle cache before creating the equipment preview');
  async function settle(frames=48){
    for(let i=0;i<frames;i++){
      for(const [url,resolve] of f.requests)if(!decoded.has(resolve)){decoded.add(resolve);resolve({url,width:96,height:80});}
      await Promise.resolve();f.paint();lobby.update(.016);
    }
  }
  function tap(id){
    const hit=device.menuView.state().controls.find(row=>row.id===id);
    assert(hit,id);
    const point={phase:'start',x:hit.x+hit.w/2,y:hit.y+hit.h/2,pointerId:1};
    const route=[...routes].filter(row=>row.accepts(point)).sort((a,b)=>b.priority-a.priority)[0];
    route.handler(point);route.handler({...point,phase:'end'});
  }
  await t.test('rapid home and equipment reversals reuse the ready owner until the player stays on a page',async()=>{
    await settle();
    assert.equal(live.size,1);
    const firstPreview=aircraftBuilds,initialPortraits=portraitBuilds;
    for(let i=0;i<8;i++){
      lobby.switchTab('battle');await settle(4);
      lobby.switchTab('assembly');await settle(5);
    }
    assert.equal(aircraftBuilds,firstPreview);
    assert.equal(portraitBuilds,initialPortraits);
    assert.equal(live.size,1);
    lobby.switchTab('battle');await settle();
    assert.equal(live.size,0);
    assert.equal(portraitLoaded,true);
    const homePortrait=portraitBuilds;
    for(let i=0;i<8;i++){
      lobby.switchTab('assembly');await settle(4);
      assert(device.menuView.state().controls.some(c=>c.id==='catalog-aircraft'));
      lobby.switchTab('battle');await settle(5);
    }
    await settle();
    assert.equal(portraitBuilds,homePortrait);
    assert.equal(aircraftBuilds,firstPreview);
    lobby.switchTab('assembly');await settle();
    assert.equal(aircraftBuilds,firstPreview+1);
    assert.equal(portraitLoaded,false);
    lobby.switchTab('battle');await settle(2);assert.equal(live.size,1);
    lobby.setVisible(false);assert.equal(live.size,0,'starting a sortie cancels the brief hold');
    lobby.setVisible(true);lobby.switchTab('assembly');await settle();
  });
  for(let tour=0;tour<3;tour++){
    for(const page of ['aircraft','weapon','pilot']){
      await settle();assert.equal(live.size,lowMemory?0:1,'visible hangar');
      tap('catalog-'+page);
      assert.equal(lobby.state.subpage,page);
      assert.equal(live.size,0,'previous studio released before building '+page);
      await settle();
      assert.equal(live.size,!lowMemory&&page==='aircraft'?1:0);
      if(tour===1&&page==='aircraft'){
        const catalog=device.menuView;
        lowMemory=true;lobby.trimMemory();lobby.trimMemory();
        assert.equal(live.size,0,'the visible 3D model releases immediately');
        await settle();assert.equal(device.menuView,catalog);
        assert(f.images.has(optimizeUiAssetUrls(nativeCollectionArt(snapshot.replicaCollection.skins[0],'preview'))));
      }
      tap('back');assert.equal(lobby.state.subpage,'');
    }
  }
  assert.equal(cacheReleases,2);
  lobby.switchTab('research');assert.equal(live.size,0);
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

for(const won of [false,true])test('first '+(won?'victory':'defeat')+' can return once saved even if background work never finishes',async t=>{
  const configuration=createReplicaConfiguration({items:[],slots:{},levels:{}},createReplicaProgression());
  const snapshot={...equipmentSnapshot(),firstSortieRequired:true};
  let emit,current,leaves=0,grants=0,saveAvailable=won;
  const errors=[],messages=[];
  const runId='run',session='first';
  const store={snapshot:()=>snapshot,replicaConfiguration:()=>configuration,
    prepareSortie:()=>({ok:true,snapshot:{id:runId,replicaConfiguration:configuration}}),
    recordSortie(result){
      if(!saveAvailable)return {ok:false,message:'保存失败'};
      grants++;return {ok:true,rewards:[],replica:result};
    }};
  const sortie=createSortieController({peripheral:()=>store,onProgress(){},onState(){},onEnter(){},
    onLeave(){leaves++;},onError:message=>errors.push(message),screen:{},
    host:{baseURL:'https://example.invalid/',now:()=>0,hidden:()=>false,setLaunching(){},makeSessionId:()=>session,bind:()=>()=>{},
      prepareResultReturn(isCurrent){current=isCurrent;return new Promise(()=>{});},
      createSurface:()=>({show(){},close(){},mount(request){emit=request.emit;return {receive:m=>messages.push(m),dispose(){}};}})},
    showSortieLoading:()=>({update(){},close(){},fail(){}})});
  t.after(sortie.dispose);
  const started=sortie.start({chapterId:1});
  const send=(type,data={})=>emit({channel:'shnh-replica-battle-v1',session,type,...data});
  await send('ready');
  const {requestId,configurationKey}=messages.find(m=>m.type==='configure');
  await send('configured',{requestId,configurationKey});await send('started',{runId,configurationKey});await started;
  const result={runId,chapterId:1,won,endReason:won?'victory':'defeat'};
  if(!saveAvailable)t.mock.method(console,'error',()=>{});
  await send('result',{result});
  if(!saveAvailable){
    await send('home',{result});
    assert.equal(leaves,0);assert.equal(grants,0);assert(errors.includes('保存失败'));
    saveAvailable=true;
    await send('result',{result});
  }
  assert.equal(current(),true);
  await Promise.all([send('home',{result}),send('home',{result})]);
  assert.equal(current(),false);
  assert.equal(leaves,1);assert.equal(grants,1);
});

test('first sortie prepares the equipment still at settlement and starts the 3D studio only after opening equipment',async t=>{
  let modelReady=false,modelSteps=0,modelLayouts=0;
  const aircraftPreview=refresh=>({ready:false,target:{width:100,height:80},update(){},tick(){},pause(){},close(){},
    prepare(){modelSteps++;if(modelReady&&!this.ready){this.ready=true;refresh();}return this.ready;},paint(){modelLayouts++;}});
  const {debug,lines}=captureDebug(t);
  const f=fixture(t,debug,{viewport:{safeTop:content.top},aircraftPreview,reuseArtwork:true});
  const {platform,renderer,device,region}=f;
  const routes=new Set();
  platform.bindTouches=(handler,priority=0,accepts=()=>true)=>{
    const route={handler,priority,accepts};routes.add(route);return ()=>routes.delete(route);
  };
  platform.inputIdle=false;
  const fileReads=[];
  platform.warmArtworkFiles=async (urls,signal)=>{fileReads.push({urls,signal});};
  let output=null;
  Object.assign(renderer,{setPixelRatio(){},setViewport(){},getRenderTarget:()=>output,setRenderTarget:value=>{output=value;}});
  Object.assign(device,{subscribeHome:()=>()=>{},
    publishHome(snapshot,chapter,developer){device.homeState=homePresentation(snapshot,chapter,developer);}});
  let snapshot={...shopSnapshot(),...equipmentSnapshot(),nativeAcquisition:undefined,firstSortieRequired:true,
    onboarding:{version:1,completed:[1,4]},stages:[{index:0,unlocked:true}],pilots:[{id:'pilot-01',name:'夜莺',rarity:'R'}],
    pools:{pilot:{singleCost:10}},research:{cards:[]}};
  const bridge={app:{renderer:device},getPeripheralSnapshot:()=>snapshot};
  const portraitVisibility=[];
  const portraits={openHome:()=>({layout(){},close(){}}),openCatalog(){return region.openPortrait(()=>{},()=>{});},
    setVisible(value){portraitVisibility.push(value);},sync(){},destroy(){}};
  const loading=[];
  const api={showLoading(){loading.push('show');},hideLoading(){loading.push('hide');}};
  const lobby=mountWechatLobby(api,platform,device,{bridge,portraits,deferPortraits:true,deferFirstSortieLobby:true,
    openAircraft:(_device,_bounds,...args)=>region.openAircraft(...args)});
  t.after(lobby.destroy);
  const signal={aborted:false},uploads=new Set(),settled=new Set();
  const homeBackdrop=optimizeUiAssetUrls('/art/psd-main-v1/main-background.png');
  const lateButton=optimizeUiAssetUrls('/art/psd-main-v1/buttons/patrol.png');
  let releaseHome=false,releaseButton=false;
  renderer.initTexture=texture=>uploads.add(texture.image.url);
  const gear=optimizeUiAssetUrls('/art/psd-equipment-v1/equipment-background.webp');
  const aircraft=optimizeUiAssetUrls('/art/aircraft-ui-v1/'+snapshot.aircraftId+'-hangar.webp');
  const portrait=recruitPortrait('pilot-01');
  assert.deepEqual(await lobby.prepareMenus(),[]);
  assert.equal(lobby.state.visible,false);
  assert(!f.requests.has(homeBackdrop));
  const touches=routes.size;
  device.cover={};
  device.warmFirstSortieHomeFiles(signal);
  assert.deepEqual(fileReads,[]);
  device.cover=null;
  function decode(){
    for(const [url,resolve] of f.requests)if(!settled.has(resolve)&&(releaseHome||url!==homeBackdrop)&&(releaseButton||url!==lateButton)){
      settled.add(resolve);
      resolve({url,width:256,height:256});
    }
  }
  device.warmFirstSortieHomeFiles(signal);
  assert.equal(fileReads.length,1);
  assert.equal(fileReads[0].urls[0],homeBackdrop);
  assert(fileReads[0].urls.includes(optimizeUiAssetUrls('/art/onboarding-dialogue-v2/panel.webp')));
  assert(fileReads[0].urls.includes(lateButton));
  assert.equal(fileReads[0].signal.aborted,false);
  platform.visible=false;
  assert.equal(fileReads[0].signal.aborted,true);
  device.warmFirstSortieHomeFiles(signal);
  assert.equal(fileReads.length,1);
  platform.visible=true;
  assert.equal(uploads.size,0);
  assert.equal(routes.size,touches,'hidden menus never interrupt combat touches');
  const otherMenus=[portrait,...['shop','research'].map(tab=>optimizeUiAssetUrls(art[tab+'-background']))];
  for(const url of [gear,aircraft,...otherMenus])assert(!f.requests.has(url),url);
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
      equipment.items[1]=tutorialGear(equipment.items[1]);
      const other=equipment.items.at(-1);other.equipped=true;equipment.slots[other.type]=other.uid;
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
  assert.equal(leaveCount,0);
  assert.equal(lobby.state.visible,false);
  f.events.length=0;
  const equippedIcon=optimizeUiAssetUrls('/art/project-flight-gear-v1/saint-ring-v4/4110100.webp');
  for(let frame=0;frame<30;frame++){f.paint();decode();await Promise.resolve();}
  assert(f.requests.has(equippedIcon),'preparation uses the saved equipment data');
  assert.equal(modelSteps,0,'the battle and equipment studios must not coexist');
  assert.equal(leaveCount,0,'the returning lobby artwork is still pending');
  assert(f.requests.has(homeBackdrop),'the returning lobby is prepared after settlement');
  assert([...routes].every(route=>!route.accepts({x:100,y:100})));
  assert.deepEqual(f.events,[]);
  for(let frame=0;frame<120&&!details(lines,'结算时装备详情已准备').length;frame++){
    f.paint();decode();await new Promise(setImmediate);
  }
  assert(details(lines,'结算时装备详情已准备').length);
  assert(f.requests.has(gearSkillIcon),'idle receipt frames prepare the exact tutorial item');
  t.mock.timers.enable({apis:['setTimeout']});
  await Promise.all([send('home'),send('home')]);
  assert.equal(leaveCount,1);
  assert.equal(lobby.state.visible,true,'confirmation returns even while the home background is pending');
  assert(!portraitVisibility.includes(true),'the animated portrait cannot compete with the first home frame');
  f.paint();
  assert(!f.events.includes('paint'),'keep the previous frame until the lobby can draw its backdrop');
  t.mock.timers.tick(150);
  assert.deepEqual(loading,['show']);
  releaseHome=true;
  for(let frame=0;frame<5;frame++){decode();await new Promise(setImmediate);f.paint();}
  assert(f.events.includes('paint'),'an unrelated missing button cannot hold the first lobby frame');
  lobby.update(.016);
  assert.equal(portraitVisibility.at(-1),true);
  releaseButton=true;
  assert.deepEqual(errors,[]);
  assert.equal(lobby.tab,'battle');
  assert.equal(device.homeView.guide?.id,'nav-assembly');
  snapshot={...snapshot,wallet:{...snapshot.wallet,stamina:96}};
  lobby.refresh();
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
  assert(f.images.has(aircraft));assert.equal(modelLayouts,0);
  modelReady=true;
  for(let frame=0;frame<8&&!modelLayouts;frame++){lobby.update(.016);f.paint();}
  assert(modelLayouts>0);
  assert.deepEqual(loading,['show','hide']);
  lobby.update(.016);f.paint();
  const openPanel=device.openLobbyPanel;
  let detailOptions;
  device.openLobbyPanel=(kind,...options)=>{
    if(kind==='gearDetail')detailOptions=options;
    return openPanel(kind,...options);
  };
  const gearCard=device.menuView.state().controls.find(control=>control.id==='gear-002');
  const point={phase:'start',x:gearCard.x+gearCard.w/2,y:gearCard.y+gearCard.h/2,pointerId:1};
  const route=[...routes].filter(entry=>entry.accepts(point)).sort((a,b)=>b.priority-a.priority)[0];
  route.handler(point);route.handler({...point,phase:'end'});
  assert.equal(lobby.state.modal,'gearDetail');
  f.paint();
  assert(f.texts.has('装备详情'));
  assert(f.texts.has('替换'));
  for(const url of [...activityFrames,activityClose,gearSkillIcon])assert(f.images.has(url),url);
  const frame=details(lines,'页面首帧').find(row=>row.page==='gearDetail');
  assert.equal(frame?.artwork.pending,0);
  const entry=details(lines,'页面切换').find(row=>row.page==='gearDetail');
  assert.equal(entry?.prepared,true);
  bridge.peripheralAction=(action,{id})=>{
    assert.equal(action,'gearEquip');assert.equal(id,'002');
    const equipment=structuredClone(snapshot.equipment);
    equipment.items[0].equipped=false;equipment.items[1].equipped=true;equipment.slots[1]=id;
    snapshot={...snapshot,equipment,onboarding:{version:1,completed:[1,4,9]}};
    return {ok:true};
  };
  const preparedDetail=device.panel;
  const slotPulse=t.mock.method(device.feedback,'gearSlot');
  const replace=preparedDetail.state().controls.find(control=>control.id==='gearEquip');
  const tap={phase:'start',x:replace.x+replace.w/2,y:replace.y+replace.h/2,pointerId:2};
  const dialogRoute=[...routes].find(entry=>entry.priority===10&&entry.accepts(tap));
  dialogRoute.handler(tap);dialogRoute.handler({...tap,phase:'end'});
  await new Promise(setImmediate);
  assert.equal(lobby.state.modal,null);
  assert.equal(lobby.snapshot.equipment.slots[1],'002');
  assert.deepEqual(slotPulse.mock.calls.map(call=>call.arguments),[[1]]);
  assert(!routes.has(dialogRoute),'a closed detail releases its touch route');
  const [detailHost,sendDetail,scrollDetail,soundDetail,detailEntry]=detailOptions;
  const reopened=openPanel('gearDetail',detailHost,sendDetail,scrollDetail,soundDetail,{
    ...detailEntry,snapshot:lobby.snapshot,modal:{...detailEntry.modal,detailOrigin:'slot'},
  });
  assert.equal(device.panel,preparedDetail,'another visit keeps the uploaded detail artwork');
  for(let frame=0;frame<24&&device.panel.preparing;frame++){
    f.paint();decode();await new Promise(setImmediate);
  }
  assert(!device.panel.preparing);
  assert(device.panel.state().controls.some(c=>c.id==='gearUnequip'),'the reused panel displays the equipped state');
  assert.equal(details(lines,'页面切换').filter(row=>row.page==='gearDetail').at(-1)?.retained,true);
  const secondRoute=[...routes].find(entry=>entry.priority===10);
  assert(secondRoute);
  reopened.close();reopened.close();
  assert.equal(device.panel,null);
  assert(!routes.has(secondRoute));
  platform.inputIdle=true;
  for(let frame=0;frame<180;frame++){
    lobby.update(.016);f.paint(16);decode();await new Promise(setImmediate);
  }
  for(const url of otherMenus)assert(uploads.has(url),'lobby idle time warms '+url);
  lobby.switchTab('supply');f.paint();
  assert(f.images.has(portrait),'the full portrait is ready on entry');
  lobby.update(.016);lobby.setVisible(false);
  const count=fileReads.length;device.warmFirstSortieHomeFiles(signal);assert.equal(fileReads.length,count);
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
  test('WeChat guides chapter two only after clearing chapter one, with first-battle '+(won?'victory':'defeat'),async t=>{
    const {device,region,renderer}=fixture(t);
    const save=new Map(),storage={getItem:key=>save.get(key)??null,setItem:(key,value)=>save.set(key,value)};
    const collection=createInitialGachaState();
    let selectedStage=0;
    const options={storage,profile:{coins:0,diamonds:0},
      stages:['第一章','第二章','第三章'].map((name,index)=>({id:'stage-'+index,name})),
      selectStage:index=>{selectedStage=index;},getSelectedStage:()=>selectedStage,
      now:()=>Date.UTC(2026,10,24,4),rng:()=>.5,saveProfile:()=>true,
      collectionApi:{get:()=>collection,transact:change=>change(collection)},
      pilotApi:{get:()=>({selected:'pilot-01',persistentSelected:'pilot-01',owned:['pilot-01'],resonance:{}})}};
    const system=createPeripheralSystem(options);
    device.reducedMotion=()=>true;device.safeBottom=()=>34;
    device.feedback={pulse(){},power(){},wallet(){},clear(){}};
    device.toast={show(){},clear(){}};
    Object.assign(device,lobbyPanels(device,{inspectItems:()=>({open(){},close(){},destroy(){}})}));
    let sendHome,send,guide,started,settled=false;
    const tabs=[];
    device.mountHome=(page,action)=>{
      sendHome=action;
      return {page,selectPilot(){},tick(){},setGuide(value){guide=value;},close(){}};
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
    const bridge={app:{renderer:device},switchLobbyTab:tab=>tabs.push(tab),
      peripheralAction(action,payload){
        if(action!=='start')return system.action(action,payload);
        assert.equal(payload.stageIndex,1);
        started=system.prepareSortie({engine:'danke-replica-v1',chapterId:payload.stageIndex+1,replicaConfiguration:system.replicaConfiguration()});
        return {...started,started:started.ok};
      },getPeripheralSnapshot(){
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
    function finishFirstChapter(victory){
      const run=system.prepareSortie({engine:'danke-replica-v1',chapterId:1,replicaConfiguration:system.replicaConfiguration()});
      assert(run.ok,run.message);lobby.setVisible(false);
      const receipt=system.recordSortie({engine:'danke-replica-v1',runId:run.snapshot.id,chapterId:1,stageIndex:0,
        endReason:victory?'victory':'defeat',won:victory,wave:victory?15:1,clock:victory?270:35,gold:0,level:2});
      assert(receipt.ok,receipt.message);settled=true;lobby.setVisible(true);
    }
    async function closeProgress(sendAction){
      for(let i=0;i<4&&lobby.state.modal==='processFeedback';i++)await sendAction('close',{},region);
      assert.equal(lobby.state.modal,null);
      lobby.update(.016);
    }
    finishFirstChapter(won);
    assert.equal(lobby.tab,'battle');assert.equal(lobby.state.modal,null);
    assert.deepEqual(tabs,[]);
    assert.deepEqual(guide,{id:'nav-assembly',text:'点击装备',strong:true,modal:false});
    assert.equal(lobby.snapshot.firstSortieRequired,false);
    assert.deepEqual(lobby.snapshot.replicaCampaign.clearedChapterIds,won?[1]:[]);
    assert.equal(lobby.snapshot.stages[1].unlocked,won);
    assert.equal(lobby.snapshot.secondSortieGuidePending,false);
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
    assert.deepEqual(system.snapshot().replicaCampaign.clearedChapterIds,won?[1]:[]);
    assert.equal(system.snapshot().stages[1].unlocked,won);
    assert.equal(system.snapshot().secondSortieGuidePending,won);
    assert.equal(system.snapshot().stages[2].unlocked,false);
    assert.equal(lobby.state.modal,won?'processFeedback':null,'queued feedback resumes after teaching equipment');
    await closeProgress(send);
    if(won)assert.deepEqual(guide,{id:'nav-battle',text:'返回战役',strong:true,modal:false});
    else assert.equal(guide,null);
    await send('tab',{tab:'battle'},region);lobby.update(.016);
    if(!won){
      assert.equal(system.action('selectStage',{index:1}).ok,false);
      assert.equal(system.prepareSortie({engine:'danke-replica-v1',chapterId:2,replicaConfiguration:system.replicaConfiguration()}).ok,false);
      await sendHome('chapterNext',{},region);lobby.update(61);
      assert.equal(selectedStage,0);
      assert.equal(guide,null,'the idle hint also skips a locked chapter');
      await sendHome('chapterPrev',{},region);
      finishFirstChapter(true);
      await closeProgress(sendHome);
      assert.equal(system.snapshot().secondSortieGuidePending,true);
    }
    assert.deepEqual(guide,{id:'chapter-next',text:'切换到第二关',strong:true,modal:false});
    await sendHome('chapterNext',{},region);lobby.update(.016);
    assert.equal(selectedStage,1);
    assert.deepEqual(guide,{id:'start',text:'开始第二关',strong:true,modal:false});
    await sendHome('start',{},region);
    assert(started?.ok,started?.message);
    assert.equal(started.snapshot.chapterId,2);
    assert.equal(system.snapshot().secondSortieGuidePending,true);
    assert.equal(system.completeBattleGuide('stale',SECOND_SORTIE_GUIDE),false);
    assert.equal(system.completeBattleGuide(started.snapshot.id,SECOND_SORTIE_GUIDE),true);
    assert.equal(system.snapshot().secondSortieGuidePending,false);
    const reloaded=createPeripheralSystem(options).snapshot();
    assert.equal(reloaded.secondSortieGuidePending,false);
    assert.equal(reloaded.stages[1].unlocked,true);
    assert.deepEqual(reloaded.replicaCampaign.clearedChapterIds,[1]);
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
      const lockIcon=optimizeUiAssetUrls(projectIconUrl('lock'));
      assert(uploads.has(f.images.get(lockIcon)?.material.map),'the lock icon is ready before the page opens');
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
      const lockedDay=find('day-2'),before=f.commands.length;
      assert.equal(lockedDay.disabled,true);
      assert.equal(lockedDay.label,'第2天，未解锁');
      f.click(lockedDay);
      assert.equal(f.commands.length,before,'tapping a locked date keeps the current task list');
      f.click(find('action-ready'));
      assert.deepEqual(f.commands.at(-1).slice(0,2),['carnivalClaim',{
        expectedRevision:3,expectedInventoryRevision:4,expectedEquipmentRevision:5,kind:'task',id:'ready',
      }]);
      assert.equal(find('claim-milestone'),undefined);
      const nextDay={type:'carnival',day:2};
      dialog.update(snapshot,nextDay,'lobby');
      f.device.panel.draw(f.renderer);
      assert(find('action-login'),'a locked selection displays the current open day');
      assert.deepEqual(shade('active'),black,'only an open day can be selected');
      assert.deepEqual(shade('inactive'),gray,'the locked date stays gray after a stale selection');
      const {carnival}=snapshot;
      const days=carnival.days.map(day=>({...day,unlocked:true}));
      dialog.update({...snapshot,carnival:{...carnival,day:2,days}},nextDay,'lobby');
      f.images.delete(lockIcon);
      f.device.panel.draw(f.renderer);
      assert.deepEqual(shade('active'),black,'the date turns black at unlock');
      assert.equal(f.images.has(lockIcon),false);
      assert.equal(find('day-2').disabled,false);
      assert.equal(find('day-2').label,'第2天');
      f.click(find('day-2'));
      assert.deepEqual(f.commands.at(-1).slice(0,2),['carnivalDay',{id:2}]);
    }
  });
}

for(const [width,height] of [[390,844],[320,640]]){
  test('WeChat carnival puts each claim on its reward tile at '+width+'px',async t=>{
    const f=fixture(t),frame={x:0,y:0,left:0,top:0,right:width,bottom:height,width,height};
    f.region.bounds=()=>frame;
    f.region.frameBounds=()=>frame;
    const {dialog,snapshot}=makeActivityDialog(t,f,'carnival');
    const blueprint={id:10010007,amount:100,name:'随机装备图纸',
      image:'/art/project-equipment-blueprints-v2/equipment-blueprints.svg'};
    const ticket={id:112,amount:5,name:'高级装备箱券',image:'/art/project-supplement-icons-v1/advanced-ticket.png'};
    const epic={id:923,amount:1,name:'随机史诗圣环装备',image:'/art/project-supplement-icons-v1/gear-choice-box.png',
      qualityRank:3,qualityKnown:true};
    snapshot.nativeAcquisition={materials:[{id:112,count:3}]};
    const title='累计开启装备宝箱60次';
    snapshot.carnival.days[0].tasks.push({id:'boxes60',name:title,progress:0,target:60});
    const rows=Array.from({length:7},(_,i)=>({points:100*(i+1),canClaim:i===0,
      reward:i===6?{kind:'equipment',rank:1}:{kind:i===0?'materials':'item'},
      rewards:[i===0?blueprint:i===6?epic:ticket]}));
    const update=(activity={},flags={})=>dialog.update({...snapshot,...flags,carnival:{...snapshot.carnival,
      points:110,milestones:rows,...activity}},{type:'carnival',day:1},JSON.stringify([activity,flags]));
    update();
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
    assert(f.texts.has('110'));
    assert(f.texts.has('×100'));
    assert(![...f.texts].some(text=>text.endsWith(' 活跃奖励')||text==='未达成'));
    const tiles=rows.map(row=>find('milestone-reward-'+row.points));
    const [first]=tiles,last=tiles.at(-1),day=find('day-1');
    assert(f.textMeshes.get('110').position.x<first.x);
    assert(tiles.every((tile,i)=>tile.w>=28&&tile.y===first.y&&(!i||tile.x>=tiles[i-1].x+tiles[i-1].w-.01)));
    assert(last.x+last.w<width);
    assert(day.y>=last.y+last.h&&day.y-last.y-last.h<13,'the tasks immediately follow the rewards');
    const heading=f.textMeshes.get(title),progress=f.textMeshes.get('0 / 60'),button=find('action-boxes60');
    assert(heading&&progress&&button,'the complete title, counter and button render on a narrow screen');
    assert(heading.position.x+heading.scale.x/2<progress.position.x-progress.scale.x/2);
    assert.equal(heading.position.y,progress.position.y);
    assert(button.y>heading.position.y+heading.scale.y/2);
    assert.equal(find('claim-milestone'),undefined);

    f.click(first);
    assert.deepEqual(f.commands.map(command=>command.slice(0,2)),[['carnivalClaim',{
      expectedRevision:3,expectedInventoryRevision:4,expectedEquipmentRevision:5,kind:'milestone',id:100,
    }]]);
    await paint();
    assert.equal(find('inspect-close'),undefined);

    f.click(find('milestone-reward-200'));
    await paint();
    assert(f.texts.has('高级装备箱券'));
    assert(f.texts.has('开启高级装备箱时消耗。'));
    assert(f.texts.has('持有数量：'));
    assert(f.texts.has('3'));
    assert.equal(find('claim-milestone'),undefined);
    f.click(find('inspect-close'));
    await paint();

    f.click(find('milestone-reward-700'));
    await paint();
    assert(f.texts.has('随机史诗圣环装备'));
    assert(f.texts.has('领取时随机获得一件史诗圣环装备。'));
    assert.equal(f.commands.length,1);
    f.click(find('inspect-close'));
    await paint();

    const claimed={...rows[0],canClaim:false,claimed:true};
    update({revision:4,milestones:[claimed,...rows.slice(1)]});
    await paint();
    assert(find('milestone-reward-100').disabled);
    f.click(find('milestone-reward-100'));
    assert.equal(f.commands.length,1);
    assert.equal(find('inspect-close'),undefined);

    update({}, {rewardPending:true});
    await paint();
    f.click(find('milestone-reward-100'));
    await paint();
    assert.equal(f.commands.length,1);
    assert(f.texts.has('随机装备图纸'));
    f.click(find('inspect-close'));
    await paint();

    update();
    await paint();
    dialog.activityClock(snapshot.carnival.expiresAt);
    await paint();
    assert(f.texts.has('活动已结束'));
    f.click(find('milestone-reward-100'));
    await paint();
    assert.equal(f.commands.length,1);
    assert(f.texts.has('随机装备图纸'));
  });
}

test('carnival starts on its first visible frame, scales the whole button and cancels a drag',async t=>{
  const f=fixture(t),{dialog}=makeActivityDialog(t,f,'carnival');
  f.device.reducedMotion=()=>false;
  dialog.prepareOffscreen();
  for(const [url,resolve] of f.requests)resolve({url,width:90,height:70});
  await Promise.resolve();
  for(let i=0;i<50&&!dialog.prepareOffscreen();i++){}
  f.paint(2000);
  dialog.activate();
  const panel=f.device.panel,draw=()=>panel.draw(f.renderer);
  const control=id=>panel.state().controls.find(c=>c.id===id);
  const mesh=name=>f.textMeshes.get(name);
  draw();
  assert.equal(mesh('七日嘉年华').parent.scale.x,.5);
  assert.equal(control('outside').w,screen.width);
  const canvases=f.canvases;
  f.paint(200);draw();
  assert(Math.abs(mesh('七日嘉年华').parent.scale.x-1.1)<.001);
  f.paint(150);draw();
  assert.equal(mesh('七日嘉年华').parent.scale.x,1);
  const date=control('day-1'),label=mesh('第1天'),plate=f.images.get(optimizeUiAssetUrls('/art/project-tabs-v1/tab-active.png'));
  const lw=label.scale.x,pw=plate.scale.x,x=date.x+date.w/2,y=date.y+date.h/2;
  f.point('start',x,y);f.paint(115);draw();
  assert(Math.abs(label.scale.x/lw-.9)<.001&&Math.abs(plate.scale.x/pw-.9)<.001);
  f.point('move',x,y-28);f.point('end',x,y-28);draw();
  assert.equal(f.commands.length,0);assert.equal(label.scale.x,lw);
  f.click(control('day-2'));assert.equal(f.commands.length,0);
  f.click(control('action-ready'));assert.equal(f.commands[0][0],'carnivalClaim');
  f.paint(180);draw();
  assert.equal(f.canvases,canvases);
  assert.equal(panel.animated,false);
});

test('a nested popup keeps its full-screen shade, dismisses once and restores the parent at rest',t=>{
  const f=fixture(t),commands=[];
  let detail=false;
  const panel=createLobbyPanel(f.device,f.region,'任务',(data,w,h,t)=>{
    function paper(scope,style){
      const a=t.layer(scope).art;
      t.backdrop(a,.6,undefined,{scope,style});
      a.quad(70,70,w-140,h-140,'#fff');
      t.control(scope+'-outside','关闭',t.frameRect,{type:'close'},{scope});
      t.control(scope+'-paper','',{x:70,y:70,w:w-140,h:h-140},{type:'none'},{scope});
    }
    paper('base','large');
    if(data.detail){paper('inspect','small');return 'inspect';}
    t.control('open','详情',{x:100,y:100,w:70,h:40},{type:'open'});
    return 'base';
  },cmd=>{
    commands.push(cmd.type);
    detail=cmd.type==='open';panel.update({detail},commands.length,'tasks');
  });
  t.after(panel.close);
  let sizes=[];
  f.renderer.render=scene=>{
    const group=scene.children[0],mesh=group.children[0];
    sizes.push([group.scale.x,Math.abs(mesh.scale.x),Math.abs(mesh.scale.y)]);
  };
  const draw=()=>{sizes=[];panel.draw(f.renderer);};
  const control=id=>panel.state().controls.find(c=>c.id===id);
  panel.update({detail},0,'tasks');draw();
  assert.deepEqual(sizes[0],[1,screen.width,screen.height]);
  f.paint(350);draw();f.click(control('open'));draw();
  assert.equal(sizes[1][0],1);assert.equal(sizes[3][0],.9);
  assert.deepEqual(sizes[2],[1,screen.width,screen.height]);
  const outside=()=>{f.point('start',3,3);f.point('end',3,3);};
  outside();outside();assert.deepEqual(commands,['open']);
  f.paint(140);draw();draw();
  assert.deepEqual(commands,['open','close']);
  assert.equal(sizes.length,2);assert.equal(sizes[1][0],1);assert.equal(panel.animated,false);
});

test('ordinary reward items settle in sequence and stay settled on a receipt refresh',t=>{
  const f=fixture(t);
  f.device.reducedMotion=()=>false;
  t.mock.method(globalThis.performance,'now',f.platform.now);
  const receipt=lobbyPanels(f.device).openRewardReceipt(f.region,()=>{});
  t.after(receipt.close);
  const snapshot={weapons:[],aircraft:[],pilots:[]};
  const modal={type:'rewards',id:'daily-claim',rewards:[{type:'coins',amount:100},{type:'diamonds',amount:5}]};
  receipt.update(snapshot,modal,1);
  const panel=f.device.panel,draw=()=>panel.draw(f.renderer),label=name=>f.textMeshes.get(name);
  draw();
  const startWidth=label('金币').scale.x;
  assert.equal(label('金币').material.opacity,0);assert.equal(label('钻石').material.opacity,0);
  f.paint(35);draw();
  assert(label('金币').material.opacity>0&&label('金币').material.opacity<1);
  assert.equal(label('钻石').material.opacity,0);
  f.paint(125);draw();
  assert.equal(label('钻石').material.opacity,1);
  assert(Math.abs(startWidth/label('金币').scale.x-1.5)<.001);
  receipt.update(snapshot,modal,2);draw();
  assert.equal(label('金币').material.opacity,1);assert.equal(panel.animated,false);
});

test('equipment box light follows the committed grade and skipping twice advances one receipt',t=>{
  assert.equal(mod.exports.boxOpeningRank({drawn:[{quality:20}],receipt:{outcomes:[{id:20101}]}}),4);
  assert.equal(mod.exports.boxOpeningRank({drawn:[{quality:61}]}),5);
  const f=fixture(t),advanced=[];
  f.device.reducedMotion=()=>false;
  t.mock.method(performance,'now',f.platform.now);
  t.mock.timers.enable({apis:['setTimeout']});
  const handle=lobbyPanels(f.device).openBoxOpening(f.region,cmd=>advanced.push(cmd));
  t.after(handle.close);
  let light;
  f.renderer.render=scene=>{
    for(const mesh of scene.children[0].children)if(mesh.material.premultipliedAlpha)light=mesh.material.color.getHexString();
  };
  for(const [rank,color] of [[0,'e8f2ff'],[3,'de9cff'],[4,'ffce70']]){
    handle.update({},{id:'box-'+rank,pool:'basic',gearRank:rank});
    const count=advanced.length;t.mock.timers.tick(2100);assert.equal(advanced.length,count);
    f.device.panel.draw(f.renderer);assert.equal(light,color);
    const skip=f.device.panel.state().controls.find(c=>c.id==='skip');
    f.click(skip);f.click(skip);t.mock.timers.tick(2000);
  }
  assert.deepEqual(advanced,Array(3).fill('processSkipBox'));
});

test('a live ten-box receipt accents its highest grade and the history opens fully settled',t=>{
  const f=fixture(t),s={...equipmentSnapshot(),weapons:[]};
  f.device.reducedMotion=()=>false;t.mock.method(performance,'now',f.platform.now);
  const batch=s.equipment.items.slice(0,10);
  batch.forEach((row,i)=>{row.uid='crate-'+i;row.quality=i===1?50:10;});
  const handle=lobbyPanels(f.device).openRewardReceipt(f.region,()=>{});
  t.after(handle.close);
  const modal={type:'shopBoxResult',id:'test-box',drawn:batch.map(r=>r.uid)};
  handle.update(s,modal,1);
  let labels=[];
  f.renderer.render=scene=>{
    const wrapped=scene.children[0].children.filter(mesh=>mesh.userData.uiTextLines);
    if(wrapped.length===batch.length)labels=wrapped;
  };
  const panel=f.device.panel,draw=()=>panel.draw(f.renderer);draw();
  assert.equal(panel.state().controls.filter(c=>c.id.startsWith('receipt-item-')).length,10);
  f.paint(500);draw();assert.equal(labels.length,10);const peak=labels[1].scale.x;
  handle.update(s,{...modal,history:true},2);draw();
  assert(peak>labels[1].scale.x*1.08);
  for(const mesh of labels)assert.equal(mesh.material.opacity,1);
  assert.equal(panel.animated,false);
});

test('ten-draw highlights the new card once and rests again after a touch',t=>{
  const f=fixture(t),done=[];
  f.device.reducedMotion=()=>false;f.device.viewportHeight=()=>screen.height;
  t.mock.method(performance,'now',f.platform.now);
  const handle=openRecruitResults(f.device,f.region,cmd=>done.push(cmd));
  t.after(handle.close);
  const pilot={id:'pilot-01',name:'测试驾驶员',rarity:'SSR'};
  const rewards=[{type:'pilot',pilotId:pilot.id,isNew:true},...Array.from({length:9},()=>({type:'coins',amount:10}))];
  handle.update({pilots:[pilot],weapons:[],aircraft:[]},{type:'rewards',recruit:true,recruitGrid:true,rewards});
  const panel=f.device.panel,draw=()=>panel.draw(f.renderer);draw();
  f.paint(295);draw();const peak=f.textMeshes.get('SSR').scale.x;
  f.paint(1000);draw();assert(peak>f.textMeshes.get('SSR').scale.x*1.05);
  assert.equal(panel.animated,false);
  const card=panel.state().controls.find(c=>c.id==='draw-card-0'),x=card.x+card.w*.7,y=card.y+card.h*.4;
  f.point('start',x,y);draw();f.point('end',x,y);draw();
  assert.equal(panel.animated,true);
  f.paint(220);draw();assert.equal(panel.animated,false);assert.deepEqual(done,[]);
  f.click(panel.state().controls.find(c=>c.id==='confirm'));assert.deepEqual(done,['close']);
});

test('equipment level settles on the committed number and ordinary refreshes stay still',t=>{
  const f=fixture(t),s=equipmentSnapshot();
  f.device.reducedMotion=()=>false;f.device.safeBottom=()=>34;
  t.mock.method(performance,'now',f.platform.now);
  const item=tutorialGear(s.equipment.items[0]);item.equipped=true;s.equipment.items[0]=item;
  const handle=lobbyPanels(f.device).openLobbyPanel('gear',f.region,()=>{});
  t.after(handle.close);
  const modal={type:'gearDetail',id:item.uid},panel=f.device.panel,draw=()=>panel.draw(f.renderer);
  handle.update(s,modal,1);draw();f.paint(500);draw();
  item.level=8;modal.upgradeAt=f.platform.now()/1000;
  handle.update(s,modal,2);draw();f.paint(120);draw();const peak=f.textMeshes.get('Lv.8 / 20').scale.x;
  f.paint(450);draw();const width=f.textMeshes.get('Lv.8 / 20').scale.x;
  assert(peak>width*1.15);
  handle.update(s,{...modal,error:'材料不足'},3);draw();assert.equal(f.textMeshes.get('Lv.8 / 20').scale.x,width);
  f.device.reducedMotion=()=>true;item.level=9;
  handle.update(s,{...modal,upgradeAt:f.platform.now()/1000},4);draw();
  const quiet=f.textMeshes.get('Lv.9 / 20').scale.x;f.paint(120);draw();assert.equal(f.textMeshes.get('Lv.9 / 20').scale.x,quiet);
});

test('gear feedback uses the painted slot, coalesces repeats and clears on navigation',t=>{
  const f=fixture(t),snapshot=equipmentSnapshot();
  f.view.update({tab:'assembly',gearFilter:'all',gearSort:'quality',snapshot},1);f.paint();
  const r=f.view.anchorRect('gear-slot-1');assert(r&&r.w>0);
  let tab='assembly',time=0,quiet=false,edges=[];
  const feedback=createLobbyFeedback(f.device,{now:()=>time,reducedMotion:()=>quiet,layout:()=>({tab,bounds:screen})});
  t.after(feedback.close);
  const draw=()=>feedback.draw({render(scene){edges=scene.children[1].children.filter(m=>m.visible);}},screen.width,screen.height);
  feedback.gearSlot(1);feedback.gearSlot(1);time=90;draw();
  assert.equal(edges.length,4);assert.equal(edges[0].position.x,r.x+r.w/2);assert.equal(edges[0].position.y,r.y+1);
  tab='battle';draw();assert.equal(edges.length,0);assert.equal(feedback.active,false);
  quiet=true;feedback.gearSlot(1);assert.equal(feedback.active,false);
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

test('WeChat tasks reveal the lobby entry and tabs at their chapter milestones',async t=>{
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
  const stage=createHomeStage(new Map(homePictures.map(([id])=>[id,{id,width:256,height:256}])));
  t.after(stage.dispose);
  function assertTaskEntry(expected){
    const model=homePresentation(snapshot,0,false);
    assert.equal(model.showTasks,expected);
    for(const width of [320,390]){
      const viewport={width,height:width*1624/750,safeTop:44,safeBottom:34};
      assert.equal(homeControls(model,viewport,[]).some(c=>c.id==='tasks'),expected);
    }
    stage.drawInFront({render(scene){
      assert.equal(scene.children.some(mesh=>mesh.visible&&mesh.material.uniforms.art.value.image.id==='tasks'),expected);
    }},false,model.showTasks);
  }
  assertTaskEntry(false);
  await sendHome('tasks',{},region);
  assert.equal(lobby.state.modal,null);
  assert(!device.panel);

  const controls=()=>device.panel.state().controls;
  const all=['signin','daily','weekly','achievements'];
  function draw(visible){
    f.texts.clear();
    device.panel.draw(f.renderer);
    const rows=controls(),tabs=rows.filter(row=>row.id.startsWith('tab-'));
    assert.deepEqual(tabs.map(tab=>tab.id),visible.map(id=>'tab-'+id));
    assert(!tabs.some(tab=>tab.label.endsWith('，未解锁')));
    assert(![...f.texts].some(text=>text.startsWith('到达第')));
    return rows;
  }
  function tap(id){f.click(controls().find(control=>control.id==='tab-'+id));}
  function assertChests(rows){
    assert.deepEqual(rows.filter(c=>c.id.startsWith('chest-')).map(c=>c.id),[20,40,60,80,100].map(step=>'chest-'+step));
  }

  snapshot=atSignIn;lobby.update(1);
  assertTaskEntry(true);
  await sendHome('tasks',{},region);
  draw(['signin']);
  assert(f.texts.has('第 1 天'));

  snapshot=atRecurring;lobby.update(1);
  await sendHome('close',{},region);
  await sendHome('tasks',{},region);
  draw(all);
  assert(f.texts.has('第 1 天'),'claimable sign-in is selected when opening tasks');
  tap('daily');assertChests(draw(all));
  assert(f.texts.has('每日活跃'));
  tap('weekly');assertChests(draw(all));
  assert(f.texts.has('每周活跃'));
  tap('achievements');
  assert(!draw(all).some(c=>c.id.startsWith('chest-')||c.id.startsWith('day-')));
  assert(f.texts.has('累计登录'));

  snapshot={...beforeSignIn,signIn:{...beforeSignIn.signIn,starterPending:true,canClaim:true}};
  lobby.update(1);assertTaskEntry(true);draw(['signin']);
  assert(f.texts.has('第 1 天'),'a pending sign-in reward is still accessible');
  const dateWarning='日期异常，请恢复设备日期';
  const timeChanged=snapshot=>({...snapshot,pilotSupply:{...snapshot.pilotSupply,clockRollback:true,
    taskGate:{...snapshot.pilotSupply.taskGate,reached:false,reason:dateWarning}}});
  snapshot=timeChanged(beforeSignIn);lobby.update(1);
  assertTaskEntry(false);
  assert.equal(lobby.state.modal,null);
  assert(!device.panel);
  snapshot=timeChanged(atRecurring);lobby.update(1);
  await sendHome('tasks',{},region);
  draw(all);tap('daily');draw(all);
  assert(f.texts.has(dateWarning),'an already unlocked tab still explains a device date issue');
  assert.deepEqual(messages,[]);
});

test('WeChat traces a decoded dialog as cold while its texture upload is pending',async t=>{
  const {debug,lines}=captureDebug(t),f=fixture(t,debug);
  const view=createLobbyPanel(f.device,f.region,'测试',(data,w,h,t)=>{
    t.image(t.layer('body').art,data.art,0,0,w,h);return 'base';
  },()=>{},{prepareArtwork:()=>false,completeEntry:true,
    beginEntryTrace:(section,prepared)=>debug.beginMenu(f.platform.now,'carnival',false,undefined,{section,prepared})});
  t.after(view.close);
  view.update({art:'/art/equipment-skill-lock-v1/30.webp'},'a','carnival','day-1');
  assert.equal(view.prepareOffscreen(),false);
  for(const [url,resolve] of f.requests)resolve({url,width:64,height:64});
  await Promise.resolve();
  assert.equal(view.prepareOffscreen(),false);
  view.activate();
  assert.equal(details(lines,'页面切换').at(-1).prepared,false);
  assert(view.preparing);
});

test('WeChat holds the daily screen until all sign-in rewards are ready',async t=>{
  const {debug,lines}=captureDebug(t),f=fixture(t,debug),prepareArtwork=createMenuArtworkWarmup(f.platform),drawn=[];
  f.device.reducedMotion=()=>true;
  f.device.repaintHome=()=>{
    const panel=f.device.panel;
    if(!panel?.prepareFrame())return;
    panel.draw(f.renderer);drawn.push([...f.texts]);
  };
  const {signIn}=flightRewardsSnapshot(undefined, {items:{}}, {passedWaves:{2:14}}, Date.UTC(2026,0,1));
  const snapshot={weapons:[],aircraft:[],pilots:[],signIn};
  const dialog=openTaskPanel(f.device,f.region,(action,data)=>{
    if(action==='taskPeriod')update(data.period);
    else if(action==='close')dialog.close();
  },'tasks',new Map(),{prepareArtwork,completeEntry:true,
    beginEntryTrace:(section,prepared)=>debug.beginMenu(f.platform.now,'tasks',false,undefined,{section,prepared})});
  t.after(dialog.close);
  function update(period){dialog.update(snapshot,{type:'tasks',period},'lobby');}
  const control=id=>f.device.panel.state().controls.find(c=>c.id===id);
  async function resolveRequests(hold){
    for(const [url,resolve] of f.requests){
      if(url===hold)continue;
      resolve({url,width:90,height:70});f.requests.delete(url);
    }
    await Promise.resolve();
  }
  update('daily');
  dialog.prepareOffscreen();
  await resolveRequests();
  let ready=false;
  for(let frame=0;frame<50&&!ready;frame++)ready=dialog.prepareOffscreen();
  assert(ready);
  dialog.activate();f.paint();
  assert(drawn[0].includes('每日活跃'));
  f.click(control('tab-signin'));f.paint(1600);
  assert.equal(drawn.length,1);
  const rewards=new Set(signIn.days.flatMap(day=>day.rewards.map(row=>optimizeUiAssetUrls(taskReward(row,snapshot,true).image))));
  assert(rewards.size>4);
  for(const url of rewards)assert(f.requests.has(url),url);
  const last=[...rewards].at(-1);
  await resolveRequests(last);f.paint(1600);
  assert.equal(drawn.length,1);
  await resolveRequests();
  for(let frame=0;frame<30&&drawn.length<2;frame++)f.paint();
  assert.equal(drawn.length,2);
  assert(drawn[1].includes('第 1 天'));
  assert.equal(control('day-1').disabled,false);
  for(const url of rewards)assert(f.images.has(url),url);
  const switches=details(lines,'页面切换'),firstFrames=details(lines,'页面首帧');
  assert.deepEqual(switches.map(row=>row.section),['daily','signin']);
  assert(switches[0].prepared);assert(!switches[1].prepared);
  assert.deepEqual(firstFrames.map(row=>row.artwork.pending),[0,0]);
  assert.deepEqual(details(lines,'切页补图'),[]);
  f.click(control('close'));assert.equal(f.device.panel,null);
});

const gearSkillIcon=optimizeUiAssetUrls('/art/equipment-skill-lock-v1/30.webp');
function tutorialGear(item){
  return {...item,quality:20,qualityRank:1,qualityName:'优秀',maxLevel:20,attributeName:'耐久',attribute:10,
    features:[{quality:30,text:'耐久 +5%'}]};
}

for(const failSkin of [false,true]){
  test('WeChat gear detail prepares the replacement action '+(failSkin?'with a missing button skin':'with a slow skill icon'),async t=>{
    const f=fixture(t),snapshot=equipmentSnapshot(),[equipped,candidate]=snapshot.equipment.items;
    f.device.safeBottom=()=>f.platform.viewport.safeBottom;
    equipped.equipped=true;snapshot.equipment.slots[1]=equipped.uid;
    snapshot.equipment.items[1]=tutorialGear(candidate);
    const panels=lobbyPanels(f.device,{preparePanelArtwork:createMenuArtworkWarmup(f.platform)});
    const dialog=panels.openLobbyPanel('gearDetail',f.region,(...args)=>f.commands.push(args));
    t.after(dialog.close);
    dialog.update(snapshot,{type:'gearDetail',id:candidate.uid,detailOrigin:'warehouse'},'gear');
    const view=f.device.panel,draw=()=>view.draw(f.renderer);
    const gold=optimizeUiAssetUrls('/art/psd-equipment-v1/button-gold.png');
    const waitFor=failSkin?gold:gearSkillIcon;
    draw();
    const equip=view.state().controls.find(control=>control.id==='gearEquip');
    assert.equal(equip.label,'替换');
    for(const [url,resolve] of f.requests)if(url!==waitFor)resolve({url,width:90,height:70});
    await Promise.resolve();
    for(let frame=0;frame<8;frame++)draw();
    assert.equal(f.texts.size,0);
    f.click(equip);
    assert.equal(f.commands.length,0);
    f.requests.get(waitFor)(failSkin?null:{url:waitFor,width:90,height:70});
    await Promise.resolve();
    for(let frame=0;frame<30&&!f.texts.has('装备详情');frame++)draw();
    assert(f.texts.has('替换'));
    for(const url of [...activityFrames,activityClose,gearSkillIcon,...(failSkin?[]:[gold])])assert(f.images.has(url),url);
    f.click(equip);
    assert.deepEqual(f.commands.at(-1).slice(0,2),['gearEquip',{id:candidate.uid}]);
  });
}

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

test('native panels keep visible artwork and a bounded set of idle pixels, including after delayed reads',async t=>{
  const f=fixture(t),seen=new Map(),disposed=new Set();
  const panel=createLobbyPanel(f.device,f.region,'驾驶员',({urls},_w,_h,tools)=>{
    const art=tools.layer('portraits').art;
    for(const url of urls){
      const texture=tools.texture(url);
      if(seen.get(url)!==texture)texture.addEventListener('dispose',()=>disposed.add(url));
      seen.set(url,texture);art.image(texture,0,0,100,100);
    }
  },()=>{},{main:true,progressive:true,repaint(){}});
  t.after(panel.close);
  const select=(key,urls)=>{panel.update({urls,prioritizedArtwork:true},key,key);panel.prepare(true);};
  select('one',['room','pilot-a','icon-a','icon-b','icon-c']);
  for(const [url,done] of f.requests){
    const size=url.startsWith('icon')?512:1024;
    done({url,width:size,height:size});
  }
  await new Promise(setImmediate);panel.prepare(true);
  select('two',['room','pilot-b']);
  assert.deepEqual([...disposed].sort(),['icon-a','pilot-a']);
  assert.equal(seen.get('room').image.width,1024);
  const active=panel.artwork();assert.equal(active.size,2);
  panel.close();assert.equal(active.size,0);assert.equal(disposed.size,6);
  f.requests.get('pilot-b')({width:2048,height:2048});
  await new Promise(setImmediate);assert.equal(seen.get('pilot-b').image,null);
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

test('WeChat pauses portraits for modals, releases them in the background, and keeps stills after a memory warning',async t=>{
  const calls=[],frames=new Map();
  let frameId=0,disposals=0;
  const api={createVideoDecoder:()=>({on(){},
    start(){calls.push('start');},stop(){calls.push('stop');},remove(){calls.push('remove');},
    getFrameData:()=>({width:4,height:2,data:new ArrayBuffer(32)}),
  })};
  const visibility=new Set();
  const platform={visible:true,onViewport(fn){visibility.add(fn);return ()=>visibility.delete(fn);},
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
  function foreground(value){
    platform.visible=value;
    for(const fn of [...visibility])if(visibility.has(fn))fn({},value);
  }
  portrait.layout({width:200,height:200});await flush();
  assert.deepEqual(calls,['start']);
  const [frame,paint]=frames.entries().next().value;frames.delete(frame);paint();
  portraits.setVisible(false);await flush();
  assert.deepEqual(calls,['start','stop']);
  assert.equal(disposals,0);assert.equal(frames.size,0);
  portraits.setVisible(true);await flush();
  assert.deepEqual(calls,['start','stop','start']);
  assert.equal(disposals,0);
  portraits.setVisible(false,{suspendLoading:true});await flush();
  assert.deepEqual(calls,['start','stop','start','remove']);
  assert.equal(disposals,1);assert.equal(frames.size,0);
  assert.equal(portrait.closed,false);
  portraits.setVisible(true);await flush();
  assert.deepEqual(calls,['start','stop','start','remove','start']);
  const [id,draw]=frames.entries().next().value;frames.delete(id);draw();
  foreground(false);portrait.layout({width:220,height:220});await flush();
  assert.equal(calls.at(-1),'remove');
  assert.equal(disposals,2);assert.equal(frames.size,0);
  foreground(true);await flush();assert.equal(calls.at(-1),'start');
  const [next,render]=frames.entries().next().value;frames.delete(next);render();
  portraits.trimMemory();portraits.trimMemory();await flush();
  assert.equal(disposals,3);assert.equal(frames.size,0);assert.equal(calls.at(-1),'remove');
  const count=calls.length;
  portraits.sync();foreground(false);foreground(true);
  portraits.setVisible(false);portraits.setVisible(true);
  portraits.openHome('pilot-08').layout({width:250,height:360});await flush();
  assert.equal(calls.length,count);assert.equal(frames.size,0);
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

test('menu texture warming can complete a small final visible upload in the same frame',t=>{
  const f=fixture(t),uploads=[];
  f.renderer.initTexture=texture=>uploads.push(texture);
  const prepare=createMenuArtworkWarmup(f.platform);
  const small=()=>({image:{width:128,height:128}});
  const icons=[small(),small()],background={image:{width:700,height:600}};
  assert.equal(prepare(icons,4,true),true);
  assert.deepEqual(uploads,icons);
  assert.equal(prepare([background],4,true),false);
  assert.equal(prepare([background],4,true),true);
  assert.equal(prepare([small()],1),false);
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

test('the equipment still and live frame swap in place without rebuilding the warehouse',async t=>{
  let preview,model;
  const aircraftPreview=()=>preview={ready:false,updatesInPlace:true,target:{width:200,height:100},
    update(){},prepare(){return this.ready;},pause(){},close(){},releaseModel(){this.ready=false;},
    paint(art,x,y,w,h){return model=art.quad(x,y,w,h);}};
  const f=fixture(t,undefined,{main:true,atomicEntry:true,aircraftPreview});
  f.region.allowAircraftStill=()=>true;
  const snapshot=equipmentSnapshot(),still=optimizeUiAssetUrls('/art/aircraft-ui-v1/'+snapshot.aircraftId+'-hangar.webp');
  f.view.update({tab:'assembly',gearFilter:'all',gearSort:'quality',snapshot},'hangar');
  f.paint();
  for(const [url,resolve] of f.requests)resolve({url,width:96,height:80});
  await Promise.resolve();
  for(let i=0;i<18&&!f.events.length;i++)f.paint();
  assert(f.images.has(still));assert.equal(model.visible,false);
  const pilotLabel=f.textMeshes.get('驾驶员'),plane=model,canvases=f.canvases;
  assert(pilotLabel);
  preview.ready=true;f.device.repaintHome();f.paint();
  assert.equal(model,plane);assert.equal(model.visible,true);assert(!f.images.has(still));
  assert.equal(model.scale.x/-model.scale.y,2);
  f.view.trimAircraft();f.paint();
  assert.equal(model,plane);assert.equal(model.visible,false);assert(f.images.has(still));
  assert.equal(f.textMeshes.get('驾驶员'),pilotLabel);assert.equal(f.canvases,canvases);
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
  test(`WeChat ${page.tab} holds its first frame while keeping the bottom tabs usable`,async t=>{
    const f=fixture(t,undefined,{main:true,atomicEntry:true,parked:true});
    f.view.update({tab:page.tab,...page.data()},page.tab);
    assert.equal(f.view.prepareOffscreen(),false);
    f.activate();f.paint(1600);
    assert.deepEqual(f.events,[]);
    assert.equal(f.images.size,0);
    for(const tab of ['shop','assembly','battle','research','supply']){
      f.click(f.control('nav-'+tab));
      assert.deepEqual(f.commands.at(-1).slice(0,2),['tab',{tab}]);
    }
    const background=optimizeUiAssetUrls(page.tab==='assembly'?'/art/psd-equipment-v1/equipment-background.webp':art[page.tab+'-background']);
    assert(f.requests.has(background));
    for(const [url,resolve] of f.requests)if(url!==background)resolve({url,width:96,height:80});
    await Promise.resolve();f.paint(1200);
    assert.deepEqual(f.events,[],'a delayed backdrop must not expose the destination controls or the other loaded images');
    f.requests.get(background)({url:background,width:96,height:80});
    await Promise.resolve();
    for(let step=0;step<36&&!f.events.length;step++)f.paint();
    assert.deepEqual(f.events,['paint']);
    assert(f.images.has(background));
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

test('WeChat holds a cold catalog offscreen and keeps its back control usable',t=>{
  const f=fixture(t,undefined,{atomicEntry:true,catalog:true});
  f.view.update({tab:'aircraft',...catalogFixture('aircraft')},'aircraft');
  f.paint(1600);
  assert.deepEqual(f.events,[]);
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

test('a warm shop reuses the same first screen after an unrelated page setting changes',async t=>{
  const f=fixture(t,undefined,{main:true,atomicEntry:true,parked:true});
  const data={tab:'shop',shopSection:'boxes',snapshot:shopSnapshot(),gearSort:'quality',section:'talent'};
  f.view.update(data,'same-snapshot');
  assert.equal(f.view.prepareOffscreen(),false);
  for(const [url,resolve] of f.requests)resolve({url,width:96,height:80});
  await Promise.resolve();
  let ready=false;
  for(let frame=0;frame<40&&!ready;frame++)ready=f.view.prepareOffscreen();
  assert(ready);
  f.activate();f.paint();
  const previous=f.textMeshes.get('装备宝箱');assert(previous);
  f.park();
  f.view.update({...data,gearSort:'level',section:'lab',selected:'pilot-03'},'same-snapshot');
  f.activate();f.paint();
  assert.equal(f.textMeshes.get('装备宝箱'),previous,'the warmed shop layout is reused');
  f.view.update({...data,shopSection:'coins'},'same-snapshot');f.paint();
  assert.equal(f.events.length,2,'a cold section keeps the complete current screen');
  const coin=optimizeUiAssetUrls('/art/shop-coin-tiers-v2/coins-safe.png');
  assert(f.requests.has(coin));
  for(const [url,resolve] of f.requests)resolve({url,width:96,height:80});
  await Promise.resolve();
  for(let frame=0;frame<24&&f.events.length<3;frame++)f.paint();
  assert(f.texts.has('一箱金币'));assert(f.images.has(coin));
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

test('menu logs name missing artwork and count each frame that fills it in',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const {debug,lines,native}=captureDebug(t);
  let now=100;
  debug.markMenuVisible('shop','boxes');
  const trace=debug.beginMenu(()=>now,'assembly',false,undefined,{section:'all',prepared:false});
  const loading={userData:{assetPath:'/art/hangar/deck.webp?v=test'}},discarded={userData:{assetPath:'/art/hangar/slot.png'}};
  const late={userData:{assetPath:'https://example.invalid/art/hangar/icon.png?session=secret'}};
  trace.prepare(3);
  now=116;
  assert(trace.paint(new Map([[loading,'pending'],[discarded,'pending']]),false,6));
  const context={entry:1,fromPage:'shop',fromSection:'boxes',page:'assembly',section:'all',retained:false,prepared:false};
  assert.deepEqual(details(lines,'页面切换'),[context]);
  assert.deepEqual(details(lines,'页面首帧'),[{...context,firstPaintMs:16,paintCpuMs:6,prepareCpuMs:3,
    artwork:{ready:0,pending:2,failed:0,skipped:0},missingAssets:['art/hangar/deck.webp','art/hangar/slot.png'],modelReady:false}]);
  for(let i=0;i<8;i++)trace.slowArtwork('https://example.invalid/art/room.png?internal=1','CDN/缓存',175,8);
  const slow=details(lines,'慢贴图');
  assert.equal(slow.length,6);
  assert.deepEqual(slow[0],{entry:1,page:'assembly',asset:'art/room.png',source:'CDN/缓存',fileMs:175,decodeMs:8});
  now=200;assert(trace.paint(new Map([[loading,'ready']]),false,12));
  const complete=new Map([[loading,'ready'],[late,'ready']]);
  now=260;assert(trace.paint(complete,false,8));
  now=280;assert(trace.paint(complete,true,8));
  assert.deepEqual(details(lines,'切页补图'),[
    {...context,batch:1,afterFirstPaintMs:84,count:1,assets:['art/hangar/deck.webp']},
    {...context,batch:2,afterFirstPaintMs:144,count:1,assets:['art/hangar/icon.png']},
  ]);
  now=1780;t.mock.timers.tick(1500);
  assert.deepEqual(details(lines,'页面首进结果'),[{...context,status:'完成',elapsedMs:1680,firstPaintMs:16,
    artworkMs:100,modelMs:180,artwork:{ready:1,pending:0,failed:0,skipped:1},maxPaintCpuMs:12,
    lateBatches:2,lateAssets:2,lastLateMs:144}]);
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
    {chapter:1,wave:8,frames:249,elapsedMs:5000,fps:49.8,framesOver33ms:1,framesOver50ms:0,maxGapMs:40},
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
  trace.wait('贴图未齐',new Set([{userData:{assetPath:'/art/shop/boxes.webp'}}]));
  now=14000;t.mock.timers.tick(14000);
  const [result]=details(lines,'页面首进结果');
  assert.equal(result.status,'超时');
  assert.equal(result.firstPaintMs,null);
  assert.equal(debug.activeMenu,null);
  assert.equal(result.waitingFor,'贴图未齐');
  assert.deepEqual(result.waitingAssets,['art/shop/boxes.webp']);
  assert.equal(trace.paint(new Map(),undefined,1),false);
});

test('a prepared footer fading in after navigation is not logged as late artwork',async t=>{
  const {debug,lines}=captureDebug(t),f=fixture(t,debug,{main:true,atomicEntry:true});
  const navigation=f.device.lobbyNavigation=createLobbyNavigationMotion();
  navigation.homeArtwork={navigation:()=>true};
  navigation.select('shop',false);
  f.view.update({tab:'shop',shopSection:'boxes',snapshot:shopSnapshot()},'shop');
  f.paint();
  for(const [url,resolve] of f.requests)resolve({url,width:90,height:70});
  await Promise.resolve();
  for(let frame=0;frame<45;frame++)f.paint(16);
  assert(f.texts.has('装备宝箱'));
  assert.equal(details(lines,'页面首帧').length,1);
  assert.deepEqual(details(lines,'切页补图'),[]);
});

test('shop logs artwork actually drawn after opening and gives section changes their own trace',async t=>{
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
  assert(first.missingAssets.length>0);
  const background=optimizeUiAssetUrls(art['shop-background']);
  f.requests.get(background)({url:background,width:96,height:80});
  await Promise.resolve();f.paint(240);
  const [shown]=details(lines,'切页补图');
  assert.equal(shown.entry,first.entry);
  assert.equal(shown.count,1);
  assert.equal(shown.afterFirstPaintMs,240);
  assert(f.images.has(background));
  f.view.section('coins');f.paint();
  const [from,to]=details(lines,'页面切换');
  assert.equal(from.section,'daily');
  assert.equal(to.section,'coins');
  assert.equal(to.fromSection,'daily');
  assert.notEqual(to.entry,from.entry);
  f.park();
  assert.equal(details(lines,'页面首进结果').at(-1).status,'离开页面');
  f.activate();f.paint();
  assert.equal(details(lines,'页面首帧').at(-1).retained,true);
  f.park();
});

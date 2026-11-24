import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {createWechatDebugLog} from '../wechat/src/three/debug-log.js';
import {retireNativeVideo} from '../wechat/src/full/video-player.js';
import talentCatalog from '../../../../../pixigame/src/replica/native-research-source.json' with {type:'json'};
import economyCatalog from '../../../../../pixigame/src/replica/native-economy-catalog.json' with {type:'json'};

const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const {outputFiles:[bundle]}=await build({
  stdin:{resolveDir:root,contents:`
    export {mountWechatMenu} from './packages/wechat/r145-source/pixigame/wechat/src/three/menu-surface.js';
    export {createWechatPanelInput} from './packages/wechat/r145-source/pixigame/wechat/src/three/panel-input.js';
    export {createMenuArtworkWarmup} from './packages/wechat/r145-source/pixigame/wechat/src/three/frame-artwork.js';
    export {createLobbyPanel} from './pixigame/src/three/game-screen/lobby-panel.js';
    export {createHomeHud} from './pixigame/src/three/game-screen/three-home-hud.js';
    export {homeControls,createHomePointer} from './pixigame/src/three/game-screen/home-input.js';
    export {default as homeArt} from './pixigame/src/three/game-screen/home-art.json';
    export {paintLobbyPaper,paintSecondaryPaper} from './pixigame/src/three/game-screen/panel-paper.js';
    export {openChapterPanel} from './pixigame/src/three/game-screen/chapter-panel.js';
    export {openTaskPanel} from './pixigame/src/three/game-screen/task-panel.js';
    export {taskReward} from './pixigame/src/three/game-screen/task-model.js';
    export {flightRewardsSnapshot} from './pixigame/src/replica/flight-rewards.js';
    export {openCarnivalPanel} from './pixigame/src/three/game-screen/carnival-panel.js';
    export {openRecruitResults} from './pixigame/src/three/game-screen/recruit-results.js';
    export {DRAW_GATE_ART} from './pixigame/src/ui/draw-gate.js';
    export {createArtworkLoader,useArtworkLoader} from './pixigame/src/three/game-screen/image-loading.js';
    export {openWechatPortraitDecoder} from './packages/wechat/r145-source/pixigame/wechat/src/three/video.js';
    export {art,qualityFrame} from './pixigame/src/three/game-screen/menu-art.js';
    export {recruitPreview} from './pixigame/src/three/game-screen/recruit-preview-atlas.js';
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
const {mountWechatMenu,createWechatPanelInput,createArtworkLoader,useArtworkLoader,openWechatPortraitDecoder,
  createLobbyPanel,paintLobbyPaper,paintSecondaryPaper,createMenuArtworkWarmup,openChapterPanel,openTaskPanel,openCarnivalPanel,openRecruitResults,DRAW_GATE_ART,
  art,atlas,catalogPortrait,PILOT_PORTRAITS,qualityFrame,recruitPreview,researchArt,researchCardQuality,taskReward,flightRewardsSnapshot,
  createHomeHud,homeControls,createHomePointer,homeArt,
  nativeCollectionArt,nativeLabArt,projectIconUrl,optimizeUiAssetUrls}=mod.exports;

const screen={x:0,y:0,left:0,top:0,width:390,height:844,right:390,bottom:844};
const content={...screen,y:78,top:78,height:766};
const lateGear='/art/project-flight-gear-v1/sets-v3/4500400.webp';

test('WeChat home guide frames the drawn tab and its center still opens the tab',async t=>{
  const hud=await createHomeHud(async url=>({url,width:256,height:256}),{chapter:0},()=>{});
  t.after(()=>hud.dispose());
  const centerX=mesh=>mesh.position.x+mesh.scale.x/2;
  const centerY=mesh=>mesh.position.y+mesh.scale.y/2;
  const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} does not match ${b}`);
  for(const [width,height,safeBottom] of [[320,640,34],[390,844,34],[430,932,34],[375,667,0]]){
    const viewport={x:0,y:0,width,height,safeTop:48,safeBottom};
    const controls=homeControls({},viewport,[200,400,350,600]);
    hud.layout(viewport);
    for(const [tab,text] of [['assembly','进入装备页'],['shop','进入商城']]){
      const id='nav-'+tab,control=controls.find(c=>c.id===id);
      const guide={id,text,strong:true,reduced:true,target:control.box};
      hud.setGuide(guide);
      let meshes;
      hud.paint({render(scene){meshes=scene.children.filter(mesh=>mesh.visible);}},0);
      const matches=url=>meshes.filter(mesh=>mesh.material.uniforms.art.value.image?.url===url);
      const [icon]=matches(homeArt.nav[tab]),[ring]=matches('/art/psd-equipment-v1/frame-gold.png');
      assert(icon&&ring);
      near(centerX(ring),centerX(icon));
      near(centerY(ring),centerY(icon));
      assert(ring.position.y>control.box[1]);
      assert(ring.position.y+ring.scale.y<1624);
      const arrows=matches(homeArt.pointer);
      assert.equal(arrows.length,2);
      for(const arrow of arrows)near(centerX(arrow),centerX(icon));
      const pointer=createHomePointer({bounds:()=>viewport,controls:()=>controls,enabled:()=>true,guide:()=>guide,scale(){}},
        {request:()=>0,cancel(){},now:()=>0});
      const x=centerX(ring)*width/750,y=centerY(ring)*height/1624;
      assert.equal(pointer.start(x,y,1)?.id,id);
      assert.equal(pointer.end(x,y,1)?.id,id);
      pointer.close();
    }
  }
});

function fixture(t,debugLog,options={}) {
  const requests=new Map(),frames=new Map(),commands=[],events=[],texts=new Set(),textMeshes=new Map(),images=new Map();
  const previewMeshes=[];
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
        if(image?.url==='/'+recruitPreview.path)previewMeshes.push(mesh);
      }
    },
  };
  platform.renderer=renderer;
  const device={three:renderer,display:platform.display,
    createPanelInput:host=>createWechatPanelInput({},platform,host)};
  const region={bounds:()=>content,frameBounds:()=>screen,visible:()=>visible,catalog:options.catalog,recruit:options.recruit,workshop:options.workshop,
    openPortrait:(refresh,redraw)=>catalogPortrait(device,null,refresh,redraw,{
      bounds:()=>content,
      open(){events.push('portrait');return {layout(){},close(){}};},
    }),
    openAircraft:(_panel,_refresh,_request,_available,options)=>{
      assert.equal(options.stageModel,true);
      assert.equal(options.prefetchModel,false);
      return {ready:false,update(){},tick(){events.push('aircraft');},pause(){},close(){}};
    },
  };
  const view=mountWechatMenu(device,platform,region,(...args)=>commands.push(args),()=>true,()=>{},options);
  t.after(()=>{view.close();restore();if(wx===undefined)delete globalThis.wx;else globalThis.wx=wx;});
  function point(phase,x,y){touch({phase,x,y,pointerId:1});}
  return {view,requests,commands,events,texts,textMeshes,images,previewMeshes,device,region,renderer,platform,point,
    get canvases(){return canvases;},get touchBindings(){return touchBindings;},
    paint(){
      now+=16;
      const callbacks=[...frames.values()];
      if(!callbacks.length)return;
      frames.clear();texts.clear();textMeshes.clear();images.clear();previewMeshes.length=0;
      for(const fn of callbacks)fn(now);
    },
    control:id=>view.state().controls.find(c=>c.id===id),
    click(c,vertical=.5){const x=c.x+c.w/2,y=c.y+c.h*vertical;point('start',x,y);point('end',x,y);},
    drag(x,y,distance){point('start',x,y);point('move',x,y-distance);point('end',x,y-distance);},
    park(){visible=false;view.park();},
    activate(){visible=true;view.activate();},
  };
}

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
  snapshot.carnival={day:1,days:[{day:1,unlocked:true,tasks:[{id:'login',name:'累计登录',progress:0,target:1}]}],
    points:10,maxPoints:700,milestones:[{points:100,reward:{kind:'resource'},rewards:[reward]}],
    taskReward:reward,taskPoints:10,revision:3,observedAt:0,expiresAt:3600000,
  };
  const dialog=kind==='tasks'?openTaskPanel(f.device,f.region,send,'tasks',new Map(),options):
    openCarnivalPanel(f.device,f.region,send,options);
  t.after(dialog.close);
  const modal=kind==='tasks'?{type:'tasks',period:'daily'}:{type:'carnival',day:1};
  dialog.update(snapshot,modal,'lobby');
  return dialog;
}

for(const [kind,title,control] of [['tasks','任务','action-battle1'],['carnival','七日嘉年华','task-login']]){
  test(`WeChat ${kind} prepares its complete first frame offscreen and binds input only when opened`,async t=>{
    const f=fixture(t),uploads=new Set(),bound=f.touchBindings;
    f.renderer.initTexture=texture=>uploads.add(texture);
    const dialog=makeActivityDialog(t,f,kind);
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
    f.click(f.device.panel.state().controls.find(c=>c.id===control));
    assert.equal(f.commands.at(-1)?.[0],kind==='tasks'?'dailyGo':'carnivalGo');
  });
}

test('WeChat task dialog has a complete fallback frame and reveals slow artwork together',async t=>{
  const f=fixture(t),dialog=makeActivityDialog(t,f,'tasks',{entryWaitMs:0});
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

test('WeChat locked sign-in shows late reward artwork after switching tabs',async t=>{
  const f=fixture(t),prepareArtwork=createMenuArtworkWarmup(f.platform);
  f.device.reducedMotion=()=>true;
  f.device.repaintHome=()=>f.device.panel?.draw(f.renderer);
  const {signIn}=flightRewardsSnapshot(undefined, {items:{}}, {}, Date.UTC(2026,0,1));
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
  assert(f.texts.has(signIn.gate.reason));
  assert(control('day-1').disabled);
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
  const f=fixture(t,undefined,{atomicEntry:true,parked:true});
  f.view.update({tab:'assembly',gearFilter:'all',gearSort:'quality',snapshot:equipmentSnapshot()},'equipment');
  assert.equal(f.view.prepareOffscreen(),false);
  const background=optimizeUiAssetUrls('/art/psd-equipment-v1/equipment-background.webp');
  const aircraft=optimizeUiAssetUrls('/art/aircraft-ui-v1/pilot-01-hangar.webp');
  assert(f.requests.has(background)&&f.requests.has(aircraft));
  for(const [url,read] of f.requests)read({url,width:96,height:80});
  await Promise.resolve();
  let ready=false;
  for(let step=0;step<40&&!ready;step++)ready=f.view.prepareOffscreen();
  assert(ready);
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

test('WeChat reveals slow first-entry equipment artwork together after the wait expires',async t=>{
  const f=fixture(t,undefined,{atomicEntry:true});
  f.view.update({tab:'assembly',gearFilter:'all',gearSort:'quality',snapshot:equipmentSnapshot()},'equipment');
  f.paint();
  const delayed=['assembly-heading','equipment-deck'].map(key=>optimizeUiAssetUrls(art[key]));
  for(const url of delayed)assert(f.requests.has(url),url);
  for(const [url,read] of f.requests)if(!delayed.includes(url))read({url,width:96,height:80});
  await Promise.resolve();
  for(let frame=0;frame<70;frame++)f.paint();
  assert(f.events.includes('paint'));
  assert(delayed.every(url=>!f.images.has(url)));
  f.requests.get(delayed[0])({url:delayed[0],width:96,height:80});
  await Promise.resolve();f.paint();
  assert(delayed.every(url=>!f.images.has(url)));
  f.requests.get(delayed[1])({url:delayed[1],width:96,height:80});
  await Promise.resolve();f.paint();
  assert(delayed.every(url=>f.images.has(url)));
});

function catalogFixture(tab){
  const stage={star:1,skills:[],attributes:[]};
  const common={quality:10,owned:true,equipped:true,star:1,stage,stages:[stage]};
  const gun={...common,id:10001,name:'测试武器',weaponType:1};
  const aircraft={...common,id:10101,name:'测试战机'};
  const pilot={...common,id:40100,name:'测试驾驶员'};
  const replicaCollection={guns:[gun],skins:[aircraft],pilots:[pilot],slots:[],useWeaponMap:[gun.id],
    weaponSkillMap:{},attributeNames:{}};
  return {snapshot:{replicaCollection,aircraftId:'pilot-01'},catalog:{id:tab==='weapon'?gun.id:'pilot-01'}};
}

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
    art:()=>['/'+recruitPreview.path,art['recruit-button-single']]},
  ...['weapon','aircraft','pilot'].map(tab=>({tab,catalog:true,data:()=>catalogFixture(tab),control:'back',action:'catalogBack',
    art:()=>[atlas[tab+'-hero'],...(tab==='aircraft'?[nativeCollectionArt({id:10101},'preview')]:
      tab==='pilot'?[PILOT_PORTRAITS['pilot-01'].image]:[])]})),
];
for(const page of firstScreens){
  test(`WeChat paints the prepared ${page.tab} artwork and controls together on its first visible frame`,async t=>{
    const f=fixture(t,undefined,{atomicEntry:true,parked:true,catalog:page.catalog});
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
    f.paint();
    assert.deepEqual(f.events,['paint']);
    for(const url of assets)assert(f.images.has(url),url);
    f.click(f.control(page.control));
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

test('WeChat recruitment first paints local portraits and cards while large images follow the selected pilot',async t=>{
  const f=fixture(t,undefined,{atomicEntry:true,parked:true,recruit:true});
  const data={tab:'supply',snapshot:{wallet:{diamonds:100},pools:{pilot:{singleCost:10}},pilots:[
    {id:'pilot-01',name:'夜莺',rarity:'R'},{id:'pilot-03',name:'桃乐丝',rarity:'SSR'},
  ]}};
  const preview='/'+recruitPreview.path;
  const full=(id)=>'/art/recruit-portraits-v2/'+id+'.png?v=redraw-20261109-v2';
  const first=full('pilot-01'),second=full('pilot-03');
  f.view.update(data,'roster');
  assert.equal(f.view.prepareOffscreen(),false);
  assert.equal(f.requests.keys().next().value,preview);
  assert.equal(f.requests.has(first),false);
  for(const [url,resolve] of f.requests)resolve({url,width:96,height:96});
  await Promise.resolve();
  let ready=false;
  for(let frame=0;frame<32&&!ready;frame++)ready=f.view.prepareOffscreen();
  assert(ready);
  f.activate();
  f.paint();
  assert.equal(f.previewMeshes.length,3,'portrait and both cards are visible before the original art is requested');
  assert.equal(f.requests.has(first),false);
  f.paint();
  assert(f.requests.has(first));
  f.view.update({...data,selected:'pilot-03'},'roster');
  f.paint();
  assert.equal(f.previewMeshes.length,3);
  const tile=recruitPreview.tiles.get('pilot-03').portrait;
  const uv=f.previewMeshes[0].geometry.attributes.uv;
  assert(Math.abs(uv.getX(0)-(tile.x+recruitPreview.padding)/recruitPreview.width)<1e-6);
  f.requests.get(first)({url:first,width:1254,height:1254});
  await Promise.resolve();
  f.requests.get(second)({url:second,width:1254,height:1254});
  await Promise.resolve();
  f.paint();
  assert(!f.images.has(first));
  assert(f.images.has(second));
  assert.equal(f.previewMeshes.length,2,'the resolved original replaces just the portrait preview');
});

test('WeChat shop paints the requested section first and can return to the box controls while artwork is pending',t=>{
  const f=fixture(t);
  f.view.update({tab:'shop',shopSection:'coins',snapshot:shopSnapshot()},'shop');
  f.view.section('coins');f.paint();
  assert.deepEqual(f.events,['paint']);
  assert(f.texts.has('一箱金币'));
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

import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {createWechatDebugLog} from '../wechat/src/three/debug-log.js';
import talentCatalog from '../../../../../pixigame/src/replica/native-research-source.json' with {type:'json'};
import economyCatalog from '../../../../../pixigame/src/replica/native-economy-catalog.json' with {type:'json'};

const root=fileURLToPath(new URL('../../../../../',import.meta.url));
const {outputFiles:[bundle]}=await build({
  stdin:{resolveDir:root,contents:`
    export {mountWechatMenu} from './packages/wechat/r145-source/pixigame/wechat/src/three/menu-surface.js';
    export {createWechatPanelInput} from './packages/wechat/r145-source/pixigame/wechat/src/three/panel-input.js';
    export {useArtworkLoader} from './pixigame/src/three/game-screen/image-loading.js';
    export {art,qualityFrame} from './pixigame/src/three/game-screen/menu-art.js';
    export {researchArt,researchCardQuality} from './pixigame/src/ui/research-art.js';
    export {nativeLabArt} from './pixigame/src/replica/native-collection-art.js';
    export {projectIconUrl} from './pixigame/src/ui/project-ui-art.js';
    export {optimizeUiAssetUrls} from './pixigame/src/ui/ui-image-source.js';
  `},
  bundle:true,write:false,format:'cjs',loader:{'.glsl':'text'},logLevel:'silent',
  define:{'import.meta.env':'{"BASE_URL":"/","DEV":false,"PROD":true}','import.meta.url':'"https://example.invalid/game.js"'},
});
const mod={exports:{}};
new Function('module','exports',bundle.text)(mod,mod.exports);
const {mountWechatMenu,createWechatPanelInput,useArtworkLoader,art,qualityFrame,researchArt,researchCardQuality,nativeLabArt,projectIconUrl,optimizeUiAssetUrls}=mod.exports;

const screen={x:0,y:0,left:0,top:0,width:390,height:844,right:390,bottom:844};
const content={...screen,y:78,top:78,height:766};
const lateGear='/art/project-flight-gear-v1/sets-v3/4500400.webp';

function fixture(t,debugLog) {
  const requests=new Map(),frames=new Map(),commands=[],events=[],texts=new Set(),textMeshes=new Map(),images=new Map();
  let touch,nextFrame=0,now=0,canvases=0,visible=true;
  const wx=globalThis.wx;
  globalThis.wx={createCanvas(){
    canvases++;
    const ctx={measureText:value=>({width:value.length*9}),scale(){},fillText(){},strokeText(){}};
    return {getContext:()=>ctx};
  }};
  const restore=useArtworkLoader(url=>new Promise(resolve=>requests.set(url,resolve)));
  const platform={
    visible:true,viewport:{screen,density:2,safeBottom:34},now:()=>now,debugLog,
    requestFrame(fn){frames.set(++nextFrame,fn);return nextFrame;},
    cancelFrame:id=>frames.delete(id),
    onViewport:()=>()=>{},
    bindTouches(handler){touch=handler;return ()=>{touch=null;};},
    display:{begin(){},present(){events.push('paint');}},
  };
  const renderer={
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
  const device={three:renderer,display:platform.display,preparedArtwork:new Map(),
    createPanelInput:host=>createWechatPanelInput({},platform,host)};
  const region={bounds:()=>content,frameBounds:()=>screen,visible:()=>visible,
    openPortrait:()=>({select(){},resize(){},close(){}}),
    openAircraft:(_panel,_refresh,_request,_available,options)=>{
      assert.equal(options.stageModel,true);
      assert.equal(options.prefetchModel,false);
      return {ready:false,update(){},tick(){events.push('aircraft');},pause(){},close(){}};
    },
  };
  const view=mountWechatMenu(device,platform,region,(...args)=>commands.push(args),()=>true,()=>{},
    {stageEntry:true,progressiveEntry:true});
  t.after(()=>{view.close();restore();if(wx===undefined)delete globalThis.wx;else globalThis.wx=wx;});
  function point(phase,x,y){touch({phase,x,y,pointerId:1});}
  return {view,requests,commands,events,texts,textMeshes,images,get canvases(){return canvases;},
    paint(){
      now+=16;
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

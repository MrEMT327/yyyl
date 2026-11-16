import test from 'node:test';
import assert from 'node:assert/strict';
import {loadYoga} from 'yoga-layout/load';
import {createDomEnvironment} from '../wechat/src/full/dom-environment.js';
import {createDomStyles} from '../wechat/src/full/dom-style.js';
import {createDomLayout} from '../wechat/src/full/dom-layout.js';
import {createDomPainter} from '../wechat/src/full/dom-painter.js';
import {createDomAnimations} from '../wechat/src/full/dom-animation.js';
import {createDomFramePerformance} from '../wechat/src/full/dom-frame-performance.js';
import {attachDomInput} from '../wechat/src/full/dom-input.js';
import {compileSharedCss} from '../wechat/tools/compile-shared-css.mjs';
import {createStartupScreen} from '../src/ui/startup-screen.js';
import {notifyOwnedCanvasFrame} from '../src/ui/release-owned-canvas.js';

const Yoga=await loadYoga();
const url='https://game.test/';
function fixture(markup,css,layoutCacheKey) {
  let clock=0,clears=0,draws=0,gradients=0;
  const paint=[];
  const context=new Proxy({globalAlpha:1,filter:'none',clearRect(){clears++;},drawImage(source){draws++;paint.push(source);},
    fillText(value){paint.push(value);},
    fill(){if(this.fillStyle==='#203b51')paint.push('fallback face');},
    createLinearGradient(){gradients++;return {addColorStop(){}};},
    measureText:text=>({width:text.length*8})},{get:(target,key)=>key in target?target[key]:()=>{}});
  const canvas=()=>({width:300,height:150,getContext:()=>context});
  const host=createDomEnvironment({env:{USER_DATA_PATH:'/test'},createCanvas:canvas},
    {baseURL:url,markup:`<html><body>${markup}</body></html>`,width:390,height:844,pixelRatio:2,resources:{resolve:s=>s},globalScope:{}});
  const sheet=compileSharedCss('html,body{margin:0;width:100%;height:100%}'+css,{baseURL:url});
  host.layout=createDomLayout(host,createDomStyles(sheet,host),Yoga,context,{
    layoutCacheKey:layoutCacheKey&&(()=>layoutCacheKey(host.document)),
  });
  host.animations=createDomAnimations(()=>clock);
  const painter=createDomPainter(host,host.layout,canvas(),{skipUnchanged:true});
  const input=attachDomInput(host,{listen:false});
  return {host,painter,input,paint,set clock(value){clock=value;},get clears(){return clears;},get draws(){return draws;},get gradients(){return gradients;},
    get:id=>host.document.getElementById(id),close(){input.destroy();painter.destroy();host.animations.destroy();host.layout.destroy();host.dispose();}};
}
const touches=(x,y)=>({changedTouches:[{identifier:1,clientX:x,clientY:y}]});

test('returning to a tab restores its resolved container styles and hit testing at the current scroll',()=>{
  const f=fixture('<main id="tab" data-tab="one"><button id="item">商品</button><span id="spacer"></span></main>',
    '#tab{width:180px;height:80px;overflow:auto;container-type:inline-size}'+
    'button{display:block;box-sizing:border-box;width:60px;height:40px;flex-shrink:0}#spacer{display:block;height:200px;flex-shrink:0}'+
    '@container (min-width: 160px){button{width:110px;color:#c00}}',
    document=>document.getElementById('tab').dataset.tab);
  try{
    const tab=f.get('tab'),item=f.get('item'),spacer=f.get('spacer'),layout=f.host.layout;
    const other=f.host.document.createElement('div');
    const select=(key,children)=>{tab.dataset.tab=key;tab.replaceChildren(...children);layout.update();};
    assert.equal(item.offsetWidth,110);
    select('two',[other]);
    const before=layout.stats.fullLayouts;
    select('one',[item,spacer]);
    assert.equal(layout.stats.fullLayouts,before);
    assert.equal(layout.stats.restoredLayouts,1);
    assert.equal(layout.styles.read(item).color,'#c00');
    tab.scrollTop=20;
    assert.equal(layout.hit(100,10),item);
    assert.notEqual(layout.hit(100,30),item);
  }finally{f.close();}
});

test('a saved tab is recalculated after intrinsic image size, text, or fonts change',()=>{
  const f=fixture('<main id="tab" data-tab="one"><img id="cover"><span id="label">旧</span></main>',
    'img{display:block;align-self:flex-start}',document=>document.getElementById('tab').dataset.tab);
  try{
    const tab=f.get('tab'),cover=f.get('cover'),label=f.get('label'),layout=f.host.layout;
    let width=60;
    Object.defineProperties(cover,{naturalWidth:{get:()=>width},naturalHeight:{value:30}});
    const leave=()=>{tab.dataset.tab='two';tab.replaceChildren();layout.update();};
    const returnToTab=()=>{tab.dataset.tab='one';tab.replaceChildren(cover,label);layout.update();};
    assert.equal(cover.offsetWidth,60);
    leave();width=90;returnToTab();assert.equal(cover.offsetWidth,90);
    assert.equal(layout.stats.restoredLayouts,0);
    leave();label.textContent='新内容';const before=layout.stats.restoredLayouts;
    returnToTab();assert.equal(layout.stats.restoredLayouts,before);
    assert.equal(layout.record(label.firstChild).text,'新内容');
    leave();layout.invalidateFonts();const beforeFont=layout.stats.restoredLayouts;
    returnToTab();assert.equal(layout.stats.restoredLayouts,beforeFont);
  }finally{f.close();}
});

test('an already decoded image is ready on the current paint and dispatches load asynchronously',async()=>{
  const f=fixture('<img id="cover" width="60" height="20">','');
  const {host}=f,cover=f.get('cover'),surface={width:60,height:20};
  try{
    let events=0,decodes=0;
    host.loadImageSurface=async()=>{decodes++;return surface;};
    host.peekImageSurface=()=>surface;
    cover.addEventListener('load',()=>events++);
    cover.src='https://game.test/cover.png';
    assert.equal(cover.complete,true);
    assert.equal(cover.naturalWidth,60);
    assert.equal(events,0);
    await cover.decode();
    assert.equal(events,1);
    assert.equal(decodes,0);
  }finally{f.close();}
});

test('hit testing follows nested transforms, current scroll and shared stacking order',()=>{
  const f=fixture('<main id="scroll"><div id="shift"><button id="bottom">下</button><button id="top">上</button></div></main>',
    '#scroll{width:150px;height:100px;overflow:auto;transform:translate(19px,7px)}'+
    '#shift{position:relative;top:60px;width:140px;height:190px;flex-shrink:0;transform:translateX(10px) scale(.9)}'+
    'button{position:absolute;left:5px;top:10px;width:75px;height:50px}#top{z-index:2}');
  try{
    const top=f.get('top'),scroll=f.get('scroll');
    scroll.scrollTop=40;
    const tap=()=>{const r=top.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};};
    const {x,y}=tap();
    assert.equal(f.host.layout.hit(x,y)?.id,'top');
    let clicks=0;top.addEventListener('click',()=>clicks++);
    f.input.start(touches(x,y));f.input.end(touches(x,y));assert.equal(clicks,1);
    top.animate([{opacity:0},{opacity:0}],{duration:100,fill:'both'});
    f.painter.render();assert.equal(f.host.layout.hit(x,y)?.id,'bottom');
    scroll.scrollTop=170;
    assert.notEqual(f.host.layout.hit(x,y)?.id,'bottom');
  }finally{f.close();}
});

test('a guide can check its target without hiding or relaying out the screen',()=>{
  const f=fixture('<button id="start">出战</button><aside id="guide"><div id="caption">点击出战</div></aside><div id="modal" hidden></div>',
    'button,aside,#modal{position:absolute;left:15px;top:15px;width:120px;height:60px}'+
    'aside{pointer-events:none;z-index:2}#caption{width:100%;height:100%;pointer-events:auto}#modal{z-index:3}');
  try{
    const {document}=f.host,guide=f.get('guide');
    f.painter.render();
    const layout=f.host.layout.generation;
    for(let i=0;i<90;i++){
      assert.equal(document.elementFromPoint(48,36)?.id,'caption');
      assert.equal(document.elementFromPoint(48,36,guide)?.id,'start');
    }
    assert.equal(f.host.layout.generation,layout);
    f.get('modal').hidden=false;
    assert.equal(document.elementFromPoint(48,36,guide)?.id,'modal','an unrelated overlay still covers the target');
  }finally{f.close();}
});

test('steady pixels stay untouched; image completion, scroll, and animations repaint',async()=>{
  const f=fixture('<main id="scroll"><div id="art"></div><div id="tail"></div></main>',
    '#scroll{height:100px;width:140px;overflow:auto}#art{width:60px;height:48px;flex-shrink:0;background-image:url(still.png)}#tail{height:230px;flex-shrink:0}');
  let complete;
  f.host.loadImageSurface=()=>new Promise(resolve=>{complete=resolve;});
  try {
    f.painter.render();const initial=f.clears;
    f.painter.render();assert.equal(f.clears,initial);
    complete({width:60,height:48});
    await new Promise(resolve=>setImmediate(resolve));
    f.painter.render();assert(f.clears>initial);assert(f.draws>0);
    const staticDraw=f.clears;
    f.painter.render();assert.equal(f.clears,staticDraw);
    f.get('scroll').scrollTop=13;
    f.painter.render();assert.equal(f.clears,staticDraw+1);
    f.get('art').animate([{transform:'translateX(0px)'},{transform:'translateX(20px)'}],{duration:100,fill:'both'});
    f.clock=50;f.painter.render();assert.equal(f.clears,staticDraw+2);
    f.clock=120;f.painter.render();assert.equal(f.clears,staticDraw+3);
    f.clock=150;f.painter.render();assert.equal(f.clears,staticDraw+3);
    // A native RAF can stop while hidden; the show event must still repaint.
    f.host.document.dispatchEvent(new f.host.window.Event('visibilitychange'));
    f.painter.render();
    assert.equal(f.clears,staticDraw+4);
  }finally{f.close();}
});

test('a fixed-size image paints after decode without rebuilding layout',async()=>{
  const f=fixture('<div id="tile"><img id="icon" src="/icon.png"></div><img id="intrinsic" src="/natural.png">',
    '#tile{display:grid;grid-template:30px / 64px;width:64px;height:30px}#icon{width:100%;height:100%}#intrinsic{width:max-content}');
  const requests = new Map();
  f.host.loadImageSurface = url => new Promise(resolve => requests.set(url,resolve));
  try {
    const format = f.get('icon'), natural = f.get('intrinsic'), source = {width:80,height:60};
    f.painter.render();
    const prior=f.host.layout.generation, before=format.getBoundingClientRect();
    requests.get('/icon.png')(source);
    await format.decode();
    f.paint.length=0;
    assert(f.painter.render());
    assert(f.paint.includes(source));
    assert.deepEqual(format.getBoundingClientRect(),before);
    assert.equal(f.host.layout.generation,prior);
    requests.get('/natural.png')({width:99,height:44});
    await natural.decode();
    assert.equal(natural.getBoundingClientRect().width,99);
    assert(f.host.layout.generation>prior);
  }finally{f.close();}
});

test('moving content reuses its fixed alpha mask, which refreshes when its CSS changes',()=>{
  const f=fixture('<div id="mask"><div id="glow"></div></div>',
    '#mask{position:relative;width:120px;height:100px;mask-image:linear-gradient(black, transparent)}'+
    '#glow{position:absolute;width:64px;height:75px;background:red}');
  try {
    const glow=f.get('glow'), mask=f.get('mask');
    glow.animate([{transform:'translateX(0px)'},{transform:'translateX(40px)'}],{duration:100});
    f.painter.render();
    assert.equal(f.gradients,1);
    const draws=f.draws;
    f.clock=45;
    assert(f.painter.render());
    assert(f.draws>draws,'the animation still composites under the mask');
    assert.equal(f.gradients,1);
    mask.style.maskImage='linear-gradient(transparent, black)';
    f.painter.render();
    assert.equal(f.gradients,2);
  }finally{f.close();}
});

test('a portrait canvas composites each published frame and leaves unchanged pixels on screen',()=>{
  const f=fixture('<canvas id="portrait"></canvas>','canvas{width:130px;height:150px}');
  try{
    const canvas=f.get('portrait');canvas.getContext('2d');
    assert(f.painter.render());
    assert(f.painter.render(),'unmanaged canvas still takes the live path');

    notifyOwnedCanvasFrame(canvas);
    assert(f.painter.render());
    const layouts=f.host.layout.generation, draws=f.draws;
    assert.equal(f.painter.render(),false);
    assert.equal(f.draws,draws);
    notifyOwnedCanvasFrame(canvas);
    notifyOwnedCanvasFrame(canvas);
    assert(f.painter.render());
    assert.equal(f.draws,draws+1);
    assert.equal(f.host.layout.generation,layouts);
    assert.equal(f.painter.render(),false);

    canvas.animate([{opacity:0},{opacity:1}],{duration:100});
    f.clock=50;
    assert(f.painter.render(),'independent UI animation still paints');
  }finally{f.close();}
});

test('the first visible startup button paints its decoded PSD image and label together',async()=>{
  const f=fixture('<main id="bootLoading"><p id="bootMessage">加载中</p><progress max="3" value="0"></progress>'+
    '<button id="bootStart" hidden disabled>开始游戏</button><button id="bootRetry" hidden>重试</button></main>',
    '#bootStart{width:150px;height:44px;border-image:url(start.png) 9 fill / 5px stretch}');
  const previousWindow=Object.getOwnPropertyDescriptor(globalThis,'window');
  Object.defineProperty(globalThis,'window',{configurable:true,value:f.host.window});
  let finishDecode,requests=0,entered=0;
  f.host.loadImageSurface=()=>{requests++;return new Promise(resolve=>{finishDecode=resolve;});};
  const image={width:64,height:44};
  try{
    const startup=createStartupScreen(f.host.document,{prepareStartButton:f.painter.prepareBorderImage});
    const start=f.get('bootStart'), entering=startup.ready(()=>entered++);
    f.painter.render();
    assert.equal(requests,1);
    assert.equal(start.hidden,true);
    assert.equal(start.disabled,true);
    assert.equal(f.paint.includes('开始游戏'),false);

    finishDecode(image);
    await new Promise(resolve=>setImmediate(resolve));
    f.paint.length=0;
    f.painter.render();
    const label=f.paint.indexOf('开始游戏');
    assert(label>=0);
    assert(f.paint.slice(0,label).includes(image), 'the first frame with the label paints the original image first');
    assert.equal(requests,1);

    const box=start.getBoundingClientRect(), point=touches(box.x+box.width/2,box.y+box.height/2);
    f.input.start(point);f.input.end(point);
    await entering;
    assert.equal(entered,1);
    assert.equal(f.get('bootLoading'),null);
  }finally{
    if(previousWindow)Object.defineProperty(globalThis,'window',previousWindow);
    else delete globalThis.window;
    f.close();
  }
});

test('buttons wait for their painted face, including pseudo layers and shared navigation art',async()=>{
  const f=fixture('<button id="behind">底层</button><button id="confirm"><span>确定</span></button>'+
    '<nav id="bar" data-button-bar><button id="tab"><img data-button-face src="tab.png">战役</button></nav>'+
    '<button id="sortie" aria-label="出击"><img data-button-face src="sortie.png"></button>',
    'button,nav{position:absolute;left:4px;width:135px;height:40px}'+
    '#behind,#confirm{top:4px}#confirm{z-index:2}'+
    '#confirm::before{content:"";position:absolute;inset:0;z-index:-1;border-image:url(frame.png) 9 fill / 5px stretch}'+
    '#confirm::after{content:"";position:absolute;top:5px;right:5px;width:10px;height:10px;background:url(badge.png)}'+
    '#bar{top:56px;background:url(bar.png) center / 100% 100% no-repeat}#tab{inset:0}#tab img{width:16px;height:16px}'+
    '#sortie{top:108px}#sortie img{width:100%;height:100%}');
  const requests=new Map();
  f.host.loadImageSurface=url=>new Promise((resolve,reject)=>requests.set(String(url).split('/').at(-1),{resolve,reject}));
  const signals={confirm:0,behind:0,tab:0,sortie:0};
  const tap=id=>{const box=f.get(id).getBoundingClientRect(), point=touches(box.x+box.width/2,box.y+box.height/2);
    f.input.start(point); f.input.end(point);};
  for(const id of Object.keys(signals))f.get(id).addEventListener('click',()=>signals[id]++);
  const image={width:60,height:35},navImage={width:16,height:16},bar={width:135,height:40};
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  const paired=(label,source)=>{
    const index=f.paint.indexOf(label);
    assert(index>=0&&f.paint.slice(0,index).includes(source),label+' paired with its face');
  };
  try {
    tap('confirm'); // Layout can be queried before the first screen render.
    f.painter.render();
    assert.equal(f.paint.includes('确定'),false);
    assert.equal(f.paint.includes('战役'),false);
    assert.equal(f.paint.includes('出击'),false);
    tap('confirm');tap('tab');tap('sortie');
    assert.deepEqual(signals,{confirm:0,behind:0,tab:0,sortie:0});

    requests.get('tab.png').resolve(navImage);
    requests.get('frame.png').resolve(image);
    requests.get('sortie.png').reject(new Error('fixture decode failure'));
    await settle();
    tap('confirm');tap('sortie');
    assert.deepEqual(signals,{confirm:0,behind:0,tab:0,sortie:0});
    f.paint.length=0;
    f.painter.render();
    paired('确定',image);
    paired('出击','fallback face');
    assert.equal(f.paint.includes('战役'),false);
    assert(requests.has('badge.png'),'optional art still loads after the button is revealed');
    tap('confirm');tap('sortie');
    assert.deepEqual(signals,{confirm:1,behind:0,tab:0,sortie:1});

    requests.get('bar.png').resolve(bar);
    await settle();
    f.paint.length=0;
    f.painter.render();
    paired('战役',bar);paired('战役',navImage);
    tap('tab');
    assert.equal(signals.tab,1);
  } finally {f.close();}
});

test('progress paint does not rebuild Yoga; value-dependent CSS still can',()=>{
  for(const selector of ['', 'progress[value="3"]{width:160px}']){
    const f=fixture('<progress id="progress" max="5" value="0"></progress>','progress{width:100px;height:20px}'+selector);
    try {
      f.painter.render();const generation=f.host.layout.generation,paint=f.clears;
      const p=f.get('progress');p.value=3;
      assert.equal(p.value,3);
      f.painter.render();
      assert(f.clears>paint);
      assert.equal(f.host.layout.generation-generation,selector?1:0);
      assert.equal(p.getBoundingClientRect().width,selector?160:100);
    }finally{f.close();}
  }
});

test('profile separates layout from paint and nested touch, with a bounded frame window',()=>{
  let time=0;const profile=createDomFramePerformance(()=>time,2);
  const measure=(domain,name,ms)=>profile.measure(domain,name,()=>{time+=ms;});
  profile.measure('host','input',()=>{
    time+=1;measure('host','layout',2);
    profile.measure('battle','input',()=>{measure('battle','layout',3);time+=4;});
    time+=5;
  });
  profile.measure('host','paint',()=>{measure('host','layout',6);time+=7;});
  profile.measure('host','paint',()=>{
    time+=2;measure('battle','layout',1);
    profile.measure('battle','paint',()=>{measure('battle','layout',3);time+=2;});
    time+=1;
  });
  profile.measureTransfer('aircraftRead',256*256,()=>{time+=4;});
  profile.closeFrame('battle');
  const {host,battle}=profile.snapshot().phases.battle;
  assert.equal(host.layout.p95,8);
  assert.equal(host.paint.p95,10);
  assert.equal(host.input.p95,6);
  assert.equal(battle.layout.p95,7);
  assert.equal(battle.paint.p95,2);
  assert.equal(battle.inputActiveP95,4);
  assert.deepEqual(profile.transfers().aircraftRead,{calls:1,rgbaBytes:262144,mean:4,p95:4,activeP95:4});
  profile.closeFrame('battle');profile.closeFrame('battle');
  assert.equal(profile.snapshot().phases.battle.frames,2);
  assert.equal(profile.snapshot().phases.battle.host.inputActiveP95,null);
});

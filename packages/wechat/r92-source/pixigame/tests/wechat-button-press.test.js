import assert from 'node:assert/strict';
import test from 'node:test';
import {loadYoga} from 'yoga-layout/load';
import {mountDomButtonPress} from '../src/ui/dom-button-press.js';
import {createDomEnvironment} from '../wechat/src/full/dom-environment.js';
import {createDomLayout} from '../wechat/src/full/dom-layout.js';
import {createDomStyles} from '../wechat/src/full/dom-style.js';
import {attachDomInput} from '../wechat/src/full/dom-input.js';
import {compileSharedCss} from '../wechat/tools/compile-shared-css.mjs';

const Yoga=await loadYoga();
const baseURL='https://game.test/';

test('holding a native button across frames preserves its hit area and activates it once',()=>{
  const host=createDomEnvironment({env:{USER_DATA_PATH:'/test'}},{baseURL,width:390,height:844,pixelRatio:3,
    resources:{resolve:url=>url},globalScope:{},markup:'<html><body><button id="start">开始游戏</button><button id="scaled">出击</button></body></html>'});
  const css='html,body{margin:0;width:100%;height:100%}button{width:170px;height:44px;position:absolute;left:110px;top:600px}'+
    '#scaled{top:660px;scale:1.2   0.8}';
  const styles=createDomStyles(compileSharedCss(css,{baseURL}),host);
  host.layout=createDomLayout(host,styles,Yoga,{measureText:text=>({width:text.length*8})});
  host.install();
  const input=attachDomInput(host,{listen:false});
  const clock=new Map();let lastId=0;
  const saved=new Map(['requestAnimationFrame','cancelAnimationFrame'].map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,writable:true,value:cb=>{clock.set(++lastId,cb);return lastId;}});
  Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,writable:true,value:id=>clock.delete(id)});
  const tick=ms=>{
    const frames=[...clock.values()];clock.clear();
    assert(frames.length>0,'This test must process a frame between touchstart and touchend');
    for(const cb of frames)cb(performance.now()+ms);
  };
  let removePress;
  try {
    removePress=mountDomButtonPress(host.document);
    for(const [i,id] of ['start','scaled'].entries()){
      const button=host.document.getElementById(id);
      if(i===0)assert.equal(host.window.getComputedStyle(button).scale,'');
      const before=button.getBoundingClientRect(), x=before.left+before.width/2, y=before.top+before.height/2;
      const atCenter={changedTouches:[{identifier:i+1,clientX:x,clientY:y}]};
      let clicks=0;button.addEventListener('click',()=>clicks++);
      assert.equal(host.layout.hit(x,y),button);
      const layouts=host.layout.stats.fullLayouts;
      input.start(atCenter);
      tick(130);
      const held=button.getBoundingClientRect();
      assert(Math.abs(held.width-before.width*.9)<.01 && Math.abs(held.height-before.height*.9)<.01,
        `unexpected press area ${held.width}×${held.height} for ${id}`);
      assert.equal(host.layout.hit(x,y),button);
      input.end(atCenter);
      assert.equal(clicks,1);
      tick(160);
      assert.equal(button.getBoundingClientRect().width,before.width);
      assert.equal(host.layout.stats.fullLayouts,layouts);
    }
  } finally {
    removePress?.();input.destroy();host.layout.destroy();host.dispose();
    for(const [key,value] of saved)if(value)Object.defineProperty(globalThis,key,value);else delete globalThis[key];
  }
});

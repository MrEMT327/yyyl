import test from 'node:test';
import assert from 'node:assert/strict';
import {createSurfaceCache} from '../wechat/src/full/surface-cache.js';
import {installNativeArt} from '../wechat/src/full/native-art.js';

test('decoded image cache stays bounded through thousands of changing SVG snapshots without destroying visible surfaces',async()=>{
 const cache=createSurfaceCache({maxBytes:1024,maxEntries:4});const held=[];
 for(let n=0;n<2000;n++){
  const image=await cache.get('frame-'+n,()=>({width:8,height:8,revision:n}));
  if(n===0)held.push(image);
  assert(cache.stats.bytes<=1024);assert(cache.stats.entries<=4);
 }
 assert.deepEqual(held[0],{width:8,height:8,revision:0});assert.deepEqual(cache.stats,{entries:4,bytes:1024,pending:0});
});
test('cache hits promote recent surfaces and concurrent loads share a promise',async()=>{
 const cache=createSurfaceCache({maxEntries:2});let calls=0,ready;
 const load=()=>{calls++;return new Promise(resolve=>{ready=resolve;});};
 const first=cache.get('one',load),second=cache.get('one',load);assert.equal(first,second);
 assert.equal(cache.peek('one'),undefined);
 await Promise.resolve();assert.equal(calls,1);ready({width:10,height:10});await first;
 await cache.get('two',()=>({width:1,height:1}));assert.equal(cache.peek('one'),await first);
 await cache.get('three',()=>({width:1,height:1}));let reloaded=false;
 assert.equal(cache.peek('two'),undefined);
 await cache.get('two',()=>{reloaded=true;return {width:1,height:1};});assert(reloaded);
});
test('failed decodes and late completion after disposal do not retain entries or corrupt byte accounting',async()=>{
 const cache=createSurfaceCache({maxBytes:1});await assert.rejects(cache.get('bad',()=>{throw Error('decode');}),/decode/);
 assert.deepEqual(cache.stats,{entries:0,bytes:0,pending:0});let ready;
 const pending=cache.get('later',()=>new Promise(resolve=>{ready=resolve;}));await Promise.resolve();cache.clear();
 ready({width:100,height:100});await pending;assert.deepEqual(cache.stats,{entries:0,bytes:0,pending:0});
 const large=await cache.get('large',()=>({width:100,height:100}));assert.equal(large.width,100);assert.equal(cache.stats.bytes,0);
});

test('native art integrates the decoded-surface budget while keeping currently owned images usable',async()=>{
 let decoded=0;
 const host={api:{createImage(){decoded++;return {width:1024,height:1024,set src(value){this.url=value;queueMicrotask(()=>this.onload());}};}},
  resources:{resolve:value=>value},scope:{},document:{baseURI:'https://game.test/'}};
 const art=installNativeArt(host,{localFile:async value=>value});
 try{
  const first=await host.loadImageSurface('first.png');assert.equal(await host.loadImageSurface('first.png'),first);assert.equal(decoded,1);
  for(let n=0;n<40;n++)await host.loadImageSurface(n+'.png');
  assert.equal(first.width,1024);assert.equal(first.url,'first.png');
  const before=decoded;await host.loadImageSurface('first.png');assert.equal(decoded,before+1);
 }finally{art.destroy();}
});

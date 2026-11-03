import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {build} from 'esbuild';
import {parseHTML} from 'linkedom';
const stubs={
 'three':`export class WebGLRenderer{constructor(){this.info={render:{calls:1,triangles:1}};}setPixelRatio(){}setClearColor(){}dispose(){}forceContextLoss(){}} export const SRGBColorSpace='srgb',ACESFilmicToneMapping=1;`,
 '../three/aircraft/fighter-packages.js':'export const loadFighterPackages=async()=>{};',
 '../three/aircraft/aircraft-lighting.js':'export const AIRCRAFT_RENDER_STYLE={exposure:1};',
 './sortie-hangar-scene.js':'export const createSortieHangarScene=(...args)=>globalThis.__scene(...args);',
};
const built=await build({entryPoints:['src/ui/sortie-hangar.js'],bundle:true,write:false,format:'esm',platform:'node',define:{'import.meta.env.BASE_URL':'"/"'},plugins:[{name:'renderer-test-seams',setup(b){
 b.onResolve({filter:/.*/},a=>stubs[a.path]?{path:a.path,namespace:'stub'}:null);
 b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:stubs[a.path],loader:'js'}));
 b.onLoad({filter:/[\\/]src[\\/]ui[\\/]sortie-hangar\.js$/},async a=>({contents:(await fs.readFile(a.path,'utf8')).replace("new URL('./sortie-hangar.worker.js',import.meta.url)",'new URL("http://localhost/worker.js")'),loader:'js'}));
}}]});
const {createSortieHangar}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text+'\n//# sourceURL=hangar-controller-test.js').toString('base64'));
function fixture({reduced=false,workers=true}={}){
 const {window,document}=parseHTML('<html><body><section><img class="sortie-hangar__elevator"><div class="model"></div></section></body></html>');
 const host=document.querySelector('.model'),deck=document.querySelector('img'),timers=new Map(),frames=new Map(),instances=[];let serial=0,scenes=0,disposed=0;
 Object.defineProperty(document,'baseURI',{value:'http://localhost:4173/'});document.hidden=false;
 host.getBoundingClientRect=()=>({width:400,height:500});deck.getBoundingClientRect=()=>({width:344,height:100});
 window.matchMedia=()=>({matches:reduced,addEventListener(){},removeEventListener(){}});
 const keys=['window','document','Worker','HTMLCanvasElement','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout','__scene'];
 const previous=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 class Worker{constructor(){this.sent=[];this.terminated=false;instances.push(this);}postMessage(data){this.sent.push(data);}terminate(){this.terminated=true;}emit(data){this.onmessage?.({data});}}
 class Canvas{};if(workers)Canvas.prototype.transferControlToOffscreen=()=>({});
 const create=document.createElement.bind(document);document.createElement=(name)=>{const el=create(name);if(name==='canvas')el.transferControlToOffscreen=()=>({});return el;};
 Object.assign(globalThis,{window,document,Worker,HTMLCanvasElement:Canvas,ResizeObserver:class{observe(){}disconnect(){}},requestAnimationFrame:fn=>{const id=++serial;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),__scene:()=>{scenes++;return{resize(){},warmup:async()=>{},draw(){},dispose(){disposed++;}};}});
 const view=createSortieHangar(host,'pilot-04');
 return{view,host,deck,instances,timers,frames,get scenes(){return scenes;},get disposed(){return disposed;},async flush(){await Promise.resolve();await Promise.resolve();await Promise.resolve();},cleanup(){view.dispose();for(const k of keys)if(previous[k]===undefined)delete globalThis[k];else globalThis[k]=previous[k];}};
}
test('worker readiness starts one presentation and completion releases the launch gate',async()=>{
 const f=fixture();try{const w=f.instances[0];assert.equal(w.sent[0].type,'init');w.emit({type:'ready'});assert.equal(f.host.dataset.phase,'elevator');assert.equal(w.sent.filter(m=>m.type==='start').length,1);w.emit({type:'complete'});await f.view.ready;assert.equal(f.host.dataset.phase,'ready');}finally{f.cleanup();}
});
test('closing before worker readiness disposes resources and ignores late readiness',async()=>{
 const f=fixture();try{const w=f.instances[0],late=w.onmessage;f.view.dispose();late({data:{type:'ready'}});await f.view.ready;assert.equal(w.sent.filter(m=>m.type==='start').length,0);assert(w.sent.some(m=>m.type==='dispose'));assert.equal(f.host.querySelectorAll('canvas').length,0);}finally{f.cleanup();}
});
test('unsupported worker canvas uses the same main-thread model instead of hiding the aircraft',async()=>{
 const f=fixture({workers:false});try{await f.flush();assert.equal(f.host.dataset.renderer,'main');assert.equal(f.scenes,1);assert(f.host.classList.contains('has-model'));f.view.freeze();await f.view.ready;f.view.dispose();assert.equal(f.disposed,1);}finally{f.cleanup();}
});
test('worker startup error falls back once and disposes the failed worker',async()=>{
 const f=fixture();try{const w=f.instances[0];w.emit({type:'error',message:'test unavailable'});await f.flush();assert.equal(f.host.dataset.renderer,'main');assert.equal(f.scenes,1);assert(w.sent.some(m=>m.type==='dispose'));}finally{f.cleanup();}
});
test('reduced-motion preparation resolves without allocating a worker or GPU model',async()=>{
 const f=fixture({reduced:true});try{await f.view.ready;assert.equal(f.host.dataset.phase,'fallback');assert.equal(f.instances.length,0);assert.equal(f.scenes,0);}finally{f.cleanup();}
});
test('background visibility pauses the worker and foreground resumes it',()=>{
 const f=fixture();try{const w=f.instances[0];w.emit({type:'ready'});f.host.ownerDocument.hidden=true;f.host.ownerDocument.dispatchEvent(new window.Event('visibilitychange'));assert.equal(w.sent.at(-1).type,'pause');f.host.ownerDocument.hidden=false;f.host.ownerDocument.dispatchEvent(new window.Event('visibilitychange'));assert.equal(w.sent.at(-1).type,'resume');}finally{f.cleanup();}
});

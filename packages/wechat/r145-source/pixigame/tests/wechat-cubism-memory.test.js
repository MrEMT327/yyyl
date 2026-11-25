import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import test from 'node:test';
import {build} from 'esbuild';
import {wrapNativeCubismCore} from '../wechat/tools/cubism-native.mjs';

test('Switching from the large Cubism pilot recreates the real core at the small pilot budget',async t=>{
  const project=new URL('../../../../../pixigame/',import.meta.url),assets=new URL('public/',project);
  const source=await readFile(new URL('art/live2d-runtime/live2dcubismcore.min.js',assets),'utf8');
  const sandbox={module:{exports:{}},console,atob,TextDecoder,ArrayBuffer,Uint8Array,setTimeout,clearTimeout,performance};
  vm.runInNewContext(wrapNativeCubismCore(source),sandbox);
  const {outputFiles:[bundle]}=await build({
    absWorkingDir:fileURLToPath(project),entryPoints:['src/ui/cubism-portrait-player.js'],
    bundle:true,write:false,format:'cjs',logLevel:'silent',define:{'import.meta.env':'{}'},
  });
  const mod={exports:{}};
  new Function('module','exports',bundle.text)(mod,mod.exports);
  const {createCubismPortraitPlayer,trimUnusedNativeCubismCore}=mod.exports;
  let factories=0,pilot;
  const previous=Object.getOwnPropertyDescriptor(globalThis,'Live2DCubismCore');
  t.after(()=>{
    pilot?.destroy();trimUnusedNativeCubismCore();
    if(previous)Object.defineProperty(globalThis,'Live2DCubismCore',previous);else delete globalThis.Live2DCubismCore;
  });
  const host={baseURL:assets.href,hidden:()=>false,watchVisibility:()=>()=>{},
    loadCore:async()=>{factories++;return sandbox.module.exports({console,atob,TextDecoder});},
    fetchResource:async url=>{
      const bytes=await readFile(new URL(url));
      return {ok:true,json:async()=>JSON.parse(bytes),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};
    }};
  async function open(modelPath,memoryMiB,idleGroup='idle'){
    pilot=createCubismPortraitPlayer({geometryHost:{...host,cubismMemoryBytes:memoryMiB*1024*1024},
      assetBase:assets.href,modelPath,geometryOnly:true,motionGroups:{[idleGroup]:'idle'}});
    assert.equal(await pilot.prepareGeometry(),true,pilot.error?.stack);
    return pilot.model.getModel().parameters.values.buffer.byteLength/1048576;
  }
  const small='art/orange-jetboard-v5/reference/ougen_5.model3.json';
  assert.equal(await open(small,16),16);pilot.destroy();
  assert.equal(await open('art/luna-maid-v1/source/heitaizi_2.model3.json',16),16);
  assert.equal(factories,1);pilot.destroy();
  assert((await open('art/blue-ponytail-v15/blue-ponytail.model3.json',128,'Idle'))>=128);
  trimUnusedNativeCubismCore();assert(globalThis.Live2DCubismCore);
  pilot.destroy();assert.equal(globalThis.Live2DCubismCore,undefined);
  assert.equal(await open(small,16),16);assert.equal(factories,2);
});

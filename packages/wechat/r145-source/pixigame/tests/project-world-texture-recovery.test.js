import test from 'node:test';
import assert from 'node:assert/strict';
import {guardWorldTextureUpload} from '../src/replica/project-world-texture-recovery.js';
import {createNativeBattleRenderBudget,nativeBattleBufferSize} from '../src/replica/native-battle-render-budget.js';
import {createSourceMeshShaderData,updateSourceMeshShaderData} from '../replica-battle/kernel/pathogenic/source-mesh-shader-data.mjs';
test('texture restoration reserves the original size without uploading an unavailable WebGL canvas', () => {
  let ready = false;
  const terrain = {width:450,height:800};
  const uploads = [];
  const wrapper = {
    pixels:terrain, width:450, height:800,
    _processTexture() {
      uploads.push({pixels:this.pixels,width:this.width,height:this.height});
    },
  };
  const upload = wrapper._processTexture;
  const release = guardWorldTextureUpload(wrapper, () => ready);

  wrapper._processTexture();
  assert.equal(wrapper.pixels, terrain);
  ready = true;
  wrapper._processTexture();
  assert.deepEqual(uploads, [
    {pixels:null,width:450,height:800},
    {pixels:terrain,width:450,height:800},
  ]);
  release();
  assert.equal(wrapper._processTexture, upload);
});

test('failed uploads restore the source and cleanup cannot overwrite another owner', () => {
  const terrain = {};
  const wrapper = {pixels:terrain, _processTexture() { throw Error('upload failure'); }};
  const release = guardWorldTextureUpload(wrapper, () => false);
  assert.throws(() => wrapper._processTexture(), /upload failure/);
  assert.equal(wrapper.pixels, terrain);
  const replacement = () => {};
  wrapper._processTexture = replacement;
  release();
  assert.equal(wrapper._processTexture, replacement);
});

test('native terrain skips intermediate frames but responds immediately to weather, teleport and recovery',()=>{
  const budget=createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20);
  assert.equal(budget.aircraftTextureSize,192);
  assert.deepEqual([budget.terrainWidth,budget.terrainHeight],[360,640]);
  function countTerrainFrames(rendererBudget, movementPerFrame){
    let draws=0;
    for(let frame=0;frame<60;frame++){
      if(rendererBudget.shouldDrawTerrain(frame/60,1,'light',0,frame*movementPerFrame))draws++;
    }
    return draws;
  }
  assert.equal(countTerrainFrames(budget,.01),20);
  assert(budget.shouldDrawTerrain(59/60,1,'storm',0,.59));
  assert(budget.shouldDrawTerrain(59/60,1,'storm',4,.59));
  assert(budget.shouldDrawTerrain(0,2,'storm',0,0));
  assert(!budget.shouldDrawTerrain(0,2,'storm',0,0));
  budget.reset();
  assert(budget.shouldDrawTerrain(0,2,'storm',0,0));
  budget.reset();
  assert.equal(countTerrainFrames(budget,.13),30);
  const wide=createNativeBattleRenderBudget({width:800,height:1100,pixelRatio:2},20);
  assert.equal(wide.aircraftTextureSize,256);
  assert.deepEqual([wide.terrainWidth,wide.terrainHeight],[540,960]);
  assert.equal(countTerrainFrames(wide,.01),30);
});

test('regular phone aircraft updates leave room for terrain with a bounded delay', () => {
  const phone = createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20);
  assert.equal(phone.combatBloomLevels,1);
  assert.equal(phone.compactAircraftEffects,true);
  assert(!phone.shouldDrawAircraft(1/60,false,true));
  assert(phone.shouldDrawAircraft(1/30,false,true));
  assert(!phone.shouldDrawAircraft(1/30,true,true));
  assert(phone.shouldDrawAircraft(1/20,true,true));
  assert(!phone.shouldDrawAircraft(1/30,false,false));
  assert(phone.shouldDrawAircraft(1/15,false,false));
  assert(!phone.shouldDrawAircraft(1/15,true,false));
  assert(phone.shouldDrawAircraft(1/12,true,false));
  const wide = createNativeBattleRenderBudget({width:800,height:1100,pixelRatio:2},20);
  assert.equal(wide.combatBloomLevels,undefined);
  assert.equal(wide.compactAircraftEffects,false);
  assert(wide.shouldDrawAircraft(1/60,true,true));
  assert(!wide.shouldDrawAircraft(1/60,true,false));
});

test('the smaller phone framebuffer preserves source shader coordinates', () => {
  const {width,height}=nativeBattleBufferSize({width:390,height:844,pixelRatio:2},540,960);
  assert.deepEqual([width,height],[432,768]);
  assert.deepEqual(nativeBattleBufferSize({width:800,height:1100,pixelRatio:2},540,960),{width:540,height:960});
  const renderScale=width/540, item={color:[1,1,1,1],matrix:[1.4,.1,-.2,1.8,260,430]};
  const source={width:128,height:128}, installed={binding:{premultiplied:false}}, resolved={uniforms:{},textures:{}};
  const data=createSourceMeshShaderData();
  const transform=(matrix,x,y)=>[matrix[0]*x+matrix[3]*y+matrix[6],matrix[1]*x+matrix[4]*y+matrix[7]];
  updateSourceMeshShaderData(data,item,source,0,false,1,1,undefined,installed,resolved);
  const model=data.modelMatrix.slice(), logicalPoint=transform(data.localToScreen,12,35);
  updateSourceMeshShaderData(data,item,source,0,false,1,1,undefined,installed,resolved,renderScale);
  const pixel=transform(data.localToScreen,12,35);
  const local=transform(data.screenToLocal,...pixel);
  for(let index=0;index<2;index++){
    assert(Math.abs(pixel[index]-logicalPoint[index]*renderScale)<1e-9);
    assert(Math.abs(local[index]-[12,35][index])<1e-9);
  }
  assert.deepEqual(data.modelMatrix,model);
});

test('busy phone separates routine renders and leaves a deferred terrain draw due', () => {
  const phone = createNativeBattleRenderBudget({width:390,height:844,pixelRatio:2},20);
  assert.equal(phone.planTerrain(0,1,'clear',0,0),'immediate');
  phone.commitTerrain();
  assert.equal(phone.planTerrain(1/18,1,'clear',0,0),'regular');
  assert.equal(phone.planTerrain(1/18,1,'clear',0,0),'regular');
  phone.commitTerrain();
  assert.equal(phone.planTerrain(1/18,1,'clear',0,0),null);
  assert.equal(phone.planTerrain(2/18,1,'night',0,0),'immediate');
  for(let i=0;i<24;i++)phone.deferOverlappingRender(1/37,false,false);
  assert.equal(phone.deferOverlappingRender(1/37,true,true),'terrain');
  assert.equal(phone.deferOverlappingRender(1/37,true,true),'aircraft');
  assert.equal(phone.deferOverlappingRender(1/37,false,true),null);
  assert.equal(phone.deferOverlappingRender(1/37,true,false),null);
  assert.equal(phone.deferOverlappingRender(1/37,false,true,true),'terrain');
  assert.equal(phone.deferOverlappingRender(1/37,false,true,true),null,'a second priority pose releases deferred terrain');
  assert.equal(phone.deferOverlappingRender(1/37,false,false,true),null,'urgent terrain has its own deadline');
  assert.equal(phone.deferOverlappingRender(.4,true,true),null);
  for(let i=0;i<60;i++)assert.equal(phone.deferOverlappingRender(1/60,true,true),null);
  const wide = createNativeBattleRenderBudget({width:800,height:1100,pixelRatio:2},20);
  for(let i=0;i<24;i++)assert.equal(wide.deferOverlappingRender(1/18,true,true),null);
});

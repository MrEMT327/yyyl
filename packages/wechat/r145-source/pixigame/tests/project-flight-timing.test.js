import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry, Group, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, ShaderLib, Texture} from 'three';
import {createFlightVisualState,sampleFlightVisual,flightPoseNeedsRefresh}from'../src/replica/project-flight-visual.js';
import {createCombatAircraftRenderer} from '../src/replica/project-aircraft-render.js';
import {CombatRenderSamples} from '../../../../../pixigame/src/replica/combat-render-samples.mjs';
import {createCombatHullBatches} from '../src/three/aircraft/combat-hull-batches.js';
const frame=(clock,x,dt,active=true)=>({clock,runId:1,renderDelta:dt,flight:{x,z:0,speed:10,active}});

test('projectile presentation follows fixed step remainder at 50 Hz and during slow motion', () => {
  const logicStep = 1/30, nativeDelta = 2184/65536, interval = 1/50;
  for (const scale of [1, .25]) {
    const sampler = new CombatRenderSamples();
    const bullet = {owner:'enemy',x:0,z:0,oldX:0,oldZ:0};
    let steps = 0, remainder = 0, previous = 0;
    sampler.beginFrame(0,1,'playing',0,0);
    for (let index=0;index<80;index++) {
      remainder += interval*scale;
      while (remainder+1e-9>=logicStep) { remainder-=logicStep;steps++; }
      bullet.oldX=Math.max(0,steps-1)*10;bullet.x=steps*10;
      sampler.beginFrame(steps*nativeDelta,1,'playing',interval*scale,remainder/logicStep);
      const x=sampler.projectile(bullet,0).x;
      assert(x>=bullet.oldX-1e-7 && x<=bullet.x+1e-7);
      if (steps>=2) assert(Math.abs((x-previous)-10*interval*scale/logicStep)<1e-7);
      previous=x;
    }
    sampler.beginFrame(steps*nativeDelta,1,'upgrade',.2,1);
    assert.equal(sampler.projectile(bullet,0).x,previous);
    sampler.beginFrame(steps*nativeDelta,1,'playing',0,0);
    assert.equal(sampler.projectile(bullet,0).x,previous);
    sampler.beginFrame(0,2,'playing',0,0);
    bullet.x=21;bullet.oldX=0;
    assert.equal(sampler.projectile(bullet,0).x,21);
  }
});

test('quarter-speed enemies and medkits move in proportion to uneven display intervals', () => {
  const step=1/30,delta=2184/65536,samples=new CombatRenderSamples();
  const e={x:2,z:0,oldX:2,oldZ:0,angle:0,viewPositionRevision:0};
  const kit={kind:'heart',x:0,z:0,age:0,delay:0,state:'stay',stateTime:0,speed:0};
  const intervals=[1/60,1/50,1/120,1/90,.038,1/60,1/30];
  let count=0,remainder=0,lastEnemy=0,lastKit=0;
  samples.beginFrame(0,1,'playing',0,0);samples.enemy(e);samples.pickup(kit);
  for(let index=0;index<250;index++){
    const dt=intervals[index%intervals.length]*.25;
    remainder+=dt;
    while(remainder>=step){
      remainder-=step;count++;
      e.oldZ=e.z;e.z-=delta*.24;
      kit.z-=delta*2.5;kit.age+=delta;
    }
    const snapshot=[{...e},{...kit}];
    samples.beginFrame(count*delta,1,'playing',dt,remainder/step);
    const enemy=samples.enemy(e).z,medkit=samples.pickup(kit).z;
    if(count>1){
      assert(Math.abs(lastEnemy-enemy-dt/step*delta*.24)<1e-8);
      assert(Math.abs(lastKit-medkit-dt/step*delta*2.5)<1e-8);
    }
    assert.deepEqual([e,kit],snapshot);
    lastEnemy=enemy;lastKit=medkit;
  }
  samples.beginFrame(count*delta,1,'paused',.25,0);
  assert.equal(samples.enemy(e).z,lastEnemy);assert.equal(samples.pickup(kit).z,lastKit);
});

test('enemy loop resets snap, and a newly visible medkit starts from its drop point', () => {
  const step=2184/65536,samples=new CombatRenderSamples();
  const e={x:0,z:0,oldX:0,oldZ:0,angle:Math.PI-.1,viewPositionRevision:0};
  const kit={kind:'heart',x:5,z:1,origin:{x:5,z:2},age:step,delay:0,state:'scatter'};
  samples.beginFrame(0,1,'playing',0,0);samples.enemy(e);
  samples.beginFrame(step,1,'playing',step/2,.5);
  e.angle=-Math.PI+.1;
  assert(Math.abs(samples.enemy(e).angle-Math.PI)<1e-8);
  assert.equal(samples.pickup(kit).z,1.5);
  Object.assign(e,{z:35,oldZ:35,angle:0,viewPositionRevision:1});
  samples.beginFrame(step*2,1,'playing',step,.5);
  assert.equal(samples.enemy(e).z,35);assert.equal(samples.enemy(e).angle,0);
  e.dead=true;e.z=34;e.oldZ=35;
  assert.equal(samples.enemy(e).z,34);
});

test('phone aircraft submits one color pass and restores wake emitters after a failed draw', () => {
  const left = {visible:true}, right = {visible:false};
  const depthInfo = {};
  const fighter = {
    runtime:{jets:[{object:left},{object:right}],depthInfo},
    withPreparedRender(_camera, draw) { return draw(); },
  };
  let passes = 0, fail = false;
  const aircraft = createCombatAircraftRenderer({render() {
    passes++;
    assert.deepEqual([left.visible,right.visible],[false,false]);
    assert.equal(fighter.runtime.depthInfo,depthInfo);
    if (fail) throw new Error('fixture draw failed');
  }},192);
  try {
    aircraft.render({}, {}, fighter, 192, false);
    assert.equal(passes,1);
    assert.deepEqual([left.visible,right.visible],[true,false]);
    fail = true;
    assert.throws(() => aircraft.render({}, {}, fighter, 192, false),/fixture draw failed/);
    assert.deepEqual([left.visible,right.visible],[true,false]);
  } finally { aircraft.dispose(); }
});

test('combat hull batches preserve the authored tree and yield to moving or edited parts', () => {
  const solid = new Group(), wing = new Group();
  const material = new MeshStandardMaterial(), canopy = new MeshStandardMaterial({transparent:true});
  const geometry = new BoxGeometry(), fuselage = new Mesh(geometry, material), wingPanel = new Mesh(geometry, material);
  const glass = new Mesh(geometry, canopy);
  wing.position.x = 3;
  wing.add(wingPanel);
  solid.add(wing, fuselage, glass);
  const batches = createCombatHullBatches(solid);
  assert(batches);
  const assertBatched = () => {
    assert.equal(wingPanel.parent, wing);
    assert.deepEqual([fuselage.visible, wingPanel.visible, glass.visible], [false, false, true]);
    const drawn = solid.children.at(-1).children;
    assert.equal(drawn.length, 1);
    assert.equal(drawn[0].material, material);
    drawn[0].geometry.computeBoundingBox();
    assert.equal(drawn[0].geometry.boundingBox.max.x, 3.5);
  };
  const assertOriginal = () => {
    assert.deepEqual(solid.children, [wing, fuselage, glass]);
    assert.deepEqual([fuselage.visible, wingPanel.visible, glass.visible], [true, true, true]);
  };
  try {
    assertOriginal();
    batches.render(assertBatched);
    wing.rotation.z = .2;
    batches.render(assertOriginal);
    wing.rotation.z = 0;
    assert.throws(() => batches.render(() => {
      assertBatched();
      throw new Error('fixture draw failed');
    }), /fixture draw failed/);
    assertOriginal();
    geometry.attributes.position.needsUpdate = true;
    batches.render(assertOriginal);
  } finally {
    batches.dispose(); geometry.dispose(); material.dispose(); canopy.dispose();
  }
});

test('combat hull palette preserves per-surface paint and rejects diverging texture state', () => {
  const solid = new Group(), geometry = new BoxGeometry(), map = new Texture();
  const shell = new MeshPhysicalMaterial({clearcoat: .25, roughness: .5, normalMap: map});
  const trim = new MeshPhysicalMaterial({clearcoat: .5, roughness: .25, normalMap: map});
  shell.color.setRGB(.25, .5, .75);
  trim.color.setRGB(.5, .25, .125);
  const body = new Mesh(geometry, shell), accent = new Mesh(geometry, trim);
  solid.add(body, accent);
  const batches = createCombatHullBatches(solid);
  assert(batches);
  const shader = {...ShaderLib.physical, uniforms: {}};
  try {
    batches.render(() => {
      assert.deepEqual([body.visible, accent.visible], [false, false]);
      const [proxy] = solid.children.at(-1).children;
      assert.equal(proxy.material.normalMap, map);
      assert.notEqual(proxy.material, shell);
      proxy.material.onBeforeCompile(shader);
      assert.deepEqual([...shader.uniforms.combatPaint.value], [.25, .5, .75, .5, .5, .25, .125, .25]);
      assert.equal(shader.uniforms.combatCoat.value[0], .25);
      assert.equal(shader.uniforms.combatCoat.value[2], .5);
    });
    trim.color.r = .75;
    trim.emissive.setRGB(.5, .25, 0);
    trim.emissiveIntensity = 2;
    batches.render(() => {
      assert.equal(shader.uniforms.combatPaint.value[4], .75);
      assert.deepEqual([...shader.uniforms.combatEmission.value.slice(4, 7)], [1, .5, 0]);
    });
    trim.normalMap = null;
    batches.render(() => {
      assert.deepEqual(solid.children, [body, accent]);
      assert.deepEqual([body.visible, accent.visible], [true, true]);
    });
  } finally {
    batches.dispose(); geometry.dispose(); map.dispose(); shell.dispose(); trim.dispose();
  }
});

test('full rolls keep 0.72-second timing at 5–144 display Hz after a normal release',()=>{
 for(const hz of[5,8,10,15,20,30,60,120,144])for(const direction of[-1,1]){
  const state=createFlightVisualState();let clock=0,x=0,start=null,finish=null;
  sampleFlightVisual(state,frame(0,x,0));
  for(let index=1;index<=hz*3;index++){
   clock+=Math.min(1/hz,.1);if(index===1)x+=direction*10*Math.min(1/hz,.1);
   const input=frame(clock,x,1/hz),before=structuredClone(input),pose=sampleFlightVisual(state,input);
   assert.deepEqual(input,before);
   if(start===null&&pose.rollActive)start=index/hz;
   if(start!==null&&!pose.rollActive){finish=index/hz-start;assert.equal(pose.roll,0);break;}
  }
  assert(finish!==null,'never completed at '+hz+' Hz');assert(finish>=.72-1e-9&&finish<=.72+1/hz+1e-9,'roll stretched at '+hz+' Hz: '+finish);
  assert.equal(state.roll.serial,1);
 }
});
test('irregular slow frames do not accumulate the old 50 ms animation debt',()=>{
 const state=createFlightVisualState();sampleFlightVisual(state,frame(0,0,0));let clock=0,total=0,start=0,done=false;
 const sequence=[1/120,1/60,.09,.14,1/30,.20,.07,.06];
 for(let i=0;i<40;i++){
  const dt=sequence[i%sequence.length];clock+=Math.min(.1,dt);total+=dt;
  const pose=sampleFlightVisual(state,frame(clock,.08,dt));
  if(i===0)start=total;
  if(!pose.rollActive){assert(total-start>=.72);assert(total-start<=.92);done=true;break;}
 }
 assert(done);
});
test('a paused roll stays frozen and a genuine long suspension rebases level',()=>{
 const state=createFlightVisualState();sampleFlightVisual(state,frame(0,0,0));
 for(let i=1;i<=12;i++)sampleFlightVisual(state,frame(i/60,Math.min(i,3)/6,1/60));
 const before=structuredClone(state);
 for(let i=0;i<60;i++)assert.deepEqual(sampleFlightVisual(state,frame(.2,.5,0,false)),before.pose);
 assert.deepEqual(state,before);
 const pose=sampleFlightVisual(state,frame(.3,.5,1));
 assert.equal(pose.roll,0);assert.equal(pose.rollActive,false);assert.equal(pose.thrust,0);
});
test('the exact level endpoint invalidates the cached texture even when the next frame pauses',()=>{
 const state=createFlightVisualState();let lastClock=-1,lastPose=null,completed=false;
 sampleFlightVisual(state,frame(0,0,0));
 for(let i=1;i<=90;i++){
  const pose=sampleFlightVisual(state,frame(i/60,1/6,1/60));
  const cadence=pose.rollActive||Math.abs(pose.bank)>.002||pose.thrust>.02?1/60:1/30;
  const cadenceDue=state.visualClock-lastClock>=cadence-1e-6;
  if(lastPose?.rollActive&&!pose.rollActive){
   assert(!cadenceDue,'exercise the frame skipped by the old cache');assert(flightPoseNeedsRefresh(lastPose,pose));
   lastPose={...pose};const paused=sampleFlightVisual(state,frame(i/60,1/6,0,false));
   assert(!flightPoseNeedsRefresh(lastPose,paused));assert.equal(lastPose.roll,0);completed=true;break;
  }
  if(cadenceDue||flightPoseNeedsRefresh(lastPose,pose)){lastClock=state.visualClock;lastPose={...pose};}
 }
 assert(completed);
});
test('texture refresh follows real endpoint changes, not every easing or unchanged paused sample',()=>{
 const p={bank:.1,pitch:.02,thrust:.4,roll:0,rollActive:false,rollSerial:1};
 assert(!flightPoseNeedsRefresh(p,{...p}));assert(!flightPoseNeedsRefresh(p,{...p,bank:.05,pitch:.01,thrust:.2}));
 for(const key of['bank','pitch','thrust'])assert(flightPoseNeedsRefresh(p,{...p,[key]:0}));
 assert(flightPoseNeedsRefresh(p,{...p,rollActive:true,rollSerial:2}));
});

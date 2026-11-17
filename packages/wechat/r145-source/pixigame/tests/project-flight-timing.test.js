import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlightVisualState,sampleFlightVisual,flightPoseNeedsRefresh}from'../src/replica/project-flight-visual.js';
const frame=(clock,x,dt,active=true)=>({clock,runId:1,renderDelta:dt,flight:{x,z:0,speed:10,active}});
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

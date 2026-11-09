// Read-only movement snapshots drive model attitude and engine presentation.
// No input target, entity position, projectile or gameplay parameter is changed.
import {createFlightRollState,sampleFlightRoll} from './project-flight-roll.js';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const idle=()=>({bank:0,pitch:0,thrust:0,roll:0,rollActive:false,rollSerial:0});
export function createFlightVisualState(){return {runId:null,clock:null,visualClock:0,motion:{vx:0,vz:0},x:0,z:0,roll:createFlightRollState(),pose:idle()};}
export function sampleFlightVisual(state,{clock,runId,flight,visible=true,renderDelta}){
  if(!flight||![clock,flight.x,flight.z,flight.speed].every(Number.isFinite))return {...state.pose};
  const reset=()=>{state.runId=runId;state.clock=clock;state.visualClock=clock;state.motion={vx:0,vz:0};state.x=flight.x;state.z=flight.z;state.roll=createFlightRollState();state.pose=idle();return {...state.pose};};
  if(!visible||state.clock===null||state.runId!==runId||clock<state.clock)return reset();
  const snapshotDelta=clock-state.clock;
  if(snapshotDelta>0){
    const dx=flight.x-state.x,dz=flight.z-state.z;
    // Rebase after a long suspension or teleport, without a false thrust burst.
    if(snapshotDelta>.25||Math.hypot(dx,dz)>Math.max(.5,flight.speed*snapshotDelta*2))return reset();
    state.clock=clock;state.x=flight.x;state.z=flight.z;
    const speed=Math.max(.001,flight.speed);
    state.motion={vx:dx/snapshotDelta/speed,vz:dz/snapshotDelta/speed};
  }
  // Native snapshots still determine motion. Only attitude/engine animation
  // advances between ticks; pause, restart and teleport keep their reset rules.
  // This is elapsed display time, not a physics integration step. Capping it
  // at 50 ms stretched a 0.72 s roll to 1.5 s at 10 Hz. Long suspensions rebase
  // level; ordinary slow frames still finish the complete roll on time.
  const dt=Number.isFinite(renderDelta)?Math.max(0,renderDelta):snapshotDelta;
  if(!flight.active||dt<=0)return {...state.pose};
  if(dt>.25)return reset();
  state.visualClock+=dt;
  const {vx,vz}=state.motion;
  const moving=Math.hypot(vx,vz)>.015;
  const target={bank:clamp(-vx,-1,1)*.22,pitch:clamp(-vz,-1,1)*.045,
    thrust:moving?clamp(Math.hypot(vx,vz)*.65+Math.max(0,vz)*.35,0,1):0};
  for(const key of ['bank','pitch','thrust']){
    // Both lateral and vertical reversals acknowledge the new direction.
    // Attitude can ease, but stopping should promptly settle the hull/exhaust.
    const reversing=state.pose[key]*target[key]<0;
    const response=reversing?128:Math.abs(target[key])<.0001?96:48;
    const blend=1-Math.exp(-response*dt);
    state.pose[key]+=(target[key]-state.pose[key])*blend;
    if(Math.abs(state.pose[key])<.0001)state.pose[key]=0;
  }
  Object.assign(state.pose,sampleFlightRoll(state.roll,{dt,vx,vz}));
  return {...state.pose};
}

// Endpoints must reach the texture even when cadence changes from 60 to 30 Hz
// or a choice modal pauses the next frame. Unchanged paused poses stay cached.
export function flightPoseNeedsRefresh(previous,next){
  return !previous||previous.rollActive!==next.rollActive||previous.rollSerial!==next.rollSerial
    ||['bank','pitch','thrust'].some(key=>next[key]===0&&previous[key]!==0);
}
// Spine's local scale/shear is its old 2D banking illusion. The rendered 3D
// hull already rolls rigidly, so inheriting that deformation banks it twice
// and can leave it narrow after the native track enters a held side pose.
// World position, global size, visibility and damage tint remain host-owned.
export function rigidAircraftSkinPose(pose){
  return {...pose,scaleX:1,scaleY:1,shearX:0};
}
const previousJets=new WeakMap();
export function updateFlightFighter(fighter,clock,pose){
  const runtime=fighter.runtime;
  // Restore the last sample before the package evaluates its own bindings.
  // This prevents multiplication accumulating on paused or repeated frames.
  for(const saved of previousJets.get(runtime)||[]){
    saved.object.scale.copy(saved.scale);
    if(saved.gain!==undefined)saved.object.material.uniforms.uGain.value=saved.gain;
    if(saved.throttle!==undefined)saved.object.material.uniforms.uThrottle.value=saved.throttle;
  }
  const quiet=1-clamp(pose.thrust,0,1)*.7;
  // A barrel roll owns lateral attitude for the flight. Its serial stays set
  // after completion, so a held drag cannot add a second bank on the next frame.
  // Keep pitch/thrust feedback, but end every whole revolution exactly level.
  const rollOwnsBank=(pose.rollSerial||0)>0;
  fighter.updateAircraft(clock,{bank:rollOwnsBank?0:pose.bank+Math.sin(clock*1.65)*.018*quiet,
    pitch:pose.pitch+Math.sin(clock*1.2+.4)*.012*quiet,roll:pose.roll||0,
    ...(runtime?.asset.solid.userData.cleanAircraftSurface?{boost:pose.thrust>.6}:{} )});
  fighter.object3D.rotation.y=rollOwnsBank?0:Math.sin(clock*1.4)*.018*quiet;
  if(!runtime)return;
  const thrust=clamp(pose.thrust,0,1),saved=[];
  for(const [index,jet]of runtime.jets.entries()){
    const object=jet.object,uniforms=object.material.uniforms;
    // Packages place exhaust on their separate effects pass. Combat renders
    // the fighter into one texture, so the authored jets also need layer 0.
    object.layers.enable(0);
    saved.push({object,scale:object.scale.clone(),gain:uniforms.uGain?.value,throttle:uniforms.uThrottle?.value});
    // The authored nozzle anchor and width remain fixed; only axial length varies.
    const axis=jet.axis||[0,0,1],pulse= .88+.22*Math.sin(clock*13+index*2.3);
    for(const [index,key]of ['x','y','z'].entries())if(Math.abs(axis[index])>.5)object.scale[key]*=(.94+thrust*.22)*pulse;
    if(uniforms.uGain)uniforms.uGain.value*=(1.02+thrust*.25)*(1+.16*Math.sin(clock*11+index*2.3));
    if(uniforms.uThrottle)uniforms.uThrottle.value=runtime.asset.solid.userData.cleanAircraftSurface?Math.max(uniforms.uThrottle.value,.46+thrust*.54):.08+thrust*.5;
  }
  previousJets.set(runtime,saved);
}

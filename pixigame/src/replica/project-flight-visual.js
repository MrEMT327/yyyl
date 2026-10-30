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
  const dt=Number.isFinite(renderDelta)?clamp(renderDelta,0,.05):snapshotDelta;
  if(!flight.active||dt<=0)return {...state.pose};
  state.visualClock+=dt;
  const {vx,vz}=state.motion;
  const moving=Math.hypot(vx,vz)>.015;
  const target={bank:clamp(-vx,-1,1)*.22,pitch:clamp(-vz,-1,1)*.045,
    thrust:moving?clamp(Math.hypot(vx,vz)*.65+Math.max(0,vz)*.35,0,1):0};
  const reversing=state.pose.bank*target.bank<0;
  const blend=1-Math.exp(-(reversing?48:moving?28:40)*dt);
  for(const key of ['bank','pitch','thrust']){
    state.pose[key]+=(target[key]-state.pose[key])*blend;
    if(Math.abs(state.pose[key])<.0001)state.pose[key]=0;
  }
  Object.assign(state.pose,sampleFlightRoll(state.roll,{dt,vx,vz}));
  return {...state.pose};
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
  fighter.updateAircraft(clock,{bank:pose.bank+Math.sin(clock*1.65)*.018*quiet,
    pitch:pose.pitch+Math.sin(clock*1.2+.4)*.012*quiet,roll:pose.roll||0});
  fighter.object3D.rotation.y=Math.sin(clock*1.4)*.018*quiet;
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
    if(uniforms.uThrottle)uniforms.uThrottle.value=.08+thrust*.5;
  }
  previousJets.set(runtime,saved);
}

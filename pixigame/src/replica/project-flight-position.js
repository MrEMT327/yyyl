// Display-only, bounded smoothing. The simulation, collision and weapon origins
// always retain the accepted native position. Never extrapolate beyond it.
const stoppedOrReversed=(previous,next)=>Math.abs(previous)>1e-7&&(Math.abs(next)<1e-7||previous*next<0);
export function createFlightPositionState(){
  return {runId:null,clock:null,target:null,current:null,direction:null,launchActive:false};
}
export function sampleFlightPosition(state,{clock,runId,flight,visible=true,renderDelta=0,launchActive=false}){
  if(!flight||![clock,flight.x,flight.z].every(Number.isFinite))return null;
  const launchChanged=state.launchActive!==launchActive;
  state.launchActive=launchActive;
  const target={x:flight.x,z:flight.z};
  const reset=()=>{
    state.runId=runId;state.clock=clock;state.target=target;state.current={...target};state.direction=null;
    return {...state.current};
  };
  // Opening choices can pause simulation before launch. Follow the accepted
  // entry path exactly, then rebase at its final point before pause freezes it.
  if(launchActive||launchChanged||!visible||state.clock===null||state.runId!==runId||clock<state.clock)return reset();
  if(!flight.active)return {...state.current};
  const snapshotDelta=clock-state.clock;
  if(snapshotDelta>0){
    const dx=target.x-state.target.x,dz=target.z-state.target.z,distance=Math.hypot(dx,dz);
    const dot=state.direction?dx*state.direction.x+dz*state.direction.z:0;
    const turning=state.direction&&dot<=Math.hypot(state.direction.x,state.direction.z)*distance*.25;
    // A shallow turn can reverse/stop one axis while the other dominates the
    // overall heading. Do not let visual damping continue the abandoned axis.
    const axisChanged=state.direction&&(stoppedOrReversed(state.direction.x,dx)||stoppedOrReversed(state.direction.z,dz));
    if(snapshotDelta>.25||distance>Math.max(.5,(flight.speed||0)*snapshotDelta*2)||distance<1e-7||turning||axisChanged)return reset();
    const starting=!state.direction;
    state.direction={x:dx,z:dz};state.target=target;state.clock=clock;
    // First movement follows the accepted logic position immediately. Subsequent
    // steady travel can still be subdivided between snapshots without prediction.
    if(starting){state.current={...target};return {...state.current};}
  }
  const dt=Number.isFinite(renderDelta)?Math.min(.05,Math.max(0,renderDelta)):0;
  const blend=1-Math.exp(-240*dt);
  state.current.x+=(state.target.x-state.current.x)*blend;
  state.current.z+=(state.target.z-state.current.z)*blend;
  const dx=state.current.x-target.x,dz=state.current.z-target.z,distance=Math.hypot(dx,dz);
  // Small/slow aircraft also get a small error budget. A missing radius opts
  // out of smoothing rather than inventing a collision size for old adapters.
  const limit=Math.max(0,Math.min((flight.radius||0)*.1,(flight.speed||0)/240));
  if(distance>limit){
    const ratio=limit/distance;
    state.current={x:target.x+dx*ratio,z:target.z+dz*ratio};
  }
  return {...state.current};
}

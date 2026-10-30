// Display-only, bounded smoothing. The simulation, collision and weapon origins
// always retain the accepted native position. Never extrapolate beyond it.
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
    const reversed=state.direction&&dx*state.direction.x+dz*state.direction.z<0;
    if(snapshotDelta>.25||distance>Math.max(.5,(flight.speed||0)*snapshotDelta*2)||distance<1e-7||reversed)return reset();
    state.direction={x:dx,z:dz};state.target=target;state.clock=clock;
  }
  const dt=Number.isFinite(renderDelta)?Math.min(.05,Math.max(0,renderDelta)):0;
  const blend=1-Math.exp(-90*dt);
  state.current.x+=(state.target.x-state.current.x)*blend;
  state.current.z+=(state.target.z-state.current.z)*blend;
  const dx=state.current.x-target.x,dz=state.current.z-target.z,distance=Math.hypot(dx,dz);
  // Small/slow aircraft also get a small error budget. A missing radius opts
  // out of smoothing rather than inventing a collision size for old adapters.
  const limit=Math.max(0,Math.min((flight.radius||0)*.25,(flight.speed||0)/120));
  if(distance>limit){
    const ratio=limit/distance;
    state.current={x:target.x+dx*ratio,z:target.z+dz*ratio};
  }
  return {...state.current};
}

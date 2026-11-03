// Presentation-only barrel roll. Movement snapshots cannot move the player or
// grant a dodge. Restore the legacy revolution, cooldown and queued turn.
export const FLIGHT_ROLL_SECONDS=.72;
const COOLDOWN=.6,QUEUE_SECONDS=1.55,LATERAL_EPSILON=.015;
export function createFlightRollState(){
  return {elapsed:null,direction:0,cooldown:0,gesture:0,pending:0,pendingTime:0,serial:0};
}
function startRoll(state,direction){
  state.direction=direction;state.elapsed=0;state.cooldown=COOLDOWN;
  state.pending=0;state.pendingTime=0;state.serial++;
}
export function sampleFlightRoll(state,{dt,vx}){
  state.cooldown=Math.max(0,state.cooldown-dt);
  if(state.elapsed!==null){
    state.elapsed+=dt;
    if(state.elapsed>=FLIGHT_ROLL_SECONDS-1e-9)state.elapsed=null;
  }
  state.pendingTime=Math.max(0,state.pendingTime-dt);
  if(!state.pendingTime)state.pending=0;
  // The current input already accepts the stroke. A lateral turn requests its
  // roll immediately; do not demand another speed or sustained-travel gate.
  const direction=Math.abs(vx)>LATERAL_EPSILON?Math.sign(vx):0;
  if(!direction){
    state.gesture=state.pending=0;state.pendingTime=0;
  }else{
    if(state.pending&&state.pending!==direction){state.pending=0;state.pendingTime=0;}
    if(state.gesture!==direction){
      state.gesture=direction;
      if(state.elapsed===null&&state.cooldown<=1e-9)startRoll(state,direction);
      else if(direction!==state.direction){state.pending=direction;state.pendingTime=QUEUE_SECONDS;}
    }
    // Complete the whole revolution before the opposite one. No accelerated
    // last half-turn or restart; releasing cancels only the queued request.
    if(state.pending===direction&&state.elapsed===null&&state.cooldown<=1e-9)startRoll(state,direction);
  }
  const t=state.elapsed===null?0:Math.min(1,state.elapsed/FLIGHT_ROLL_SECONDS);
  // Native model space has the opposite sign to the legacy screen-space hull.
  return {roll:t?-state.direction*t*t*(3-2*t)*Math.PI*2:0,
    rollActive:state.elapsed!==null,rollSerial:state.serial};
}

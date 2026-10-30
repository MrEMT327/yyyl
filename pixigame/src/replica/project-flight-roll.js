// Presentation-only barrel roll. Movement and elapsed time come from immutable
// simulation snapshots; this module cannot move the player or grant a dodge.
export const FLIGHT_ROLL_SECONDS=.56;
const TRAVEL=.10,COOLDOWN=.4,QUEUE_SECONDS=.55;
export function createFlightRollState(){
  return {elapsed:null,rate:1,direction:0,cooldown:0,gesture:0,travel:0,latched:0,pending:0,pendingTime:0,serial:0};
}
export function sampleFlightRoll(state,{dt,vx,vz}){
  state.cooldown=Math.max(0,state.cooldown-dt);
  if(state.elapsed!==null){
    // A committed opposite gesture accelerates the unfinished revolution.
    // The hull stays continuous; the next bank no longer waits a full roll.
    const opposite=Math.sign(vx)===-state.direction&&Math.abs(vx)>=.55&&Math.abs(vx)>=Math.abs(vz)*1.15;
    if(opposite)state.rate=Math.min(3,Math.max(state.rate,(FLIGHT_ROLL_SECONDS-state.elapsed)/.16));
    state.elapsed+=dt*state.rate;
    if(state.elapsed>=FLIGHT_ROLL_SECONDS-1e-9)state.elapsed=null;
  }
  state.pendingTime=Math.max(0,state.pendingTime-dt);
  if(!state.pendingTime)state.pending=0;
  const horizontal=Math.abs(vx);
  const direction=horizontal>=.55&&horizontal>=Math.abs(vz)*1.15?Math.sign(vx):0;
  if(horizontal<.15){
    state.gesture=state.travel=state.latched=state.pending=0;
  }else if(!direction){
    state.travel=0;state.pending=0;
  }else{
    if(state.gesture!==direction){state.gesture=direction;state.travel=0;}
    state.travel+=Math.min(horizontal,1)*dt;
    if(state.pending&&state.pending!==direction)state.pending=0;
    if(state.latched!==direction&&state.travel>=TRAVEL-1e-9){
      state.latched=direction;
      // Finish the current revolution before playing a queued reversal.
      if(state.elapsed===null||direction!==state.direction){
        state.pending=direction;state.pendingTime=QUEUE_SECONDS;
      }
    }
    if(state.pending===direction&&state.elapsed===null&&(state.cooldown===0||direction!==state.direction)){
      state.direction=direction;state.elapsed=0;state.rate=1;state.cooldown=COOLDOWN;
      state.pending=0;state.serial++;
    }
  }
  const t=state.elapsed===null?0:Math.min(1,state.elapsed/FLIGHT_ROLL_SECONDS);
  // Match the existing banking sign: dragging right dips the right wing.
  return {roll:t?-state.direction*t*t*(3-2*t)*Math.PI*2:0,
    rollActive:state.elapsed!==null,rollSerial:state.serial};
}

// Visual observation of an emitted aircraft skill, never a combat timer.
// This first trial belongs to native 10104 (pilot-04 / Azure) and weapon 400002.
export const PASSIVE_DEPLOYMENT = Object.freeze({aircraftId:'pilot-04',weaponId:400002,open:.32,holdUntil:.9,end:1.36,burstGap:2});
const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*t*(t*(t*6-15)+10);};
export function aircraftPassiveShot(projectiles,clock){
  let latest;
  for(const shot of projectiles)if(shot.owner==='player'&&shot.weaponId===PASSIVE_DEPLOYMENT.weaponId&&Number.isFinite(shot.uid)&&Number.isFinite(shot.age)&&(!latest||shot.uid>latest.uid))latest=shot;
  return latest?{uid:latest.uid,bornAt:clock-Math.max(0,latest.age)}:undefined;
}
export function passiveDeploymentEnvelope(age){
  const p=PASSIVE_DEPLOYMENT;
  if(!Number.isFinite(age)||age<0||age>=p.end)return 0;
  if(age<p.open)return smooth(age/p.open);
  if(age<=p.holdUntil)return 1;
  return 1-smooth((age-p.holdUntil)/(p.end-p.holdUntil));
}
export function createPassiveDeploymentState(){return {runId:null,aircraftId:null,clock:null,lastUid:-1,startedAt:-Infinity,serial:0,pose:{enabled:false,active:false,progress:0,target:false,serial:0}};}
export function samplePassiveDeployment(state,{clock,runId,aircraftId,aircraftPassiveShot:shot,flight,visible=true}){
  if(!Number.isFinite(clock))return {...state.pose};
  const enabled=aircraftId===PASSIVE_DEPLOYMENT.aircraftId;
  const reset=state.clock===null||state.runId!==runId||state.aircraftId!==aircraftId||clock<state.clock;
  if(reset){state.runId=runId;state.aircraftId=aircraftId;state.lastUid=-1;state.startedAt=-Infinity;state.serial=0;state.pose={enabled,active:false,progress:0,target:false,serial:0};}
  state.clock=clock;
  if(!enabled||!visible){
    state.startedAt=-Infinity;state.lastUid=shot?.uid??state.lastUid;
    return state.pose={enabled,active:false,progress:0,target:false,serial:state.serial};
  }
  // Pause holds exactly the sampled pose. A reopened/late snapshot cannot
  // replay an old volley or advance the mechanism on wall-clock time.
  if(!flight?.active)return {...state.pose,enabled};
  if(shot&&shot.uid>state.lastUid&&Number.isFinite(shot.bornAt)){
    state.lastUid=shot.uid;
    const age=clock-shot.bornAt;
    if(age>=-1e-6&&age<=.25&&shot.bornAt-state.startedAt>PASSIVE_DEPLOYMENT.burstGap){
      state.startedAt=shot.bornAt;state.serial++;
    }
  }
  const age=clock-state.startedAt,active=age>=0&&age<PASSIVE_DEPLOYMENT.end;
  return state.pose={enabled,active,progress:passiveDeploymentEnvelope(age),target:active&&age<PASSIVE_DEPLOYMENT.holdUntil,serial:state.serial};
}

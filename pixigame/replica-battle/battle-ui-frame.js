// Native UI callbacks can advance wave/choice state and must keep their order.
// Only the read-only cloud projection is coalesced inside one simulation frame.
// Inputs and other updates outside the frame remain synchronous.
export function createBattleUiFrame(present) {
  let depth=0,pending=false,disposed=false;
  const flush=()=>{if(!disposed&&pending&&depth===0){pending=false;present();}};
  return {
    request(){if(disposed)return;pending=true;flush();},
    run(callback){if(disposed)return;depth++;try{return callback();}finally{depth--;flush();}},
    destroy(){disposed=true;pending=false;},
  };
}

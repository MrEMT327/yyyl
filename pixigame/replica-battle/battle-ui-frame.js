// Native UI callbacks can advance wave/choice state and must keep their order.
// Only the read-only cloud projection is coalesced inside one simulation frame.
// Inputs and other updates outside the frame remain synchronous.
export function createBattleUiFrame(present,{interval=0,now,canDefer}={}) {
  let depth=0,pending=false,disposed=false;
  let lastPaint=-Infinity;
  function flush(fromFrame){
    if(disposed||!pending||depth)return;
    const limit=typeof interval==='function'?interval():interval;
    if(limit>0){
      const at=now(),elapsed=at-lastPaint;
      if(fromFrame&&elapsed>=0&&elapsed<limit-1&&canDefer())return;
      lastPaint=at;
    }
    pending=false;
    present();
  }
  return {
    request(){if(disposed)return;pending=true;flush(false);},
    run(callback){if(disposed)return;depth++;try{return callback();}finally{depth--;flush(true);}},
    destroy(){disposed=true;pending=false;},
  };
}

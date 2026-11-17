// Submit the completed Phaser buffer synchronously. The screen's own RAF only
// paints when the engine has gone quiet (loading, suspension, or an error).
export function createBattleFramePresenter({paint,isActive,fallbackAfter=40}) {
  let disposed=false,lastPaint=-Infinity,lastEnginePaint=-Infinity;
  let completedFrames=0,fallbackFrames=0,quietSince=-Infinity;
  const active=()=>!disposed&&isActive();
  return {
    present(time){
      if(!active()||paint()===false)return false;
      lastPaint=lastEnginePaint=time;quietSince=-Infinity;completedFrames++;return true;
    },
    tick(time){
      if(!active()||time===lastPaint||time-lastEnginePaint<fallbackAfter)return false;
      // A delayed RAF can be followed immediately by Phaser. Wait one extra
      // screen tick after observing a quiet engine before starting fallback.
      if(completedFrames>0 && quietSince===-Infinity){quietSince=time;return false;}
      if(time===quietSince||paint()===false)return false;
      lastPaint=time;fallbackFrames++;return true;
    },
    get stats(){return {completedFrames,fallbackFrames};},
    destroy(){disposed=true;},
  };
}

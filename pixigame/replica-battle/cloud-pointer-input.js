// Keep ownership of a combat-UI gesture separate from flight controls. Losing
// browser capture/focus is a cancellation, never a deferred button click.
export function bindCloudPointerInput({surface,canvas,handlePointer,windowRef=window,documentRef=document}) {
  let ownedPointer=null,lastPoint={x:0,y:0},disposed=false;
  const release=id=>{
    try {
      if(!surface.hasPointerCapture||surface.hasPointerCapture(id))surface.releasePointerCapture?.(id);
    } catch { /* The browser may already have released an inactive pointer. */ }
  };
  const cancel=()=>{
    if(ownedPointer===null)return;
    const id=ownedPointer;ownedPointer=null;
    handlePointer({...lastPoint,phase:'cancel'});
    release(id);
  };
  const capture=event=>{
    if(disposed)return;
    const phase=({pointerdown:'start',pointermove:'move',pointerup:'end',pointercancel:'cancel'})[event.type];
    if(ownedPointer!==null&&ownedPointer!==event.pointerId)return;
    if(phase!=='start'&&ownedPointer===null)return;
    const rect=canvas.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0)){cancel();return;}
    const point={x:(event.clientX-rect.left)*600/rect.width,y:(event.clientY-rect.top)*1300/rect.height};
    lastPoint=point;
    const owned=ownedPointer!==null;
    const captured=handlePointer({...point,phase});
    if(captured||owned){
      if(event.cancelable)event.preventDefault();event.stopImmediatePropagation();
      if(phase==='start'){
        ownedPointer=event.pointerId;
        try {surface.setPointerCapture?.(event.pointerId);} catch {cancel();}
      }
      if(phase==='end'||phase==='cancel'){
        ownedPointer=null;release(event.pointerId);
      }
    }
  };
  const lost=event=>{if(event.pointerId===ownedPointer)cancel();};
  const visibility=()=>{if(documentRef.hidden)cancel();};
  const types=['pointerdown','pointermove','pointerup','pointercancel'];
  for(const type of types)surface.addEventListener(type,capture,{capture:true,passive:false});
  surface.addEventListener('lostpointercapture',lost,true);
  windowRef.addEventListener('blur',cancel);
  documentRef.addEventListener('visibilitychange',visibility);
  return {destroy(){
    if(disposed)return;
    disposed=true;cancel();
    for(const type of types)surface.removeEventListener(type,capture,true);
    surface.removeEventListener('lostpointercapture',lost,true);
    windowRef.removeEventListener('blur',cancel);
    documentRef.removeEventListener('visibilitychange',visibility);
  }};
}

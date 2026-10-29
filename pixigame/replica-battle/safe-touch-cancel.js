// Phaser 3.90 checks cancelable on start/move/end, but omits it on cancel.
// Keep the exact manager dispatch and lifecycle; replace only this handler.
const guarded=new WeakSet();
export function installSafeTouchCancel(manager) {
  const touch=manager?.touch,target=touch?.target;
  if(!target || !touch.onTouchCancel || guarded.has(touch))return false;
  target.removeEventListener('touchcancel',touch.onTouchCancel);
  touch.onTouchCancel=event=>{
    if(!event.defaultPrevented && touch.enabled && manager.enabled){
      manager.onTouchCancel(event);
      if(touch.capture && event.cancelable)event.preventDefault();
    }
  };
  target.addEventListener('touchcancel',touch.onTouchCancel,{passive:false});
  // TouchManager.stopListeners/destroy reads this property and removes it.
  guarded.add(touch);return true;
}

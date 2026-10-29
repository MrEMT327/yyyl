const attached=new WeakSet();
export function attachRecruitStripDrag(strip){
 if(!strip||attached.has(strip))return;attached.add(strip);
 let origin=null,dragged=false;
 strip.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;origin={x:event.clientX,left:strip.scrollLeft,id:event.pointerId};dragged=false;});
 strip.addEventListener('pointermove',event=>{
  if(!origin)return;const delta=event.clientX-origin.x;
  if(!dragged&&Math.abs(delta)<6)return;
  dragged=true;strip.classList.add('is-dragging');strip.setPointerCapture(origin.id);strip.scrollLeft=origin.left-delta;event.preventDefault();
 });
 const finish=()=>{origin=null;strip.classList.remove('is-dragging');};
 strip.addEventListener('pointerup',finish);strip.addEventListener('pointercancel',finish);strip.addEventListener('lostpointercapture',finish);
 strip.addEventListener('pointerleave',()=>{if(!dragged)finish();});
 strip.addEventListener('click',event=>{if(dragged){event.preventDefault();event.stopImmediatePropagation();dragged=false;}},true);
}

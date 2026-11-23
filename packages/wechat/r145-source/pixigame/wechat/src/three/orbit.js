const maxPitch=Math.PI*.42;
export function createWechatOrbit(platform,region,{onChange,onDragEnd}){
  let pitch=0,yaw=0,last=null,interacted=false;
  function cancel(){if(last){last=null;onDragEnd();}}
  const unbind=platform.bindTouches(point=>{
    if(point.phase==='start'){last=point;return;}
    if(!last||last.pointerId!==point.pointerId)return;
    if(point.phase!=='move'){cancel();return;}
    const width=Math.max(1,region.bounds().width);
    pitch=Math.min(maxPitch,Math.max(-maxPitch,pitch+(point.y-last.y)/width*Math.PI));
    yaw+=(point.x-last.x)/width*Math.PI*2;yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));
    last=point;interacted=true;onChange();
  },1,point=>region.hit({clientX:point.x,clientY:point.y}));
  return {get pitch(){return pitch;},get yaw(){return yaw;},get dragging(){return Boolean(last);},
    get interacted(){return interacted;},cancel,destroy(){unbind();cancel();}};
}


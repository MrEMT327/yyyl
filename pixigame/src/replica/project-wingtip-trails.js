import * as THREE from 'three';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const sockets=new WeakMap(),LIFETIME=.36,MAX_POINTS=20;

// Use the package's outermost authored trail sockets. Their identity stays in
// aircraft space, so the two sides never swap histories during a barrel roll.
export function projectWingtipPositions(fighter,camera,pose){
  const runtime=fighter.runtime;
  if(!pose?.visible||!runtime?.trails?.length)return [];
  fighter.object3D.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
  let selected=sockets.get(runtime);
  if(!selected){
    const anchors=runtime.trails.map(trail=>({socket:trail.socket,
      x:runtime.anchorLocal(trail.socket,new THREE.Vector3()).x})).sort((a,b)=>a.x-b.x);
    selected=anchors.length>=2?[anchors[0].socket,anchors.at(-1).socket]:[];
    sockets.set(runtime,selected);
  }
  const width=Math.max(pose.width,pose.height)*pose.scaleX;
  const height=Math.max(pose.width,pose.height)*pose.scaleY;
  return selected.map(socket=>{
    const point=runtime.anchorLocal(socket,new THREE.Vector3());
    runtime.ship.localToWorld(point);point.project(camera);
    return {x:pose.x+point.x*width/2,y:pose.y-point.y*height/2};
  });
}

export function createWingtipTrailState(){
  return {runId:null,pilotId:null,clock:null,center:null,tracks:[[],[]]};
}

// History is in camera-independent screen units. Camera panning reprojects the
// whole trail together rather than drawing an artificial streak across it.
export function sampleWingtipTrails(state,{clock,runId,pilotId,pose,tips,camera,
  pixelsPerUnit,flight,rollActive=false,thrust=0}){
  const valid=pose?.visible&&tips?.length===2&&Number.isFinite(clock)&&pixelsPerUnit>0
    &&[pose.x,pose.y,pose.width,pose.height,pose.scaleX,pose.scaleY,camera?.x,camera?.z,
      ...tips.flatMap(tip=>[tip.x,tip.y])].every(Number.isFinite);
  const clear=()=>{state.tracks[0].length=state.tracks[1].length=0;};
  if(!valid){clear();state.clock=null;state.center=null;return [];}
  const offset={x:camera.x*pixelsPerUnit,y:-camera.z*pixelsPerUnit};
  const center={x:pose.x+offset.x,y:pose.y+offset.y};
  const width=Math.max(pose.width,pose.height)*pose.scaleX;
  const dt=state.clock===null?0:clock-state.clock;
  const teleported=state.center&&Math.hypot(center.x-state.center.x,center.y-state.center.y)
    >Math.max(80,width*1.5,(flight?.speed||0)*Math.max(0,dt)*pixelsPerUnit*2);
  if(state.runId!==runId||state.pilotId!==pilotId||dt<0||dt>.25||teleported)clear();
  const advancing=state.clock===null||dt!==0;
  state.runId=runId;state.pilotId=pilotId;state.clock=clock;state.center=center;
  const strength=rollActive?.9:clamp(.24+clamp(thrust,0,1)*.72,0,.8);
  for(const [side,history]of state.tracks.entries()){
    if(advancing&&flight?.active&&(rollActive||thrust>.06)){
      const previous=history.at(-1);
      if(!previous||clock-previous.clock>=1/60-1e-9)
        history.push({clock,x:tips[side].x+offset.x,y:tips[side].y+offset.y,strength});
    }
    while(history.length>MAX_POINTS||history.length&&clock-history[0].clock>LIFETIME)history.shift();
  }
  const segments=[],maxLength=clamp(width*.7,26,54),scale=clamp(width/80,.7,1.4);
  for(const [side,history]of state.tracks.entries()){
    let length=0;
    for(let i=history.length-1;i>0&&length<maxLength;i--){
      const a=history[i],b=history[i-1],distance=Math.hypot(b.x-a.x,b.y-a.y);
      if(distance<.05)continue;
      const ratio=Math.min(1,(maxLength-length)/distance);
      const freshness=clamp(1-(clock-(a.clock+b.clock)/2)/LIFETIME,0,1);
      const taper=clamp(1-length/maxLength,0,1);
      // Concentrate the extra light in the first few pixels, not the whole wake.
      const alpha=Math.min(.9,freshness*freshness*Math.min(a.strength,b.strength)*taper*(1+.3*taper**4));
      // A narrow highlight runs from the wing towards the end of the trail.
      // Shared simulation time keeps pause/reprojection deterministic.
      const phase=((clock*2.4+side*.12)%1+1)%1;
      const glint=Math.max(0,1-Math.abs(length/maxLength-phase)/.22);
      if(alpha>.0005)segments.push({side,x1:a.x-offset.x,y1:a.y-offset.y,
        x2:a.x+(b.x-a.x)*ratio-offset.x,y2:a.y+(b.y-a.y)*ratio-offset.y,
        width:scale*(.45+.55*taper),alpha,glint:glint*glint});
      length+=distance*ratio;
    }
  }
  return segments;
}

export function drawWingtipTrails(graphics,segments){
  graphics.clear();
  // Local additive glow: soft halo, cyan body and a thin moving white core.
  // Keep the existing short history and length cap; no extra render target.
  for(const segment of segments)for(const [width,color,alpha]of [
    [segment.width*4.5,0x47baff,segment.alpha*.12],
    [segment.width*2.1,0x64ddff,segment.alpha*.4],
    [segment.width*.85,0xd4f0fb,segment.alpha*(.7+(segment.glint||0)*.1)],
  ]){
    graphics.lineStyle(width,color,alpha).beginPath();
    graphics.moveTo(segment.x1,segment.y1).lineTo(segment.x2,segment.y2).strokePath();
  }
}

// Separate foreground caps keep the emission points readable on bright hulls.
// History stays behind the fighter; these two tiny lights never move it.
export function drawWingtipHighlights(graphics,tips,{visible=true,clock=0,width=80,thrust=0,rollActive=false}={}){
  if(!graphics)return;graphics.clear();
  if(!visible||tips?.length!==2||![clock,width,...tips.flatMap(p=>[p.x,p.y])].every(Number.isFinite))return;
  const scale=clamp(Math.abs(width)/80,.65,3.5),power=rollActive?.95:clamp(.65+clamp(thrust,0,1)*.4,.65,.9);
  for(const [side,tip]of tips.entries()){
    const intensity=power*(.92+.08*Math.sin(clock*5+side*1.7));
    // Low-opacity concentric falloff avoids the old three hard disc edges.
    // Only two tiny tips use this gradient; no blur pass or extra texture.
    for(let ring=8;ring>=1;ring--){
      const t=ring/8,alpha=.12*Math.exp(-3*t*t)*intensity;
      graphics.fillStyle(0x5bc3ec,alpha).fillCircle(tip.x,tip.y,4.6*t*scale);
    }
    graphics.fillStyle(0xbcebf5,.18*intensity).fillCircle(tip.x,tip.y,.55*scale);
    graphics.fillStyle(0xe2f8ff,.14*intensity).fillCircle(tip.x,tip.y,.25*scale);
  }
}

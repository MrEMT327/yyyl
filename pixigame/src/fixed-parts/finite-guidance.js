// Finite target acquisition, with a bounded turn per physics step. Losing a
// target uses at most one reacquisition; flight age is never touched.
export function guideFiniteRocket(b, targets, height, dt=1/60, width=height*600/1300) {
 const rules=b.fixedRules;if(!rules?.tracking)return;
 const id=t=>t.fixedTargetId??t.id;
 const legal=targets.filter(t=>!t.dead&&t.y>=0&&t.y<=height&&t.x>=0&&t.x<=width);
 b.rocketGuidance ||= {targetId:null,acquired:false,retries:rules.retarget?1:0,stopped:false};
 const g=b.rocketGuidance;if(g.stopped)return;
 let target=legal.find(t=>id(t)===g.targetId);
 if(!target){
  if(g.acquired&&g.retries--<=0){g.stopped=true;return;}
  const front=legal.filter(t=>(t.x-b.x)*b.vx+(t.y-b.y)*b.vy>0);
  front.sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y));
  target=front[0];g.acquired=true;g.targetId=target?id(target):null;
  if(!target){g.stopped=true;return;}
 }
 const current=Math.atan2(b.vx,-b.vy),desired=Math.atan2(target.x-b.x,b.y-target.y);
 const delta=Math.atan2(Math.sin(desired-current),Math.cos(desired-current)),limit=Math.PI/2*dt;
 const angle=current+Math.max(-limit,Math.min(limit,delta)),speed=Math.hypot(b.vx,b.vy);
 b.vx=Math.sin(angle)*speed;b.vy=-Math.cos(angle)*speed;
}

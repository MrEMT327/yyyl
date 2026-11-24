export function easing(p,x1=.25,y1=.1,x2=.25,y2=1){
  if(p<=0||p>=1)return Math.min(1,Math.max(0,p));
  const cubic=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
  let lo=0,hi=1;
  for(let i=0;i<12;i++){const m=(lo+hi)/2;if(cubic(m,x1,x2)<p)lo=m;else hi=m;}
  return cubic((lo+hi)/2,y1,y2);
}
const base={x:0,y:0,rotation:0,scaleX:1,scaleY:1,opacity:1};
export function animateMeshes(t,meshes,cx,cy,{entered,reduced,outer,...inner}){
  if(!meshes.length||reduced)return;
  const tracks=[{cx,cy,...inner},...(outer||[])].map(({cx,cy,frames,delay=0,duration,curve,loop=false})=>({
    cx,cy,delay,duration,curve,loop,keys:frames.map(({scale=1,...k})=>({...base,scaleX:scale,scaleY:scale,...k})),pose:{...base}
  }));
  const originals=meshes.map(m=>({m,x:m.position.x,y:m.position.y,sx:m.scale.x,sy:m.scale.y,angle:m.rotation.z,opacity:m.material.opacity}));
  function paint(now){
    let moving=false;
    for(const tr of tracks){
      const phase=(now-entered-tr.delay)/tr.duration,p=Math.max(0,tr.loop?phase%1:Math.min(1,phase));
      const end=tr.keys.findIndex((k,i)=>i>0&&k.at>=p),from=tr.keys[end-1],to=tr.keys[end];
      const v=easing((p-from.at)/(to.at-from.at),...(tr.curve||[]));
      for(const key of Object.keys(base))tr.pose[key]=from[key]+(to[key]-from[key])*v;
      tr.angle=tr.pose.rotation*Math.PI/180;tr.cos=Math.cos(tr.angle);tr.sin=Math.sin(tr.angle);
      moving=moving||tr.loop||phase<1;
    }
    for(const o of originals){
      let {x,y,sx,sy,angle,opacity}=o;
      for(const tr of tracks){
        const q=tr.pose,dx=(x-tr.cx)*q.scaleX,dy=(y-tr.cy)*q.scaleY;
        x=tr.cx+dx*tr.cos-dy*tr.sin+q.x;y=tr.cy+dx*tr.sin+dy*tr.cos+q.y;
        sx*=q.scaleX;sy*=q.scaleY;angle+=tr.angle;opacity*=q.opacity;
      }
      const m=o.m;m.position.set(x,y,m.position.z);m.scale.set(sx,sy,m.scale.z);m.rotation.z=angle;m.material.opacity=opacity;
    }
    return moving;
  }
  if(paint(performance.now()/1000))t.animate(paint);
}


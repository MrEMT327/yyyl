import * as THREE from 'three';

// Small, screen-readable exhaust behind the original hull. Read only the real
// nozzle transforms; do not turn on the package's long showcase trails.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function sampleCombatEngineWake(fighter,camera,{clock,displaySize,textureSize=256,thrust=0}){
  if(!Number.isFinite(clock)||!Number.isFinite(displaySize)||displaySize<=0)return [];
  fighter.object3D.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
  const pixels=textureSize/clamp(displaySize,36,240),rows=[];
  const color=new THREE.Color(fighter.runtime.config.engineColor||'#65cfff').getHexString();
  for(const [i,jet]of fighter.runtime.jets.slice(0,6).entries()){
    const object=jet.object;if(!object.visible)continue;
    const p=object.getWorldPosition(new THREE.Vector3());
    const direction=new THREE.Vector3(...(jet.axis||[0,0,1])).transformDirection(object.matrixWorld);
    const a=p.clone().project(camera),b=p.add(direction).project(camera);
    const x=(a.x*.5+.5)*textureSize,y=(.5-a.y*.5)*textureSize;
    let dx=b.x-a.x,dy=a.y-b.y;const norm=Math.hypot(dx,dy);
    if(![x,y,norm].every(Number.isFinite)||norm<1e-7||x<3||y<3||x>textureSize-3||y>textureSize-3)continue;
    dx/=norm;dy/=norm;
    const beat=.8+.2*Math.sin(clock*13+i*2.3),width=1.9*pixels;
    // Reserve the full tapered trail within the existing capture rectangle.
    const margin=width+2,roomX=Math.abs(dx)<1e-6?Infinity:Math.max(0,(dx>0?textureSize-margin-x:x-margin)/Math.abs(dx));
    const roomY=Math.abs(dy)<1e-6?Infinity:Math.max(0,(dy>0?textureSize-margin-y:y-margin)/Math.abs(dy));
    const length=Math.min((15+clamp(thrust,0,1)*4)*pixels*beat,roomX,roomY);
    if(length<pixels)continue;
    rows.push({x,y,dx,dy,width,length,color,phase:clock*3.7+i*.47,pixels});
  }
  return rows;
}
export function drawCombatEngineWake(ctx,rows){
  ctx.save();ctx.globalCompositeOperation='lighter';
  for(const r of rows){
    ctx.save();ctx.translate(r.x,r.y);ctx.rotate(Math.atan2(r.dy,r.dx)-Math.PI/2);
    for(const [width,length,alpha,color]of [[r.width,r.length,.30,'#'+r.color],[r.width*.48,r.length*.76,.48,'#'+r.color],[r.width*.20,r.length*.45,.76,'#e5fbff']]){
      const g=ctx.createLinearGradient(0,0,0,length);g.addColorStop(0,color);g.addColorStop(1,'transparent');
      ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(-width,0);
      ctx.quadraticCurveTo(-width*.55,length*.6,0,length);ctx.quadraticCurveTo(width*.55,length*.6,width,0);ctx.closePath();ctx.fill();
    }
    for(let k=0;k<2;k++){
      const t=((r.phase+k*.5)%1+1)%1,side=(k?1:-1)*r.width*.62;
      ctx.globalAlpha=.48*Math.sin(Math.PI*t);ctx.fillStyle='#d8f7ff';ctx.beginPath();
      ctx.ellipse(side,r.length*(.2+t*.7),r.pixels*.36*(1-t*.5),r.pixels*.65,0,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  ctx.restore();
}

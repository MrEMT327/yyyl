import * as THREE from 'three';

// Small, screen-readable exhaust behind the original hull. Read only the real
// nozzle transforms; do not turn on the package's long showcase trails.
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function sampleCombatEngineWake(fighter,camera,{clock,displaySize,textureSize=256,thrust=0,matricesReady=false}){
  if(!Number.isFinite(clock)||!Number.isFinite(displaySize)||displaySize<=0)return [];
  if(!matricesReady){
    fighter.object3D.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
  }
  const pixels=textureSize/clamp(displaySize,36,240),rows=[];
  const color=new THREE.Color(fighter.runtime.config.engineColor||'#65cfff').getHexString();
  const position=new THREE.Vector3(),direction=new THREE.Vector3(),start=new THREE.Vector3();
  const jets=fighter.runtime.jets;
  for(let i=0;i<Math.min(jets.length,6);i++){
    const jet=jets[i];
    const object=jet.object;if(!object.visible)continue;
    position.setFromMatrixPosition(object.matrixWorld);
    direction.set(...(jet.axis||[0,0,1])).transformDirection(object.matrixWorld);
    const a=start.copy(position).project(camera),b=position.add(direction).project(camera);
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

// Bound the rotated paths/ellipses, including antialiasing. The wake still uses
// the authored additive blend, but only this patch needs to be composited.
export function combatEngineWakeBounds(rows,size){
  if(!rows.length)return null;
  let left=size,top=size,right=0,bottom=0;
  for(const {x,y,dx,dy,width,length,pixels} of rows){
    const margin=Math.max(width,width*.62+pixels*.65)+2;
    left=Math.min(left,x+Math.min(0,dx*length)-margin);
    top=Math.min(top,y+Math.min(0,dy*length)-margin);
    right=Math.max(right,x+Math.max(0,dx*length)+margin);
    bottom=Math.max(bottom,y+Math.max(0,dy*length)+margin);
  }
  left=Math.max(0,Math.floor(left));top=Math.max(0,Math.floor(top));
  return {x:left,y:top,width:Math.min(size,Math.ceil(right))-left,height:Math.min(size,Math.ceil(bottom))-top};
}

// Compose only the tail patch. The original alpha and drawing commands stay
// the same as the CPU snapshot so the tail is always beneath the aircraft.
export function createCombatWakeLayer(createCanvas) {
  const canvas = createCanvas('2d');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建飞机尾焰纹理');
  return {
    paint(target, rows, {x, y, width, height}) {
      if (canvas.width < width) canvas.width = width;
      if (canvas.height < height) canvas.height = height;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.save();
      try {
        context.beginPath();
        context.rect(0, 0, width, height);
        context.clip();
        context.translate(-x, -y);
        drawCombatEngineWake(context, rows);
      } finally { context.restore(); }
      target.save();
      try {
        target.globalCompositeOperation = 'destination-over';
        target.drawImage(canvas, 0, 0, width, height, x, y, width, height);
      } finally { target.restore(); }
    },
    dispose() { canvas.width = canvas.height = 0; },
  };
}

export function warningPhase(elapsed,duration) {
  const progress=Math.max(0,Math.min(1,elapsed/Math.max(.01,duration)));
  return {progress,urgent:progress>=.72,alpha:.62+.38*progress};
}
export function edgeThreats(threats, width=600,height=1300) {
  const result=[],sides=new Set();
  for(const p of threats){
    if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
    if(p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height)continue;
    const dx=p.x-width/2,dy=p.y-height/2;
    const tx=dx?width/2/Math.abs(dx):Infinity,ty=dy?height/2/Math.abs(dy):Infinity;
    const side=tx<ty?(dx<0?'left':'right'):(dy<0?'top':'bottom');
    if(sides.has(side))continue;sides.add(side);
    const t=Math.min(tx,ty);
    result.push({x:Math.max(18,Math.min(width-18,width/2+dx*t)),y:Math.max(170,Math.min(height-200,height/2+dy*t)),angle:Math.atan2(dy,dx),side});
    if(result.length===2)break;
  }
  return result;
}

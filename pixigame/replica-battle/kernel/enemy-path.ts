/** Original MonsterMoveOnPath / BezierCurve semantics, from static ARM64.
 * Segment lengths allocate time; time inside a segment is its Bezier parameter.
 * This intentionally does not reparameterize each curve to constant arc speed.
 */
export interface EnemyPathPoint { x:number; z:number; y?:number }
export interface EnemyPathNode { position:EnemyPathPoint; handle1:EnemyPathPoint; handle2:EnemyPathPoint }
export interface EnemyPathSource { points:EnemyPathNode[]; closed?:boolean; resolution?:number }
interface Segment { from:EnemyPathNode; to:EnemyPathNode; length:number }
export interface NativeEnemyPath { root:EnemyPathPoint; segments:Segment[]; length:number }

/** MonsterMoveOnPath snapshots speed in OnStart, but advances its timer by
 * currentMoveSpeed / the raw Character_entity.MoveSpeed on every update.
 * These factors only cancel when the task began at its unmodified speed. */
export function nativePathDistanceDelta(speedAtStart:number,currentSpeed:number,rawConfigSpeed:number,dt:number):number {
  return rawConfigSpeed === 0 ? 0 : speedAtStart * (currentSpeed / rawConfigSpeed) * dt;
}
const zero=(p:EnemyPathPoint)=>p.x===0&&(p.y||0)===0&&p.z===0;
const add=(a:EnemyPathPoint,b:EnemyPathPoint):EnemyPathPoint=>({x:a.x+b.x,y:(a.y||0)+(b.y||0),z:a.z+b.z});
function pointAt(a:EnemyPathNode,b:EnemyPathNode,t:number):EnemyPathPoint {
  const p=a.position,q=b.position,u=1-t;
  const left=!zero(a.handle2),right=!zero(b.handle1);
  const c=add(p,a.handle2),d=add(q,b.handle1);
  const component=(key:'x'|'y'|'z')=>{
    const p0=p[key]||0,p3=q[key]||0;
    if(!left&&!right)return p0*u+p3*t;
    if(!left||!right){const p1=(left?c:d)[key]||0;return u*u*p0+2*u*t*p1+t*t*p3;}
    return u*u*u*p0+3*u*u*t*(c[key]||0)+3*u*t*t*(d[key]||0)+t*t*t*p3;
  };
  return {x:component('x'),y:component('y'),z:component('z')};
}
export function createNativeEnemyPath(source:EnemyPathSource):NativeEnemyPath {
  const nodes=source.points||[],segments:Segment[]=[];
  const count=source.closed&&nodes.length>2?nodes.length:Math.max(0,nodes.length-1);
  const resolution=source.resolution&&source.resolution>0?Math.trunc(source.resolution):10;
  for(let i=0;i<count;i++){
    const from=nodes[i],to=nodes[(i+1)%nodes.length];let previous=from.position,length=0;
    for(let j=1;j<=resolution;j++){
      const current=pointAt(from,to,j/resolution);
      length+=Math.hypot(current.x-previous.x,(current.y||0)-(previous.y||0),current.z-previous.z);previous=current;
    }
    segments.push({from,to,length});
  }
  return {root:nodes[0]?.position||{x:0,z:0},segments,length:segments.reduce((sum,s)=>sum+s.length,0)};
}
/** distance = elapsed * movementSpeed * speedScale (with any original speed ratio). */
export function sampleNativeEnemyPath(path:NativeEnemyPath,origin:EnemyPathPoint,distance:number):EnemyPathPoint {
  let remaining=Math.max(0,Math.min(path.length,distance));
  let point=path.root;
  for(const segment of path.segments){
    if(segment.length<=0)continue;
    point=pointAt(segment.from,segment.to,Math.min(1,remaining/segment.length));
    if(remaining<=segment.length)break;
    remaining-=segment.length;
  }
  return {x:origin.x+point.x-path.root.x,y:(origin.y||0)+(point.y||0)-(path.root.y||0),z:origin.z+point.z-path.root.z};
}
/** Native LookRotationDir uses this tick's actual displacement, not analytic tangent. */
export function nativePathMovementAngle(previous:EnemyPathPoint,next:EnemyPathPoint,fallback:number):number {
  const dx=next.x-previous.x,dz=next.z-previous.z;
  return dx||dz?Math.atan2(dx,dz):fallback;
}
/** EntityCharacter.GetLoopMoveRestartPos. radius is ShapeRadius, not ShapeRadius2. */
export function nativePathRestartPosition(inMapOrigin:EnemyPathPoint,cameraTop:number,shapeRadius:number,loopRestartZOffset:number):EnemyPathPoint {
  return {x:inMapOrigin.x,y:inMapOrigin.y||0,z:cameraTop+shapeRadius+loopRestartZOffset};
}

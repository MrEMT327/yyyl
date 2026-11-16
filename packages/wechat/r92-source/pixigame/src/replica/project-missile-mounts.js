import * as THREE from 'three';

const points=new WeakMap();
// Use the airframe's solid bounds rather than exhaust sockets, which can sit
// close to the fuselage. Keep the two rails slightly inboard of the wing edges.
export function projectMissileWingMounts(fighter,camera,pose){
  const runtime=fighter?.runtime,bounds=runtime?.modelBounds;
  if(!pose?.visible||!bounds||!runtime.ship)return [];
  const width=Math.max(pose.width,pose.height)*pose.scaleX;
  const height=Math.max(pose.width,pose.height)*pose.scaleY;
  if(!(width>0&&height>0)||![pose.x,pose.y,width,height,...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite))return [];
  let pair=points.get(runtime);if(!pair){pair=[new THREE.Vector3(),new THREE.Vector3()];points.set(runtime,pair);}
  const x=(bounds.min.x+bounds.max.x)/2,y=(bounds.min.y+bounds.max.y)/2,z=(bounds.min.z+bounds.max.z)/2;
  const half=(bounds.max.x-bounds.min.x)*.41;
  if(!(half>0))return [];
  fighter.object3D.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
  pair[0].set(x-half,y,z);pair[1].set(x+half,y,z);
  for(const point of pair){runtime.ship.localToWorld(point);point.project(camera);}
  const left=pose.x+Math.min(pair[0].x,pair[1].x)*width/2;
  const right=pose.x+Math.max(pair[0].x,pair[1].x)*width/2;
  const railY=pose.y-(pair[0].y+pair[1].y)*height/4;
  return [{x:left,y:railY},{x:right,y:railY}];
}

import {VfxMeshBuffer,boundsVisible} from './vfx-buffers.mjs';

// The live collision capsule supplies the radius and every reflection endpoint.
// This quiet, non-emissive envelope never participates in collision or damage.
const ARCS=6,POINTS=(ARCS+1)*2,MAX_SEGMENTS=32;
function palette(b){
 if(b.familyId===200171&&b.modelId===221001)return[.96,.52,.18];
 if(b.familyId===200121&&b.modelId===220009)return[.18,.64,1];
 if(b.weaponId===200067&&b.modelId===220010)return[.24,.82,.28];
 return null;
}
export class BeamFootprints{
 constructor(material,flowMaterial=material){
  this.buffer=new VfxMeshBuffer('beam-footprint',material,0,2048);
  this.flow=new VfxMeshBuffer('beam-flow',flowMaterial,0,128);this.flowPoints=Array.from({length:4},()=>({x:0,y:0}));
  this.points=Array.from({length:POINTS*2},()=>({x:0,y:0}));this.beginFrame();
 }
 beginFrame(viewport){this.viewport=viewport;this.segments=0;this.buffer.reset();this.flow.reset();}
 projectile(b,screen){
  const color=palette(b),radius=b.radiusX;
  if(!color||b.owner!=='player'||!b.beam||b.dead||b.visualHidden||b.collisionDisabled||b.damageDisabled||
    !Number.isFinite(b.age)||!Number.isFinite(b.warmup??0)||b.age<Math.max(0,b.warmup??0)||!Number.isFinite(radius)||radius<=0)return;
  let distance=0;const phase=(b.age-Math.max(0,b.warmup??0))*.65;
  const seed=((Math.imul((b.uid??0)|0,1664525)>>>0)%1024)/1024;
  for(const segment of b.segments||[]){
   if(this.segments>=MAX_SEGMENTS)break;
   const a=segment.from,z=segment.to;if(!a||!z||![a.x,a.z,z.x,z.z].every(Number.isFinite))continue;
   const dx=z.x-a.x,dz=z.z-a.z,length=Math.hypot(dx,dz);if(length<1e-6)continue;
   const startDistance=distance;distance+=length;
   const angle=Math.atan2(dz,dx);let finite=true,left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
   for(let end=0;end<2;end++)for(let j=0;j<=ARCS;j++){
    const center=end?a:z,turn=angle+Math.PI/2-end*Math.PI-j*Math.PI/ARCS,index=end*(ARCS+1)+j;
    for(let ring=0;ring<2;ring++){
     const r=radius*(ring?.86:1),p=screen(center.x+Math.cos(turn)*r,center.z+Math.sin(turn)*r),out=this.points[index+ring*POINTS];
     out.x=p.x;out.y=p.y;finite&&=Number.isFinite(p.x)&&Number.isFinite(p.y);
     if(!ring){left=Math.min(left,p.x);right=Math.max(right,p.x);top=Math.min(top,p.y);bottom=Math.max(bottom,p.y);}
    }
   }
   if(!finite||!boundsVisible(left,top,right,bottom,this.viewport))continue;
   const center=screen((a.x+z.x)/2,(a.z+z.z)/2);if(!Number.isFinite(center.x+center.y))continue;
   const start=this.buffer.mesh.vertices.length;
   for(let i=0;i<POINTS*2;i++){const p=this.points[i];this.buffer.vertex(p.x,p.y,.5,.5,...color,i<POINTS?.10:.035);}
   const middle=this.buffer.vertex(center.x,center.y,.5,.5,...color,.018),indices=this.buffer.mesh.indices;
   for(let i=0;i<POINTS;i++){
    const next=(i+1)%POINTS,outer=start+i,outerNext=start+next,inner=outer+POINTS,innerNext=outerNext+POINTS;
    indices.push(outer,outerNext,innerNext,outer,innerNext,inner,middle,inner,innerNext);
   }
   // A narrow live ribbon stays inside the existing collision radius. UV distance
   // continues through reflections, including segments outside the viewport.
   const width=Math.min(radius*.8,.38),nx=-dz/length,nz=dx/length;
   for(let i=0;i<4;i++){
    const end=i>=2,side=i===1||i===2?1:-1,at=end?z:a,p=screen(at.x+nx*width*side,at.z+nz*width*side),out=this.flowPoints[i];out.x=p.x;out.y=p.y;
   }
   const flowStart=this.flow.mesh.vertices.length;
   for(let i=0;i<4;i++){const p=this.flowPoints[i],end=i>=2;this.flow.vertex(p.x,p.y,i===1||i===2?1:0,(startDistance+(end?length:0))*.085-phase+seed,...color,Math.min(1,Math.max(0,(b.age-(b.warmup??0))/.06)));}
   this.flow.mesh.indices.push(flowStart,flowStart+1,flowStart+2,flowStart,flowStart+2,flowStart+3);
   this.segments++;
  }
 }
 draw(view){if(this.buffer.mesh.indices.length)view.drawMeshes('combat-feedback:beam-footprint',[this.buffer.mesh],undefined,{presentationDepth:31.8});if(this.flow.mesh.indices.length)view.drawMeshes('combat-feedback:beam-flow',[this.flow.mesh],undefined,{presentationDepth:32.1});}
 reset(){this.beginFrame(this.viewport);this.buffer.records.length=0;this.flow.records.length=0;}
}

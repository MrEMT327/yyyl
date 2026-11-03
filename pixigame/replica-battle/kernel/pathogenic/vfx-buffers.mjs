// Per-renderer scratch. Active arrays keep the old mesh contract; retained
// records are private, bounded and never reused by another live batch.
export class VfxMeshBuffer{
 constructor(key,material,z=2,retain=4096){this.mesh={key,z,material:{$ref:material},vertices:[],indices:[],count:0};this.records=[];this.retain=retain;this.createdVertices=0;}
 reset(){this.mesh.vertices.length=0;this.mesh.indices.length=0;this.mesh.count=0;}
 vertex(x,y,u,v,r,g,b,a){const i=this.mesh.vertices.length;let record=this.records[i];
  if(!record){record={position:[0,0],uv:[0,0],color:[0,0,0,0]};this.createdVertices++;if(i<this.retain)this.records[i]=record;}
  record.position[0]=x;record.position[1]=y;record.uv[0]=u;record.uv[1]=v;record.color[0]=r;record.color[1]=g;record.color[2]=b;record.color[3]=a;this.mesh.vertices.push(record);return i;
 }
 quad(points,r,g,b,a){const m=this.mesh,start=m.vertices.length;for(let i=0;i<4;i++)this.vertex(points[i].x,points[i].y,i===1||i===2?1:0,i>=2?1:0,r,g,b,a);m.indices.push(start,start+1,start+2,start,start+2,start+3);}
}
export class VfxMeshCache{
 constructor(){this.entries=new Map();this.revision=0;}
 beginFrame(){this.revision++;}
 get(id){let entry=this.entries.get(id);if(!entry){entry={buffers:new Map(),revision:this.revision};this.entries.set(id,entry);}entry.revision=this.revision;return entry.buffers;}
 endFrame(){for(const [id,entry]of this.entries)if(entry.revision!==this.revision)this.entries.delete(id);}
 reset(){this.entries.clear();}
}
export function boundsVisible(left,top,right,bottom,viewport){
 if(!viewport||!(viewport.width>0)||!(viewport.height>0)||!Number.isFinite(viewport.width+viewport.height))return true;
 if(!Number.isFinite(left+top+right+bottom))return true;
 const padding=viewport.padding??128;return right>=-padding&&bottom>=-padding&&left<=viewport.width+padding&&top<=viewport.height+padding;
}
export function quadVisible(points,viewport){return boundsVisible(Math.min(points[0].x,points[1].x,points[2].x,points[3].x),Math.min(points[0].y,points[1].y,points[2].y,points[3].y),Math.max(points[0].x,points[1].x,points[2].x,points[3].x),Math.max(points[0].y,points[1].y,points[2].y,points[3].y),viewport);}
// Explicit 24-bit fixed-point storage survives Phaser's packed vertex color.
export function packedScalar(value,range,out){const n=Math.round(Math.max(0,Math.min(1,value/range))*16777215);out[0]=(n>>>16)/255;out[1]=((n>>>8)&255)/255;out[2]=(n&255)/255;return out;}

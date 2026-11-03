// Retain only a bounded peak topology. Phaser expands indexed geometry into
// independent triangle vertices; restoring a shorter active prefix is safe.
const topologyPool=new WeakMap();
export const MAX_RETAINED_SOURCE_VERTICES=8192;
function restoreTopology(view,count){const pool=topologyPool.get(view);if(!pool||count>pool.vertices.length||!Array.isArray(view.faces)||count%3)return false;
 const oldV=view.vertices.length,oldF=view.faces.length;view.vertices.length=count;view.faces.length=count/3;
 for(let i=oldV;i<count;i++)view.vertices[i]=pool.vertices[i];for(let i=0;i<count/3;i++)view.faces[i]=pool.faces[i];
 if(view.dirtyCache)view.dirtyCache[9]=-1;return true;
}
function retainTopology(view,count){if(Array.isArray(view.faces)&&view.faces.length===count/3&&count<=MAX_RETAINED_SOURCE_VERTICES)topologyPool.set(view,{vertices:view.vertices.slice(),faces:view.faces.slice()});else topologyPool.delete(view);}
const channel=(v,gain)=>Math.round(Math.max(0,Math.min(1,v/gain))*255);
const colorOf=(v,gain)=>(channel(v[0],gain)<<16)|(channel(v[1],gain)<<8)|channel(v[2],gain);
// Phaser expands indexed points into view.vertices. Reuse those vertices;
// flat UV/position/color buffers are only needed when topology changes.
export function updateSourceMeshGeometry(view,geometry,source,line=false) {
  const points=geometry.vertices,indices=geometry.indices;
  let gain=1;
  if(line)for(const point of points)gain=Math.max(gain,point.color[0],point.color[1],point.color[2]);
  if(view.vertices.length!==indices.length&&!restoreTopology(view,indices.length)) {
    const positions=new Array(points.length*2),uvs=new Array(points.length*2),colors=new Array(points.length);
    for(let i=0;i<points.length;i++) {
      const v=points[i],j=i*2;positions[j]=v.position[0];positions[j+1]=-v.position[1];
      uvs[j]=line?v.uv[0]:v.uv[0]/source.width;uvs[j+1]=line?v.uv[1]:v.uv[1]/source.height;
      colors[i]=line?colorOf(v.color,gain):0xffffff;
    }
    view.clear();view.addVertices(positions,uvs,indices,false,undefined,colors);retainTopology(view,indices.length);
  }
  for(let i=0;i<indices.length;i++) {
    const point=points[indices[i]],v=view.vertices[i];
    v.x=point.position[0];v.y=-point.position[1];
    v.setUVs(line?point.uv[0]:point.uv[0]/source.width,line?point.uv[1]:point.uv[1]/source.height);
    v.color=line?colorOf(point.color,gain):0xffffff;v.alpha=line?point.color[3]:1;
  }
  return gain;
}

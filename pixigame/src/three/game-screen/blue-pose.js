function blendRigidArtwork(part,start,end,weight,out){
  const rest=part.rest,pivot=part.rigidPivotRest;
  const restAngle=Math.atan2(rest[3]-rest[1],rest[2]-rest[0]);
  const a=Math.atan2(start[3]-start[1],start[2]-start[0])-restAngle;
  const b=Math.atan2(end[3]-end[1],end[2]-end[0])-restAngle;
  const angle=a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*weight;
  const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),c=Math.cos(angle),s=Math.sin(angle);
  const rx=pivot[0]-rest[0],ry=pivot[1]-rest[1];
  const ax=start[0]+ca*rx-sa*ry,ay=start[1]+sa*rx+ca*ry;
  const bx=end[0]+cb*rx-sb*ry,by=end[1]+sb*rx+cb*ry;
  const px=ax+(bx-ax)*weight,py=ay+(by-ay)*weight;
  for(let i=0;i<out.length;i+=2){
    const x=rest[i]-pivot[0],y=rest[i+1]-pivot[1];
    out[i]=px+c*x-s*y;out[i+1]=py+s*x+c*y;
    if(part.deformingArtwork){
      out[i]+=(start[i]-(ax+ca*x-sa*y))*(1-weight)+(end[i]-(bx+cb*x-sb*y))*weight;
      out[i+1]+=(start[i+1]-(ay+sa*x+ca*y))*(1-weight)+(end[i+1]-(by+sb*x+cb*y))*weight;
    }
  }
}

function projectCannon(part,pose){
  const [angle,tilt,jx,jy]=pose,c=Math.cos(angle),s=Math.sin(angle),q=Math.cos(tilt),t=Math.sin(tilt);
  const {vertices3d,normals3d,indices}=part.projectionModel,out=part.pose,cache=part.projection;
  for(let i=0;i<vertices3d.length;i++){
    const [x,y,z]=vertices3d[i],n=normals3d[i];
    out[2*i]=jx+c*q*x-s*y-c*t*z;out[2*i+1]=jy+s*q*x+c*y-s*t*z;
    cache.depth[i]=t*x+q*z;cache.normalZ[i]=t*n[0]+q*n[2];
  }
  cache.visible.length=0;
  for(let i=0;i<indices.length;i++){
    const [a,b,c]=indices[i];
    if(cache.normalZ[a]+cache.normalZ[b]+cache.normalZ[c]<=0)continue;
    cache.weight[i]=cache.depth[a]+cache.depth[b]+cache.depth[c];cache.visible.push(i);
  }
  cache.visible.sort((a,b)=>cache.weight[a]-cache.weight[b]);
  let count=0;
  for(const i of cache.visible){const tri=indices[i];cache.indices[count++]=tri[0];cache.indices[count++]=tri[1];cache.indices[count++]=tri[2];}
  cache.count=count;
}

export function createBluePose(parts,bundle){
  for(const p of parts){
    p.pose=new Float32Array(p.rest.length);p.alpha=0;
    if(!p.projectionModel)continue;
    const {vertices3d,indices}=p.projectionModel;
    p.projection={depth:new Float64Array(vertices3d.length),normalZ:new Float64Array(vertices3d.length),
      weight:new Float64Array(indices.length),indices:new Uint16Array(indices.length*3),visible:[],count:0};
  }
  return {
    update(key,frame,blend){
      const f=Math.max(0,Math.min(frame,(key==='idle'?bundle.idleFrames:bundle.frames)-1));
      for(const p of parts){
        p.orderNow=p.orders?.[key==='rest'?'main3':key]?.[frame]??p.order??500;
        const opacity=key==='rest'?((p.generatedMaterial&&!p.rigidArtwork)||p.phaseOnly?0:1):p.opacities?.[key]?.[frame]??1;
        p.eye=key==='rest'?0:p.opacityTracks?.[key]?.[f]??0;
        p.alpha=opacity*(p.opacityTracks?Math.min(1,p.eye/.16):1);
        if(p.alpha<1e-6)continue;
        const prior=blend?.from.get(p.name);
        if(p.projectionModel){
          const next=key==='rest'?p.projectionPoseRest:p.projectionPoses[key][f];
          const previous=prior?._rigidPose;
          p.rigidPose=previous?next.map((v,i)=>previous[i]+blend.weight*(i===0?Math.atan2(Math.sin(v-previous[i]),Math.cos(v-previous[i])):v-previous[i])):next;
          projectCannon(p,p.rigidPose);continue;
        }
        const n=p.pose.length,src=key==='rest'?p.rest:p.streams[key].subarray(f*n,(f+1)*n);
        if(!prior){p.pose.set(src);continue;}
        if(p.rigidArtwork){blendRigidArtwork(p,prior,src,blend.weight,p.pose);continue;}
        for(let i=0;i<n;i++)p.pose[i]=prior[i]+(src[i]-prior[i])*blend.weight;
      }
    },
    snapshot(){
      const out=new Map();
      for(const p of parts)if(p.alpha>=1e-6){
        const pose=new Float32Array(p.pose);
        if(p.rigidPose)pose._rigidPose=[...p.rigidPose];
        out.set(p.name,pose);
      }
      return out;
    }
  };
}


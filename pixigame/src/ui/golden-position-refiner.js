// Fixed rest-space local corrections transported by the current body/arm frame.
// Shared pieces receive the same field, preserving their material joins.
export function createGoldenPositionRefiner(manifest) {
  const config=manifest.geometryRefinement;if(!config?.enabled)return null;
  const rest=new Float32Array(manifest.positionFloatCount);
  for(const mesh of manifest.meshes)rest.set(mesh.vertices,mesh.stateOffset);
  const baseline=config.referencePose?new Float32Array(config.referencePose):rest;
  const sample=(positions,anchor)=>{
    let x=0,y=0;for(let i=0;i<3;i++){const at=anchor.indices[i],w=anchor.weights[i];x+=positions[at]*w;y+=positions[at+1]*w;}return [x,y];
  };
  const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
  const fields=config.fields.map(field=>{
    const entries=[];
    for(const mesh of manifest.meshes){
      if(!field.meshes.includes(mesh.id)||(field.driverMesh&&mesh.id!==field.driverMesh))continue;
      for(let i=0;i<mesh.vertices.length;i+=2){
        const at=mesh.stateOffset+i,x=rest[at],y=rest[at+1];
        const nx=(x-field.center[0])/field.radius[0],ny=(y-field.center[1])/field.radius[1],support=1-nx*nx-ny*ny;
        if(support<=0)continue;
        let weight=support*support*support;
        if(field.lowerFade)weight*=1-smooth((y-field.lowerFade.start)/(field.lowerFade.end-field.lowerFade.start));
        if(field.guard){const distance=Math.hypot(x-field.guard.center[0],y-field.guard.center[1]);weight*=smooth((distance-field.guard.inner)/(field.guard.outer-field.guard.inner));}
        if(weight>1e-9){
          if(field.kind==='compress'){
            // Thin only the lower forearm around the original upper contour.
            // The same artwork-space displacement is used on every contact piece.
            const [nx,ny]=field.normal,distance=Math.max(0,(x-field.origin[0])*nx+(y-field.origin[1])*ny);
            const amount=Math.min(field.maxDisplacement,distance*field.strength*weight);
            if(amount>1e-9)entries.push([at,-nx*amount,-ny*amount]);
          }else entries.push(field.kind==='stabilize'?[at,weight,baseline[at],baseline[at+1]]:[at,weight*field.displacement[0],weight*field.displacement[1]]);
        }
      }
    }
    const reference=field.anchors.map(anchor=>sample(field.kind==='stabilize'?baseline:rest,anchor));
    return {...field,entries,reference};
  });
  function matrix(positions,field){
    const r=field.reference,c=field.anchors.map(anchor=>sample(positions,anchor));
    const ux=r[1][0]-r[0][0],uy=r[1][1]-r[0][1],cx=c[1][0]-c[0][0],cy=c[1][1]-c[0][1];
    if(field.transport==='rotation'){
      const denominator=Math.hypot(ux,uy)*Math.hypot(cx,cy);if(denominator<1e-8)return [1,0,0,1,0,0];
      const cosine=(ux*cx+uy*cy)/denominator,sine=(ux*cy-uy*cx)/denominator;
      return [cosine,-sine,sine,cosine,0,0];
    }
    const vx=r[2][0]-r[0][0],vy=r[2][1]-r[0][1],dx=c[2][0]-c[0][0],dy=c[2][1]-c[0][1],det=ux*vy-uy*vx;
    if(Math.abs(det)<1e-8)throw new Error('局部修形参考退化');
    const a=(cx*vy-dx*uy)/det,b=(-cx*vx+dx*ux)/det,e=(cy*vy-dy*uy)/det,f=(-cy*vx+dy*ux)/det;
    return [a,b,e,f,c[0][0]-a*r[0][0]-b*r[0][1],c[0][1]-e*r[0][0]-f*r[0][1]];
  }
  return {
    apply(positions){
      // Evaluate all transports before changing any shared vertex.
      const transforms=fields.map(field=>matrix(positions,field));
      fields.forEach((field,i)=>{
        const [a,b,c,d,tx,ty]=transforms[i];
        if(field.kind==='stabilize'){
          const displacements=new Map();
          for(const [at,weight,x,y] of field.entries){
            let dx=(a*x+b*y+tx-positions[at])*weight*field.strength,dy=(c*x+d*y+ty-positions[at+1])*weight*field.strength;
            const magnitude=Math.hypot(dx,dy),limit=field.maxDisplacement??2;
            if(magnitude>limit){dx*=limit/magnitude;dy*=limit/magnitude;}
            const oldX=positions[at],oldY=positions[at+1];positions[at]+=dx;positions[at+1]+=dy;displacements.set(at,[positions[at]-oldX,positions[at+1]-oldY]);
          }
          for(const follower of field.followers||[]){let dx=0,dy=0;for(let k=0;k<3;k++){const delta=displacements.get(follower.drivers[k]);if(delta){dx+=delta[0]*follower.weights[k];dy+=delta[1]*follower.weights[k];}}positions[follower.at]+=dx;positions[follower.at+1]+=dy;}
        }else for(const [at,x,y] of field.entries){positions[at]+=a*x+b*y;positions[at+1]+=c*x+d*y;}
      });
    },
    get fields(){return fields;},
    get affectedIndices(){return [...new Set(fields.flatMap(field=>[...field.entries.map(e=>e[0]),...(field.followers||[]).map(f=>f.at)]))];},
  };
}

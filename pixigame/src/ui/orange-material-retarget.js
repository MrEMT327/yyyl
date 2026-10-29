const transform=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[2],m[3]*p[0]+m[4]*p[1]+m[5]];
const vector=(m,p)=>[m[0]*p[0]+m[1]*p[1],m[3]*p[0]+m[4]*p[1]];

// Reference geometry stays in its original coordinate system until this final
// material-space pass. Each new painted island keeps its authored rest shape.
export function createOrangeMaterialRetarget(manifest){
 const layers=manifest.layers,groups=manifest.materialGroups,offsets=[];let count=0;
 for(const l of layers){offsets.push(count);count+=l.vertices.length;}
 const byId=new Map(layers.map((l,i)=>[l.id,i]));
 const read=(positions,spec)=>{const o=offsets[byId.get(spec.layer)],out=[0,0];spec.vertices.forEach((v,i)=>{out[0]+=positions[o+v*2]*spec.weights[i];out[1]+=positions[o+v*2+1]*spec.weights[i];});return out;};
 const restManifest={...manifest,layers:layers.map(l=>({...l,vertices:l.vertices.flatMap((v,i)=>i%2?[]:transform(groups[l.materialGroup].matrix,[v,l.vertices[i+1]]))}))};
 function apply(positions,{sampleSurface,activeHand,time,jointPositions}){
  const deltas=new Map();
  const delta=name=>{
   if(deltas.has(name))return deltas.get(name);
   const g=groups[name],a=g.anchor;let d=[0,0];
   if(a){const parent=groups[g.parent],pd=delta(g.parent),p=sampleSurface(a.parent),q=sampleSurface(a.own),pm=vector(parent.matrix,[p[0]-a.parentRest[0],p[1]-a.parentRest[1]]),qm=vector(g.matrix,[q[0]-a.ownRest[0],q[1]-a.ownRest[1]]);d=[pd[0]+pm[0]-qm[0],pd[1]+pm[1]-qm[1]];}
   deltas.set(name,d);return d;
  };
  const map=(group,p)=>{const q=transform(groups[group].matrix,p),d=delta(group);return[q[0]+d[0],q[1]+d[1]];};
  for(let j=0;j<layers.length;j++){const l=layers[j],o=offsets[j];for(let v=0;v<l.vertices.length;v+=2){const p=map(l.materialGroup,[positions[o+v],positions[o+v+1]]);positions[o+v]=p[0];positions[o+v+1]=p[1];}}
  let torsoPoint=null;
  if(manifest.materialUpperBody){
   const a=transform(groups.body.matrix,manifest.joints.hip.targetRest),b=transform(groups.body.matrix,manifest.joints.neck.targetRest),p=map('body',jointPositions.hip),q=map('body',jointPositions.neck),dx=b[0]-a[0],dy=b[1]-a[1],u=q[0]-p[0],v=q[1]-p[1],angle=Math.atan2(v*dx-u*dy,u*dx+v*dy),scale=Math.max(.98,Math.min(1.02,Math.hypot(u,v)/Math.hypot(dx,dy))),c=Math.cos(angle)*scale,s=Math.sin(angle)*scale;
   torsoPoint=r=>[p[0]+(r[0]-a[0])*c-(r[1]-a[1])*s,p[1]+(r[0]-a[0])*s+(r[1]-a[1])*c];
   for(let j=0;j<layers.length;j++){const l=layers[j],o=offsets[j],rest=restManifest.layers[j].vertices;if(l.id==='body'){const spec=manifest.materialUpperBody,neck=map('head',sampleSurface(spec.neckBinding)),own=torsoPoint(spec.neck);for(let v=0;v<rest.length;v+=2){const p=torsoPoint([rest[v],rest[v+1]]),w=Math.max(0,Math.min(1,(390-rest[v+1])/80))*Math.max(0,Math.min(1,(rest[v]-680)/25))*Math.max(0,Math.min(1,(835-rest[v])/20));positions[o+v]=p[0]+(neck[0]-own[0])*w;positions[o+v+1]=p[1]+(neck[1]-own[1])*w;}}
    if(l.sleeveElbow){const a=[625,345],b=[423,293],p=torsoPoint(a),q=map('frontArm',sampleSurface(l.sleeveElbow)),dx=b[0]-a[0],dy=b[1]-a[1],u=q[0]-p[0],v=q[1]-p[1],den=dx*dx+dy*dy,c=(u*dx+v*dy)/den,s=(v*dx-u*dy)/den;for(let k=0;k<rest.length;k+=2){const x=rest[k]-a[0],y=rest[k+1]-a[1];const arm=[p[0]+x*c-y*s,p[1]+x*s+y*c],root=torsoPoint([rest[k],rest[k+1]]),distance=(65*(rest[k]-650)+51*(rest[k+1]-334))/Math.hypot(65,51),t=Math.max(0,Math.min(1,(distance+85)/85)),w=t*t*(3-2*t);positions[o+k]=arm[0]+(root[0]-arm[0])*w;positions[o+k+1]=arm[1]+(root[1]-arm[1])*w;}}
   }
  }
  // Retarget leg rotations in painted target space. Mapping an already-rotated
  // source leg through an anisotropic registration stretches the shin as it
  // swings horizontally. Forward kinematics keeps authored segment lengths.
  const legs={};
  for(const chain of manifest.materialLegChains||[]){
   const j=byId.get(chain.layer),l=layers[j],rest=restManifest.layers[j].vertices,o=offsets[j],bones={};let end=null;
   for(const id of chain.bones){
    const [first,last]=manifest.bones[id],a=manifest.joints[first].targetRest,b=manifest.joints[last].targetRest,p=jointPositions[first],q=jointPositions[last],dx=b[0]-a[0],dy=b[1]-a[1],u=q[0]-p[0],v=q[1]-p[1],angle=Math.atan2(v*dx-u*dy,u*dx+v*dy),c=Math.cos(angle),s=Math.sin(angle),ra=transform(groups[l.materialGroup].matrix,a),rb=transform(groups[l.materialGroup].matrix,b),start=end||map(l.materialGroup,p),tx=rb[0]-ra[0],ty=rb[1]-ra[1];
    end=[start[0]+tx*c-ty*s,start[1]+tx*s+ty*c];bones[id]={a:ra,p:start,c,s};
    const rawA=map(l.materialGroup,p),rawB=map(l.materialGroup,q),length=Math.hypot(tx,ty);
    legs[id]={length,currentLength:Math.hypot(end[0]-start[0],end[1]-start[1]),sourceMappedRatio:Math.hypot(rawB[0]-rawA[0],rawB[1]-rawA[1])/length};
   }
   for(let v=0;v<l.skin.length;v++){let x=0,y=0;for(const [id,w]of l.skin[v]){const t=bones[id],dx=rest[v*2]-t.a[0],dy=rest[v*2+1]-t.a[1];x+=(t.p[0]+dx*t.c-dy*t.s)*w;y+=(t.p[1]+dx*t.s+dy*t.c)*w;}positions[o+v*2]=x;positions[o+v*2+1]=y;}
  }
  const join=manifest.materialWrist,socket=manifest.wristSockets?.[activeHand];let wrist=null;
  if(join&&socket){
   const own=sampleSurface(socket.anchor.own),target=[0,0];for(const [w,b]of socket.anchor.target){const p=sampleSurface(b);target[0]+=w*p[0];target[1]+=w*p[1];}
   let tips=socket.bindings.map(b=>{const p=sampleSurface(b);return map('hand',[p[0]+target[0]-own[0],p[1]+target[1]-own[1]]);});
   const seam=join.seam.map(b=>map('frontArm',sampleSurface(b))),a=[seam[1][0]-seam[0][0],seam[1][1]-seam[0][1]],b=[tips[1][0]-tips[0][0],tips[1][1]-tips[0][1]];
   if(a[0]*b[0]+a[1]*b[1]<0)tips.reverse();
   const d=seam.map((p,i)=>[tips[i][0]-p[0],tips[i][1]-p[1]]),j=byId.get(join.layer),o=offsets[j];
   layers[j].wristWeights.forEach(([amount,across],v)=>{positions[o+v*2]+=amount*((1-across)*d[0][0]+across*d[1][0]);positions[o+v*2+1]+=amount*((1-across)*d[0][1]+across*d[1][1]);});
   if(join.bridge){const start=join.bridge.start.map(b=>map('frontArm',sampleSurface(b))),o=offsets[byId.get(join.bridge.layer)];[start[0],tips[0],tips[1],start[1]].forEach((p,v)=>{positions[o+v*2]=p[0];positions[o+v*2+1]=p[1];});if(socket.inside){const p=sampleSurface(socket.inside);wrist={forearm:[(start[0][0]+start[1][0])/2,(start[0][1]+start[1][1])/2],hand:map('hand',[p[0]+target[0]-own[0],p[1]+target[1]-own[1]])};}}
  }
  let contactError=0;
  if(manifest.materialUpperBody&&torsoPoint){
   const spec=manifest.materialUpperBody,contact=manifest.boardContact,target=read(positions,contact.target),shoulder=torsoPoint(spec.shoulder),wrist=[target[0]+spec.wrist[0]-spec.palm[0],target[1]+spec.wrist[1]-spec.palm[1]],dx=wrist[0]-shoulder[0],dy=wrist[1]-shoulder[1],d=Math.hypot(dx,dy),l1=Math.hypot(spec.elbow[0]-spec.shoulder[0],spec.elbow[1]-spec.shoulder[1]),l2=Math.hypot(spec.wrist[0]-spec.elbow[0],spec.wrist[1]-spec.elbow[1]),reach=Math.max(1,d/(l1+l2)*1.001),a=l1*reach,b=l2*reach,along=(a*a-b*b+d*d)/(2*d),height=Math.sqrt(Math.max(0,a*a-along*along)),elbow=[shoulder[0]+dx/d*along-dy/d*height,shoulder[1]+dy/d*along+dx/d*height];
   const bone=(a,b,p,q)=>{const x=b[0]-a[0],y=b[1]-a[1],u=q[0]-p[0],v=q[1]-p[1],den=x*x+y*y;return r=>[p[0]+((r[0]-a[0])*(u*x+v*y)-(r[1]-a[1])*(v*x-u*y))/den,p[1]+((r[0]-a[0])*(v*x-u*y)+(r[1]-a[1])*(u*x+v*y))/den];},upper=bone(spec.shoulder,spec.elbow,shoulder,elbow),fore=bone(spec.elbow,spec.wrist,elbow,wrist);
   for(const id of ['support-sleeve','support-forearm','support-hand']){const j=byId.get(id),o=offsets[j],rest=restManifest.layers[j].vertices;for(let v=0;v<rest.length;v+=2){const r=[rest[v],rest[v+1]];let p;if(id==='support-hand')p=[r[0]+target[0]-spec.palm[0],r[1]+target[1]-spec.palm[1]];else if(id==='support-forearm')p=fore(r);else{const t=Math.max(0,Math.min(1,(r[1]-spec.elbow[1]+38)/76)),w=t*t*(3-2*t),a=upper(r),b=fore(r);p=[a[0]+(b[0]-a[0])*w,a[1]+(b[1]-a[1])*w];const root=Math.max(0,Math.min(1,(r[1]-spec.shoulder[1])/80)),k=root*root*(3-2*root),torso=torsoPoint(r);p=[torso[0]+(p[0]-torso[0])*k,torso[1]+(p[1]-torso[1])*k];}positions[o+v]=p[0];positions[o+v+1]=p[1];}}
   const actual=read(positions,contact.follower);contactError=Math.hypot(actual[0]-target[0],actual[1]-target[1]);
  }else if(manifest.boardContact){const contact=manifest.boardContact,target=read(positions,contact.target),own=read(positions,contact.follower),d=[target[0]-own[0],target[1]-own[1]];
   for(let j=0;j<layers.length;j++){const l=layers[j];if(!l.boardContactWeights)continue;const o=offsets[j];l.boardContactWeights.forEach((w,v)=>{positions[o+v*2]+=d[0]*w;positions[o+v*2+1]+=d[1]*w;});}
   const result=read(positions,contact.follower);contactError=Math.hypot(result[0]-target[0],result[1]-target[1]);
  }
  for(let j=0;j<layers.length;j++){const l=layers[j];if(!l.jet)continue;const o=offsets[j],origin=read(positions,l.jet.origin),axis=read(positions,l.jet.axis),dx=axis[0]-origin[0],dy=axis[1]-origin[1],len=Math.hypot(dx,dy)||1,u=[dx/len,dy/len],pulse=1+.045*Math.sin(time*16+l.jet.phase);
   for(let v=0;v<l.vertices.length;v+=2){const x=positions[o+v]-origin[0],y=positions[o+v+1]-origin[1],along=Math.max(0,x*u[0]+y*u[1]);positions[o+v]+=u[0]*along*(pulse-1);positions[o+v+1]+=u[1]*along*(pulse-1);}
  }
  const bob=2*Math.sin(time*2.4);for(let i=1;i<positions.length;i+=2)positions[i]+=bob;
  if(wrist){wrist.forearm[1]+=bob;wrist.hand[1]+=bob;}
  return{contactError,groups:deltas.size,wrist,legs};
 }
 return{apply,restManifest};
}

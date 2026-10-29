// Original project RGBA layers and meshes, driven by the unmodified source
// model's evaluated geometry/physics. This does not author a new native MOC.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const WHITE={r:1,g:1,b:1,a:1},BLACK={r:0,g:0,b:0,a:0};
const apply=(m,x,y)=>[m[0]*x+m[1]*y+m[2],m[3]*x+m[4]*y+m[5]];
function multiply(a,b){return [a[0]*b[0]+a[1]*b[3],a[0]*b[1]+a[1]*b[4],a[0]*b[2]+a[1]*b[5]+a[2],a[3]*b[0]+a[4]*b[3],a[3]*b[1]+a[4]*b[4],a[3]*b[2]+a[4]*b[5]+a[5]];}

function boundedElbow(point,shoulder,wrist,upper,fore){
 const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]),inside=(p,c,r)=>distance(p,c)<=r+1e-7;
 if(inside(point,shoulder,upper)&&inside(point,wrist,fore))return point;
 const project=(p,c,r)=>{const d=distance(p,c),k=Math.min(1,r/Math.max(d,1e-9));return[c[0]+(p[0]-c[0])*k,c[1]+(p[1]-c[1])*k];},candidates=[],a=project(point,shoulder,upper),b=project(point,wrist,fore);
 if(inside(a,wrist,fore))candidates.push(a);if(inside(b,shoulder,upper))candidates.push(b);
 const dx=wrist[0]-shoulder[0],dy=wrist[1]-shoulder[1],d=Math.hypot(dx,dy);
 if(d>1e-8&&d<=upper+fore&&d>=Math.abs(upper-fore)){
  const along=(upper*upper-fore*fore+d*d)/(2*d),height=Math.sqrt(Math.max(0,upper*upper-along*along)),x=shoulder[0]+dx/d*along,y=shoulder[1]+dy/d*along;
  candidates.push([x-dy/d*height,y+dx/d*height],[x+dy/d*height,y-dx/d*height]);
 }
 if(!candidates.length)throw Error('Luna arm segment limits cannot reach the authored wrist');
 // Projection onto an intersection of discs is continuous and unique. Unlike
 // fixed-length IK it does not flip elbow branches when the hand crosses.
 return candidates.reduce((best,p)=>distance(p,point)<distance(best,point)?p:best);
}

export function createLunaMaidModelAdapter(model,payload){
 const raw=model.getModel(),native=raw.drawables;
 if(native.count!==payload.sourceDrawableCount)throw Error('Luna source drawable count changed');
 const descriptors=new Map(Object.entries(payload.drivers).map(([key,d])=>{
  const index=Number(key);if(native.ids[index]!==d.id)throw Error(`Luna source mesh changed: ${index}`);
  return[index,{...d,rest:new Float64Array(d.rest),inverse:new Float64Array(d.pseudoinverse),frame:new Float64Array(6)}];
 }));
 const frames=new Map(payload.frames.map(f=>[f.name,{...f,matrix:[1,0,0,0,1,0]}]));
 const layers=payload.layers.map(l=>({...l,positions:new Float32Array(l.rest),rest:new Float32Array(l.rest),uv:new Float32Array(l.uv),indices:new Uint16Array(l.indices)}));
 const order=Int32Array.from(layers,(_,i)=>i),opacities=new Float32Array(layers.length).fill(1),masks=layers.map(()=>new Int32Array()),maskCounts=new Int32Array(layers.length);
 const parameters=new Map(Array.from(raw.parameters.ids,(id,i)=>[id,i]));
 const methods={getDrawableCount:()=>layers.length,getDrawableRenderOrders:()=>order,
  getDrawableVertexPositions:i=>layers[i].positions,getDrawableVertices:i=>layers[i].positions,
  getDrawableVertexUvs:i=>layers[i].uv,getDrawableVertexIndices:i=>layers[i].indices,
  getDrawableVertexCount:i=>layers[i].positions.length/2,getDrawableVertexIndexCount:i=>layers[i].indices.length,
  getDrawableTextureIndex:()=>0,getDrawableOpacity:i=>opacities[i],
  getDrawableDynamicFlagVertexPositionsDidChange:()=>true,getDrawableDynamicFlagIsVisible:i=>opacities[i]>.0001,
  getDrawableCulling:()=>false,getDrawableBlendMode:()=>0,getDrawableInvertedMaskBit:()=>false,
  isUsingMasking:()=>false,getDrawableMaskCounts:()=>maskCounts,getDrawableMasks:()=>masks,
  getMultiplyColor:()=>WHITE,getScreenColor:()=>BLACK,getDrawableMultiplyColor:()=>WHITE,getDrawableScreenColor:()=>BLACK};
 const originals=Object.fromEntries(Object.keys(methods).map(k=>[k,{own:Object.hasOwn(model,k),value:model[k]}]));
 Object.assign(model,methods);
 let detached=false,transition=null,prepared=false;
 const state={source:'heitaizi_2',layers:layers.length,vertices:layers.reduce((a,l)=>a+l.rest.length/2,0),nonfinite:0,maximumDisplacementPixels:0,eyeOpen:[1,1],mouthOpen:0};

 const inverse=m=>{const d=m[0]*m[4]-m[1]*m[3];if(Math.abs(d)<1e-9)throw Error('Source head frame is singular');return[m[4]/d,-m[1]/d,(m[1]*m[5]-m[4]*m[2])/d,-m[3]/d,m[0]/d,(m[3]*m[2]-m[0]*m[5])/d];};
 let joints=null,supportOpacity=0;
 const surfaceConstraints=layers.map((l,index)=>{if(!l.nativeHand&&!l.clothMobility&&l.name!=='back_leg_continuous')return null;const triangles=[];for(let j=0;j<l.indices.length;j+=3){const ids=Array.from(l.indices.slice(j,j+3),i=>i*2),[a,b,c]=ids,p=l.rest,area=(p[b]-p[a])*(p[c+1]-p[a+1])-(p[b+1]-p[a+1])*(p[c]-p[a]);if(Math.abs(area)>1e-8)triangles.push({ids,sign:Math.sign(area),minimum:Math.max(.02/(80*80),Math.abs(area)*.025)});}return{index,triangles,mobility:l.clothMobility};}).filter(Boolean);
 function constrainSurfaces(){
  let corrections=0,maximum=0,maximumHand=0,maximumCloth=0,remaining=0,before=0;
  for(const {index,triangles,mobility} of surfaceConstraints){if(opacities[index]<.02)continue;const p=layers[index].positions,original=p.slice();
   for(const{ids:[a,b,c],sign}of triangles)if(((p[b]-p[a])*(p[c+1]-p[a+1])-(p[b+1]-p[a+1])*(p[c]-p[a]))*sign<0)before++;
   for(let pass=0;pass<96;pass++){let changed=0;for(const{ids:[a,b,c],sign,minimum}of triangles){const ax=p[a],ay=p[a+1],bx=p[b],by=p[b+1],cx=p[c],cy=p[c+1],area=((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))*sign;if(area>=minimum*.999)continue;const gradient=[[(by-cy)*sign,(cx-bx)*sign],[(cy-ay)*sign,(ax-cx)*sign],[(ay-by)*sign,(bx-ax)*sign]],den=gradient.reduce((n,[x,y],j)=>n+(x*x+y*y)*(mobility?.[[a,b,c][j]/2]??1),0);if(den<1e-14)continue;const amount=(minimum-area)/den;[a,b,c].forEach((at,k)=>{const mass=mobility?.[at/2]??1;p[at]+=gradient[k][0]*amount*mass;p[at+1]+=gradient[k][1]*amount*mass;});changed++;corrections++;}if(!changed)break;}
   for(let k=0;k<p.length;k+=2){const distance=Math.hypot(p[k]-original[k],p[k+1]-original[k+1])*80;maximum=Math.max(maximum,distance);if(mobility)maximumCloth=Math.max(maximumCloth,distance);else maximumHand=Math.max(maximumHand,distance);}
   for(const{ids:[a,b,c],sign}of triangles)if(((p[b]-p[a])*(p[c+1]-p[a+1])-(p[b+1]-p[a+1])*(p[c]-p[a]))*sign<=0)remaining++;
  }return{corrections,maximumDisplacementPixels:maximum,maximumHandDisplacementPixels:maximumHand,maximumClothDisplacementPixels:maximumCloth,remaining,before};
 }
 function nativePoint(binding){
  const[index,a,b,c,u,v,w,ox,oy]=binding,d=descriptors.get(index),xy=native.vertexPositions[index],f=d.frame;
  return[xy[a*2]*u+xy[b*2]*v+xy[c*2]*w+f[0]*ox+f[1]*oy,xy[a*2+1]*u+xy[b*2+1]*v+xy[c*2+1]*w+f[3]*ox+f[4]*oy];
 }
 function boneMatrix(a,b,aa,bb,width){
  const rx=b[0]-a[0],ry=b[1]-a[1],rl=Math.hypot(rx,ry),cx=bb[0]-aa[0],cy=bb[1]-aa[1],cl=Math.hypot(cx,cy),ux=rx/rl,uy=ry/rl,vx=cx/cl,vy=cy/cl,long=cl/rl;
  const m=[long*vx*ux+width*vy*uy,long*vx*uy-width*vy*ux,0,long*vy*ux-width*vx*uy,long*vy*uy+width*vx*ux,0];
  m[2]=aa[0]-m[0]*a[0]-m[1]*a[1];m[5]=aa[1]-m[3]*a[0]-m[4]*a[1];return m;
 }
 function retargetJoints(){
  const cfg=payload.retarget;if(!cfg)return;
  const head=frames.get('head').matrix,sourceInverse=inverse(descriptors.get(cfg.headDriver).frame),map=cfg.headMap;
  const goal=record=>{const source=nativePoint(record.binding),local=apply(sourceInverse,...source),rest=apply(map,...record.sourceRest),mapped=apply(map,...local);return apply(head,mapped[0]+record.targetRest[0]-rest[0],mapped[1]+record.targetRest[1]-rest[1]);};
  const sourceElbow=goal(cfg.elbow),wrist=goal(cfg.wrist),shoulder=apply(frames.get('torso').matrix,...cfg.upperRest[0]);
  let elbow=sourceElbow.slice(),armProjection=null;
  if(cfg.armProjection){
   const torso=frames.get('torso').matrix,bodyScale=Math.sqrt(Math.abs(torso[0]*torso[4]-torso[1]*torso[3])),profile=cfg.armProjection,
    rawUpper=Math.hypot(sourceElbow[0]-shoulder[0],sourceElbow[1]-shoulder[1]),rawFore=Math.hypot(wrist[0]-sourceElbow[0],wrist[1]-sourceElbow[1]),rawTotal=rawUpper+rawFore,
    start=profile.softStart*bodyScale,maximum=profile.maximumTotal*bodyScale;
   let total=rawTotal;
   if(rawTotal>start){const span=maximum-start;total=start+span*(1-Math.exp(-(rawTotal-start)/span));}
   const dx=wrist[0]-shoulder[0],dy=wrist[1]-shoulder[1],distance=Math.hypot(dx,dy);
   total=Math.max(total,distance+profile.minimumReachMargin);
   if(total<rawTotal-1e-7&&distance>1e-6){
    // Project the native elbow guide onto the target length ellipse. Radial
    // projection is continuous even when the source passes through a fully
    // folded pose; selecting a signed IK branch would pop at that crossing.
    const middle=[(shoulder[0]+wrist[0])/2,(shoulder[1]+wrist[1])/2],gx=sourceElbow[0]-middle[0],gy=sourceElbow[1]-middle[1];
    let lo=0,hi=1;
    for(let pass=0;pass<24;pass++){const amount=(lo+hi)/2,x=middle[0]+gx*amount,y=middle[1]+gy*amount,length=Math.hypot(x-shoulder[0],y-shoulder[1])+Math.hypot(wrist[0]-x,wrist[1]-y);if(length<total)lo=amount;else hi=amount;}
    const amount=(lo+hi)/2;elbow=[middle[0]+gx*amount,middle[1]+gy*amount];
   }
   armProjection={sourceTotalPixels:rawTotal,targetTotalPixels:Math.hypot(elbow[0]-shoulder[0],elbow[1]-shoulder[1])+Math.hypot(wrist[0]-elbow[0],wrist[1]-elbow[1]),maximumTotalPixels:maximum,sourceElbow};
  }
  if(cfg.armSegmentLimits){
   const m=frames.get('torso').matrix,scale=Math.sqrt(Math.abs(m[0]*m[4]-m[1]*m[3])),limits=cfg.armSegmentLimits,
    upperMaximum=limits.upperMaximum*scale,foreMaximum=limits.foreMaximum*scale;
   elbow=boundedElbow(elbow,shoulder,wrist,upperMaximum,foreMaximum);
   armProjection={...armProjection,targetTotalPixels:Math.hypot(elbow[0]-shoulder[0],elbow[1]-shoulder[1])+Math.hypot(wrist[0]-elbow[0],wrist[1]-elbow[1]),
    segments:{upperPixels:Math.hypot(elbow[0]-shoulder[0],elbow[1]-shoulder[1]),forePixels:Math.hypot(wrist[0]-elbow[0],wrist[1]-elbow[1]),upperMaximum,foreMaximum}};
  }
  const upper=frames.get('reach_upper'),fore=frames.get('reach_fore'),area=m=>Math.abs(m[0]*m[4]-m[1]*m[3]),stretch=(rest,a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1])/Math.hypot(rest[1][0]-rest[0][0],rest[1][1]-rest[0][1]);
  const upperStretch=stretch(cfg.upperRest,shoulder,elbow),foreStretch=stretch(cfg.foreRest,elbow,wrist);
  const thickness=(matrix,rest,a,b)=>{const rx=rest[1][0]-rest[0][0],ry=rest[1][1]-rest[0][1],rl=Math.hypot(rx,ry),cx=b[0]-a[0],cy=b[1]-a[1],cl=Math.hypot(cx,cy),nx=-ry/rl,ny=rx/rl;return Math.abs((-cy/cl)*(matrix[0]*nx+matrix[1]*ny)+(cx/cl)*(matrix[3]*nx+matrix[4]*ny));};
  // Limb length/angle follows the complete source path. Cross-section follows
  // body scale; a swimsuit surface's shear must not collapse the new maid arm.
  const limbWidth=Math.sqrt(area(frames.get('torso').matrix));
  upper.matrix=boneMatrix(...cfg.upperRest,shoulder,elbow,limbWidth);
  fore.matrix=boneMatrix(...cfg.foreRest,elbow,wrist,limbWidth);
  const sleeve=frames.get('reach_sleeve');if(sleeve){const restA=cfg.upperRest[0],restB=cfg.upperRest[1],dx=elbow[0]-shoulder[0],dy=elbow[1]-shoulder[1],length=Math.hypot(dx,dy),bodyScale=Math.sqrt(area(frames.get('torso').matrix)),restLength=Math.hypot(restB[0]-restA[0],restB[1]-restA[1]);sleeve.matrix=boneMatrix(restA,restB,shoulder,[shoulder[0]+dx/length*restLength*bodyScale,shoulder[1]+dy/length*restLength*bodyScale],bodyScale);}
  const elbowCap=frames.get('reach_elbow');if(elbowCap){const bodyScale=Math.sqrt(area(frames.get('torso').matrix)),angle=Math.atan2(fore.matrix[3],fore.matrix[0]),c=Math.cos(angle)*bodyScale,s=Math.sin(angle)*bodyScale,q=cfg.elbow.targetRest;elbowCap.matrix=[c,-s,elbow[0]-c*q[0]+s*q[1],s,c,elbow[1]-s*q[0]-c*q[1]];}
  const a=Math.atan2(upper.matrix[3],upper.matrix[0]),b=Math.atan2(fore.matrix[3],fore.matrix[0]);
  supportOpacity=smooth(Math.max(Math.abs(Math.atan2(Math.sin(b-a),Math.cos(b-a)))/.4,(Math.max(upperStretch,foreStretch)-1)/.25));
  const sr=cfg.upperRest,sdx=sr[1][0]-sr[0][0],sdy=sr[1][1]-sr[0][1],slen=Math.hypot(sdx,sdy),snx=-sdy/slen,sny=sdx/slen,sm=frames.get('reach_sleeve').matrix;
  joints={shoulder,elbow,wrist,armProjection,sleeveNormal:[sm[0]*snx+sm[1]*sny,sm[3]*snx+sm[4]*sny],sleeveMouth:cfg.sleeveMouth?apply(frames.get('reach_sleeve').matrix,...cfg.sleeveMouth.center):null,sourceWrist:nativePoint(cfg.handWristBinding),upperStretch,foreStretch};
  if(cfg.backLeg){const leg=cfg.backLeg,sourceReferenceInverse=inverse(descriptors.get(leg.referenceDriver).frame),targetReference=frames.get('front_leg').matrix;
   const points=[apply(frames.get('root').matrix,...leg.rest[0]),...leg.joints.map(record=>{const source=nativePoint(record.binding),local=apply(sourceReferenceInverse,...source),rest=apply(leg.map,...record.sourceRest),mapped=apply(leg.map,...local);return apply(targetReference,mapped[0]+record.targetRest[0]-rest[0],mapped[1]+record.targetRest[1]-rest[1]);})];
   for(let i=0;i<3;i++){const f=frames.get(['back_thigh','back_shin','back_foot'][i]);f.matrix=boneMatrix(leg.rest[i],leg.rest[i+1],points[i],points[i+1],Math.sqrt(area(f.matrix)));}
   if(leg.rigidFoot){
    const f=frames.get('back_foot'),a=points[2],b=points[3],dx=b[0]-a[0],dy=b[1]-a[1],distance=Math.hypot(dx,dy),
     scale=Math.sqrt(area(frames.get('root').matrix)),length=Math.hypot(leg.rest[3][0]-leg.rest[2][0],leg.rest[3][1]-leg.rest[2][1])*scale,
     toe=[a[0]+dx/distance*length,a[1]+dy/distance*length];
    // The rigid shoe follows ankle translation and the native foot angle,
    // with uniform body scale instead of stretching its toe or sole.
    f.matrix=boneMatrix(leg.rest[2],leg.rest[3],a,toe,scale);
    joints.backFoot={ankle:a,toe,sourceToe:b,matrix:f.matrix.slice(),scale};
   }
   joints.backLeg=points;
  }
 }
 function updateFrames(mode){
  for(const [index,d]of descriptors){
   const p=native.vertexPositions[index],n=p.length/2,inv=d.inverse,f=d.frame;f.fill(0);
   for(let k=0;k<n;k++)for(let a=0;a<3;a++){f[a]+=inv[a*n+k]*p[k*2];f[a+3]+=inv[a*n+k]*p[k*2+1];}
  }
  for(const f of frames.values()){
   const nativeFrame=descriptors.get(f.driver).frame;
   f.matrix=multiply(multiply(f.map,nativeFrame),f.inverseMap);
   if(f.rigid){
    const m=f.matrix,pivot=f.pivot||[0,0],anchor=apply(m,...pivot),angle=Math.atan2(m[3]-m[1],m[0]+m[4]),scale=clamp(Math.sqrt(Math.abs(m[0]*m[4]-m[1]*m[3])),.9,1.1),c=Math.cos(angle)*scale,s=Math.sin(angle)*scale;
    f.matrix=[c,-s,anchor[0]-c*pivot[0]+s*pivot[1],s,c,anchor[1]-s*pivot[0]-c*pivot[1]];
   }
   if(f.parent&&f.limitDegrees!==undefined){
    const parent=frames.get(f.parent),m=f.matrix,p=parent.matrix,pivot=f.pivot,
     ownAngle=Math.atan2(m[3],m[0]),parentAngle=Math.atan2(p[3],p[0]),
     relative=Math.atan2(Math.sin(ownAngle-parentAngle),Math.cos(ownAngle-parentAngle)),
     limit=f.limitDegrees*Math.PI/180,
     angle=parentAngle+clamp(relative,-limit,limit),
     scale=clamp(Math.hypot(m[0],m[3]),Math.hypot(p[0],p[3])*.98,Math.hypot(p[0],p[3])*1.02),
     anchor=apply(m,...pivot),c=Math.cos(angle)*scale,s=Math.sin(angle)*scale;
    f.matrix=[c,-s,anchor[0]-c*pivot[0]+s*pivot[1],s,c,anchor[1]-s*pivot[0]-c*pivot[1]];
   }
   if(f.followParent&&f.parent)f.matrix=frames.get(f.parent).matrix.slice();
   if(f.parent){const parent=frames.get(f.parent),p=apply(parent.matrix,...f.pivot),own=apply(f.matrix,...f.pivot);f.matrix[2]+=p[0]-own[0];f.matrix[5]+=p[1]-own[1];}
  }
 }

 function retargetBodyVolume(){
  const cfg=payload.retarget?.bodyVolume;if(!cfg)return;
  const m=frames.get(cfg.sourceFrame).matrix,p=cfg.anchor,anchor=apply(m,...p),
   angle=Math.atan2(m[3]-m[1],m[0]+m[4]),scale=Math.sqrt(Math.abs(m[0]*m[4]-m[1]*m[3])),c=Math.cos(angle)*scale,s=Math.sin(angle)*scale;
  // Preserve the evaluated torso position, lean and area. Remove the source
  // surface shear/unequal scale that would pinch a tailored cloth panel.
  const matrix=[c,-s,anchor[0]-c*p[0]+s*p[1],s,c,anchor[1]-s*p[0]-c*p[1]];
  frames.get(cfg.frame).matrix=matrix;
  state.bodyVolume={matrix:matrix.slice(),sourceMatrix:Array.from(m),anchor:anchor.slice(),scale};
 }

 function sampleSkinSupport(frameName,x,y){
  const rest=frameName==='reach_upper'?payload.retarget.upperRest:payload.retarget.foreRest,m=frames.get(frameName).matrix,a=rest[0],b=rest[1],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length,nx=-uy,ny=ux,u=(x-a[0])*ux+(y-a[1])*uy,v=(x-a[0])*nx+(y-a[1])*ny,
   longitudinal=Math.hypot(m[0]*ux+m[1]*uy,m[3]*ux+m[4]*uy),width=Math.hypot(m[0]*nx+m[1]*ny,m[3]*nx+m[4]*ny),inside=clamp(u,0,length),adjusted=inside+(u-inside)*width/longitudinal;
  return apply(m,a[0]+ux*adjusted+nx*v,a[1]+uy*adjusted+ny*v);
 }
 function sample(binding,x,y){
  const [frameName,a,b,c,u,v,w,ox,oy,qx,qy]=binding,f=frames.get(frameName),d=descriptors.get(f.driver);
  const point=apply(f.matrix,x,y);
  if(!f.residualGain)return point;
  const xy=native.vertexPositions[f.driver],linear=d.frame;
  const sx=xy[a*2]*u+xy[b*2]*v+xy[c*2]*w+linear[0]*ox+linear[1]*oy;
  const sy=xy[a*2+1]*u+xy[b*2+1]*v+xy[c*2+1]*w+linear[3]*ox+linear[4]*oy;
  const rest=apply(linear,qx,qy),dx=sx-rest[0],dy=sy-rest[1];
  point[0]+=(f.map[0]*dx+f.map[1]*dy)*f.residualGain;
  point[1]+=(f.map[3]*dx+f.map[4]*dy)*f.residualGain;
  return point;
 }

 function coherentHandPose(cfg){
  const palm=descriptors.get(cfg.palm).frame,scale=Math.sqrt(Math.abs(palm[0]*palm[4]-palm[1]*palm[3])),palmAngle=Math.atan2(palm[3]-palm[1],palm[0]+palm[4]),matrices={};
  for(const index of cfg.sources){const f=descriptors.get(index).frame,nativeAngle=Math.atan2(f[3]-f[1],f[0]+f[4]),angle=index===cfg.palm?palmAngle:palmAngle+cfg.fingerRotationAmplitude*Math.sin(nativeAngle-palmAngle),c=Math.cos(angle)*scale,s=Math.sin(angle)*scale;matrices[index]=[c,-s,s,c];}
  return matrices;
 }
 function coherentHandPoint(layer,k,x,y,pose){
  const cfg=layer.nativeHand,inv=cfg.inverse,dx=x-cfg.origin[0],dy=y-cfg.origin[1],q=[inv[0]*dx+inv[1]*dy,inv[2]*dx+inv[3]*dy],palm=pose[cfg.palm],out=[0,0];
  for(const [weight,index]of layer.nativeBindings[k]){const root=index===cfg.palm?cfg.restWrist:cfg.roots[index],a=root[0]-cfg.restWrist[0],b=root[1]-cfg.restWrist[1],u=q[0]-root[0],v=q[1]-root[1],f=pose[index];out[0]+=weight*(palm[0]*a+palm[1]*b+f[0]*u+f[1]*v);out[1]+=weight*(palm[2]*a+palm[3]*b+f[2]*u+f[3]*v);}
  return[joints.sourceWrist[0]+out[0],joints.sourceWrist[1]+out[1]];
 }
 function interpolate(xs,ys,x){
  if(x<=xs[0])return ys[0];
  for(let k=1;k<xs.length;k++)if(x<=xs[k]){const t=(x-xs[k-1])/(xs[k]-xs[k-1]);return ys[k-1]+(ys[k]-ys[k-1])*t;}
  return ys[ys.length-1];
 }
 function eyeSample(layer,k,x,y,controls){
  const eye=layer.eyeSurface,control=controls[eye.name],[t,upper,lower,restClosed,top]=eye.vertices[k],open=control.open,
   u=clamp((x-eye.x[0])/(eye.x.at(-1)-eye.x[0])),gap=Math.min(.12,(lower-upper)*.2),
   closed=clamp(restClosed-control.smile*Math.sin(u*Math.PI)*1.1,upper,lower-gap),
   upperNow=closed+(upper-closed)*open,lowerNow=closed+gap+(lower-closed-gap)*open;
  let ey=y;
  if(eye.role==='iris'){
   ey=upperNow+(lowerNow-upperNow)*t;
   const tx=clamp(x-control.gaze[0],eye.x[0],eye.x.at(-1)),lo=interpolate(eye.x,eye.upper,tx),hi=interpolate(eye.x,eye.lower,tx),ty=clamp(ey-control.gaze[1],lo,Math.max(lo,hi)),uv=apply(eye.uvMap,tx,ty);
   // Moving the aperture and sampling the same facial coordinates clips the
   // pupil. A fixed UV range here would squash it during every blink.
   layer.uv[k*2]=uv[0];layer.uv[k*2+1]=uv[1];
  }else if(eye.role==='upper_lid'){
   const closedThickness=Math.min(1,4/Math.max(1,upper-top));
   ey=upperNow+(y-upper)*(closedThickness+(1-closedThickness)*open);
  }
  else ey=lowerNow+(y-lower);
  return [x,ey];
 }

 function prepare({delta=0,mode='idle',eyePreview=null}={}){
  if(detached)throw Error('Luna adapter detached');
  updateFrames(mode);retargetBodyVolume();retargetJoints();
  if(payload.retarget.sleeveAttachment?.seamAnchors)state.sleeveSeam=payload.retarget.sleeveAttachment.seamAnchors.map(anchor=>anchor.weights.reduce((out,[weight,binding])=>{const p=sample(binding,...anchor.pixel);out[0]+=p[0]*weight;out[1]+=p[1]*weight;return out;},[0,0]));
  const value=id=>raw.parameters.values[parameters.get(id)]??0,
   right=clamp(value('ParamEyeROpen')),left=clamp(value('ParamEyeLOpen')),mouth=clamp(value('ParamMouthOpenY')),
   eyeControls={};
  for(const l of layers)if(l.eyeSurface&&!eyeControls[l.eyeSurface.name]){const e=l.eyeSurface;
   eyeControls[e.name]={open:clamp(eyePreview?.open??value(e.parameter)),smile:clamp(value(e.smileParameter)),
    gaze:[clamp(eyePreview?.gazeX??value('ParamEyeBallX'),-1,1)*e.gazePixels[0],clamp(eyePreview?.gazeY??value('ParamEyeBallY'),-1,1)*e.gazePixels[1]]};
  }
  const hands=layers.map((l,i)=>l.nativeHand?i:-1).filter(i=>i>=0),start=hands[0];
  hands.sort((a,b)=>native.renderOrders[layers[a].opacityDriver]-native.renderOrders[layers[b].opacityDriver]||a-b).forEach((index,rank)=>{order[index]=start+rank;});
  let nonfinite=0,maximum=0;
  for(let i=0;i<layers.length;i++){
   const l=layers[i],out=l.positions,handPose=l.nativeHand?.coherent?coherentHandPose(l.nativeHand):null;
   const panelCorners=l.clothPanel?.corners.map(anchor=>anchor.weights.reduce((out,[weight,binding])=>{const p=sample(binding,...anchor.pixel);out[0]+=p[0]*weight;out[1]+=p[1]*weight;return out;},[0,0]));
   for(let k=0;k<l.pixels.length/2;k++){
    const x=l.pixels[k*2],y=l.pixels[k*2+1],weights=l.weights[k];let px=0,py=0;
    if(l.nativeHand){const point=l.nativeHand.coherent?coherentHandPoint(l,k,x,y,handPose):nativePoint(l.nativeBindings[k]),m=l.nativeHand.matrix,dx=point[0]-joints.sourceWrist[0],dy=point[1]-joints.sourceWrist[1];px=joints.wrist[0]+m[0]*dx+m[1]*dy;py=joints.wrist[1]+m[2]*dx+m[3]*dy;}
    else if(panelCorners){const [u,v]=l.clothPanel.coordinates[k],mix=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v];for(let j=0;j<4;j++){px+=panelCorners[j][0]*mix[j];py+=panelCorners[j][1]*mix[j];}}
    else if(l.support&&l.name!=='reach_elbow_cap'){const p=sampleSkinSupport(l.name==='reach_upper_support'?'reach_upper':'reach_fore',x,y);px=p[0];py=p[1];}
    else {const point=l.eyeSurface?eyeSample(l,k,x,y,eyeControls):[x,y];for(let j=0;j<weights.length;j++){const [weight,binding]=weights[j],p=sample(binding,...point);px+=p[0]*weight;py+=p[1]*weight;}}
    if(l.offsets){const m=frames.get(l.offsetFrame).matrix,dx=l.offsets[k*2],dy=l.offsets[k*2+1];px+=m[0]*dx+m[1]*dy;py+=m[3]*dx+m[4]*dy;}
    maximum=Math.max(maximum,Math.hypot(px-x,py-y));
    out[k*2]=(px-payload.origin[0])/payload.pixelsPerUnit;
    out[k*2+1]=(payload.origin[1]-py)/payload.pixelsPerUnit;
    if(!Number.isFinite(out[k*2])||!Number.isFinite(out[k*2+1]))nonfinite++;
   }
  }
  opacities.fill(1);
  for(let i=0;i<layers.length;i++){
   if(layers[i].opacityDriver!==undefined)opacities[i]=clamp(native.opacities[layers[i].opacityDriver]);
   if(layers[i].nativeHand?.coherent)opacities[i]=layers[i].nativeHand.sources.reduce((sum,index)=>sum+clamp(native.opacities[index]),0)/layers[i].nativeHand.sources.length;
   if(layers[i].support)opacities[i]=1;
   if(layers[i].name==='reach_upper_paint'||layers[i].name==='reach_fore_paint')opacities[i]=0;
   if(layers[i].eyeSurface?.role==='iris')opacities[i]=eyeControls[layers[i].eyeSurface.name].open>.002?1:0;
   if(layers[i].eyeSurface?.role==='lower_lid')opacities[i]=smooth(eyeControls[layers[i].eyeSurface.name].open/.25);
   if(layers[i].feature==='mouth')opacities[i]=smooth((mouth-.04)/.6);
  }
  const constraints=constrainSurfaces();
  if(transition){
   transition.time+=delta;const q=clamp(transition.time/transition.duration),t=smooth(q);
   for(let i=0;i<layers.length;i++){for(let k=0;k<layers[i].positions.length;k++)layers[i].positions[k]=transition.positions[i][k]+(layers[i].positions[k]-transition.positions[i][k])*t;if(layers[i].eyeSurface)for(let k=0;k<layers[i].uv.length;k++)layers[i].uv[k]=transition.uv[i][k]+(layers[i].uv[k]-transition.uv[i][k])*t;opacities[i]=transition.opacities[i]+(opacities[i]-transition.opacities[i])*t;}
   if(q>=1)transition=null;
  }
  Object.assign(state,{nonfinite,maximumDisplacementPixels:maximum,eyeOpen:[right,left],eyeControls,mouthOpen:mouth,transitioning:Boolean(transition),posePolicy:'native wrist/palm motion, calibrated finger joints, connected glove and shoulder surfaces',armJoints:joints?{shoulder:joints.shoulder,elbow:joints.elbow,wrist:joints.wrist,sleeveMouth:joints.sleeveMouth,sleeveNormal:joints.sleeveNormal,armProjection:joints.armProjection,backLeg:joints.backLeg,backFoot:joints.backFoot}:null,supportOpacity,constraints});prepared=true;
  if(nonfinite)throw Error('Luna target mesh has invalid coordinates');
 }
 return{prepare,state:()=>({...state,eyeOpen:[...state.eyeOpen]}),
  begin({duration=0}={}){transition=prepared&&duration>0?{time:0,duration,positions:layers.map(l=>l.positions.slice()),uv:layers.map(l=>l.uv.slice()),opacities:opacities.slice()}:null;},
  detach(){if(detached)return;for(const[k,r]of Object.entries(originals)){if(r.own)model[k]=r.value;else delete model[k];}detached=true;}};
}

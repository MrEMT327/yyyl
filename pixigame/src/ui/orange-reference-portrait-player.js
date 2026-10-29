import {createOrangeSurfaceConstraints} from './orange-surface-constraints.js';
import {createOrangeMaterialRetarget} from './orange-material-retarget.js';
import {evaluateOrangeHeldCard,evaluateOrangeHandTurn,turnOrangeHandPoint} from './orange-held-card.js';
import {createCubismPortraitPlayer} from './cubism-portrait-player.js';
import {createGoldenMeshRenderer} from './golden-mesh-renderer.js';

// Original authored Cubism parameters/physics drive new target RGBA meshes.
// This is deliberately identified as a custom target renderer, not a new MOC.
export function createOrangeReferencePortraitPlayer({assetBase=import.meta.env?.BASE_URL??'/',runtimePath='art/orange-final-lap-v1/runtime.json'}={}) {
 const assetRoot=new URL(assetBase,location.href),runtimeUrl=new URL(runtimePath,assetRoot),root=new URL('./',runtimeUrl);
 if(root.origin!==location.origin)throw Error('角色资源必须同源');
 const controller=new AbortController(),images=new Set(),reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
 const sameOrigin=path=>{const url=new URL(path,root);if(url.origin!==location.origin)throw Error('角色资源必须同源');return url.href;};
 let host=null,canvas=null,sourceHost=null,source=null,renderer=null,manifest=null,loading=null;
 let state='idle',error=null,paused=false,visible=true,destroyed=false,raf=null,previous=null,accumulator=0,frames=0;
 let explicit=false,motionRequest=0;
 let debugLayers=null,constrain=null,geometryStats=null,propStats=null,retarget=null,retargetStats=null;
 let positions=null,opacities=null,orders=null,visibility=null,layers=null,offsets=null,parameterIndices=null;
 const canPlay=()=>!destroyed&&state==='ready'&&host?.isConnected&&visible&&!paused&&!document.hidden&&(!reduced?.matches||explicit);
 const stop=()=>{if(raf!==null)cancelAnimationFrame(raf);raf=null;previous=null;};
 function updateHost(){if(!host)return;Object.assign(host.dataset,{portraitState:state,portraitRevision:manifest?.materialRevision||'',motion:source?.motionName||'idle',time:(source?.currentTime||0).toFixed(4),playing:String(Boolean(canPlay())),representation:'reference-driven-target-mesh'});host.classList.toggle('is-ready',state==='ready');}
 function clearHost(){if(!host)return;host.classList.remove('is-ready');for(const key of ['portraitState','portraitRevision','motion','time','playing','representation'])delete host.dataset[key];}
 function dispose(){renderer?.destroy();renderer=null;source?.destroy();source=null;canvas?.remove();canvas=null;sourceHost?.remove();sourceHost=null;for(const img of images)img.src='';images.clear();}
 function fail(reason){if(destroyed)return;error=reason;state='error';stop();controller.abort();dispose();updateHost();console.warn('橙红发立绘载入失败，保留静态立绘。',reason);}
 const pixel=(x,y)=>[x*125+800,-y*125+215];
 function rigidTransform(index,rest){
  const current=source.model.getDrawableVertexPositions(index),a=[0,0],b=[0,0],n=rest.length/2;
  for(let i=0;i<rest.length;i+=2){const p=pixel(rest[i],rest[i+1]),q=pixel(current[i],current[i+1]);a[0]+=p[0]/n;a[1]+=p[1]/n;b[0]+=q[0]/n;b[1]+=q[1]/n;}
  let co=0,si=0;
  for(let i=0;i<rest.length;i+=2){const p=pixel(rest[i],rest[i+1]),q=pixel(current[i],current[i+1]),x=p[0]-a[0],y=p[1]-a[1],u=q[0]-b[0],v=q[1]-b[1];co+=x*u+y*v;si+=x*v-y*u;}
  const angle=Math.atan2(si,co);return{a,b,c:Math.cos(angle),s:Math.sin(angle)};
 }
 function affineTransform(index,rest){
  const current=source.model.getDrawableVertexPositions(index),a=[0,0],b=[0,0],n=rest.length/2;
  for(let i=0;i<rest.length;i+=2){const p=pixel(rest[i],rest[i+1]),q=pixel(current[i],current[i+1]);a[0]+=p[0]/n;a[1]+=p[1]/n;b[0]+=q[0]/n;b[1]+=q[1]/n;}
  let xx=0,xy=0,yy=0,xu=0,yu=0,xv=0,yv=0;
  for(let i=0;i<rest.length;i+=2){const p=pixel(rest[i],rest[i+1]),q=pixel(current[i],current[i+1]),x=p[0]-a[0],y=p[1]-a[1],u=q[0]-b[0],v=q[1]-b[1];xx+=x*x;xy+=x*y;yy+=y*y;xu+=x*u;yu+=y*u;xv+=x*v;yv+=y*v;}
  const det=xx*yy-xy*xy;if(Math.abs(det)<1e-5)throw Error('参考面片拟合退化');
  return{a,b,m:[(xu*yy-yu*xy)/det,(yu*xx-xu*xy)/det,(xv*yy-yv*xy)/det,(yv*xx-xv*xy)/det]};
 }
 function draw(){
  if(state!=='ready'||!source?.model||!renderer)return;
  const model=source.model,raw=model.getModel(),cache=new Map();
  const get=i=>{if(!cache.has(i))cache.set(i,model.getDrawableVertexPositions(i));return cache.get(i);};
  const rotations=new Map();
  const sampleSurface=binding=>{
   const [index,a,b,c,u,w,z,ox=0,oy=0,ex,ey,fx,fy]=binding,mesh=get(index);
   let x=(mesh[a*2]*u+mesh[b*2]*w+mesh[c*2]*z)*125+800,y=-(mesh[a*2+1]*u+mesh[b*2+1]*w+mesh[c*2+1]*z)*125+215;
   if(ox||oy){const key=index+':'+a+':'+b+':'+c;let r=rotations.get(key);if(!r){const ax=(mesh[b*2]-mesh[a*2])*125,ay=-(mesh[b*2+1]-mesh[a*2+1])*125,bx=(mesh[c*2]-mesh[a*2])*125,by=-(mesh[c*2+1]-mesh[a*2+1])*125,angle=Math.atan2(ay*ex-ax*ey+by*fx-bx*fy,ax*ex+ay*ey+bx*fx+by*fy);r=[Math.cos(angle),Math.sin(angle)];rotations.set(key,r);}x+=ox*r[0]-oy*r[1];y+=ox*r[1]+oy*r[0];}
   return[x,y];
  };
  const jointPositions={};
  for(const [id,joint]of Object.entries(manifest.joints||{})){
   const mesh=get(joint.index),point=[0,0];joint.indices.forEach((index,i)=>{const p=pixel(mesh[index*2],mesh[index*2+1]);point[0]+=p[0]*joint.weights[i];point[1]+=p[1]*joint.weights[i];});
   jointPositions[id]=[joint.targetRest[0]+point[0]-joint.referenceRest[0],joint.targetRest[1]+point[1]-joint.referenceRest[1]];
  }
  // The target is seated with its support palm planted on a fixed pedestal.
  // Source arm controls describe a different hand pose; retain this contact.
  if(!manifest.surfaceVersion&&manifest.joints?.supportPalm&&['idle','touch_head','touch_body'].includes(source.motionName)){
   for(const id of ['supportWrist','supportPalm'])jointPositions[id]=manifest.joints[id].targetRest.slice();
   const rest=manifest.joints.supportShoulder.targetRest,delta=jointPositions.supportShoulder.map((v,i)=>v-rest[i]);
   jointPositions.supportElbow=manifest.joints.supportElbow.targetRest.map((v,i)=>v+delta[i]*.5);
  }
  const boneTransforms={};
  for(const [id,[first,last]]of Object.entries(manifest.bones||{})){
   const a=manifest.joints[first].targetRest,b=manifest.joints[last].targetRest,p=jointPositions[first],q=jointPositions[last],dx=b[0]-a[0],dy=b[1]-a[1],u=q[0]-p[0],v=q[1]-p[1],den=dx*dx+dy*dy;
   boneTransforms[id]={a,p,c:(u*dx+v*dy)/den,s:(v*dx-u*dy)/den};
  }
  if(!manifest.surfaceVersion&&manifest.joints?.supportPalm&&['idle','touch_head','touch_body'].includes(source.motionName)){
   const a=manifest.joints.supportShoulder.targetRest,b=manifest.joints.supportWrist.targetRest,p=jointPositions.supportShoulder,q=jointPositions.supportWrist,dx=b[0]-a[0],dy=b[1]-a[1],u=q[0]-p[0],v=q[1]-p[1],den=dx*dx+dy*dy;
   const connected={a,p,c:(u*dx+v*dy)/den,s:(v*dx-u*dy)/den};
   boneTransforms.supportUpper=boneTransforms.supportFore=connected;
  }
  const activeHand=manifest.surfaceVersion?[19,114,126,132,443].reduce((a,b)=>model.getDrawableOpacity(b)>model.getDrawableOpacity(a)?b:a,19):19;
  const cardSpec=layers.find(l=>l.heldCard)?.heldCard,card=cardSpec?evaluateOrangeHeldCard(cardSpec,activeHand,sampleSurface,raw.drawables.renderOrders):null;
  const handTurn=card&&manifest.handTurn?evaluateOrangeHandTurn(manifest.handTurn,source.motionName,source.currentTime,activeHand,card,sampleSurface):null;
  propStats=card?{pose:activeHand,turn:handTurn?{pivot:handTurn.pivot,flip:handTurn.flip}:null}:null;
  let wristSocket=null;const socket=manifest.wristSockets?.[activeHand];if(socket){const own=sampleSurface(socket.anchor.own),target=[0,0];for(const [weight,binding]of socket.anchor.target){const p=sampleSurface(binding);target[0]+=p[0]*weight;target[1]+=p[1]*weight;}wristSocket=socket.bindings.map(b=>{const p=sampleSurface(b);return[p[0]+target[0]-own[0],p[1]+target[1]-own[1]];});}
  if(handTurn){wristSocket||=layers.find(l=>l.wristJoin)?.wristJoin.seam.map(sampleSurface);wristSocket=wristSocket?.map(p=>turnOrangeHandPoint(p,handTurn));}
  for(let j=0;j<layers.length;j++){
   const layer=layers[j],offset=offsets[j],headBlendMatrix=layer.headBlend?affineTransform(layer.headBlend.index,layer.headBlend.rest):null;let rigid=null,affine=null;
   if(layer.heldCard){for(let v=0;v<4;v++)positions.set(turnOrangeHandPoint(card.vertices.slice(v*2,v*2+2),handTurn),offset+v*2);opacities[j]=card.opacity;orders[j]=card.order;visibility[j]=!debugLayers||debugLayers.has(layer.id)?1:0;continue;}
   let wristDelta=null;if(layer.wristJoin&&wristSocket){const seam=layer.wristJoin.seam.map(sampleSurface),a=[seam[1][0]-seam[0][0],seam[1][1]-seam[0][1]],b=[wristSocket[1][0]-wristSocket[0][0],wristSocket[1][1]-wristSocket[0][1]],target=a[0]*b[0]+a[1]*b[1]<0?[wristSocket[1],wristSocket[0]]:wristSocket;wristDelta=seam.map((p,i)=>[target[i][0]-p[0],target[i][1]-p[1]]);}
   let surfaceAnchor=null;if(layer.surfaceAnchor){const own=sampleSurface(layer.surfaceAnchor.own),target=[0,0];for(const [weight,binding]of layer.surfaceAnchor.target){const p=sampleSurface(binding);target[0]+=p[0]*weight;target[1]+=p[1]*weight;}surfaceAnchor=[target[0]-own[0],target[1]-own[1]];}
   if(layer.affine!==undefined)affine=affineTransform(layer.affine,layer.affineRest);
   else if(!layer.skin&&layer.rigid!==undefined)rigid=rigidTransform(layer.rigid,layer.rigidRest);
   let anchorOffset=null;
   if(affine&&layer.affineAnchor){const anchor=layer.affineAnchor,head=affineTransform(anchor.index,anchor.rest),p=anchor.point,dx=p[0]-head.a[0],dy=p[1]-head.a[1],tx=head.b[0]+dx*head.m[0]+dy*head.m[1],ty=head.b[1]+dx*head.m[2]+dy*head.m[3],ax=p[0]-affine.a[0],ay=p[1]-affine.a[1];anchorOffset=[tx-affine.b[0]-ax*affine.m[0]-ay*affine.m[1],ty-affine.b[1]-ax*affine.m[2]-ay*affine.m[3]];}
   for(let v=0;v<layer.vertices.length/2;v++){
    let x=layer.vertices[v*2],y=layer.vertices[v*2+1];
    if(layer.bodySurface){x=0;y=0;for(const [index,vertex,weight]of layer.bodySurface[v]){const mesh=get(index);x+=(mesh[vertex*2]*125+800)*weight;y+=(-mesh[vertex*2+1]*125+215)*weight;}}
    else if(layer.surfaceBlend){x=0;y=0;for(const [weight,binding]of layer.surfaceBlend[v]){const p=sampleSurface(binding);x+=p[0]*weight;y+=p[1]*weight;}}
    else if(layer.surface){[x,y]=sampleSurface(layer.surface[v]);}
    else if(layer.upperField&&!layer.skin){let ox=0,oy=0;for(const [joint,weight]of layer.upperField[v].body){ox+=jointPositions[joint][0]*weight;oy+=jointPositions[joint][1]*weight;}for(const [bone,weight]of layer.upperField[v].bones){const t=boneTransforms[bone],dx=x-t.a[0],dy=y-t.a[1];ox+=(t.p[0]+dx*t.c-dy*t.s)*weight;oy+=(t.p[1]+dx*t.s+dy*t.c)*weight;}x=ox;y=oy;}
    else if(layer.bodyWeights){let ox=0,oy=0;for(const [joint,weight]of layer.bodyWeights[v]){ox+=jointPositions[joint][0]*weight;oy+=jointPositions[joint][1]*weight;}x=ox;y=oy;}
    else if(layer.skin){let ox=0,oy=0;let weights=layer.skin[v];
     if(['front-forearm','front-hand-controller','front-empty-hand'].includes(layer.id)){
      const a=manifest.joints.frontWrist.targetRest,b=manifest.joints.frontPalm.targetRest,dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
      const along=((x-a[0])*dx+(y-a[1])*dy)/length,u=Math.max(0,Math.min(1,(along+30)/80)),w=u*u*(3-2*u);
      weights=[['frontFore',1-w],['frontHand',w]];
     }
     for(const [bone,weight]of weights){const t=boneTransforms[bone],dx=x-t.a[0],dy=y-t.a[1];ox+=(t.p[0]+dx*t.c-dy*t.s)*weight;oy+=(t.p[1]+dx*t.s+dy*t.c)*weight;}x=ox;y=oy;}
    else if(affine){const dx=x-affine.a[0],dy=y-affine.a[1];x=affine.b[0]+dx*affine.m[0]+dy*affine.m[1]+(anchorOffset?.[0]||0);y=affine.b[1]+dx*affine.m[2]+dy*affine.m[3]+(anchorOffset?.[1]||0);}
    else if(rigid){const dx=x-rigid.a[0],dy=y-rigid.a[1];x=rigid.b[0]+dx*rigid.c-dy*rigid.s;y=rigid.b[1]+dx*rigid.s+dy*rigid.c;}
    else if(!layer.static){
     const [index,a,b,c,u,vv,w,rx,ry]=layer.bindings[v],mesh=get(index);
     const mx=mesh[a*2]*u+mesh[b*2]*vv+mesh[c*2]*w,my=mesh[a*2+1]*u+mesh[b*2+1]*vv+mesh[c*2+1]*w;
     x+=mx*125+800-rx;y+=-my*125+215-ry;
    }
    if(layer.headBlend){const p=[layer.vertices[v*2],layer.vertices[v*2+1]],spec=layer.headBlend,t=Math.min(1,Math.max(0,(p[1]-spec.start)/(spec.end-spec.start))),mix=t*t*(3-2*t),head=headBlendMatrix,dx=p[0]-head.a[0],dy=p[1]-head.a[1],hx=head.b[0]+dx*head.m[0]+dy*head.m[1],hy=head.b[1]+dx*head.m[2]+dy*head.m[3];x=hx+(x-hx)*mix;y=hy+(y-hy)*mix;}
    if(surfaceAnchor){x+=surfaceAnchor[0];y+=surfaceAnchor[1];}
    if(handTurn&&(layer.handPose!==undefined||layer.handPoseFallback))[x,y]=turnOrangeHandPoint([x,y],handTurn);
    if(wristDelta){const px=layer.vertices[v*2],py=layer.vertices[v*2+1],join=layer.wristJoin,u=Math.min(1,Math.max(0,(px-join.start)/(join.end-join.start))),amount=1-u*u*(3-2*u),sx=px*1254/1536,sy=py*1254/1536,t=Math.max(0,Math.min(1,(sx-313)/57)),width=17.5*(.65+.35*t*t*(3-2*t)),across=Math.max(0,Math.min(1,(sy-(146+(sx-313)*.22)+width)/(2*width)));x+=((1-across)*wristDelta[0][0]+across*wristDelta[1][0])*amount;y+=((1-across)*wristDelta[0][1]+across*wristDelta[1][1])*amount;}
    if(!Number.isFinite(x)||!Number.isFinite(y))throw Error(`网格坐标无效: ${layer.id}`);
    positions[offset+v*2]=x;positions[offset+v*2+1]=y;
   }
   let opacity=1;
   if(layer.hidden)opacity=0;
   if(layer.eye){const value=raw.parameters.values[parameterIndices.get(layer.eye)]??1;opacity=Math.max(0,Math.min(1,(.92-value)/.72));}
   if(layer.mouth){const value=raw.parameters.values[parameterIndices.get(layer.mouth)]??0;opacity=Math.max(0,Math.min(1,(value-.08)/.45));}
   if(layer.gripOpacitySource!==undefined){const value=Math.max(0,Math.min(1,model.getDrawableOpacity(layer.gripOpacitySource)));const grip=value>=.5?1:0;opacity*=layer.invertGripOpacity?1-grip:grip;}
   if(layer.handPose!==undefined)opacity=activeHand===layer.handPose?1:0;
   if(layer.handPoseFallback&&[19,114,126].includes(activeHand))opacity=0;
   if(layer.nativeOpacityIndex!==undefined)opacity*=Math.max(0,Math.min(1,model.getDrawableOpacity(layer.nativeOpacityIndex)));
   opacities[j]=opacity;orders[j]=layer.order;visibility[j]=!debugLayers||debugLayers.has(layer.id)?1:0;
   if(layer.nativeOrder!==undefined)orders[j]=raw.drawables.renderOrders[layer.nativeOrder];
   if(manifest.surfaceVersion&&layer.gripOpacitySource!==undefined){const active=[19,114,126,132,443].filter(i=>model.getDrawableOpacity(i)>.15);if(active.length)orders[j]=Math.max(...active.map(i=>raw.drawables.renderOrders[i]));}
   if(layer.orderSources&&!layer.id.startsWith('front-')){
    const active=layer.orderSources.filter(i=>model.getDrawableOpacity(i)>.15);
    if(active.length)orders[j]=Math.max(...active.map(i=>raw.drawables.renderOrders[i]))+(layer.orderOffset||0);
   }
   if(card&&layer.handPose!==undefined)orders[j]+=card.handOrderBias;
   if(card&&layer.handPoseFallback)orders[j]=card.order+.5;
  }
  // The target sleeves and glove remain a connected foreground chain.
  if(!manifest.surfaceVersion)for(let j=0;j<layers.length;j++){const id=layers[j].id;if(id.startsWith('front-')&&!['front-leg','front-hair'].includes(id))orders[j]=id.includes('hand')?424:id.includes('forearm')?423:id.includes('skin')?392:id.includes('underlap')?393:395;}
  if(retarget)retargetStats=retarget.apply(positions,{sampleSurface,activeHand,time:source.currentTime,jointPositions});
  if(constrain)geometryStats=constrain(positions);
  renderer.draw(positions,opacities,orders,visibility);frames++;updateHost();
 }
 function fit(){if(destroyed||!canvas||!renderer||!host)return;const rect=host.getBoundingClientRect(),dpr=2;renderer.resize(Math.max(1,Math.round(rect.width*dpr)),Math.max(1,Math.round(rect.height*dpr)));draw();}
 function schedule(){if(raf===null&&canPlay())raf=requestAnimationFrame(tick);}
 function tick(now){
  raf=null;if(!canPlay()){previous=null;return;}
  accumulator+=previous===null?0:Math.min(.25,Math.max(0,(now-previous)/1000));previous=now;
  try{let changed=false;while(accumulator+1e-8>=1/30&&canPlay()){accumulator-=1/30;const before=source.motionName;if(!source.stepFrames(1))throw source.error||Error('参考运动核无法更新');if(before!=='idle'&&source.motionName==='idle')explicit=false;changed=true;}if(changed)draw();sync();}catch(e){fail(e);}
 }
 function sync(){if(canPlay())schedule();else stop();updateHost();}
 async function waitForDocument(){
  if(!document.hidden)return;
  await new Promise((resolve,reject)=>{
   const done=()=>{document.removeEventListener('visibilitychange',onChange);controller.signal.removeEventListener('abort',onAbort);};
   const onChange=()=>{if(!document.hidden){done();resolve();}},onAbort=()=>{done();reject(controller.signal.reason);};
   document.addEventListener('visibilitychange',onChange);controller.signal.addEventListener('abort',onAbort,{once:true});
   if(controller.signal.aborted)onAbort();
  });
 }
 async function initialize(){
  state='loading';updateHost();
  const response=await fetch(runtimeUrl,{signal:controller.signal});if(!response.ok)throw Error(`角色清单 HTTP ${response.status}`);manifest=await response.json();if(destroyed)return false;
  if(manifest.schema!=='orange-reference-driven-target-mesh-v1')throw Error('不支持的角色清单');
  layers=manifest.layers;retarget=manifest.materialGroups?createOrangeMaterialRetarget(manifest):null;constrain=manifest.surfaceVersion?createOrangeSurfaceConstraints(retarget?.restManifest||manifest):null;offsets=[];let count=0;
  for(const layer of layers){offsets.push(count);count+=layer.vertices.length;}
  positions=new Float32Array(count);opacities=new Float32Array(layers.length);orders=new Float32Array(layers.length);visibility=new Uint8Array(layers.length).fill(1);
  sourceHost=document.createElement('div');sourceHost.setAttribute('aria-hidden','true');
  Object.assign(sourceHost.style,{position:'absolute',width:'1px',height:'1px',opacity:'0',overflow:'hidden',pointerEvents:'none'});host?.appendChild(sourceHost);
  source=createCubismPortraitPlayer({assetBase:assetRoot.href,modelPath:sameOrigin(manifest.referenceModel),hiddenDrawableIndices:Array.from({length:500},(_,i)=>i),sampleFps:30,initialMemoryBytes:128*1024*1024});
  source.setPaused(true);
  const textures=new Map(await Promise.all([...new Set(layers.map(layer=>layer.texture))].map(async texture=>{const img=new Image();images.add(img);img.src=sameOrigin(texture);await img.decode();return[texture,img];})));
  if(destroyed)return false;await waitForDocument();if(destroyed)return false;
  if(!await source.attach(sourceHost)||!source?.ready){if(destroyed)return false;throw source?.error||Error('参考运动核无法加载');}
  if(destroyed)return false;
  source.seek(0);parameterIndices=new Map(Array.from(source.model.getModel().parameters.ids,(id,i)=>[id,i]));
  canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');Object.assign(canvas.style,{position:'absolute',inset:'0',width:'100%',height:'100%'});
  const meshManifest={width:manifest.view?.width||manifest.width,height:manifest.view?.height||manifest.height,camera:{scale:1,offset:manifest.view?.offset||[0,0]},meshes:layers.map((layer,i)=>({id:layer.id,texture:layer.texture,vertices:layer.vertices,uvs:layer.uvs,indices:layer.indices,stateOffset:offsets[i],masks:layer.masks||[],blend:layer.blend||'normal',invertedMask:Boolean(layer.invertedMask)}))};
  renderer=createGoldenMeshRenderer(canvas,meshManifest,textures);images.clear();
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail(Error('角色画布连接已中断'));},{signal:controller.signal});
  host?.appendChild(canvas);state='ready';fit();sync();return true;
 }
 const ensure=()=>destroyed||state==='error'?Promise.resolve(false):!host||!visible||document.hidden?Promise.resolve(state==='ready'):loading||=(initialize().catch(e=>{fail(e);return false;}));
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(fit):null;
 const onVisibility=()=>{sync();if(!document.hidden)void ensure();};
 const onReduced=()=>{explicit=false;if(reduced?.matches&&state==='ready'){void source.playMotion('idle').then(()=>{if(destroyed||state!=='ready')return;source.setPaused(true);source.seek(0);accumulator=0;draw();sync();});}sync();};
 document.addEventListener('visibilitychange',onVisibility);reduced?.addEventListener?.('change',onReduced);
 return{
  async attach(next){if(destroyed)return false;if(next&&!next.appendChild)throw TypeError('需要有效宿主');if(host!==next){if(host)observer?.unobserve(host);clearHost();host=next;canvas?.remove();sourceHost?.remove();if(host){if(sourceHost)host.appendChild(sourceHost);if(canvas)host.appendChild(canvas);observer?.observe(host);}}
   sync();if(!host)return false;const ready=await ensure();if(!destroyed){fit();sync();}return ready;},
  async playMotion(name){const request=++motionRequest;if(!await ensure()||destroyed||request!==motionRequest)return false;const ok=await source.playMotion(name);if(destroyed||request!==motionRequest)return false;source.setPaused(true);if(!ok)return false;explicit=true;paused=false;previous=null;accumulator=0;draw();sync();return true;},
  setPaused(value){if(destroyed)return;paused=Boolean(value);if(!paused)explicit=true;source?.setPaused(true);sync();},
  setVisible(value){if(destroyed)return Promise.resolve(false);visible=Boolean(value);sync();return visible?ensure():Promise.resolve(state==='ready');},
  setDebugLayers(ids=null){debugLayers=ids?new Set(ids):null;draw();},
  seek(time){if(state!=='ready')return false;paused=true;stop();const ok=source.seek(time);accumulator=0;draw();return ok;},
  stepFrames(count=1){if(state!=='ready'||!Number.isInteger(count)||count<1||count>600)return false;paused=true;stop();const ok=source.stepFrames(count);draw();return ok;},
  restart(){if(state!=='ready')return false;return this.playMotion(source.motionName);},
  captureFrame(size=1536){if(!canvas||state!=='ready')return null;if(!Number.isFinite(size)||size<1)throw RangeError('导出尺寸必须是正数');const w=canvas.width,h=canvas.height;try{renderer.resize(Math.round(size),Math.round(size));draw();return canvas.toDataURL('image/png');}finally{renderer.resize(w,h);draw();}},
  destroy(){if(destroyed)return;destroyed=true;motionRequest++;stop();controller.abort();observer?.disconnect();document.removeEventListener('visibilitychange',onVisibility);reduced?.removeEventListener?.('change',onReduced);dispose();positions=opacities=orders=visibility=layers=offsets=parameterIndices=manifest=null;clearHost();host=null;state='destroyed';},
  get state(){return state;},get ready(){return state==='ready';},get error(){return error;},get canvas(){return canvas;},get source(){return source;},get manifest(){return manifest;},
  get currentTime(){return source?.currentTime||0;},get duration(){return source?.duration||0;},get motionName(){return source?.motionName||'idle';},get availableMotions(){return source?.availableMotions||[];},
  get retargetStats(){return retargetStats;},get propStats(){return propStats;},get geometryStats(){return geometryStats;},get renderedFrames(){return frames;},get paused(){return paused;},get positions(){return positions;},get opacities(){return opacities;},get orders(){return orders;},get playing(){return Boolean(canPlay());},get frameIndex(){return source?.frameIndex||0;},get sampleFps(){return 30;},
 };
}

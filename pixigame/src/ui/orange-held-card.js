// The idle glove crop still contains a fragment of the original painted card.
// Cut that fragment in texture space without changing the source PNG.
// The thumb is drawn separately in front of the independent card.
export const ORANGE_CARD_HAND_MATERIAL = {
 alphaOpening: {
  artworkSize: [183, 103], feather: .4, outline: 0,
  polygon: [[-4,-4],[82,-4],[82,2],[69,3],[54,3],[43,1],
   [40,3],[41,8],[44,14],[49,19],[55,22],[54,29],
   [53,35],[50,39],[47,41],[-4,28]],
 },
};

// Only the upper thumb pad belongs in front of the card. The curled finger
// underneath it is on the far side of the card, despite sharing one PNG.
export const ORANGE_CARD_THUMB_MATERIAL = {
 alphaOpening: {
  artworkSize: [183, 103], feather: .7, outline: 0, keepInside: true,
  // Follow the glove side of the painted border. The pale/gold pixels above
  // it and the curled-finger fragments below it belong behind the card.
  polygon: [[41.8,6],[45,6.9],[49,7.7],[54,8.2],[59,8.5],
   [64,8.5],[69,8.1],[74,8.4],[80,11],[87,15],[94,18],
   [88,21],[82,22],[76,22.5],[69,22.3],[62,21.7],
   [56,20.3],[51,18.3],[47,15.7],[44,12],[42.5,8.8]],
 },
};

export function splitOrangeCardGripLayers(manifest) {
 if(manifest.materialRevision!=='jetboard-v5-clean-r5')return;
 for(const id of ['front-card-hand','front-card-hand-fallback']){
  const layer=manifest.layers.find(l=>l.id===id);
  if(!layer||manifest.layers.some(l=>l.id===id+'-thumb'))continue;
  layer.cardGripDepth='back';
  manifest.layers.push({...layer,id:id+'-thumb',cardGripDepth:'front'});
 }
}

// A card keeps its own visibility and rigid shape while its attachment follows
// the active original hand surface. Hand opacity is only a pose selector.
export function evaluateOrangeHeldCard(spec,activeHand,sampleSurface,renderOrders){
 const pose=spec.poses[activeHand]||spec.poses[19];
 const [grip,axis]=pose.bindings.map(sampleSurface);
 if(pose.surfaceAnchor){
  const own=sampleSurface(pose.surfaceAnchor.own),target=[0,0];
  for(const [weight,binding]of pose.surfaceAnchor.target){const p=sampleSurface(binding);target[0]+=weight*p[0];target[1]+=weight*p[1];}
  for(const p of [grip,axis]){p[0]+=target[0]-own[0];p[1]+=target[1]-own[1];}
 }
 const dx=axis[0]-grip[0],dy=axis[1]-grip[1],length=Math.hypot(dx,dy);
 const c=length>1e-6?dx/length:1,s=length>1e-6?dy/length:0;
 const vertices=[0,0,spec.width,0,spec.width,spec.height,0,spec.height];
 for(let i=0;i<vertices.length;i+=2){const x=vertices[i]-pose.pivot[0]*spec.width,y=vertices[i+1]-pose.pivot[1]*spec.height;vertices[i]=grip[0]+c*x-s*y;vertices[i+1]=grip[1]+s*x+c*y;}
 // Keep the held assembly in front of the target head/hair, while preserving
 // the original internal palm/card/thumb/finger order. Raising only the card
 // would paint over the fingers; retaining source absolute orders hides it.
 const handOrderBias=spec.foregroundOrder===undefined?0:Math.max(0,spec.foregroundOrder-Math.min(...pose.orderGroup.map(i=>renderOrders[i])));
 return{vertices,grip,opacity:1,order:renderOrders[pose.orderSource]+pose.orderOffset+handOrderBias,handOrderBias};
}

// A rigid prop makes the source's discrete hand swaps especially noticeable.
// Ease the target hand turn at those authored boundaries, around the same wrist;
// the fingers, prop and forearm socket all receive the same rotation.
export function evaluateOrangeHandTurn(spec,motion,time,activeHand,card,sampleSurface){
 const transition=spec?.motions[motion]?.find(t=>t.to===activeHand&&time>=t.time-1e-7&&time<t.time+spec.duration);
 if(!transition)return null;
 const angle=v=>Math.atan2(v[3]-v[1],v[2]-v[0]);
 const pivot=sampleSurface(spec.wrist),delta=transition.fromAngle+transition.flip-angle(card.vertices);
 const difference=Math.atan2(Math.sin(delta),Math.cos(delta));
 const t=Math.max(0,Math.min(1,(time-transition.time)/spec.duration)),rotation=difference*(1-t*t*(3-2*t));
 return{pivot,c:Math.cos(rotation),s:Math.sin(rotation),flip:transition.flip};
}

export function turnOrangeHandPoint(point,turn){
 if(!turn)return point;
 const x=point[0]-turn.pivot[0],y=point[1]-turn.pivot[1];
 return[turn.pivot[0]+x*turn.c-y*turn.s,turn.pivot[1]+x*turn.s+y*turn.c];
}

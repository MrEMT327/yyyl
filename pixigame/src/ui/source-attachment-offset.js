// A new prop sits at its grip using an evaluated source prop or hand frame.
// Source vertices, UVs, indices and motion parameters stay intact.
export function createSourceAttachmentOffsets(model, entries) {
  const positions=model.getDrawableVertexPositions,changed=model.getDrawableDynamicFlagVertexPositionsDidChange;
  const caches=new Map();
  for(const e of entries){
    if(model.getModel().drawables.ids[e.index]!==e.id || e.reference.length!==6 || e.vertices.length!==3 || e.offset.length!==2
      || ![...e.reference,...e.offset].every(Number.isFinite))throw new Error('Invalid source attachment');
    const [ax,ay,bx,by,cx,cy]=e.reference,det=(bx-ax)*(cy-ay)-(cx-ax)*(by-ay);
    if(Math.abs(det)<1e-8)throw new Error('Degenerate source attachment frame');
    const x=(e.offset[0]*(cy-ay)-e.offset[1]*(cx-ax))/det,y=((bx-ax)*e.offset[1]-(by-ay)*e.offset[0])/det;
    const input=positions.call(model,e.index),frame=positions.call(model,e.frameIndex ?? e.index);
    if(e.frameIndex!==undefined&&model.getModel().drawables.ids[e.frameIndex]!==e.frameId)throw new Error('Invalid attachment frame identity');
    if(e.vertices.some(i=>!Number.isInteger(i)||i<0||i*2+1>=frame.length))throw new Error('Invalid source attachment anchors');
    let coordinates=null;
    if(e.frameIndex!==undefined){
      if(!Array.isArray(e.restPositions)||e.restPositions.length!==input.length||!e.restPositions.every(Number.isFinite))throw new Error('Invalid attachment rest shape');
      if(e.preserveDeformation && (!Array.isArray(e.sourceRestPositions)||e.sourceRestPositions.length!==input.length||!e.sourceRestPositions.every(Number.isFinite)))throw new Error('Invalid attachment source rest shape');
      coordinates=new Float32Array(input.length);
      for(let j=0;j<input.length;j+=2){
        // A material silhouette adds a transported rest offset to the native
        // vertex. Its source motion and secondary deformation remain present.
        const px=e.restPositions[j]+e.offset[0]-(e.preserveDeformation?e.sourceRestPositions[j]:ax);
        const py=e.restPositions[j+1]+e.offset[1]-(e.preserveDeformation?e.sourceRestPositions[j+1]:ay);
        coordinates[j]=(px*(cy-ay)-py*(cx-ax))/det;coordinates[j+1]=((bx-ax)*py-(by-ay)*px)/det;
      }
    }
    caches.set(e.index,{...e,x,y,coordinates,buffer:new Float32Array(input.length)});
  }
  let prepared=false;
  model.getDrawableVertexPositions=function(i){return prepared&&caches.has(i)?caches.get(i).buffer:positions.call(this,i);};
  model.getDrawableDynamicFlagVertexPositionsDidChange=function(i){return (prepared&&caches.has(i))||changed.call(this,i);};
  return {
    prepare(){for(const [i,e]of caches){const input=positions.call(model,i),frame=positions.call(model,e.frameIndex ?? i),[a,b,c]=e.vertices.map(v=>v*2);const bx=frame[b]-frame[a],by=frame[b+1]-frame[a+1],cx=frame[c]-frame[a],cy=frame[c+1]-frame[a+1],dx=e.x*bx+e.y*cx,dy=e.x*by+e.y*cy;if(![bx,by,cx,cy,dx,dy].every(Number.isFinite))throw new Error('Nonfinite attachment position');for(let j=0;j<input.length;j+=2){e.buffer[j]=e.coordinates?(e.preserveDeformation?input[j]:frame[a])+e.coordinates[j]*bx+e.coordinates[j+1]*cx:input[j]+dx;e.buffer[j+1]=e.coordinates?(e.preserveDeformation?input[j+1]:frame[a+1])+e.coordinates[j]*by+e.coordinates[j+1]*cy:input[j+1]+dy;}}prepared=true;},
    detach(){model.getDrawableVertexPositions=positions;model.getDrawableDynamicFlagVertexPositionsDidChange=changed;caches.clear();},
  };
}

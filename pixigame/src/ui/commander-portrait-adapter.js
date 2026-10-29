import {createCommanderBodyField,commanderLeftCoatAttachment} from './commander-body-field.js';
import {createCommanderFootSurface,trimCommanderLegIndices} from './commander-foot-surface.js';
import {trimCommanderSleeveIndices} from './commander-sleeve-surface.js';

// Local, render-only refinements for the supplied commander. The original MOC,
// texture, parameter buffers and animation curves remain the source of truth.
const clamp = (x, lo=0, hi=1) => Math.max(lo, Math.min(hi, x));
const smooth = x => { const t=clamp(x); return t*t*(3-2*t); };
const ease = x => { const t=clamp(x); return t*t*t*(10+t*(-15+6*t)); };
const band = (x, inner, outer) => 1-smooth((Math.abs(x)-inner)/(outer-inner));
const IDS = ['ArtHair','ArtHead','ArtTorso','ArtCoatLeft','ArtWaist','ArtSkirt','ArtLegFront','ArtLegBack','ArtShoes','ArtRaisedArm','ArtWaistArm','ArtRightSleeve','ArtEyeRClosed','ArtEyeLClosed','ArtWaistCuff'];

// Two midpoint subdivisions put a vertex every ~2 source pixels on the face.
// Shared edges share vertices; all new UVs are interpolated from the same art.
function subdivide(positions, uvs, indices) {
  const rest=Array.from(positions), uv=Array.from(uvs), parents=[];
  let triangles=Array.from(indices);
  for(let pass=0;pass<2;pass++) {
    const edges=new Map(), next=[];
    const middle=(a,b)=>{
      const key=a<b?`${a}:${b}`:`${b}:${a}`;
      if(edges.has(key))return edges.get(key);
      const i=rest.length/2;
      rest.push((rest[a*2]+rest[b*2])/2,(rest[a*2+1]+rest[b*2+1])/2);
      uv.push((uv[a*2]+uv[b*2])/2,(uv[a*2+1]+uv[b*2+1])/2);
      parents.push([i,a,b]);edges.set(key,i);return i;
    };
    for(let j=0;j<triangles.length;j+=3) {
      const [a,b,c]=triangles.slice(j,j+3),ab=middle(a,b),bc=middle(b,c),ca=middle(c,a);
      next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);
    }
    triangles=next;
  }
  return {rest:new Float32Array(rest),uv:new Float32Array(uv),indices:new Uint16Array(triangles),parents};
}

function frame(rest, points) {
  const anchors=points.map(([x,y])=>{
    let best=0, distance=Infinity;
    for(let j=0;j<rest.length;j+=2) {
      const d=(rest[j]*512+512-x)**2+(768-rest[j+1]*512-y)**2;
      if(d<distance){distance=d;best=j;}
    }
    return best;
  });
  const [a,b,c]=anchors,ux=rest[b]-rest[a],uy=rest[b+1]-rest[a+1],vx=rest[c]-rest[a],vy=rest[c+1]-rest[a+1];
  const det=ux*vy-uy*vx;
  if(Math.abs(det)<1e-8)throw new Error('Commander anchor frame is degenerate');
  return current=>{
    const u=current[b]-current[a],v=current[b+1]-current[a+1],w=current[c]-current[a],z=current[c+1]-current[a+1];
    const a00=(u*vy-w*uy)/det,a01=(w*ux-u*vx)/det;
    const a10=(v*vy-z*uy)/det,a11=(z*ux-v*vx)/det;
    return {a:a00,b:a10,c:a01,d:a11,x:current[a],y:current[a+1],rx:rest[a],ry:rest[a+1]};
  };
}

// Compose the eyelid field with the actual deformed face, rather than adding a
// global head-space offset. The source clip locally compresses the face; a
// global offset can fold those already compressed triangles near a blink.
function materialSampler(uv,indices) {
  const bins=new Map();
  for(let j=0;j<indices.length;j+=3){
    const [a,b,c]=indices.slice(j,j+3),x=uv[a*2]*2048,y=(1-uv[a*2+1])*2048;
    const ux=uv[b*2]*2048-x,uy=(1-uv[b*2+1])*2048-y,vx=uv[c*2]*2048-x,vy=(1-uv[c*2+1])*2048-y,det=ux*vy-uy*vx;
    if(Math.abs(det)<1e-7)continue;
    const triangle={a:a*2,b:b*2,c:c*2,x,y,ux,uy,vx,vy,det};
    for(let bx=Math.floor(Math.min(x,x+ux,x+vx)/8);bx<=Math.floor(Math.max(x,x+ux,x+vx)/8);bx++)for(let by=Math.floor(Math.min(y,y+uy,y+vy)/8);by<=Math.floor(Math.max(y,y+uy,y+vy)/8);by++){
      const key=`${bx}:${by}`;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(triangle);
    }
  }
  return (x,y,source,output,offset)=>{
    for(const t of bins.get(`${Math.floor(x/8)}:${Math.floor(y/8)}`)||[]){
      const px=x-t.x,py=y-t.y,u=(px*t.vy-py*t.vx)/t.det,v=(t.ux*py-t.uy*px)/t.det;
      if(u< -1e-5||v< -1e-5||u+v>1.00001)continue;
      output[offset]=source[t.a]*(1-u-v)+source[t.b]*u+source[t.c]*v;
      output[offset+1]=source[t.a+1]*(1-u-v)+source[t.b+1]*u+source[t.c+1]*v;return;
    }
    throw new Error('Commander facial field left the source material');
  };
}

const EYES=[
  {parameter:'ParamEyeROpen',patch:12,center:[455,157.5],tangent:[.96,-.28],inner:13,outer:22,drop:4.8},
  {parameter:'ParamEyeLOpen',patch:13,center:[508,132.5],tangent:[.86,-.51],inner:17,outer:27,drop:4.3},
];

// The .754 plateau in the supplied blink curves is an open-eye pose, not a
// quarter-transparent closed-eye patch. Preserve the original open appearance.
export const commanderEyeOpen = raw => smooth(clamp(raw)/.78);

/** A copied display pose is blended, never ParamSourceMotion (which is time). */
export function createCommanderPortraitAdapter(model) {
  const core=model.getModel(),ids=Array.from(core.drawables.ids);
  if(ids.length!==IDS.length||ids.some((id,i)=>id!==IDS[i]))throw new Error('Commander mesh identity mismatch');
  const parameterIds=Array.from(core.parameters.ids),index=id=>{
    const i=parameterIds.indexOf(id);if(i<0)throw new Error(`Commander parameter missing: ${id}`);return i;
  };
  const eyes=EYES.map(eye=>({...eye,parameterIndex:index(eye.parameter)})),mouthIndex=index('ParamMouthOpenY');
  const methods=['getDrawableVertexPositions','getDrawableVertexUvs','getDrawableVertexIndices','getDrawableVertexCount','getDrawableVertexIndexCount','getDrawableOpacity','getDrawableDynamicFlagVertexPositionsDidChange','getDrawableDynamicFlagIsVisible'];
  const original=Object.fromEntries(methods.map(name=>[name,model[name]]));
  const source=i=>original.getDrawableVertexPositions.call(model,i);
  const rest=ids.map((_,i)=>new Float32Array(source(i)));
  const face=subdivide(rest[1],original.getDrawableVertexUvs.call(model,1),original.getDrawableVertexIndices.call(model,1));
  const feet=createCommanderFootSurface(rest[8],original.getDrawableVertexUvs.call(model,8),original.getDrawableVertexIndices.call(model,8));
  const legs=Object.fromEntries([6,7].map(i=>[i,trimCommanderLegIndices(original.getDrawableVertexUvs.call(model,i),original.getDrawableVertexIndices.call(model,i))]));
  const sleeveIndices=trimCommanderSleeveIndices(rest[11],original.getDrawableVertexIndices.call(model,11));
  const surface=i=>i===1?face:i===8?feet:null;
  const sampleFace=materialSampler(original.getDrawableVertexUvs.call(model,1),original.getDrawableVertexIndices.call(model,1));
  const buffers=rest.map((xy,i)=>new Float32Array(surface(i)?.rest.length||xy.length));
  const body=createCommanderBodyField(rest,source,i=>original.getDrawableVertexIndices.call(model,i),{8:feet.rest});
  const opacities=new Float32Array(ids.length);
  // Shared skirt/thigh edges use the same body field. Only the free coat and
  // sleeve tails receive an additional secondary-motion correction.
  const garments=[
    {i:3,start:430,end:710,gain:.46,omega:18,anchors:[[328,376],[328,448],[280,448]]},
    {i:11,start:510,end:770,gain:.52,omega:17,anchors:[[624,432],[672,432],[648,488]]},
  ].map(g=>({...g,frame:frame(rest[g.i],g.anchors),offset:new Float32Array(rest[g.i].length),velocity:new Float32Array(rest[g.i].length)}));
  let prepared=false,detached=false,resetCloth=true,transition=null;
  const state={transitioning:false,transitionProgress:1,eyeOpen:[1,1],mouthOpen:0};

  model.getDrawableVertexPositions=function(i){return prepared?buffers[i]:source(i);};
  model.getDrawableVertexUvs=function(i){return surface(i)?.uv||original.getDrawableVertexUvs.call(this,i);};
  model.getDrawableVertexIndices=function(i){return surface(i)?.indices||legs[i]||(i===11?sleeveIndices:original.getDrawableVertexIndices.call(this,i));};
  model.getDrawableVertexCount=function(i){return surface(i)?surface(i).rest.length/2:original.getDrawableVertexCount.call(this,i);};
  model.getDrawableVertexIndexCount=function(i){return surface(i)?.indices.length||legs[i]?.length||(i===11?sleeveIndices.length:original.getDrawableVertexIndexCount.call(this,i));};
  model.getDrawableOpacity=function(i){return prepared?opacities[i]:original.getDrawableOpacity.call(this,i);};
  model.getDrawableDynamicFlagVertexPositionsDidChange=function(i){return prepared||original.getDrawableDynamicFlagVertexPositionsDidChange.call(this,i);};
  // An outgoing eyelid can still be visible during a pose blend after Core has
  // hidden the incoming one. Renderer visibility must describe the display pose.
  model.getDrawableDynamicFlagIsVisible=function(i){return prepared?opacities[i]>0:original.getDrawableDynamicFlagIsVisible.call(this,i);};

  function refineFace() {
    const xy=buffers[1],native=source(1);
    const open=eyes.map(e=>commanderEyeOpen(core.parameters.values[e.parameterIndex]));
    const mouth=clamp(core.parameters.values[mouthIndex]);
    state.eyeOpen=open;state.mouthOpen=mouth;
    for(let j=0;j<xy.length;j+=2) {
      const px=face.uv[j]*2048,py=(1-face.uv[j+1])*2048;
      let dx=0,dy=0;
      for(let n=0;n<eyes.length;n++) {
        const e=eyes[n],close=1-open[n];
        if(close===0)continue;
        const tx=e.tangent[0],ty=e.tangent[1],nx=-ty,ny=tx;
        const u=(px-e.center[0])*tx+(py-e.center[1])*ty,v=(px-e.center[0])*nx+(py-e.center[1])*ny;
        const weight=band(u,e.inner,e.outer)*band(v,5,20);
        const displacement=close*(e.drop*.94-v*.86)*weight;
        dx+=nx*displacement;dy+=ny*displacement;
      }
      // Keep the smile and lip corners from the original art. Only the small
      // central opening gets a little more vertical articulation; no new mouth.
      if(mouth>0) {
        const u=(px-495.5)*.92-(py-183)*.392,v=(px-495.5)*.392+(py-183)*.92;
        const d=1.05*mouth*Math.tanh(v/2.6)*band(u,5,11.5)*band(v,3,10);
        dx+=.392*d;dy+=.92*d;
      }
      const boundary=smooth((px-440)/5)*smooth((552-px)/5)*smooth((py-88)/5)*smooth((232-py)/5);
      if((dx||dy)&&boundary>0)sampleFace(px+dx*boundary,py+dy*boundary,native,xy,j);
    }
    for(let n=0;n<eyes.length;n++)opacities[eyes[n].patch]=smooth((.16-open[n])/.16);
  }

  function refineCloth(delta) {
    for(const g of garments) {
      const output=buffers[g.i],input=output.slice(),base=rest[g.i],basis=g.frame(input);
      const angle=Math.atan2(basis.b-basis.c,basis.a+basis.d),c=Math.cos(angle),s=Math.sin(angle);
      const decay=Math.exp(-g.omega*delta);
      for(let j=0;j<input.length;j+=2) {
        // No correction at the sleeve/hand attachment. At the free end, favor a
        // shape-preserving material frame, with a damped native residual.
        const gate=smooth((768-base[j+1]*512-g.start)/(g.end-g.start))*(g.i===3?1-commanderLeftCoatAttachment(base[j]*512+512,768-base[j+1]*512):1);
        const x=basis.x+c*(base[j]-basis.rx)-s*(base[j+1]-basis.ry);
        const y=basis.y+s*(base[j]-basis.rx)+c*(base[j+1]-basis.ry);
        for(let axis=0;axis<2;axis++) {
          const k=j+axis,target=input[k]-(axis?y:x);
          if(resetCloth){g.offset[k]=target;g.velocity[k]=0;}
          else if(delta>0){
            const offset=g.offset[k]-target,t=g.velocity[k]+g.omega*offset;
            g.offset[k]=target+(offset+t*delta)*decay;
            g.velocity[k]=(g.velocity[k]-g.omega*t*delta)*decay;
          }
          output[k]=input[k]*(1-gate)+((axis?y:x)+g.offset[k]*g.gain)*gate;
        }
      }
    }
    resetCloth=false;
  }

  return {
    begin({duration=0}={}) {
      if(detached)throw new Error('Commander adapter is detached');
      transition=duration>0&&prepared?{duration,time:0,positions:buffers.map(x=>x.slice()),opacity:opacities.slice()}:null;
      resetCloth=true;
    },
    prepare({delta=0}={}) {
      if(detached||!Number.isFinite(delta)||delta<0)throw new Error('Invalid commander display update');
      for(let i=0;i<ids.length;i++) {
        if(i===8)buffers[i].set(feet.rest);
        buffers[i].set(source(i));
        opacities[i]=original.getDrawableOpacity.call(model,i);
      }
      for(const [i,a,b] of face.parents){buffers[1][i*2]=(buffers[1][a*2]+buffers[1][b*2])/2;buffers[1][i*2+1]=(buffers[1][a*2+1]+buffers[1][b*2+1])/2;}
      refineFace();body.update(buffers);refineCloth(delta);
      if(transition) {
        transition.time+=delta;
        const q=clamp(transition.time/transition.duration),w=ease(q);
        for(let i=0;i<ids.length;i++) {
          const xy=buffers[i],from=transition.positions[i];
          for(let j=0;j<xy.length;j++)xy[j]=from[j]+(xy[j]-from[j])*w;
          opacities[i]=transition.opacity[i]+(opacities[i]-transition.opacity[i])*w;
        }
        state.transitioning=q<1;state.transitionProgress=q;
        if(q===1)transition=null;
      } else {state.transitioning=false;state.transitionProgress=1;}
      prepared=true;
    },
    state:()=>({...state,eyeOpen:[...state.eyeOpen]}),
    detach(){if(detached)return;for(const name of methods)model[name]=original[name];transition=null;detached=true;},
  };
}

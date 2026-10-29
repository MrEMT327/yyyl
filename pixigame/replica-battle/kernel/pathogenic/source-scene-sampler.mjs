// Pure source-scene sampling. No old-game renderer, textures, or gameplay state.
// Godot source references/defaults and limitations are recorded in sampler-notes.md.
export const IDENTITY = Object.freeze([1, 0, 0, 1, 0, 0]);
const WHITE = [1, 1, 1, 1], clone = x => structuredClone(x);
const clamp = (x, a=0, b=1) => Math.max(a, Math.min(b, x));
const lerp = (a,b,t) => a+(b-a)*t;
const mod = (x,y) => ((x%y)+y)%y;
const parentPath = p => p==='.' ? null : p.includes('/') ? p.slice(0,p.lastIndexOf('/')) : '.';
const joined = (base,relative) => {
  const parts=(base==='.'?[]:base.split('/'));
  for(const p of relative.split('/')) {if(!p||p==='.')continue;if(p==='..')parts.pop();else parts.push(p);}
  return parts.join('/')||'.';
};
export function resource(graph,ref) {return ref?.$ref ? graph.resources[ref.$ref] : undefined;}
export function multiplyMatrix(a,b) {
  return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
}
export function transformPoint(m,p) {return [m[0]*p[0]+m[2]*p[1]+m[4],m[1]*p[0]+m[3]*p[1]+m[5]];}
function localMatrix(p) {
  if(p.transform)return p.transform;
  const [x,y]=p.position||[0,0],[sx,sy]=p.scale||[1,1],r=p.rotation||0,k=p.skew||0;
  return [Math.cos(r)*sx,Math.sin(r)*sx,-Math.sin(r+k)*sy,Math.cos(r+k)*sy,x,y];
}
const colorMultiply=(a,b)=>a.map((v,i)=>v*b[i]);
export function godotEase(x,c) {
  x=clamp(x);
  if(c>0)return c<1 ? 1-Math.pow(1-x,1/c) : Math.pow(x,c);
  if(c<0)return x<.5 ? Math.pow(x*2,-c)*.5 : (1-Math.pow(1-(x-.5)*2,-c))*.5+.5;
  return 0;
}
function interpolate(a,b,t) {
  if(typeof a==='number'&&typeof b==='number')return lerp(a,b,t);
  if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length)return a.map((v,i)=>interpolate(v,b[i],t));
  return clone(t<1?a:b);
}
function cubic(a,b,pre,post,w,bt,pt,pot) {
  if(Array.isArray(a))return a.map((v,i)=>cubic(v,b[i],pre[i],post[i],w,bt,pt,pot));
  if(typeof a!=='number')return clone(w<1?a:b);
  const t=bt*w,a1=lerp(pre,a,pt===0?0:(t-pt)/-pt),a2=lerp(a,b,bt===0?.5:t/bt),a3=lerp(b,post,pot-bt===0?1:(t-bt)/(pot-bt));
  return lerp(lerp(a1,a2,bt-pt===0?0:(t-pt)/(bt-pt)),lerp(a2,a3,pot===0?1:t/pot),bt===0?.5:t/bt);
}
export function animationTime(time,length=1,loop=0) {
  if(!(length>0))return 0;
  if(loop===1)return mod(time,length);
  if(loop===2){const t=mod(time,length*2);return t>length?length*2-t:t;}
  return clamp(time,0,length);
}
export function sampleTrack(keys,time,{length=1,loop=0,loopWrap=true,interpolation=1,captureValue,captureDuration}={}) {
  let times=keys.times,values=keys.values,transitions=keys.transitions||times.map(()=>1);
  if(!times?.length)return undefined;
  const duration=captureDuration??times[0];
  const captured=keys.update===2&&duration>0&&time<duration;
  if(captured&&captureValue===undefined)throw Error('UPDATE_CAPTURE requires captureProperties');
  const finish=value=>captured?interpolate(captureValue,value,clamp(time/duration)):clone(value);
  const n=times.filter(t=>t<=length+1e-7).length;if(!n)return undefined;
  time=animationTime(time,length,loop);
  if(n===1)return finish(values[0]);
  let index=-1;for(let i=0;i<n&&times[i]<=time+1e-9;i++)index=i;
  function fetch(i) {
    if(!loop||!loopWrap){i=clamp(i,0,n-1);return {value:values[i],time:times[i],transition:transitions[i]??1};}
    const j=mod(i,n),cycle=(i-j)/n;
    if(loop===1||mod(cycle,2)===0)return {value:values[j],time:cycle*length+times[j],transition:transitions[j]??1};
    const k=n-1-j;return {value:values[k],time:(cycle+1)*length-times[k],transition:transitions[k]??1};
  }
  const a=fetch(index),b=fetch(index+1);
  if(interpolation===0||keys.update===1||a.transition===0)return finish(a.value);
  const w=godotEase(b.time===a.time?0:(time-a.time)/(b.time-a.time),a.transition);
  if(interpolation===1)return finish(interpolate(a.value,b.value,w));
  if(interpolation===2){const pre=fetch(index-1),post=fetch(index+2);return finish(cubic(a.value,b.value,pre.value,post.value,w,b.time-a.time,pre.time-a.time,post.time-a.time));}
  throw Error(`Unsupported animation interpolation ${interpolation}`);
}
export function resolveTexture(graph,ref,seen=new Set()) {
  if(!ref)return null;
  if(ref.$external){const t=graph.textures[ref.$external];return t?{key:ref.$external,width:t.width,height:t.height,crop:[0,0,t.width,t.height],file:t.file}:null;}
  if(!ref.$ref||seen.has(ref.$ref))return null;seen.add(ref.$ref);
  const r=resource(graph,ref);if(!r)return null;const p=r.properties;
  if(r.type==='AtlasTexture'){
    const base=resolveTexture(graph,p.atlas,seen);if(!base)return null;
    const region=p.region||[0,0,base.width,base.height],margin=p.margin||[0,0,0,0];
    return {...base,width:region[2]+margin[2],height:region[3]+margin[3],crop:[base.crop[0]+region[0],base.crop[1]+region[1],region[2],region[3]],margin,filterClip:p.filter_clip??false};
  }
  if(r.type==='CanvasTexture'){
    const diffuse=p.diffuse_texture?resolveTexture(graph,p.diffuse_texture,seen):null;
    if(p.diffuse_texture&&!diffuse)return null;
    return {key:ref.$ref,resource:r.type,properties:p,diffuse,width:diffuse?.width??1,height:diffuse?.height??1,crop:diffuse?.crop??[0,0,1,1]};
  }
  if(['GradientTexture1D','GradientTexture2D','NoiseTexture2D','ImageTexture','CompressedTexture2D'].includes(r.type)){
    return {key:ref.$ref,resource:r.type,properties:p,width:p.width??(r.type==='GradientTexture1D'?256:64),height:r.type==='GradientTexture1D'?1:(p.height??64)};
  }
  return null;
}
function propertySet(node,property,value) {
  if(!property.includes(':')){node.properties[property]=clone(value);return;}
  const [head,...rest]=property.split(':');let v=node.properties[head];
  const component={x:0,y:1,z:2,w:3,r:0,g:1,b:2,a:3};
  if(Array.isArray(v)&&rest.length===1&&rest[0] in component){v=[...v];v[component[rest[0]]]=value;node.properties[head]=v;return;}
  throw Error('Unsupported nested animated property '+property);
}
function trackTarget(nodes,root,path) {
  const [relative,...properties]=path.split(':');
  let p;
  if(relative.startsWith('%')){
    const name=relative.slice(1);p=[...nodes.values()].find(n=>n.path.split('/').at(-1)===name&&n.properties.unique_name_in_owner)?.path;
  }else p=joined(root,relative);
  return {node:nodes.get(p),path:p,property:properties.join(':')};
}
function trackIds(properties) {return [...new Set(Object.keys(properties).map(k=>/^tracks\/(\d+)\/type$/.exec(k)?.[1]).filter(x=>x!==undefined))].map(Number).sort((a,b)=>a-b);}
function frameAt(animation,elapsed,startFrame=0,startProgress=0,customSpeed=1) {
  const frames=animation.frames||[];if(!frames.length)return 0;
  const durations=frames.map(f=>f.duration??1),total=durations.reduce((a,b)=>a+b,0);
  let t=durations.slice(0,startFrame).reduce((a,b)=>a+b,0)+startProgress*durations[startFrame]+elapsed*(animation.speed??5)*customSpeed;
  t=animation.loop?mod(t,total):clamp(t,0,total);
  for(let i=0;i<frames.length;i++){if(t<durations[i]||i===frames.length-1)return i;t-=durations[i];}
  return 0;
}
const COMMON=new Set(['position','scale','rotation','skew','transform','modulate','self_modulate','visible','z_index','z_as_relative','show_behind_parent','top_level','material','use_parent_material','texture_filter','texture_repeat','light_mask','visibility_layer','unique_name_in_owner','script','physics_interpolation_mode','process_mode','editor_description']);
const SPRITE=new Set(['texture','offset','centered','flip_h','flip_v','hframes','vframes','frame','frame_coords','region_enabled','region_rect','region_filter_clip_enabled','sprite_frames','animation','autoplay','frame_progress','speed_scale']);
const LINE=new Set(['points','width','width_curve','default_color','gradient','texture','texture_mode','joint_mode','begin_cap_mode','end_cap_mode','round_precision','sharp_limit','antialiased','closed']);
export function sampleScene(graph,scenePath,ctx={}) {
  const scene=graph.scenes[scenePath];if(!scene)throw Error('Unknown source scene '+scenePath);
  const time=ctx.time??0;if(!Number.isFinite(time))throw Error('Non-finite source time');
  const nodes=new Map(scene.nodes.map(n=>[n.path,{...n,properties:clone(n.properties)}]));
  const out={sprites:[],lines:[],particles:[],methods:[],unsupported:[],nodes:[],finished:false};
  const warn=(code,nodePath,detail)=>out.unsupported.push({code,nodePath,detail});
  const plays=new Map(),freed=new Set(),methodEvents=[];
  for(const node of nodes.values()){
    if(node.type!=='AnimationPlayer')continue;
    const p=node.properties,root=joined(node.path,p.root_node??'..');
    const selected=ctx.animationNames?.[node.path]??(node.path==='AnimationPlayer'?ctx.animationName:undefined)??p.autoplay;
    if(!selected)continue;
    const split=selected.includes('/')?selected.indexOf('/'):-1,libName=split<0?'':selected.slice(0,split),name=split<0?selected:selected.slice(split+1);
    const lib=resource(graph,p['libraries/'+libName]),anim=resource(graph,lib?.properties._data?.[name]);
    if(!anim){warn('missing-animation',node.path,selected);continue;}
    const a=anim.properties,length=a.length??1,loop=a.loop_mode??0,localTime=(ctx.animationTimes?.[node.path]??time)*(p.speed_scale??1);
    const current=animationTime(localTime,length,loop);
    const autoCaptureDuration=Math.max(0,...trackIds(a).map(i=>a[`tracks/${i}/keys`]?.update===2?a[`tracks/${i}/keys`].times[0]||0:0));
    const configuredCapture=ctx.captureDuration??p.playback_auto_capture_duration??-1;
    const captureDuration=configuredCapture<0?autoCaptureDuration:configuredCapture;
    for(const id of trackIds(a)){
      const pre=`tracks/${id}/`;if(a[pre+'enabled']===false)continue;
      const type=a[pre+'type'],keys=a[pre+'keys'];
      const target=trackTarget(nodes,root,a[pre+'path']);
      if(!target.node){warn('missing-animation-target',node.path,a[pre+'path']);continue;}
      if(type==='value'){
        try{
          const capture=ctx.captureProperties?.[target.path]?.[target.property];
          if(keys.update===2&&(p.playback_auto_capture_transition_type??0)!==0)throw Error('Nonlinear auto capture transition not implemented');
          const value=sampleTrack(keys,localTime,{length,loop,loopWrap:a[pre+'loop_wrap']??true,interpolation:a[pre+'interp']??1,captureValue:capture,captureDuration});
          if(value!==undefined)propertySet(target.node,target.property,value);
        }catch(e){warn('animation-value',target.path,e.message);}
      }else if(type==='method'){
        for(let i=0;i<keys.times.length;i++)if(keys.times[i]<=current+1e-7){
          methodEvents.push({nodePath:target.path,method:keys.values[i].method,args:keys.values[i].args||[],at:keys.times[i],age:current-keys.times[i],playerPath:node.path,animation:selected});
        }
      }else if(type!=='audio')warn('animation-track',node.path,type);
    }
  }
  methodEvents.sort((a,b)=>a.at-b.at);
  for(const event of methodEvents){
    out.methods.push(event);const node=nodes.get(event.nodePath),p=node.properties;
    if(event.method==='queue_free'){freed.add(node.path);continue;}
    if(event.method==='play'&&node.type==='AnimatedSprite2D'){
      plays.set(node.path,{name:event.args[0]||p.animation||'default',age:event.age,speed:event.args[1]??1,fromEnd:event.args[2]??false});continue;
    }
    if(event.method==='stop'&&node.type==='AnimatedSprite2D'){plays.set(node.path,{name:p.animation||'default',age:0,speed:0});p.frame=0;continue;}
    if(event.method==='animate_width_in'||event.method==='animate_width_out'){
      const line=[...nodes.values()].find(n=>n.type==='Line2D'&&n.path===joined(node.path,'Visual/Line2D'));
      if(line&&p.base_width){
        const t=clamp(event.age/(event.args[0]||.000001));
        const full=Math.max(5,p.base_width*Math.pow(ctx.damageRatio??1,.7));
        const start=ctx.widthGrow??(ctx.captureProperties?.[line.path]?.width!==undefined?ctx.captureProperties[line.path].width/full:1);
        const grow=event.method==='animate_width_in'?1-(1-t)**3:start*(1-t**3);
        line.properties.width=full*grow;continue;
      }
    }
    if(ctx.methodHandler?.(event,{nodes,time,graph})===true)continue;
    // Events are retained even when the caller handles gameplay elsewhere.
    warn('script-method',event.nodePath,event.method);
  }
  for(const [path,props]of Object.entries(ctx.overrides||{})){
    const node=nodes.get(path);if(!node){warn('missing-override',path,'Node absent');continue;}
    Object.assign(node.properties,clone(props));
  }
  const rootMatrix=ctx.rootTransform||IDENTITY;
  const evaluated=new Map();
  function evaluate(node){
    if(evaluated.has(node.path))return evaluated.get(node.path);
    const p=node.properties,parent=nodes.get(parentPath(node.path));
    const state=parent?evaluate(parent):{matrix:rootMatrix,color:ctx.color||WHITE,visible:true,z:ctx.z||0,material:null};
    const matrix=multiplyMatrix(p.top_level?rootMatrix:state.matrix,localMatrix(p));
    const color=colorMultiply(state.color,p.modulate||WHITE),selfColor=colorMultiply(color,p.self_modulate||WHITE);
    const visible=state.visible&&p.visible!==false&&![...freed].some(f=>f===node.path||f==='.'||node.path.startsWith(f+'/'));
    const z=(p.z_as_relative===false?0:state.z)+(p.z_index||0);
    const material=p.use_parent_material?state.material:p.material;
    const e={matrix,color,selfColor,visible,z,material};evaluated.set(node.path,e);return e;
  }
  for(const node of nodes.values()){
    const p=node.properties,e=evaluate(node);out.nodes.push({...node,...e});
    if(!e.visible)continue;
    const base={nodePath:node.path,matrix:e.matrix,color:e.selfColor,z:e.z,behind:p.show_behind_parent??false,material:e.material||null,textureRepeat:p.texture_repeat??0,textureFilter:p.texture_filter??0};
    if(node.type==='GPUParticles2D'){out.particles.push({...node,...base});continue;}
    if(node.type==='Line2D'){
      for(const k of Object.keys(p))if(!COMMON.has(k)&&!LINE.has(k))warn('line-property',node.path,k);
      let points=p.points||[];
      if(ctx.linePoints?.[node.path])points=ctx.linePoints[node.path];
      else if(Number.isFinite(ctx.beamLength)&&points.length===2){
        const a=points[0],b=points[1],dx=b[0]-a[0],dy=b[1]-a[1],l=Math.hypot(dx,dy);
        if(l)points=[a,[a[0]+dx/l*ctx.beamLength,a[1]+dy/l*ctx.beamLength]];
      }
      const texture=resolveTexture(graph,p.texture);if(p.texture&&!texture)warn('missing-texture',node.path,p.texture);
      out.lines.push({...base,points:points.map(p=>transformPoint(e.matrix,p)),localPoints:points,width:p.width??10,canvasColor:base.color,color:p.gradient?base.color:colorMultiply(base.color,p.default_color||WHITE),texture,gradient:p.gradient||null,widthCurve:p.width_curve||null,jointMode:p.joint_mode??0,beginCapMode:p.begin_cap_mode??0,endCapMode:p.end_cap_mode??0,textureMode:p.texture_mode??0,roundPrecision:p.round_precision??8,sharpLimit:p.sharp_limit??2,antialiased:p.antialiased??false,closed:p.closed??false});continue;
    }
    if(node.type==='Sprite2D'||node.type==='AnimatedSprite2D'){
      for(const k of Object.keys(p))if(!COMMON.has(k)&&!SPRITE.has(k))warn('sprite-property',node.path,k);
      let tex=p.texture,frame=p.frame??0;
      if(node.type==='AnimatedSprite2D'){
        const sf=resource(graph,p.sprite_frames),play=plays.get(node.path)|| (p.autoplay?{name:p.autoplay,age:time,speed:1}:null);
        const name=play?.name||p.animation||'default',animation=sf?.properties.animations?.find(a=>a.name===name);
        if(!animation){warn('missing-sprite-animation',node.path,name);continue;}
        if(play){
          if(play.fromEnd){warn('reverse-sprite-playback',node.path,name);continue;}
          frame=frameAt(animation,play.age,p.frame??0,p.frame_progress??0,(p.speed_scale??1)*play.speed);
        }
        // AnimatedSprite2D::set_frame_and_progress clamps an assigned frame to
        // the last valid frame. The source flail tracks intentionally key 6 in
        // a six-frame SpriteFrames resource; Godot renders frame 5 there.
        frame=clamp(Math.trunc(frame),0,Math.max(0,(animation.frames?.length??0)-1));
        tex=animation.frames?.[frame]?.texture;
      }
      let texture=resolveTexture(graph,tex);if(!texture){warn('missing-texture',node.path,tex);continue;}
      if(!texture.crop){warn('procedural-sprite-texture',node.path,texture.resource);}
      let width=texture.width,height=texture.height;
      if(node.type==='Sprite2D'){
        const region=p.region_enabled?p.region_rect:null;
        if(region){texture={...texture,crop:region};width=region[2];height=region[3];}
        const hf=p.hframes??1,vf=p.vframes??1;
        if(hf!==1||vf!==1){width/=hf;height/=vf;const [fx,fy]=p.frame_coords||[frame%hf,Math.floor(frame/hf)];const crop=texture.crop||[0,0,texture.width,texture.height];texture={...texture,crop:[crop[0]+fx*width,crop[1]+fy*height,width,height]};}
      }
      const offset=p.offset||[0,0],margin=texture.margin||[0,0,0,0],centered=p.centered??true;
      const rect=[offset[0]-(centered?width/2:0)+margin[0],offset[1]-(centered?height/2:0)+margin[1],texture.crop?.[2]??width,texture.crop?.[3]??height];
      out.sprites.push({...base,texture,localRect:rect,flipX:p.flip_h??false,flipY:p.flip_v??false,frame});continue;
    }
    if(['ColorRect','TextureProgressBar','PointLight2D'].includes(node.type))warn('render-node',node.path,node.type);
  }
  out.finished=freed.has('.');return out;
}

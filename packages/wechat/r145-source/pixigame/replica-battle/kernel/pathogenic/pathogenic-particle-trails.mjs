/*
 * Godot GPUParticles2D internal 2D trail mesh and canvas skinning port.
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * Sources, Godot 4.7-stable:
 * scene/2d/gpu_particles_2d.cpp NOTIFICATION_DRAW (2D mesh and identity bind poses)
 * servers/rendering/renderer_rd/shaders/canvas.glsl (weighted bone/color blending)
 * servers/rendering/renderer_rd/shaders/particles_copy.glsl (natural frame offset)
 * servers/rendering/renderer_rd/storage_rd/particles_storage.cpp (bone history slots)
 * RibbonTrailMesh/TubeTrailMesh are 3D resources: neither occurs in this source graph.
 */
import {resolveTexture,resource,transformPoint} from './source-scene-sampler.mjs';
const IDENTITY=[1,0,0,1,0,0];
export const TRAIL_LIMITS=Object.freeze([
 'Mesh topology, identity bind poses, weights and vertex/color skinning follow GPUParticles2D; this is not a RibbonTrailMesh or TubeTrailMesh substitution.',
 'History-derived bones inherit CPU particle sampling and fractional-frame differences; supply trail.bones with exact matrix/color states to bypass temporal reconstruction.',
 'Godot independent delayed trail particles use current TIME for noise. A head history cannot reproduce time-dependent turbulence; those materials require explicit bones.',
 'The original renderer mode is unknown. trail_compat_fallback.gd disables trails in gl_compatibility; set options.renderer when that mode is known.',
]);
/** Source topology, including intentionally zero Y rest coordinates and identity binds. */
export function particleTrailLayout(width,sections=8,subdivisions=4){
 if(!(width>0)||!Number.isInteger(sections)||sections<2||sections>128||!Number.isInteger(subdivisions)||subdivisions<1||subdivisions>1024)throw Error('Invalid source GPUParticles2D trail mesh parameters');
 const vertices=[],indices=[],total=sections*subdivisions;
 for(let j=0;j<=total;j++){
  const bone=Math.floor(j/subdivisions),blend=1-(j%subdivisions)/subdivisions;
  for(let side=0;side<2;side++)vertices.push({position:[(side-.5)*width,0],uv:[side,j/total],bones:[bone,Math.min(sections,bone+1),0,0],weights:[blend,1-blend,0,0]});
  if(j){const b=j*2-2;indices.push(b,b+1,b+2,b+1,b+3,b+2);}
 }
 return {vertices,indices,bindPoses:Array.from({length:sections+1},()=>[...IDENTITY]),sections,subdivisions};
}
function matrix(point){if(point.matrix)return point.matrix;const c=Math.cos(point.rotation),s=Math.sin(point.rotation);return [c*point.scale[0],s*point.scale[0],-s*point.scale[1],c*point.scale[1],...point.position];}
function historyState(points,time){
 if(!points.length)throw Error('Particle trail has no source history');
 let a=points[0],b=a;
 if(time>=points.at(-1).time)a=b=points.at(-1);
 else if(time>points[0].time){const i=points.findIndex(p=>p.time>=time);a=points[i-1];b=points[i];}
 const f=a===b?0:(time-a.time)/(b.time-a.time),mix=(x,y)=>x.map((v,i)=>v+(y[i]-v)*f);
 if(!a.velocity||!b.velocity)throw Error('Trail history requires source simulation velocity for Godot natural-offset correction');
 return {matrix:mix(matrix(a),matrix(b)),color:mix(a.color,b.color),velocity:mix(a.velocity,b.velocity)};
}
/** A caller may provide exact per-bone states in trail.bones to bypass history interpolation. */
export function particleTrailBones(node,trail){
 const p=node.properties??node,sections=p.trail_sections??8,count=sections+1;
 if(trail.bones){if(trail.bones.length!==count)throw Error(`Expected ${count} source trail bones`);return trail.bones.map(b=>({matrix:[...matrix(b)],color:[...b.color]}));}
 const fps=(p.fixed_fps??30)>0?(p.fixed_fps??30):60,speed=trail.speedScale??p.speed_scale??1;
 if(!(speed>0))throw Error('Frozen trail requires explicit saved bone states');
 const total=Math.max(1,Math.trunc((p.trail_lifetime??.3)*fps)),age=trail.age??trail.points.at(-1)?.time;
 return Array.from({length:count},(_,i)=>{
  const offset=i*total/count,slot=Math.floor(offset),natural=(offset-slot)/fps;
  const state=historyState(trail.points,age-slot/fps/speed);
  state.matrix[4]-=state.velocity[0]*natural;state.matrix[5]-=state.velocity[1]*natural;
  return {...state,historySlot:slot,naturalOffset:natural};
 });
}
/** Input: sampled node, particle sampler's trails, complete emitter matrix.
 * Output vertices are world positions with normalized UV and HDR color, directly
 * compatible with PathogenicSceneView.mesh(..., geometry, time, true).
 * Render these meshes INSTEAD OF particle sprite quads when trails are enabled.
 */
export function particleTrailGeometry(graph,node,trails,emitterMatrix=node.matrix??IDENTITY,options={}){
 const p=node.properties??node,unsupported=[],meshes=[],limits=[...TRAIL_LIMITS];
 const fail=issue=>{unsupported.push(issue);if(options.strict!==false)throw Error(`Unsupported particle trail: ${issue}`);};
 if(node.type&&node.type!=='GPUParticles2D'){fail(`node type ${node.type}`);return {meshes,unsupported,limits};}
 if(!p.trail_enabled)return {meshes,unsupported,limits,enabled:false};
 if(options.renderer==='gl_compatibility'||options.renderer==='dummy'){
  const scripted=p.script?.$external==='res://scn/particles/trail_compat_fallback.gd';
  if(!scripted)fail('Godot compatibility backend does not implement GPU trail skinning and this node has no fallback script');
  return {meshes,unsupported,limits,enabled:false,fallbackToSprites:scripted};
 }
 const sourceTexture=resolveTexture(graph,p.texture);
 if(!sourceTexture){fail('unresolved texture');return {meshes,unsupported,limits};}
 // GPUParticles2D uses texture.get_rid() with 0..1 UV, not AtlasTexture.draw_rect.
 // An AtlasTexture determines the logical mesh width but samples the full RID.
 const base=graph.textures[sourceTexture.key];
 const texture=base?{...sourceTexture,width:base.width,height:base.height,crop:[0,0,base.width,base.height]}:sourceTexture;
 const layout=particleTrailLayout(sourceTexture.width,p.trail_sections??8,p.trail_section_subdivisions??4);
 const material=resource(graph,p.process_material),mp=material?.properties??{};
 const canvasColor=node.color??[1,1,1,1];
 for(const trail of trails){
  if(!trail.bones&&mp.turbulence_enabled){fail(`time-dependent turbulence requires independent bone states (${node.nodePath??node.path??'.'})`);continue;}
  const bones=particleTrailBones(node,trail),world=trail.space==='world',outer=world?IDENTITY:emitterMatrix;
  const vertices=layout.vertices.map(v=>{
   const a=bones[v.bones[0]],b=bones[v.bones[1]],wa=v.weights[0],wb=v.weights[1],pa=transformPoint(a.matrix,v.position),pb=transformPoint(b.matrix,v.position);
   const local=[pa[0]*wa+pb[0]*wb,pa[1]*wa+pb[1]*wb];
   return {position:transformPoint(outer,local),uv:[...v.uv],sourceUV:[...v.uv],color:a.color.map((c,i)=>(c*wa+b.color[i]*wb)*canvasColor[i]),bones:v.bones,weights:v.weights};
  });
  meshes.push({id:trail.id,texture,sourceTexture,material:node.material??p.material,matrix:outer,color:[1,1,1,1],z:node.z??p.z_index??0,
   vertices,indices:layout.indices,bones,bindPoses:layout.bindPoses,instanceCustom:trail.points?.at(-1)?.custom??trail.custom,space:'world'});
 }
 return {meshes,unsupported,limits,enabled:true};
}

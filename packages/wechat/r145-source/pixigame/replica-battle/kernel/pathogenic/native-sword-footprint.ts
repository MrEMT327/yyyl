import {sampleOriginalEffect} from '../original-effects';
import {resource,sampleScene,transformPoint} from './source-scene-sampler.mjs';

type Row=Record<string,any>;
type Bounds={left:number;right:number;top:number;bottom:number};
export const SWORD_FRAME_BOUNDS={
  texture:'res://gfx/player/bullets/slash_animation.png',
  sha256:'6e43d0e279e79920be5b3dd8f6876ae11999d0f2450262d4833ffc4570fffda0',
  width:548,height:367,
  frames:[[9,163,223,279],[24,45,235,252],[11,11,422,259],[25,18,503,271],[127,6,519,280],[308,129,539,334],[311,256,530,361]],
};
export const isNativeSwordSwing=(fx:Row)=>fx.kind==='muzzle'&&[220005,220017].includes(fx.modelId);

function boundsOf(points:number[][]):Bounds|null{
  if(!points.length)return null;
  return{left:Math.min(...points.map(point=>point[0])),right:Math.max(...points.map(point=>point[0])),
    top:Math.min(...points.map(point=>point[1])),bottom:Math.max(...points.map(point=>point[1]))};
}

function nativeSwordParticles(data:Row,fx:Row){
  const effect=data?.effects?.[fx.modelId];
  const primary=effect?.layers?.find((layer:Row)=>layer.hierarchy?.at(-1)==='Mesh_Dg');
  if(!primary)throw Error('Missing captured sword blade geometry: '+fx.modelId);
  const layers=new Set(effect.layers.filter((layer:Row)=>layer.renderer?.meshKey===primary.renderer.meshKey).map((layer:Row)=>String(layer.id)));
  const particles=sampleOriginalEffect(data,fx.modelId,fx.age,fx.uid,{simulationSpeed:fx.originalSpeed});
  return particles.filter(particle=>layers.has(particle.layerId)&&particle.alpha>0&&particle.mesh);
}

function nativeSwordPoints(data:Row,fx:Row):number[][]{
  return nativeSwordParticles(data,fx).flatMap(particle=>particle.mesh!.vertices.map(vertex=>[vertex.x,vertex.z]));
}

export function nativeSwordScreenMeshes(data:Row,fx:Row,screen:(horizontal:number,vertical:number)=>{x:number;y:number},visualScale=1){
  const angle=fx.angle??0,cosine=Math.cos(angle),sine=Math.sin(angle),mirror=fx.originalMirrorX?-1:1;
  const scale=(fx.originalScale??1)*visualScale;
  return nativeSwordParticles(data,fx).map(particle=>{
    const layer=data.effects[fx.modelId].layers.find((candidate:Row)=>String(candidate.id)===particle.layerId);
    const coordinates=data.meshes[layer.renderer.meshKey].uv;
    return{key:particle.layerId,material:{$ref:'host://continuous-blue-sword-v1/material'},
      // Give overlapping authored mesh layers separate light weights, preserving
      // every original vertex, alpha, mirror, scale and swing timestamp.
      materialUniformOverrides:{swing_age:fx.age*(fx.originalSpeed??1),layer_strength:layer.hierarchy?.at(-1)==='Mesh_Dg'?1:.38},
      indices:particle.mesh!.indices,vertices:particle.mesh!.vertices.map((vertex,index)=>{
        const horizontal=vertex.x*mirror,vertical=vertex.z;
        const position=screen(fx.x+(horizontal*cosine+vertical*sine)*scale,fx.z+(-horizontal*sine+vertical*cosine)*scale);
        return{position:[position.x,position.y],uv:[coordinates[index][0],1-coordinates[index][1]],color:[1,1,1,particle.alpha]};
      })};
  });
}

export function nativeSwordFootprint(data:Row,fx:Row):Bounds|null{
  return boundsOf(nativeSwordPoints(data,fx).map(point=>[point[0],-point[1]]));
}

export function nativeSwordScreenFootprint(data:Row,fx:Row,screen:(horizontal:number,vertical:number)=>{x:number;y:number},visualScale=1):Bounds|null{
  const angle=fx.angle??0,cosine=Math.cos(angle),sine=Math.sin(angle),mirror=fx.originalMirrorX?-1:1;
  const scale=(fx.originalScale??1)*visualScale;
  return boundsOf(nativeSwordPoints(data,fx).map(point=>{
    const horizontal=point[0]*mirror,vertical=point[1];
    const position=screen(fx.x+(horizontal*cosine+vertical*sine)*scale,fx.z+(-horizontal*sine+vertical*cosine)*scale);
    return[position.x,position.y];
  }));
}

export function swordSpriteFootprint(sample:Row):Bounds|null{
  const points:number[][]=[];
  for(const sprite of sample.sprites){
    if(sprite.texture?.key!==SWORD_FRAME_BOUNDS.texture)throw Error('Unmeasured sword texture: '+sprite.texture?.key);
    const crop=sprite.texture.crop??[0,0,SWORD_FRAME_BOUNDS.width,SWORD_FRAME_BOUNDS.height];
    const frame=crop[0]/SWORD_FRAME_BOUNDS.width,opaque=SWORD_FRAME_BOUNDS.frames[frame];
    if(!opaque||crop[1]!==0||crop[2]!==SWORD_FRAME_BOUNDS.width||crop[3]!==SWORD_FRAME_BOUNDS.height)throw Error('Unmeasured sword frame: '+crop);
    const [left,top,right,bottom]=opaque,[originX,originY]=sprite.localRect;
    for(const point of [[left,top],[right,top],[right,bottom],[left,bottom]])
      points.push(transformPoint(sprite.matrix,[originX+point[0],originY+point[1]]));
  }
  return boundsOf(points);
}

export function swordSourceDuration(graph:Row,path:string):number{
  const player=graph.scenes[path].nodes.find((node:Row)=>node.type==='AnimationPlayer');
  const library=resource(graph,player.properties['libraries/']);
  return resource(graph,library.properties._data[player.properties.autoplay]).properties.length;
}

export function fitSwordFootprint(graph:Row,path:string,context:Row,fit:Row):Row{
  const matrix=[...context.rootTransform];
  if(fit.mirrorX){matrix[0]*=-1;matrix[1]*=-1;}
  const sample=sampleScene(graph,path,{...context,rootTransform:matrix});
  if(sample.unsupported.length)throw Error('Unsupported sword footprint sample: '+JSON.stringify(sample.unsupported));
  const source=swordSpriteFootprint(sample);
  if(!source)return context;
  if(!(source.right>source.left&&source.bottom>source.top))return context;
  const target=fit.bounds as Bounds;
  const scaleX=(target.right-target.left)/(source.right-source.left);
  const scaleY=(target.bottom-target.top)/(source.bottom-source.top);
  const fitted=[matrix[0]*scaleX,matrix[1]*scaleY,matrix[2]*scaleX,matrix[3]*scaleY,
    (target.left+target.right)/2+(matrix[4]-(source.left+source.right)/2)*scaleX,
    (target.top+target.bottom)/2+(matrix[5]-(source.top+source.bottom)/2)*scaleY];
  return{...context,rootTransform:fitted};
}

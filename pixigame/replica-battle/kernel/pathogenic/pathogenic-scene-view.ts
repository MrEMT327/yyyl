import Phaser from 'phaser';
import {trimEmitterHistory,VisualMeshPool} from '../combat-readability.mjs';
import {PathogenicHdrComposite} from './pathogenic-hdr-composite';
import {sampleScene,resolveTexture,resource,multiplyMatrix} from './source-scene-sampler.mjs';
import {ParticlePlayer} from './pathogenic-particles.mjs';
import {spriteGeometry,lineGeometry,inverseMatrix,matrix3,matrix4} from './pathogenic-geometry.mjs';
import {installGradientTexture} from './pathogenic-textures.mjs';
import {particleTrailGeometry} from './pathogenic-particle-trails.mjs';
import {registerPathogenicShader} from './pathogenic-shader-pipeline';
import {PathogenicMaterials,PathogenicScreenSnapshot} from './pathogenic-materials';

type Any = Record<string,any>;
const PLAIN={path:'pathogenic-source-canvas',code:'shader_type canvas_item; render_mode unshaded; void fragment() {}'};
const MULTIPLY=[1,0,0,1,0,0];
class SourceMesh extends Phaser.GameObjects.Mesh { refresh(){this.preUpdate(0,0);} }
export class SourceCoverageError extends Error {
  constructor(readonly details:any[]){super('Pathogenic source features require implementation: '+JSON.stringify(details));}
}
/** One view owns complete source scenes; there is deliberately no legacy renderer fallback. */
export class PathogenicSceneView {
  private views=new Map<string,SourceMesh>();
  readonly meshPool=new VisualMeshPool<SourceMesh>();
  private players=new Map<string,ParticlePlayer>();
  private histories=new Map<string,any[]>();
  private live=new Set<string>();
  private livePlayers=new Set<string>();
  private liveHistories=new Set<string>();
  private cameraOffset=[0,0];
  private clock=0;
  private materials?:PathogenicMaterials;
  private snapshot?:PathogenicScreenSnapshot;
  private capture?:Phaser.GameObjects.Extern;
  display?:PathogenicHdrComposite;
  diagnostics:any[]=[];
  constructor(readonly scene:Phaser.Scene,readonly graph:Any){scene.events.once('shutdown',()=>this.destroy());}
  preload(urlFor:(path:string,texture:Any)=>string){
    for(const [path,texture]of Object.entries(this.graph.textures) as [string,Any][])
      this.scene.load.image(path,urlFor(path,texture));
  }
  setCameraOffset(x:number,y:number){this.cameraOffset=[x,y];}
  beginFrame(time:number){
    if(!this.materials){this.display=new PathogenicHdrComposite(this.scene);this.snapshot=new PathogenicScreenSnapshot(this.scene);this.capture=this.snapshot.createCaptureObject(29);this.materials=new PathogenicMaterials(this.scene,this.graph,this.snapshot);}
    if(time<this.clock)this.reset();this.clock=time;this.live.clear();this.livePlayers.clear();this.liveHistories.clear();this.diagnostics=[];
  }
  draw(id:string,path:string,ctx:Any={}){
    const result:any=sampleScene(this.graph,path,ctx);
    const unsupported=result.unsupported.filter((x:Any)=>x.code!=='procedural-sprite-texture');
    if(unsupported.length)throw new SourceCoverageError(unsupported.map((x:Any)=>({...x,scene:path})));
    for(const sprite of result.sprites)this.mesh(`${id}:${sprite.nodePath}`,sprite,spriteGeometry(sprite),this.clock,false,ctx.projectilePalette,ctx);
    for(const line of result.lines){
      const geometry=lineGeometry(this.graph,line);
      if(geometry.unsupported?.length)throw new SourceCoverageError(geometry.unsupported.map((code:string)=>({code,scene:path,node:line.nodePath})));
      this.mesh(`${id}:${line.nodePath}`,line,geometry,this.clock,true,ctx.projectilePalette,ctx);
    }
    let player=this.players.get(id);
    if(result.particles.length){if(!player){player=new ParticlePlayer();this.players.set(id,player);}this.livePlayers.add(id);}
    for(const node of result.particles){
      // Store world-space particle history before the camera translation. Camera
      // scrolling must move existing particles, never become emitter motion.
      const [cameraX,cameraY]=this.cameraOffset;
      const worldNode={...node,matrix:[...node.matrix]};worldNode.matrix[4]-=cameraX;worldNode.matrix[5]-=cameraY;
      const key=`${id}:${node.nodePath}`,history=this.histories.get(key)??[];
      if(!history.length||history.at(-1).age!==ctx.time)history.push({age:ctx.time,matrix:worldNode.matrix});
      trimEmitterHistory(history,ctx.time,node.properties);
      this.histories.set(key,history);this.liveHistories.add(key);
      const particles=player!.sample(this.graph,worldNode,ctx.time,ctx.seed??1,{history,
        stopAge:ctx.stopAge,emitting:ctx.emit??node.properties.emitting});
      const ribbons=particleTrailGeometry(this.graph,worldNode,particles.trails,worldNode.matrix,{strict:true});
      if(ribbons.unsupported.length)throw new SourceCoverageError(ribbons.unsupported);
      for(const ribbon of ribbons.meshes){
        ribbon.matrix=[...ribbon.matrix];ribbon.matrix[4]+=cameraX;ribbon.matrix[5]+=cameraY;
        for(const vertex of ribbon.vertices){vertex.position[0]+=cameraX;vertex.position[1]+=cameraY;}
        this.mesh(`${key}:trail:${ribbon.id}`,ribbon,ribbon,this.clock,true,ctx.projectilePalette,ctx);
      }
      const baseTexture=resolveTexture(this.graph,node.properties.texture);
      if(!baseTexture)throw new SourceCoverageError([{code:'particle-texture',scene:path,node:node.nodePath}]);
      for(const p of ribbons.enabled?[]:particles.instances){
        const c=Math.cos(p.rotation),s=Math.sin(p.rotation);
        const local=[c*p.scale[0],s*p.scale[0],-s*p.scale[1],c*p.scale[1],...p.position];
        const matrix=p.space==='world'?local:multiplyMatrix(node.matrix,local);
        if(p.space==='world'){matrix[4]+=cameraX;matrix[5]+=cameraY;}
        const material=resource(this.graph,node.material);
        let texture=baseTexture;
        if(material?.type==='CanvasItemMaterial'&&material.properties.particles_animation){
          const m=material.properties,h=m.particles_anim_h_frames??1,v=m.particles_anim_v_frames??1;
          let frame=Math.floor(p.custom[2]*h*v);frame=m.particles_anim_loop?((frame%(h*v))+h*v)%(h*v):Math.max(0,Math.min(h*v-1,frame));
          const crop=baseTexture.crop??[0,0,baseTexture.width,baseTexture.height],w=crop[2]/h,ht=crop[3]/v;
          texture={...baseTexture,width:w,height:ht,crop:[crop[0]+frame%h*w,crop[1]+Math.floor(frame/h)*ht,w,ht]};
        }
        const sprite={...node,texture,matrix,localRect:[-texture.width/2,-texture.height/2,texture.width,texture.height],
          color:p.color.map((v:number,i:number)=>v*node.color[i]),z:node.z};
        this.mesh(`${key}:particle:${p.id}`,sprite,spriteGeometry(sprite),this.clock,false,ctx.projectilePalette,ctx);
      }
    }
    return result;
  }
  drawMeshes(id:string,meshes:Any[],projectilePalette?:number[],presentation:Any={}){
    for(const mesh of meshes)this.mesh(`${id}:${mesh.key}`,mesh,mesh,this.clock,true,projectilePalette,presentation);
  }
  private texture(descriptor:Any):string{
    if(!descriptor)return '__WHITE';
    if(descriptor.resource?.startsWith('GradientTexture'))return installGradientTexture(this.scene,this.graph,descriptor);
    if(descriptor.resource)throw new SourceCoverageError([{code:'procedural-texture',type:descriptor.resource,key:descriptor.key}]);
    if(!this.scene.textures.exists(descriptor.key))throw new SourceCoverageError([{code:'missing-loaded-texture',key:descriptor.key}]);
    return descriptor.key;
  }
  private mesh(key:string,item:Any,geometry:Any,time:number,line=false,projectilePalette?:number[],presentation:Any={}){
    if(!geometry.indices.length)return;
    const m=item.matrix??MULTIPLY;
    if(Math.abs(m[0]*m[3]-m[1]*m[2])<1e-12)return;
    const installed=this.materials!.installTexture(item.texture),textureKey=installed.key,texture=this.scene.textures.get(textureKey),source=texture.source[0];
    const resolved=this.materials!.resolve(item.material,item.materialUniformOverrides??{}, {compatibilityZeroLights:true});
    const pipeline=resolved.registration;
    let view=this.views.get(key);
    if(!view){view=this.meshPool.acquire(()=>{const mesh=new SourceMesh(this.scene,0,0,textureKey);mesh.hideCCW=false;mesh.ignoreDirtyCache=true;this.scene.add.existing(mesh);return mesh;});this.views.set(key,view!);}
    view!.setVisible(true).setTexture(textureKey).setPosition(0,0).setDepth((presentation.presentationDepth??30)+Math.max(-500,Math.min(500,item.z??0))*.001).setBlendMode(pipeline.blendMode);
    view.setOrtho(view.width,view.height);
    const points=geometry.vertices,indices=geometry.indices;
    // Source color stays in float uniforms; line vertex variation uses the
    // existing mesh color attributes and is recorded as a precision boundary.
    const gain=line?Math.max(1,...points.flatMap((v:Any)=>v.color.slice(0,3))):1;
    const colors=points.map((v:Any)=>line?((Math.round(Math.max(0,Math.min(1,v.color[0]/gain))*255)<<16)|(Math.round(Math.max(0,Math.min(1,v.color[1]/gain))*255)<<8)|Math.round(Math.max(0,Math.min(1,v.color[2]/gain))*255)):0xffffff);
    const uvs=points.flatMap((v:Any)=>line?v.uv:[v.uv[0]/source.width,v.uv[1]/source.height]);
    // Phaser Mesh's y coordinate points up before its orthographic projection.
    const positions=points.flatMap((v:Any)=>[v.position[0],-v.position[1]]);
    if(view.vertices.length!==indices.length){view.clear();view.addVertices(positions,uvs,indices,false,undefined,colors);}
    for(let i=0;i<indices.length;i++){
      const j=indices[i],v=view.vertices[i];v.x=positions[j*2];v.y=positions[j*2+1];v.setUVs(uvs[j*2],uvs[j*2+1]);v.color=colors[j];v.alpha=line?points[j].color[3]:1;
    }
    const crop=line?[0,0,source.width,source.height]:(item.texture?.crop??[0,0,source.width,source.height]);
    const opacity=presentation.presentationOpacity??1;
    view.setData('pathogenicShader',{time,projectilePalette,color:line?[gain,gain,gain,opacity]:[...item.color.slice(0,3),item.color[3]*opacity],
      screenToLocal:matrix3(inverseMatrix(item.matrix??MULTIPLY)),localToScreen:matrix3(item.matrix??MULTIPLY),modelMatrix:matrix4(item.matrix??MULTIPLY),
      textureSize:[source.width,source.height],uvRect:[crop[0]/source.width,crop[1]/source.height,crop[2]/source.width,crop[3]/source.height],
      mainPremultiplied:installed.binding.premultiplied,mainRepeat:item.textureRepeat===2,uniforms:resolved.uniforms,textures:resolved.textures,lighting:'unlit',compatibility:{renderer:'compatibility',lightCount:0,directionalLightCount:0}});
    view.setPipeline(pipeline.key);
    view.refresh();this.live.add(key);
  }
  endFrame(){
    for(const [key,view]of this.views)if(!this.live.has(key)){this.meshPool.release(view);this.views.delete(key);}
    for(const [id,player]of this.players)if(!this.livePlayers.has(id)){player.reset();this.players.delete(id);}
    for(const key of this.histories.keys())if(!this.liveHistories.has(key))this.histories.delete(key);
  }
  reset(){for(const v of this.views.values())v.destroy();this.views.clear();this.meshPool.clear();for(const p of this.players.values())p.reset();this.players.clear();this.histories.clear();}
  destroy(){this.display?.destroy();this.reset();this.capture?.destroy();this.capture=undefined;this.snapshot?.destroy();}
}

import {createSourceMeshShaderData,updateSourceMeshShaderData} from './source-mesh-shader-data.mjs';
import {updateSourceMeshGeometry} from './source-mesh-update.mjs';
import Phaser from 'phaser';
import {trimEmitterHistory,VisualMeshPool} from '../combat-readability.mjs';
import {PathogenicHdrComposite,type PathogenicBloomOptions} from './pathogenic-hdr-composite';
import {sampleSceneForRender,resolveTexture,resource} from './source-scene-sampler.mjs';
import {ParticlePlayer} from './pathogenic-particles.mjs';
import {spriteGeometry,lineGeometry} from './pathogenic-geometry.mjs';
import {installGradientTexture} from './pathogenic-textures.mjs';
import {particleTrailGeometry} from './pathogenic-particle-trails.mjs';
import {registerPathogenicShader} from './pathogenic-shader-pipeline';
import {PathogenicMaterials,PathogenicScreenSnapshot} from './pathogenic-materials';

type Any = Record<string,any>;
type SharedTexture={ref:Any;installed:ReturnType<PathogenicMaterials["installTexture"]>;textureKey:string;source:Phaser.Textures.TextureSource};
type SharedMaterial={resolved?:ReturnType<PathogenicMaterials["resolve"]>;texture?:SharedTexture};
const PLAIN={path:'pathogenic-source-canvas',code:'shader_type canvas_item; render_mode unshaded; void fragment() {}'};
const MULTIPLY=[1,0,0,1,0,0];
type ParticleDraw={item:Any;matrix:number[];local:number[];color:number[];rect:number[]};
class SourceMesh extends Phaser.GameObjects.Mesh {
  shaderData?:Any;spriteShape?:Any;particleDraw?:ParticleDraw;
  // Mesh writes these runtime counters; its public types hide that ownership.
  declare totalFrame:number;declare totalRendered:number;
  private projectionWidth=NaN;private projectionHeight=NaN;
  private viewX=NaN;private viewY=NaN;private viewZ=NaN;
  // SceneView refreshes vertices after every source geometry/projection write.
  // The engine's earlier update only needs bookkeeping, including pause frames.
  preUpdate(){this.totalRendered=this.totalFrame;this.totalFrame=0;}
  prepareProjection(){
    const p=this.viewPosition;
    if(this.width!==this.projectionWidth||this.height!==this.projectionHeight||this.fov!==0||p.x!==this.viewX||p.y!==this.viewY||p.z!==this.viewZ){
      this.setOrtho(this.width,this.height);this.projectionWidth=this.width;this.projectionHeight=this.height;
      this.viewX=p.x;this.viewY=p.y;this.viewZ=p.z;
    }
  }
  refresh(){super.preUpdate(0,0);}
}
export class SourceCoverageError extends Error {
  constructor(readonly details:any[]){super('Pathogenic source features require implementation: '+JSON.stringify(details));}
}
/** One view owns complete source scenes; there is deliberately no legacy renderer fallback. */
export class PathogenicSceneView {
  private views=new Map<string,SourceMesh>();
  readonly meshPool=new VisualMeshPool<SourceMesh>();
  private players=new Map<string,ParticlePlayer>();
  private histories=new Map<string,{samples:any[];revision:number}>();
  private live=new Set<string>();
  private livePlayers=new Set<string>();
  private liveHistories=new Set<string>();
  private cameraOffset=[0,0];
  private clock=0;
  private materials?:PathogenicMaterials;
  private displaySettings?:Readonly<PathogenicBloomOptions>;
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
  configureDisplay(settings:Readonly<PathogenicBloomOptions>){
    this.display?.configure(settings);this.displaySettings={...settings};
  }
  beginFrame(time:number){
    if(!this.materials){this.display=new PathogenicHdrComposite(this.scene);if(this.displaySettings)this.display.configure(this.displaySettings);this.snapshot=new PathogenicScreenSnapshot(this.scene);this.capture=this.snapshot.createCaptureObject(29);this.materials=new PathogenicMaterials(this.scene,this.graph,this.snapshot);}
    if(time<this.clock)this.reset();this.snapshot!.beginFrame();this.clock=time;this.live.clear();this.livePlayers.clear();this.liveHistories.clear();this.diagnostics=[];
  }
  draw(id:string,path:string,ctx:Any={}){
    const result:any=sampleSceneForRender(this.graph,path,ctx);
    const unsupported=result.unsupported.filter((x:Any)=>x.code!=='procedural-sprite-texture');
    if(unsupported.length)throw new SourceCoverageError(unsupported.map((x:Any)=>({...x,scene:path})));
    for(const sprite of result.sprites)this.mesh(`${id}:${sprite.nodePath}`,sprite,spriteGeometry(sprite,this.views.get(`${id}:${sprite.nodePath}`)?.spriteShape),this.clock,false,ctx.projectilePalette,ctx);
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
      const key=`${id}:${node.nodePath}`,stored=this.histories.get(key)??{samples:[],revision:0},history=stored.samples;
      if(!history.length||history.at(-1).age!==ctx.time){history.push({age:ctx.time,matrix:worldNode.matrix});stored.revision++;}
      const historyLength=history.length;trimEmitterHistory(history,ctx.time,node.properties);if(history.length!==historyLength)stored.revision++;
      this.histories.set(key,stored);this.liveHistories.add(key);
      const particles=player!.sampleReadOnly(this.graph,worldNode,ctx.time,ctx.seed??1,{history,historyRevision:stored.revision,
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
      // A node's particles share read-only material parameters for this draw.
      // Resolve lazily after visibility/geometry guards, and keep per-particle
      // texture frames, transforms, color and every GPU upload independent.
      const sharedMaterial:SharedMaterial|undefined=particles.instances.length>1?{}:undefined;
      const material=resource(this.graph,node.material);
      for(const p of ribbons.enabled?[]:particles.instances){
        const c=Math.cos(p.rotation),s=Math.sin(p.rotation);
        const particleKey=`${key}:particle:${p.id}`,previous=this.views.get(particleKey);
        // Every retained mesh owns its scratch arrays. GPU draw data and
        // geometry are copied synchronously; source samples remain untouched.
        const draw:ParticleDraw=previous?.particleDraw??{item:{},matrix:Array(6).fill(0),local:Array(6).fill(0),color:Array(4).fill(0),rect:Array(4).fill(0)};
        const local=draw.local,matrix=draw.matrix;
        local[0]=c*p.scale[0];local[1]=s*p.scale[0];local[2]=-s*p.scale[1];local[3]=c*p.scale[1];local[4]=p.position[0];local[5]=p.position[1];
        if(p.space==='world'){
          for(let i=0;i<6;i++)matrix[i]=local[i];matrix[4]+=cameraX;matrix[5]+=cameraY;
        }else{
          const m=node.matrix;
          matrix[0]=m[0]*local[0]+m[2]*local[1];matrix[1]=m[1]*local[0]+m[3]*local[1];
          matrix[2]=m[0]*local[2]+m[2]*local[3];matrix[3]=m[1]*local[2]+m[3]*local[3];
          matrix[4]=m[0]*local[4]+m[2]*local[5]+m[4];matrix[5]=m[1]*local[4]+m[3]*local[5]+m[5];
        }
        let texture=baseTexture;
        if(material?.type==='CanvasItemMaterial'&&material.properties.particles_animation){
          const m=material.properties,h=m.particles_anim_h_frames??1,v=m.particles_anim_v_frames??1;
          let frame=Math.floor(p.custom[2]*h*v);frame=m.particles_anim_loop?((frame%(h*v))+h*v)%(h*v):Math.max(0,Math.min(h*v-1,frame));
          const crop=baseTexture.crop??[0,0,baseTexture.width,baseTexture.height],w=crop[2]/h,ht=crop[3]/v;
          texture={...baseTexture,width:w,height:ht,crop:[crop[0]+frame%h*w,crop[1]+Math.floor(frame/h)*ht,w,ht]};
        }
        const sprite=Object.assign(draw.item,node);
        draw.rect[0]=-texture.width/2;draw.rect[1]=-texture.height/2;draw.rect[2]=texture.width;draw.rect[3]=texture.height;
        for(let i=0;i<4;i++)draw.color[i]=p.color[i]*node.color[i];
        sprite.texture=texture;sprite.matrix=matrix;sprite.localRect=draw.rect;sprite.color=draw.color;
        this.mesh(particleKey,sprite,spriteGeometry(sprite,previous?.spriteShape),this.clock,false,ctx.projectilePalette,ctx,sharedMaterial);
        const rendered=previous??this.views.get(particleKey);
        if(rendered)rendered.particleDraw=draw;
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
  private mesh(key:string,item:Any,geometry:Any,time:number,line=false,projectilePalette?:number[],presentation:Any={},sharedMaterial?:SharedMaterial){
    if(!geometry.indices.length)return;
    const m=item.matrix??MULTIPLY;
    if(Math.abs(m[0]*m[3]-m[1]*m[2])<1e-12)return;
    // Only share within this emitter draw, for the exact same descriptor.
    // Animated atlas crops and subsequent frames still resolve independently.
    let installed:SharedTexture["installed"],textureKey:string,source:Phaser.Textures.TextureSource;
    const sharedTexture=sharedMaterial?.texture;
    if(sharedTexture&&sharedTexture.ref===item.texture){({installed,textureKey,source}=sharedTexture);}
    else{
      installed=this.materials!.installTexture(item.texture);textureKey=installed.key;source=this.scene.textures.get(textureKey).source[0];
      if(sharedMaterial)sharedMaterial.texture={ref:item.texture,installed,textureKey,source};
    }
    const resolved=sharedMaterial?.resolved??this.materials!.resolve(item.material,item.materialUniformOverrides??{}, {compatibilityZeroLights:true});
    if(sharedMaterial)sharedMaterial.resolved=resolved;
    const pipeline=resolved.registration;
    let view=this.views.get(key);
    if(!view){view=this.meshPool.acquire(()=>{const mesh=new SourceMesh(this.scene,0,0,textureKey);mesh.hideCCW=false;mesh.ignoreDirtyCache=true;this.scene.add.existing(mesh);return mesh;});this.views.set(key,view!);}
    view.setVisible(true).setTexture(textureKey).setPosition(0,0).setDepth((presentation.presentationDepth??30)+Math.max(-500,Math.min(500,item.z??0))*.001).setBlendMode(pipeline.blendMode);
    view.prepareProjection();
    const gain=updateSourceMeshGeometry(view,geometry,source,line);if(!line)view.spriteShape=geometry;
    const data=view.shaderData??=createSourceMeshShaderData();
    updateSourceMeshShaderData(data,item,source,time,line,gain,presentation.presentationOpacity??1,projectilePalette,installed,resolved);
    view.setData('pathogenicShader',data);
    view.setPipeline(pipeline.key);
    view.refresh();this.live.add(key);
  }
  endFrame(){
    for(const [key,view]of this.views)if(!this.live.has(key)){this.meshPool.release(view);this.views.delete(key);}
    for(const [id,player]of this.players)if(!this.livePlayers.has(id)){player.reset();this.players.delete(id);}
    for(const key of this.histories.keys())if(!this.liveHistories.has(key))this.histories.delete(key);
  }
  reset(){this.snapshot?.beginFrame();for(const v of this.views.values())v.destroy();this.views.clear();this.meshPool.clear();for(const p of this.players.values())p.reset();this.players.clear();this.histories.clear();}
  destroy(){this.display?.destroy();this.reset();this.capture?.destroy();this.capture=undefined;this.snapshot?.destroy();}
}

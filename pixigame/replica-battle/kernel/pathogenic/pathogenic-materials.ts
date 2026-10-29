import Phaser from 'phaser';
import {makeFloatTarget,colorOnlyFramebuffer} from './pathogenic-float-target';
import {registerPathogenicShader,PathogenicShaderCoverageError,type ShaderTextureBinding,type ShaderUniformValue} from './pathogenic-shader-pipeline';
// @ts-ignore Source extraction helper is deliberately shared as plain JS.
import {resolveTexture} from './source-scene-sampler.mjs';
// @ts-ignore Source extraction helper is deliberately shared as plain JS.
import {installGradientTexture} from './pathogenic-textures.mjs';
type Any=Record<string,any>;
const straightUploads=new WeakMap<Phaser.Textures.TextureSource,{key:string;binding:ShaderTextureBinding}>();
/** Upload the original image with UNPACK_PREMULTIPLY_ALPHA_WEBGL=false.
 * Dividing an already linearly filtered premultiplied sample by alpha does not
 * reproduce Godot's straight-color interpolation at translucent boundaries. */
function straightTexture(scene:Phaser.Scene,key:string){
  const source=scene.textures.get(key).source[0],cached=straightUploads.get(source);
  if(cached&&scene.textures.exists(cached.key))return cached;
  if(!source.glTexture)throw new PathogenicShaderCoverageError(key,'texture has no WebGL upload');
  if(source.glTexture.pma===false){const result={key,binding:{texture:source.glTexture,premultiplied:false}};straightUploads.set(source,result);return result;}
  const image=source.image;
  if(!image||!(image instanceof HTMLImageElement||image instanceof HTMLCanvasElement||typeof ImageBitmap!=='undefined'&&image instanceof ImageBitmap))
    throw new PathogenicShaderCoverageError(key,'straight upload requires original decoded image; render-target textures need explicit premultiplication metadata');
  const r=scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer,gl=r.gl,original=source.glTexture;
  const active=gl.getParameter(gl.ACTIVE_TEXTURE),pma=gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  const copyKey=`pathogenic-straight:${key}`;
  try{
    if(scene.textures.exists(copyKey))throw new PathogenicShaderCoverageError(copyKey,'stale straight-copy key belongs to another texture source');
    const texture=r.createTexture2D(0,original.minFilter,original.magFilter,original.wrapT,original.wrapS,gl.RGBA,image,source.width,source.height,false,true,original.flipY);
    scene.textures.addGLTexture(copyKey,texture);
    const result={key:copyKey,binding:{texture,premultiplied:false}};straightUploads.set(source,result);return result;
  }finally{gl.activeTexture(active);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,pma);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);}
}
function getResource(graph:Any,ref:any):Any|null {
  if(!ref)return null;
  if(ref.type&&ref.properties)return ref;
  const id=typeof ref==='string'?ref:ref.$ref;
  if(id&&graph.resources[id])return graph.resources[id];
  if(ref.$external){const found=Object.values(graph.resources).find((r:any)=>r.source===ref.$external&&r.localId===ref.$external);if(found)return found as Any;}
  throw new PathogenicShaderCoverageError(String(id??ref.$external),'unresolved material/texture resource');
}
export interface CanvasTextureChannels {
  diffuse:Any|null;normal:Any|null;specular:Any|null;
  specularColor:number[];shininess:number;filter:number;repeat:number;
}
/** Keep CanvasTexture channels explicit even when the validated zero-light path
 * does not sample normals. Never flatten it into a fabricated diffuse image. */
export function resolveCanvasTexture(graph:Any,ref:any):CanvasTextureChannels {
  const descriptor=ref?.key?ref:resolveTexture(graph,ref);
  if(ref&&!descriptor)throw new PathogenicShaderCoverageError(JSON.stringify(ref),'unresolved source texture');
  if(descriptor?.resource!=='CanvasTexture')return {diffuse:descriptor,normal:null,specular:null,specularColor:[1,1,1,1],shininess:1,filter:0,repeat:0};
  const p=descriptor.properties??graph.resources[descriptor.key]?.properties;
  if(!p)throw new PathogenicShaderCoverageError(descriptor.key,'CanvasTexture properties absent');
  const channel=(name:string)=>{if(!p[name])return null;const d=resolveTexture(graph,p[name]);if(!d)throw new PathogenicShaderCoverageError(descriptor.key,`unresolved ${name}`);return d;};
  return {diffuse:channel('diffuse_texture'),normal:channel('normal_texture'),specular:channel('specular_texture'),specularColor:p.specular_color??[1,1,1,1],shininess:p.specular_shininess??1,filter:p.texture_filter??0,repeat:p.texture_repeat??0};
}

/** A separate RGBA8 color attachment receives a GPU copy of the background.
 * Capture is a display-list operation, not an update() screenshot of last frame.
 * No destination framebuffer is bound during copyTexSubImage2D. */
export class PathogenicScreenSnapshot {
  private target!:Phaser.Renderer.WebGL.RenderTarget|ReturnType<typeof makeFloatTarget>;
  private halfFloat=false;
  private capturedFrame=-1;
  private requested=false;
  private format=0;
  private destroyed=false;
  readonly renderer:Phaser.Renderer.WebGL.WebGLRenderer;
  constructor(readonly scene:Phaser.Scene,readonly premultiplied=true){
    const renderer=scene.game.renderer;
    if(!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer))throw new PathogenicShaderCoverageError('SCREEN_TEXTURE','WebGL required');
    this.renderer=renderer;
  }
  private allocate(width:number,height:number,format:number,halfFloat=false){
    const r=this.renderer,gl=r.gl,fb=gl.getParameter(gl.FRAMEBUFFER_BINDING),wrapper=r.currentFramebuffer;
    const active=gl.getParameter(gl.ACTIVE_TEXTURE),unpackPma=gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),unpackFlip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
    gl.activeTexture(gl.TEXTURE0);const texture=gl.getParameter(gl.TEXTURE_BINDING_2D);
    try{
      this.target?.destroy();
      this.target=halfFloat?makeFloatTarget(r,width,height):new Phaser.Renderer.WebGL.RenderTarget(r,width,height,1,0,false,false,false,true);colorOnlyFramebuffer(this.target.framebuffer,gl);this.halfFloat=halfFloat;
      // An opaque WebGL default framebuffer has RGB storage. WebGL rejects
      // copyTexSubImage2D from RGB into RGBA (missing alpha component).
      const targetTexture=this.target.texture;targetTexture.format=format;targetTexture.minFilter=gl.LINEAR;targetTexture.magFilter=gl.LINEAR;
      if(!halfFloat)(targetTexture as any)._processTexture();this.format=format;
      this.capturedFrame=-1;
    }finally{
      // RenderTarget construction calls createFramebuffer, which changes both
      // GL and Phaser's framebuffer cache; restore both before continuing.
      gl.bindFramebuffer(gl.FRAMEBUFFER,fb);r.currentFramebuffer=wrapper;
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.activeTexture(active);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,unpackPma);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,unpackFlip);
    }
  }
  /** Keep demand until the next update, including paused render-only frames.
   * A new prepared frame declares its screen-reading meshes before depth 29. */
  beginFrame():void {this.requested=false;}
  requestCapture():void {this.requested=true;}
  capture(frame=this.scene.game.loop.frame):void {
    if(this.destroyed)throw new PathogenicShaderCoverageError('SCREEN_TEXTURE','snapshot destroyed');
    const r=this.renderer,gl=r.gl;
    if(gl.isContextLost())return;
    r.flush();
    const entryError=gl.getError();if(gl.isContextLost())return;if(entryError)throw new Error('Snapshot before allocate '+entryError);
    const current=r.currentFramebuffer;
    if(this.target&&(current===this.target.framebuffer||gl.getParameter(gl.FRAMEBUFFER_BINDING)===this.target.framebuffer.webGLFramebuffer))
      throw new PathogenicShaderCoverageError('SCREEN_TEXTURE','feedback: snapshot target is the active write framebuffer');
    const width=current?.renderTexture?.width??gl.drawingBufferWidth,height=current?.renderTexture?.height??gl.drawingBufferHeight;
    const format=current?.renderTexture?.format??(gl.getContextAttributes()?.alpha===false?gl.RGB:gl.RGBA);
    if(format!==gl.RGB&&format!==gl.RGBA)throw new PathogenicShaderCoverageError('SCREEN_TEXTURE','snapshot source requires supported RGB/RGBA8 framebuffer');
    const halfFloat=!!(current?.renderTexture as any)?.pathogenicHalfFloat;
    if(!this.target||this.target.width!==width||this.target.height!==height||this.format!==format||this.halfFloat!==halfFloat)this.allocate(width,height,format,halfFloat);
    const active=gl.getParameter(gl.ACTIVE_TEXTURE);gl.activeTexture(gl.TEXTURE0);
    const oldTexture=gl.getParameter(gl.TEXTURE_BINDING_2D);
    const priorError=gl.getError();if(gl.isContextLost())return;if(priorError)throw new Error('Snapshot before copy '+priorError+' half='+halfFloat);
    try{
      gl.bindTexture(gl.TEXTURE_2D,this.target.texture.webGLTexture);
      gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,width,height);
      const error=gl.getError();if(gl.isContextLost())return;if(error!==gl.NO_ERROR)throw new PathogenicShaderCoverageError('SCREEN_TEXTURE',`background copy failed with WebGL error ${error}`);
    }finally{gl.bindTexture(gl.TEXTURE_2D,oldTexture);gl.activeTexture(active);}
    this.capturedFrame=frame;
  }
  binding():ShaderTextureBinding {
    const owner=this;
    return {get texture(){if(!owner.target)throw new PathogenicShaderCoverageError('SCREEN_TEXTURE','background capture must run before binding');return owner.target.texture;},premultiplied:this.premultiplied,validate(){
      if(owner.renderer.gl.isContextLost())return;
      if(owner.destroyed||owner.capturedFrame!==owner.scene.game.loop.frame)throw new PathogenicShaderCoverageError('SCREEN_TEXTURE','background capture must run before this effect in the current render frame');
      const r=owner.renderer;if(r.currentFramebuffer===owner.target.framebuffer||r.gl.getParameter(r.gl.FRAMEBUFFER_BINDING)===owner.target.framebuffer.webGLFramebuffer)
        throw new PathogenicShaderCoverageError('SCREEN_TEXTURE','feedback: snapshot texture is attached to the active write framebuffer');
    }};
  }
  /** Put after background/world objects, before the first screen-reading effect.
   * One capture is shared by following effects, matching Godot backbuffer use. */
  createCaptureObject(depth:number):Phaser.GameObjects.Extern {
    const snapshot=this;
    class Capture extends Phaser.GameObjects.Extern {render(){if(snapshot.requested)snapshot.capture();}}
    const object=new Capture(this.scene);object.setDepth(depth);this.scene.add.existing(object);return object;
  }
  destroy(){if(!this.destroyed){this.target?.destroy();this.destroyed=true;}}
}

/** Resolve original material overrides and bind actual texture dependencies. */
export class PathogenicMaterials {
  constructor(readonly scene:Phaser.Scene,readonly graph:Any,readonly screen?:PathogenicScreenSnapshot){}
  installTexture(ref:any):{key:string;descriptor:Any|null;binding:ShaderTextureBinding;channels:CanvasTextureChannels}{
    const channels=resolveCanvasTexture(this.graph,ref),d=channels.diffuse;
    if(channels.filter!==0||channels.repeat!==0)throw new PathogenicShaderCoverageError(String(ref?.key??ref?.$ref),'CanvasTexture custom filter/repeat needs an isolated sampler view');
    let key=d?.key??'__WHITE'; // Godot's absent TEXTURE default is solid white.
    if(d?.resource?.startsWith('GradientTexture'))key=installGradientTexture(this.scene,this.graph,d);
    else if(d?.resource)throw new PathogenicShaderCoverageError(key,`texture ${d.resource} needs its original generator/imported image`);
    if(!this.scene.textures.exists(key))throw new PathogenicShaderCoverageError(key,'texture not preloaded');
    const straight=straightTexture(this.scene,key);
    return {...straight,descriptor:d,channels};
  }
  installCanvasChannels(ref:any){
    const channels=resolveCanvasTexture(this.graph,ref);
    return {channels,diffuse:this.installTexture(ref),normal:channels.normal?this.installTexture(channels.normal):null,specular:channels.specular?this.installTexture(channels.specular):null};
  }
  resolve(materialRef:any,overrides:Any={},options:{compatibilityZeroLights?:boolean}={compatibilityZeroLights:true}){
    const material=getResource(this.graph,materialRef),p=material?.properties??{};
    let source={path:'pathogenic-source-canvas',code:'shader_type canvas_item; void fragment() {}'};
    if(material?.type==='ShaderMaterial'){
      const path=p.shader?.$external,shader=this.graph.shaders[path];
      if(!shader)throw new PathogenicShaderCoverageError(path,'missing shader source');
      source={path,...shader};
    }else if(material?.type==='CanvasItemMaterial'){
      const blend=['mix','add','sub','mul','premul_alpha'][p.blend_mode??0];
      if(!blend||(p.light_mode??0)===2)throw new PathogenicShaderCoverageError(material.id,'unsupported CanvasItemMaterial blend/light-only mode');
      source={path:`pathogenic-canvas-${blend}-${p.light_mode??0}`,code:`shader_type canvas_item; render_mode blend_${blend}${p.light_mode===1?', unshaded':''}; void fragment() {}`};
    }else if(material)throw new PathogenicShaderCoverageError(material.id,`unsupported material ${material.type}`);
    if(p.next_pass)throw new PathogenicShaderCoverageError(material?.id,'material next_pass requires ordered passes');
    const registration=registerPathogenicShader(this.scene.game,source,options),uniforms:Record<string,ShaderUniformValue>={},textures:Record<string,ShaderTextureBinding>={};
    const dependencies:Any[]=[];
    for(const uniform of registration.program.uniforms){
      const key=`shader_parameter/${uniform.name}`;
      const value=overrides[uniform.name]??overrides[key]??p[key]??uniform.defaultValue;
      if(uniform.type!=='sampler2D'){
        if(value===undefined)throw new PathogenicShaderCoverageError(source.path,`uniform ${uniform.name} has no value`);
        // Godot serializes Color as RGBA even for a vec3 source_color uniform.
        uniforms[uniform.name]=uniform.type==='vec3'&&/source_color/.test(uniform.hints)&&Array.isArray(value)&&value.length===4?value.slice(0,3):value;continue;
      }
      if(/hint_screen_texture/.test(uniform.hints)){
        if(!this.screen)throw new PathogenicShaderCoverageError(source.path,'hint_screen_texture needs an independent background snapshot');
        if(/mipmap|repeat_enable/.test(uniform.hints))throw new PathogenicShaderCoverageError(source.path,'screen mipmap/repeat needs an explicit matching snapshot sampler');
        this.screen.requestCapture();textures[uniform.name]=this.screen.binding();dependencies.push({uniform:uniform.name,type:'screen-snapshot',hints:uniform.hints});continue;
      }
      if(/filter_nearest|mipmap|repeat_enable/.test(uniform.hints))throw new PathogenicShaderCoverageError(source.path,`custom sampler state requires isolated texture view: ${uniform.name}`);
      if(!value)throw new PathogenicShaderCoverageError(source.path,`sampler ${uniform.name} has no texture dependency`);
      const installed=this.installTexture(value),d=installed.descriptor;
      if(d?.crop&&(d.crop[0]!==0||d.crop[1]!==0||d.crop[2]!==installed.binding.texture.width||d.crop[3]!==installed.binding.texture.height))throw new PathogenicShaderCoverageError(source.path,`atlas sampler ${uniform.name} needs independent normalized texture coordinates`);
      textures[uniform.name]=installed.binding;dependencies.push({uniform:uniform.name,texture:d,channels:installed.channels,hints:uniform.hints});
    }
    return {registration,uniforms,textures,dependencies,material,source};
  }
}

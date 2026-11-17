import Phaser from 'phaser';
import {DIMENSION_CUT_LIMIT,type DimensionSwordCut} from './dimension-sword-presentation.mjs';
import {DIMENSION_SWORD_GLSL} from './dimension-sword-shader.mjs';
import {makeFloatTarget} from './pathogenic-float-target';
import {PATHOGENIC_DISPLAY_PROFILE,type PathogenicDisplayProfile} from './pathogenic-display-profile';
import {GLES_GLOW_GLSL} from './pathogenic-color-math.mjs';

type Target=ReturnType<typeof makeFloatTarget>;
type Camera=Phaser.Cameras.Scene2D.Camera;
export type PathogenicBloomOptions=Partial<Pick<PathogenicDisplayProfile,'glowEnabled'|'intensity'|'threshold'|'scale'|'bloom'|'cap'>>&{
  bloomLevels?:number;
  prefilterBrightPixels?:boolean;
  drawBaseIntoWorld?:boolean;
};
/** Actual floating scene composition, followed by the source GLES glow pipeline.
 * All world objects are inside this layer; HUD/text are rendered after resolve.
 * RGBA16F stores the pre-threshold energy. No blur of an already clipped SDR frame.
 */
export class PathogenicHdrComposite {
  enabled=true;
  readonly diagnostics={format:'RGBA16F',workingSpace:'source-compatibility-srgb',frames:0,passes:0,baseCopies:0,width:0,height:0};
  private world?:Target;private down:Target[]=[];private up:Target[]=[];
  private bloomLevels=4;private prefilterBrightPixels=false;
  private base?:Phaser.Textures.TextureSource['glTexture'];private baseFormat=0;
  private destination:Phaser.Renderer.WebGL.Wrappers.WebGLFramebufferWrapper|null=null;
  private started=false;private destroyed=false;
  private validateFrame=true;
  private savedAddBlend:any;
  private program?:WebGLProgram;private buffer?:WebGLBuffer;
  private uniforms=new Map<string,WebGLUniformLocation|null>();
  private dimensionCuts:DimensionSwordCut[]=[];
  clearDimensionCuts(){this.dimensionCuts.length=0;}
  addDimensionCut(cut:DimensionSwordCut){
    const previous=this.dimensionCuts.findIndex(c=>c.uid===cut.uid);
    if(previous>=0)this.dimensionCuts[previous]=cut;
    else{if(this.dimensionCuts.length>=DIMENSION_CUT_LIMIT)this.dimensionCuts.shift();this.dimensionCuts.push(cut);}
  }
  private objects:Phaser.GameObjects.Extern[]=[];
  private readonly clearObject:Phaser.GameObjects.Extern;
  private r:Phaser.Renderer.WebGL.WebGLRenderer;
  private profile:PathogenicDisplayProfile={...PATHOGENIC_DISPLAY_PROFILE};
  constructor(readonly scene:Phaser.Scene){
    this.r=scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    if(!(this.r instanceof Phaser.Renderer.WebGL.WebGLRenderer))throw new Error('Pathogenic HDR needs WebGL');
    const owner=this;
    // raw() already brackets each part with Phaser's pipeline handoff.
    // Extern's default renderWebGL would perform that handoff a second time.
    class ClearWorld extends Phaser.GameObjects.Extern{
      renderWebGL(_renderer:Phaser.Renderer.WebGL.WebGLRenderer,_object:Phaser.GameObjects.Extern,camera:Camera){owner.begin(camera);}
    }
    class Begin extends Phaser.GameObjects.Extern{renderWebGL(){owner.begin();}}
    class End extends Phaser.GameObjects.Extern{renderWebGL(){owner.end();}}
    // The direct clear is ahead of the terrain. The existing copy stays at
    // its original depth for cameras that have already drawn into the buffer.
    this.clearObject=new ClearWorld(scene).setDepth(-1001).setVisible(false);
    this.objects=[this.clearObject,new Begin(scene).setDepth(-1000),new End(scene).setDepth(49.9)];
    for(const object of this.objects)scene.add.existing(object);
    this.r.on('losewebgl',this.onContextLost,this);
    this.r.on('restorewebgl',this.onContextRestored,this);
  }
  configure(values:PathogenicBloomOptions){
    const {bloomLevels,prefilterBrightPixels,drawBaseIntoWorld,...profile}=values;
    if(drawBaseIntoWorld!==undefined)this.clearObject.setVisible(drawBaseIntoWorld);
    if(bloomLevels!==undefined){if(!Number.isInteger(bloomLevels)||bloomLevels<1||bloomLevels>4)throw Error('Bloom levels must be between 1 and 4');this.bloomLevels=bloomLevels;}
    if(prefilterBrightPixels!==undefined&&prefilterBrightPixels!==this.prefilterBrightPixels){
      this.prefilterBrightPixels=prefilterBrightPixels;
      if(this.program||this.buffer){const gl=this.r.gl;if(!gl.isContextLost()){if(this.program)gl.deleteProgram(this.program);if(this.buffer)gl.deleteBuffer(this.buffer);}this.program=undefined;this.buffer=undefined;this.uniforms.clear();}
    }
    this.profile={...this.profile,...profile};
  }
  private onContextLost(){
    if(this.started)(this.r as any).blendModes[Phaser.BlendModes.ADD]=this.savedAddBlend;
    this.started=false;this.destination=null;
  }
  private onContextRestored(){this.validateFrame=true;this.program=undefined;this.buffer=undefined;this.uniforms.clear();this.dimensionCuts.length=0;this.started=false;}
  private compile(){
    if(this.program)return;const gl=this.r.gl;
    const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('HDR shader: '+gl.getShaderInfoLog(shader));return shader;};
    const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}');
    const fragment=compile(gl.FRAGMENT_SHADER,`precision highp float;
varying vec2 vUv;uniform sampler2D uInput;uniform sampler2D uScene;
uniform vec2 uPixel;uniform float uMode;uniform vec4 uFilter;uniform float uIntensity;uniform float uExposure;
${GLES_GLOW_GLSL}
${DIMENSION_SWORD_GLSL}
${this.prefilterBrightPixels?`// Project first-chapter bloom: select hot source pixels before spatial mixing.
vec3 projectBloomTap(vec2 uv){
  vec3 c=texture2D(uInput,uv).rgb;float peak=max(c.r,max(c.g,c.b));
  if(peak<=uFilter.x&&uFilter.z<=0.0)return vec3(0.0);
  return godotGlowFilter(c,uFilter.x,uFilter.y,uFilter.z,uFilter.w);
}
vec4 projectBloomDownsample(){
  vec2 h=uPixel*0.5;vec3 c=projectBloomTap(vUv)*4.0;
  c+=projectBloomTap(vUv-h);c+=projectBloomTap(vUv+h);
  c+=projectBloomTap(vUv-vec2(h.x,-h.y));c+=projectBloomTap(vUv+vec2(h.x,-h.y));
  return vec4(c/8.0,1.0);
}`:''}
void main(){
 if(uMode<.5){vec4 c=texture2D(uInput,vUv);if(uExposure!=1.0)c.rgb=godotCanvasExposure(c.rgb,uExposure);gl_FragColor=c;}
 else if(uMode<1.5){${this.prefilterBrightPixels?'gl_FragColor=projectBloomDownsample();':'vec4 c=godotGlowDownsample(uInput,vUv,uPixel);c.rgb=godotGlowFilter(c.rgb,uFilter.x,uFilter.y,uFilter.z,uFilter.w);gl_FragColor=c;'}}
 else if(uMode<2.5)gl_FragColor=godotGlowDownsample(uInput,vUv,uPixel);
 else if(uMode<3.5)gl_FragColor=godotGlowUpsample(uInput,vUv,uPixel);
 else gl_FragColor=dimensionResolve();
}`);
    const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.bindAttribLocation(program,0,'aPosition');gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('HDR program: '+gl.getProgramInfoLog(program));
    this.program=program;this.buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  }
  private uniform(name:string){if(!this.uniforms.has(name))this.uniforms.set(name,this.r.gl.getUniformLocation(this.program!,name));return this.uniforms.get(name)!;}
  private allocate(width:number,height:number){
    if(this.world?.width===width&&this.world.height===height&&this.down.length===this.bloomLevels)return;
    this.validateFrame=true;this.freeTargets();this.world=makeFloatTarget(this.r,width,height);
    let w=width,h=height;for(let i=0;i<this.bloomLevels;i++){w=Math.max(4,Math.floor(w/2));h=Math.max(4,Math.floor(h/2));this.down.push(makeFloatTarget(this.r,w,h));if(i<this.bloomLevels-1)this.up.push(makeFloatTarget(this.r,w,h));}
    this.diagnostics.width=width;this.diagnostics.height=height;
  }
  private allocateBase(width:number,height:number,format:number){
    if(this.base&&this.baseFormat===format)return;
    if(this.base)this.r.deleteTexture(this.base);
    const gl=this.r.gl;
    this.base=this.r.createTexture2D(0,gl.LINEAR,gl.LINEAR,gl.CLAMP_TO_EDGE,gl.CLAMP_TO_EDGE,format,undefined,width,height,false,true,false);
    this.baseFormat=format;this.validateFrame=true;
  }
  private bindPassProgram(exposure:number){
    this.compile();
    const gl=this.r.gl;
    gl.useProgram(this.program!);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer!);
    gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);gl.uniform1i(this.uniform('uInput'),0);
    // Until resolve the second sampler is unused. Point it at the input as
    // well so the previous resolve's world binding cannot feed back on a copy.
    gl.uniform1i(this.uniform('uScene'),0);
    gl.uniform1f(this.uniform('uExposure'),exposure);
  }
  private pass(target:Target|null,input:Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper,mode:number,width:number,height:number){
    const gl=this.r.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer.webGLFramebuffer??this.destination?.webGLFramebuffer??null);
    gl.viewport(0,0,width,height);gl.bindTexture(gl.TEXTURE_2D,input.webGLTexture);
    gl.uniform2f(this.uniform('uPixel'),1/width,1/height);gl.uniform1f(this.uniform('uMode'),mode);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);this.diagnostics.passes++;
  }
  private bindResolve(){
    const gl=this.r.gl,p=this.profile;
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.world!.texture.webGLTexture);
    gl.uniform1i(this.uniform('uScene'),1);gl.activeTexture(gl.TEXTURE0);
    gl.uniform1f(this.uniform('uIntensity'),p.glowEnabled?p.intensity:0);
    gl.uniform1f(this.uniform('uDimensionCount'),this.dimensionCuts.length);
    if(this.dimensionCuts.length){
      const {zoomX,zoomY}=this.scene.cameras.main;
      gl.uniform2f(this.uniform('uDimensionViewport'),this.scene.scale.width/zoomX,this.scene.scale.height/zoomY);
      for(let i=0;i<this.dimensionCuts.length;i++){const cut=this.dimensionCuts[i];
        gl.uniform4fv(this.uniform(`uDimensionLine[${i}]`),cut.line);
        gl.uniform4fv(this.uniform(`uDimensionShape[${i}]`),cut.shape);
        gl.uniform4fv(this.uniform(`uDimensionStyle[${i}]`),cut.style);
      }
    }
  }
  private raw(action:()=>void){
    const gl=this.r.gl,scissor=gl.isEnabled(gl.SCISSOR_TEST),active=gl.getParameter(gl.ACTIVE_TEXTURE);
    this.r.pipelines.clear();gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);
    try{action();}
    catch(error){if(!gl.isContextLost())throw error;}
    finally{if(!gl.isContextLost()){gl.activeTexture(active);if(scissor)gl.enable(gl.SCISSOR_TEST);this.r.pipelines.rebind();}}
  }
  // getError synchronizes the GPU. Validate newly allocated/restored targets
  // once; identical steady-state frames retain the same framebuffer contract.
  private checkGl(stage:string){if(!this.validateFrame)return;const error=this.r.gl.getError();if(error)throw new Error('HDR '+stage+' WebGL '+error);}
  private canClearWorld(camera:Camera,width:number,height:number){
    if(this.destination||this.profile.exposure!==1)return false;
    const {game,cameras,children}=this.scene;
    return game.config.clearBeforeRender&&game.config.backgroundColor.alphaGL===1
      &&game.scene.scenes.length===1&&cameras.cameras.length===1&&camera===cameras.main
      &&camera.alpha===1&&camera.x===0&&camera.y===0&&camera.width===width&&camera.height===height
      &&camera.backgroundColor.alphaGL===0&&!camera.mask&&!camera.hasPostPipeline&&children.list[0]===this.clearObject;
  }
  private begin(camera?:Camera){
    if(!this.enabled||this.destroyed||this.started||this.r.gl.isContextLost())return;
    const gl=this.r.gl;this.destination=this.r.currentFramebuffer;
    const w=this.destination?.renderTexture?.width??gl.drawingBufferWidth,h=this.destination?.renderTexture?.height??gl.drawingBufferHeight;
    if(camera&&!this.canClearWorld(camera,w,h))return;
    this.raw(()=>{
      this.allocate(w,h);
      if(camera){
        this.checkGl('allocate');
        const color=this.scene.game.config.backgroundColor;
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.world!.framebuffer.webGLFramebuffer);
        gl.clearColor(color.redGL,color.greenGL,color.blueGL,color.alphaGL);gl.clear(gl.COLOR_BUFFER_BIT);
        this.checkGl('world-clear');
      }else{
        // Preserve any previous drawing for preview, masked or partial cameras.
        const format=this.destination?.renderTexture?.format??(gl.getContextAttributes()?.alpha===false?gl.RGB:gl.RGBA);
        this.allocateBase(w,h,format);this.checkGl('allocate');
        gl.bindFramebuffer(gl.FRAMEBUFFER,this.destination?.webGLFramebuffer??null);
        gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.base!.webGLTexture);
        gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,w,h);this.diagnostics.baseCopies++;this.checkGl('base-copy');
        this.bindPassProgram(this.profile.exposure);
        this.pass(this.world!,this.base!,0,w,h);this.checkGl('base-to-float');
      }
      // Phaser must know that subsequent ordinary sprites and source meshes
      // are rendering into the HDR attachment, including snapshot readbacks.
      this.r.currentFramebuffer=this.world!.framebuffer;
    });
    if(gl.isContextLost())return;
    // Phaser ADD uses destination alpha for RGB and accumulates alpha. RGBA8
    // implicitly kept it at one; floating storage would exponentially amplify
    // later map layers. This opaque canvas keeps destination alpha at one.
    const modes=(this.r as any).blendModes;
    this.savedAddBlend=modes[Phaser.BlendModes.ADD];
    modes[Phaser.BlendModes.ADD]={func:[gl.ONE,gl.ONE,gl.ZERO,gl.ONE],equation:gl.FUNC_ADD};
    this.checkGl('begin-rebind');this.started=true;
  }
  private end(){
    if(this.r.gl.isContextLost()){this.onContextLost();return;}
    if(!this.started||!this.world)return;
    this.raw(()=>{
      this.bindPassProgram(1);
      if(this.profile.glowEnabled){
        const {threshold,scale,bloom,cap}=this.profile;
        this.r.gl.uniform4f(this.uniform('uFilter'),threshold,scale,bloom,cap);
        for(let i=0;i<this.down.length;i++)this.pass(this.down[i],i===0?this.world!.texture:this.down[i-1].texture,i===0?1:2,this.down[i].width,this.down[i].height);
        for(let i=this.up.length-1;i>=0;i--)this.pass(this.up[i],i===this.up.length-1?this.down[this.down.length-1].texture:this.up[i+1].texture,3,this.up[i].width,this.up[i].height);
      }
      this.bindResolve();
      const glow=this.up[0]??this.down[0];
      this.pass(null,this.profile.glowEnabled?glow.texture:this.world!.texture,4,this.world!.width,this.world!.height);
      // Phaser's next multi-texture batch can declare every texture unit even
      // when a sprite only uses one. Do not leave its write target bound as an
      // input after the resolve, including the no-bloom path on unit zero.
      const gl=this.r.gl;
      if(!this.profile.glowEnabled)gl.bindTexture(gl.TEXTURE_2D,null);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,null);
      this.r.currentFramebuffer=this.destination;
    });
    if(this.r.gl.isContextLost()){this.onContextLost();return;}
    (this.r as any).blendModes[Phaser.BlendModes.ADD]=this.savedAddBlend;
    this.started=false;this.diagnostics.frames++;this.validateFrame=false;
  }
  private freeTargets(){this.world?.destroy();this.world=undefined;for(const t of [...this.down,...this.up])t.destroy();this.down=[];this.up=[];if(this.base)this.r.deleteTexture(this.base);this.base=undefined;}
  destroy(){if(this.destroyed)return;this.destroyed=true;for(const object of this.objects)object.destroy();this.objects=[];this.dimensionCuts.length=0;this.r.off('losewebgl',this.onContextLost,this);this.r.off('restorewebgl',this.onContextRestored,this);this.freeTargets();const gl=this.r.gl;if(this.program)gl.deleteProgram(this.program);if(this.buffer)gl.deleteBuffer(this.buffer);}
}


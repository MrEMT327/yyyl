import Phaser from 'phaser';
import {makeFloatTarget} from './pathogenic-float-target';
import {PATHOGENIC_DISPLAY_PROFILE,type PathogenicDisplayProfile} from './pathogenic-display-profile';
import {GLES_GLOW_GLSL} from './pathogenic-color-math.mjs';

type Target=ReturnType<typeof makeFloatTarget>;
/** Actual floating scene composition, followed by the source GLES glow pipeline.
 * All world objects are inside this layer; HUD/text are rendered after resolve.
 * RGBA16F stores the pre-threshold energy. No blur of an already clipped SDR frame.
 */
export class PathogenicHdrComposite {
  enabled=true;
  readonly diagnostics={format:'RGBA16F',workingSpace:'source-compatibility-srgb',frames:0,passes:0,width:0,height:0};
  private world?:Target;private down:Target[]=[];private up:Target[]=[];
  private base?:Phaser.Textures.TextureSource['glTexture'];private baseFormat=0;
  private destination:Phaser.Renderer.WebGL.Wrappers.WebGLFramebufferWrapper|null=null;
  private started=false;private destroyed=false;
  private savedAddBlend:any;
  private program?:WebGLProgram;private buffer?:WebGLBuffer;
  private uniforms=new Map<string,WebGLUniformLocation|null>();
  private objects:Phaser.GameObjects.Extern[]=[];
  private r:Phaser.Renderer.WebGL.WebGLRenderer;
  private profile:PathogenicDisplayProfile={...PATHOGENIC_DISPLAY_PROFILE};
  constructor(readonly scene:Phaser.Scene){
    this.r=scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    if(!(this.r instanceof Phaser.Renderer.WebGL.WebGLRenderer))throw new Error('Pathogenic HDR needs WebGL');
    const owner=this;
    class Begin extends Phaser.GameObjects.Extern{render(){owner.begin();}}
    class End extends Phaser.GameObjects.Extern{render(){owner.end();}}
    this.objects=[new Begin(scene).setDepth(-1000),new End(scene).setDepth(49.9)];
    for(const object of this.objects)scene.add.existing(object);
    this.r.on('losewebgl',this.onContextLost,this);
    this.r.on('restorewebgl',this.onContextRestored,this);
  }
  configure(values:Partial<Pick<PathogenicDisplayProfile,'glowEnabled'|'intensity'|'threshold'|'scale'|'bloom'|'cap'>>){this.profile={...this.profile,...values};}
  private onContextLost(){
    if(this.started)(this.r as any).blendModes[Phaser.BlendModes.ADD]=this.savedAddBlend;
    this.started=false;this.destination=null;
  }
  private onContextRestored(){this.program=undefined;this.buffer=undefined;this.uniforms.clear();this.started=false;}
  private compile(){
    if(this.program)return;const gl=this.r.gl;
    const compile=(type:number,source:string)=>{const shader=gl.createShader(type)!;gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error('HDR shader: '+gl.getShaderInfoLog(shader));return shader;};
    const vertex=compile(gl.VERTEX_SHADER,'attribute vec2 aPosition; varying vec2 vUv; void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}');
    const fragment=compile(gl.FRAGMENT_SHADER,`precision highp float;
varying vec2 vUv;uniform sampler2D uInput;uniform sampler2D uScene;
uniform vec2 uPixel;uniform float uMode;uniform vec4 uFilter;uniform float uIntensity;uniform float uExposure;
${GLES_GLOW_GLSL}
void main(){
 if(uMode<.5){vec4 c=texture2D(uInput,vUv);if(uExposure!=1.0)c.rgb=godotCanvasExposure(c.rgb,uExposure);gl_FragColor=c;}
 else if(uMode<1.5){vec4 c=godotGlowDownsample(uInput,vUv,uPixel);c.rgb=godotGlowFilter(c.rgb,uFilter.x,uFilter.y,uFilter.z,uFilter.w);gl_FragColor=c;}
 else if(uMode<2.5)gl_FragColor=godotGlowDownsample(uInput,vUv,uPixel);
 else if(uMode<3.5)gl_FragColor=godotGlowUpsample(uInput,vUv,uPixel);
 else {vec4 c=texture2D(uScene,vUv);vec3 glow=godotGlowUpsample(uInput,vUv,uPixel).rgb;gl_FragColor=vec4(godotGlowResolve(c.rgb,glow,uIntensity),c.a);}
}`);
    const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.bindAttribLocation(program,0,'aPosition');gl.linkProgram(program);
    gl.deleteShader(vertex);gl.deleteShader(fragment);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('HDR program: '+gl.getProgramInfoLog(program));
    this.program=program;this.buffer=gl.createBuffer()!;gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  }
  private uniform(name:string){if(!this.uniforms.has(name))this.uniforms.set(name,this.r.gl.getUniformLocation(this.program!,name));return this.uniforms.get(name)!;}
  private allocate(width:number,height:number,baseFormat:number){
    if(this.world?.width===width&&this.world.height===height&&this.baseFormat===baseFormat)return;
    this.freeTargets();this.world=makeFloatTarget(this.r,width,height);
    let w=width,h=height;for(let i=0;i<4;i++){w=Math.max(4,Math.floor(w/2));h=Math.max(4,Math.floor(h/2));this.down.push(makeFloatTarget(this.r,w,h));if(i<3)this.up.push(makeFloatTarget(this.r,w,h));}
    const gl=this.r.gl;this.base=this.r.createTexture2D(0,gl.LINEAR,gl.LINEAR,gl.CLAMP_TO_EDGE,gl.CLAMP_TO_EDGE,baseFormat,undefined,width,height,false,true,false);this.baseFormat=baseFormat;
    this.diagnostics.width=width;this.diagnostics.height=height;
  }
  private pass(target:Target|null,input:Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper,mode:number,width:number,height:number){
    const gl=this.r.gl;gl.bindFramebuffer(gl.FRAMEBUFFER,target?.framebuffer.webGLFramebuffer??this.destination?.webGLFramebuffer??null);
    gl.viewport(0,0,width,height);gl.useProgram(this.program!);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer!);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,input.webGLTexture);gl.uniform1i(this.uniform('uInput'),0);
    gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,mode===4?this.world!.texture.webGLTexture:input.webGLTexture);gl.uniform1i(this.uniform('uScene'),1);
    gl.uniform2f(this.uniform('uPixel'),1/width,1/height);gl.uniform1f(this.uniform('uMode'),mode);
    const p=this.profile;gl.uniform4f(this.uniform('uFilter'),p.threshold,p.scale,p.bloom,p.cap);gl.uniform1f(this.uniform('uIntensity'),p.glowEnabled?p.intensity:0);gl.uniform1f(this.uniform('uExposure'),mode===0?p.exposure:1);
    gl.drawArrays(gl.TRIANGLE_STRIP,0,4);this.diagnostics.passes++;
  }
  private raw(action:()=>void){
    const gl=this.r.gl,scissor=gl.isEnabled(gl.SCISSOR_TEST),active=gl.getParameter(gl.ACTIVE_TEXTURE);
    this.r.pipelines.clear();gl.disable(gl.BLEND);gl.disable(gl.SCISSOR_TEST);gl.disable(gl.DEPTH_TEST);gl.disable(gl.STENCIL_TEST);
    try{this.compile();action();}
    catch(error){if(!gl.isContextLost())throw error;}
    finally{if(!gl.isContextLost()){gl.activeTexture(active);if(scissor)gl.enable(gl.SCISSOR_TEST);this.r.pipelines.rebind();}}
  }
  private checkGl(stage:string){const error=this.r.gl.getError();if(error)throw new Error('HDR '+stage+' WebGL '+error);}
  private begin(){
    if(!this.enabled||this.destroyed||this.r.gl.isContextLost())return;
    const gl=this.r.gl;this.r.flush();this.destination=this.r.currentFramebuffer;
    const w=this.destination?.renderTexture?.width??gl.drawingBufferWidth,h=this.destination?.renderTexture?.height??gl.drawingBufferHeight;
    const format=this.destination?.renderTexture?.format??(gl.getContextAttributes()?.alpha===false?gl.RGB:gl.RGBA);
    this.raw(()=>{
      this.allocate(w,h,format);this.checkGl('allocate');gl.bindFramebuffer(gl.FRAMEBUFFER,this.destination?.webGLFramebuffer??null);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.base!.webGLTexture);gl.copyTexSubImage2D(gl.TEXTURE_2D,0,0,0,0,0,w,h);this.checkGl('base-copy');
      this.pass(this.world!,this.base!,0,w,h);this.checkGl('base-to-float');
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
    this.r.flush();const gl=this.r.gl;
    this.raw(()=>{
      if(this.profile.glowEnabled){
        for(let i=0;i<4;i++)this.pass(this.down[i],i===0?this.world!.texture:this.down[i-1].texture,i===0?1:2,this.down[i].width,this.down[i].height);
        for(let i=2;i>=0;i--)this.pass(this.up[i],i===2?this.down[3].texture:this.up[i+1].texture,3,this.up[i].width,this.up[i].height);
      }
      this.pass(null,this.profile.glowEnabled?this.up[0].texture:this.world!.texture,4,this.world!.width,this.world!.height);
      gl.bindFramebuffer(gl.FRAMEBUFFER,this.destination?.webGLFramebuffer??null);(this.r as any).currentFramebuffer=this.destination;
    });
    (this.r as any).blendModes[Phaser.BlendModes.ADD]=this.savedAddBlend;
    this.started=false;this.diagnostics.frames++;
  }
  private freeTargets(){this.world?.destroy();this.world=undefined;for(const t of [...this.down,...this.up])t.destroy();this.down=[];this.up=[];if(this.base)this.r.deleteTexture(this.base);this.base=undefined;}
  destroy(){if(this.destroyed)return;this.destroyed=true;for(const object of this.objects)object.destroy();this.objects=[];this.r.off('losewebgl',this.onContextLost,this);this.r.off('restorewebgl',this.onContextRestored,this);this.freeTargets();const gl=this.r.gl;if(this.program)gl.deleteProgram(this.program);if(this.buffer)gl.deleteBuffer(this.buffer);}
}


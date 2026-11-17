import Phaser from 'phaser';

/** Godot canvas source adapter. Source expressions are retained, not replaced by
 * look-alike texture effects. GLSL ES 1.00 and an unlit canvas are the explicit
 * supported rendering boundary; lighting/screen/texture omissions fail closed.
 * Reference: Godot drivers/gles3/shaders/canvas.glsl and rasterizer_canvas_gles3.cpp. */
export class PathogenicShaderCoverageError extends Error {
  constructor(readonly sourcePath: string, reason: string) {
    super(`Pathogenic shader coverage: ${sourcePath}: ${reason}`);
  }
}
export type ShaderUniformValue = number | boolean | number[];
export interface CanvasShaderSource { path: string; code: string; sha256?: string }
export interface CanvasShaderCompileOptions {
  /** Explicit Godot Compatibility specialization, only valid with zero lights. */
  compatibilityZeroLights?: boolean;
  /** Source meshes can carry their full-precision opacity in each vertex. */
  meshOpacity?: boolean;
  /** Plain sprites with ordinary straight-alpha textures can share a batch. */
  batchTextures?: boolean;
}
export interface CanvasUniform { name: string; type: string; hints: string; defaultValue?: ShaderUniformValue }
export interface CompiledCanvasShader {
  source: CanvasShaderSource; vertex: string; fragment: string;
  uniforms: CanvasUniform[]; blend: 'mix' | 'add' | 'sub' | 'mul' | 'premul_alpha';
  requiresScreen: boolean; unshaded: boolean; compatibilityZeroLights: boolean;
  meshOpacity: boolean; batchTextures: boolean;
}
export interface ShaderTextureBinding {
  texture: PathogenicSampleTexture;
  /** True for ordinary Phaser image uploads; false for straight/float data. */
  premultiplied: boolean;
  /** Runtime validation, e.g. a current-frame backbuffer copy with no feedback. */
  validate?: () => void;
}
type PathogenicSampleTexture=Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper & {
  /** Float32 gradients without OES_texture_float_linear use shader bilinear. */
  pathogenicManualLinear?: boolean;
};
export interface PathogenicShaderDraw {
  /** Simulation time in seconds. Caller handles Godot TIME rollover and pause. */
  time: number;
  /** Host faction palette, applied after source shading; alpha zero keeps source RGB. */
  projectilePalette?: [number, number, number, number];
  /** Source Godot HDR modulate; do not encode this into Phaser's 8-bit tint. */
  color: [number, number, number, number];
  /** Column-major matrices; source local units must be original Godot pixels. */
  screenToLocal: number[]; localToScreen: number[]; modelMatrix: number[];
  /** Source texture dimensions, irrespective of displayed size. */
  textureSize: [number, number];
  /** Atlas crop origin and size in normalized texture coordinates. */
  uvRect?: [number, number, number, number];
  mainPremultiplied?: boolean;
  /** Godot TEXTURE_REPEAT_ENABLED; manual wrapped bilinear supports NPOT WebGL1. */
  mainRepeat?: boolean;
  uniforms?: Record<string, ShaderUniformValue | null>;
  textures?: Record<string, ShaderTextureBinding>;
  /** Required assertion from the scene renderer. No lights are silently ignored. */
  lighting: 'unlit';
  /** Required each draw for a compatibilityZeroLights compiled specialization. */
  compatibility?: {renderer: 'compatibility'; lightCount: number; directionalLightCount: number};
  /** CanvasModulate applied after fragment code by Godot, except unshaded. */
  canvasModulate?: [number, number, number, number];
}

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}
function takeFunction(code: string, name: string): { body: string; remainder: string; exists: boolean } {
  const match = new RegExp(`\\bvoid\\s+${name}\\s*\\(\\s*\\)\\s*\\{`).exec(code);
  if (!match) return { body: '', remainder: code, exists: false };
  const begin = match.index + match[0].length;
  let at = begin, depth = 1;
  while (at < code.length && depth) { if (code[at] === '{') depth++; if (code[at] === '}') depth--; at++; }
  if (depth) throw new Error(`Unclosed ${name} function`);
  return { body: code.slice(begin, at - 1), remainder: code.slice(0, match.index) + code.slice(at), exists: true };
}
function scalar(text: string): number | boolean {
  if (text.trim() === 'true') return true;
  if (text.trim() === 'false') return false;
  const value = Number(text.trim());
  if (!Number.isFinite(value)) throw new Error(`Unsupported uniform initializer: ${text}`);
  return value;
}
function initializer(type: string, value?: string): ShaderUniformValue | undefined {
  if (type.startsWith('sampler')) return undefined;
  if (!value) {
    const dimension = /^(?:[bi]?vec)([234])$/.exec(type);
    if (dimension) return Array(Number(dimension[1])).fill(0);
    const matrix = /^mat([234])$/.exec(type);
    if (matrix) return Array(Number(matrix[1]) ** 2).fill(0);
    return type === 'bool' ? false : 0;
  }
  const vector = /^(?:[bi]?vec[234]|mat[234])\s*\(([^()]*)\)$/.exec(value.trim());
  if (!vector) return scalar(value);
  const values = vector[1].split(',').map(s => Number(scalar(s)));
  const n = Number(type.at(-1));
  if (type.startsWith('mat') && values.length === 1)
    return Array.from({ length: n * n }, (_, i) => i % (n + 1) === 0 ? values[0] : 0);
  return values.length === 1 ? Array(n).fill(values[0]) : values;
}
function textureCallArities(code: string): number[] {
  const result: number[] = [];
  for (const match of code.matchAll(/\btexture\s*\(/g)) {
    let depth = 1, commas = 0;
    for (let i = match.index! + match[0].length; i < code.length && depth; i++) {
      if (code[i] === '(') depth++;
      if (code[i] === ')') depth--;
      if (code[i] === ',' && depth === 1) commas++;
    }
    result.push(commas + 1);
  }
  return result;
}

/** Resolve only the renderer preprocessor guards actually present in the source.
 * Unknown directives fail rather than being evaluated as zero by a WebGL driver. */
function compatibilityBranch(code: string, fail: (reason: string) => never): string {
  const stack: {parent: boolean; condition: boolean; sawElse: boolean}[]=[];
  let active=true;const output: string[]=[];
  for(const line of code.split('\n')) {
    const directive=/^\s*#\s*(\w+)\s*(.*?)\s*$/.exec(line);
    if(!directive){if(active)output.push(line);continue;}
    const [,kind,expr]=directive;
    if(kind==='if') {
      const match=/^CURRENT_RENDERER\s*(!=|==)\s*RENDERER_COMPATIBILITY$/.exec(expr);
      if(!match)fail(`unsupported Compatibility preprocessor condition ${expr}`);
      const condition=match![1]==='==';stack.push({parent:active,condition,sawElse:false});active=active&&condition;
    }else if(kind==='else') {
      const state=stack.at(-1);if(!state||state.sawElse)fail('invalid Compatibility #else');
      state!.sawElse=true;active=state!.parent&&!state!.condition;
    }else if(kind==='endif') {
      const state=stack.pop();if(!state)fail('invalid Compatibility #endif');active=state!.parent;
    }else if(kind==='define') {if(active)output.push(line);}
    else fail(`unsupported Compatibility preprocessor directive #${kind}`);
  }
  if(stack.length)fail('unclosed Compatibility preprocessor guard');
  return output.join('\n');
}

export function compilePathogenicCanvasShader(source: CanvasShaderSource, options: CanvasShaderCompileOptions = {}): CompiledCanvasShader {
  const fail = (reason: string): never => { throw new PathogenicShaderCoverageError(source.path, reason); };
  let code = stripComments(source.code);
  if (!/\bshader_type\s+canvas_item\s*;/.test(code)) fail('not a canvas_item shader (particle shaders require their process implementation)');
  if(options.compatibilityZeroLights) {
    code=compatibilityBranch(code,fail);
    // Godot GLES3 DISABLE_LIGHTING specialization never invokes this stage.
    // source.code stays intact in the compiled program for provenance/audit.
    code=takeFunction(code,'light').remainder;
  }
  if (/\bvoid\s+light\s*\(/.test(code)) fail('Godot light() stage requires a light renderer; unsupported by this unlit adapter');
  if(/^\s*#\s*(?:if|ifdef|ifndef|elif|else|endif)\b/m.test(code))fail('renderer preprocessor guards require an explicit compatible specialization');
  if (/\bglobal\s+uniform\b/.test(code)) fail('global shader uniforms require a project-level uniform provider');
  if(/\bconst\s+\w+\s+\w+\s*\[[^\]]+\]\s*=\s*\{/.test(code))fail('Godot array initializer requires an explicit GLSL ES 1.00 array lowering');
  if (/\b(?:round|roundEven|fwidth|dFdx|dFdy)\s*\(/.test(code) || /%/.test(code)) fail('uses unsupported GLSL ES 3 or derivative operation');
  if (textureCallArities(code).some(n => n !== 2)) fail('texture LOD/bias requires an explicit source-compatible mipmap renderer');
  if (/\b(?:NORMAL|NORMAL_MAP|NORMAL_MAP_DEPTH|SPECULAR_SHININESS|LIGHT_VERTEX|SHADOW_VERTEX|LIGHT_ONLY|SCREEN_MATRIX|CANVAS_MATRIX|INSTANCE_CUSTOM|VERTEX_ID|textureLod|textureGrad|textureSize|texelFetch|samplerCube|uint|uvec\d)\b/.test(code))
    fail('uses unsupported lighting, instancing, texture query, or GLSL ES 3 operation');
  const modeMatch = /\brender_mode\s+([^;]+);/.exec(code);
  const modes = modeMatch ? modeMatch[1].split(',').map(x => x.trim()) : [];
  const allowedModes = new Set(['unshaded', 'blend_mix', 'blend_add', 'blend_sub', 'blend_mul', 'blend_premul_alpha']);
  for (const mode of modes) if (!allowedModes.has(mode)) fail(`unsupported render_mode ${mode}`);
  const blends = modes.filter(x => x.startsWith('blend_'));
  if (blends.length > 1) fail('multiple blend modes');
  const blend = (blends[0]?.slice(6) || 'mix') as CompiledCanvasShader['blend'];
  code = code.replace(/\bshader_type\s+canvas_item\s*;/, '').replace(/\brender_mode\s+[^;]+;/g, '');
  // Godot accepts numeric literal coercions that GLSL ES 1.00 does not. This
  // changes only the literal type, not the original mathematical expression.
  code = code.replace(/\bpow\s*\(([^()]*)\)/g, (all, args: string) => {
    const split = args.split(',');
    return split.length === 2 && /^\s*-?\d+\s*$/.test(split[1]) ? `pow(${split[0]}, ${split[1].trim()}.0)` : all;
  });
  const uniforms: CanvasUniform[] = [];
  code = code.replace(/\b(?:instance\s+)?uniform\s+(\w+)\s+(\w+)\s*(?::\s*([^=;]+))?\s*(?:=\s*([^;]+))?;/g,
    (_all, type: string, name: string, hints = '', value?: string) => {
      if (!/^(?:float|int|bool|vec[234]|ivec[234]|bvec[234]|mat[234]|sampler2D)$/.test(type)) fail(`uniform type ${type}`);
      let defaultValue: ShaderUniformValue | undefined;
      try { defaultValue = initializer(type, value); } catch (error) { fail(String(error)); }
      uniforms.push({ name, type, hints: hints.trim(), defaultValue });
      return `uniform ${type} ${name};`;
    });
  if (/\b(?:uniform|varying)\s+[^;]*[:=]/.test(code)) fail('unsupported uniform/varying declaration');
  const vertexFn = takeFunction(code, 'vertex');
  const fragmentFn = takeFunction(vertexFn.remainder, 'fragment');
  const shared = fragmentFn.remainder;
  const meshOpacity = options.meshOpacity === true;
  const batchTextures = options.batchTextures === true && meshOpacity && !uniforms.length &&
    !vertexFn.body.trim() && !fragmentFn.body.trim() && !shared.trim();
  const textureVaryings = batchTextures ? 'varying vec2 outTexCoord;\nvarying float outTexId;' : '';
  // The scene mesh already stores screen positions. Only shaders that refer
  // to Godot's VERTEX need the local position and its per-object transform.
  const usesLocalVertex = /\bVERTEX\b/.test(code);
  const samplers = ['TEXTURE', ...uniforms.filter(u => u.type === 'sampler2D').map(u => u.name)];
  const replaceTextures = (input: string) => {
    let result = input;
    for (const name of samplers) result = result.replace(new RegExp(`\\btexture\\s*\\(\\s*${name}\\s*,`, 'g'), `pgSample_${name}(`);
    if (/\btexture\s*\(/.test(result)) fail('indirect or unknown texture sampler');
    return result;
  };
  const samplerHelpers = samplers.map(name => {
    const main = name === 'TEXTURE', sampler = main ? 'uMainSampler' : name;
    if (main && batchTextures) return '';
    return `uniform float pgPremult_${name};
uniform vec2 pgLinearPixelSize_${name};
vec4 pgDecode_${name}(vec4 value) {
  if (pgPremult_${name} > 0.5 && value.a > 0.000001) value.rgb /= value.a;
  return value;
}
vec4 pgSample_${name}(vec2 uv) {
  ${main ? `if (uPgMainRepeat > 0.5) {
    vec2 extent = uPgUvRect.zw / uPgTexturePixelSize;
    vec2 point = uv * extent - vec2(0.5);
    vec2 base = floor(point), weight = fract(point);
    vec2 a = (mod(base, extent) + vec2(0.5)) * uPgTexturePixelSize + uPgUvRect.xy;
    vec2 b = (mod(base + vec2(1.0), extent) + vec2(0.5)) * uPgTexturePixelSize + uPgUvRect.xy;
    vec4 c00 = pgDecode_TEXTURE(texture2D(uMainSampler, a));
    vec4 c10 = pgDecode_TEXTURE(texture2D(uMainSampler, vec2(b.x, a.y)));
    vec4 c01 = pgDecode_TEXTURE(texture2D(uMainSampler, vec2(a.x, b.y)));
    vec4 c11 = pgDecode_TEXTURE(texture2D(uMainSampler, b));
    return mix(mix(c00, c10, weight.x), mix(c01, c11, weight.x), weight.y);
  }` : ''}
  vec2 textureUv = ${main ? 'uPgUvRect.xy + uv * uPgUvRect.zw' : 'uv'};
  if (pgLinearPixelSize_${name}.x > 0.0) {
    // Texel-center coordinates reproduce LINEAR + CLAMP_TO_EDGE exactly.
    // Interpolate the original HDR channels, without clipping them to RGBA8.
    vec2 point = textureUv / pgLinearPixelSize_${name} - vec2(0.5);
    vec2 a = (floor(point) + vec2(0.5)) * pgLinearPixelSize_${name};
    vec2 b = a + pgLinearPixelSize_${name};
    vec2 weight = fract(point);
    vec4 c00 = texture2D(${sampler}, a);
    vec4 c10 = texture2D(${sampler}, vec2(b.x, a.y));
    vec4 c01 = texture2D(${sampler}, vec2(a.x, b.y));
    vec4 c11 = texture2D(${sampler}, b);
    return pgDecode_${name}(mix(mix(c00, c10, weight.x), mix(c01, c11, weight.x), weight.y));
  }
  vec4 value = texture2D(${sampler}, textureUv);
  return pgDecode_${name}(value);
}`;
  }).join('\n');
  const common = `precision highp float;
precision highp sampler2D;
uniform float uPgTime;
${batchTextures ? '' : 'uniform sampler2D uMainSampler;'}
uniform vec4 uPgColor;
uniform vec4 uPgProjectilePalette;
uniform vec4 uPgCanvasModulate;
uniform vec4 uPgUvRect;
uniform vec2 uPgTexturePixelSize;
uniform float uPgMainRepeat;
uniform vec2 uResolution;
uniform mat3 uPgScreenToLocal;
uniform mat3 uPgLocalToScreen;
uniform mat4 MODEL_MATRIX;
#define TIME uPgTime
#define TEXTURE_PIXEL_SIZE uPgTexturePixelSize
#define SCREEN_PIXEL_SIZE (vec2(1.0) / uResolution)
#define PI 3.14159265358979323846
#define TAU 6.28318530717958647692
#define E 2.71828182845904523536
vec4 COLOR;
vec2 VERTEX;
vec2 UV;
vec2 SCREEN_UV;
${uniforms.map(u => `uniform ${u.type} ${u.name};`).join('\n')}
${samplerHelpers}
${replaceTextures(shared.replace(/uniform\s+\w+\s+\w+\s*;/g, ''))}
`;
  const vertex = `${common}
uniform mat4 uProjectionMatrix;
attribute vec2 inPosition;
attribute vec2 inTexCoord;
attribute vec4 inTint;
${meshOpacity ? 'attribute float inTintEffect;' : ''}
${batchTextures ? 'attribute float inTexId;' : ''}
${textureVaryings}
varying vec2 pgUv;
${usesLocalVertex ? 'varying vec2 pgVertex;' : ''}
varying vec4 pgColor;
void main() {
  ${usesLocalVertex ? 'VERTEX = (uPgScreenToLocal * vec3(inPosition, 1.0)).xy;' : ''}
  ${batchTextures ? 'outTexCoord = UV = inTexCoord; outTexId = inTexId;' : 'UV = (inTexCoord - uPgUvRect.xy) / uPgUvRect.zw;'}
  COLOR = vec4(inTint.bgr, inTint.a) * ${meshOpacity ? 'vec4(uPgColor.rgb, inTintEffect)' : 'uPgColor'};
  SCREEN_UV = vec2(0.0);
  ${replaceTextures(vertexFn.body)}
  pgUv = UV; pgColor = COLOR;
  ${usesLocalVertex ? 'pgVertex = VERTEX;' : ''}
  vec2 screenPosition = ${usesLocalVertex ? '(uPgLocalToScreen * vec3(VERTEX, 1.0)).xy' : 'inPosition'};
  gl_Position = uProjectionMatrix * vec4(screenPosition, 1.0, 1.0);
}`;
  const fragment = `${common}
${textureVaryings}
${batchTextures ? `
uniform sampler2D uMainSampler[%count%];
vec4 pgSample_TEXTURE(vec2 uv) {
  vec4 texture;
  %forloop%
  return texture;
}` : ''}
varying vec2 pgUv;
${usesLocalVertex ? 'varying vec2 pgVertex;' : ''}
varying vec4 pgColor;
void main() {
  UV = pgUv; ${usesLocalVertex ? 'VERTEX = pgVertex;' : ''}
  SCREEN_UV = gl_FragCoord.xy / uResolution;
  vec4 pgTexel = pgSample_TEXTURE(UV);
  COLOR = pgColor * pgTexel;
  ${replaceTextures(fragmentFn.body)}
  ${modes.includes('unshaded') ? '' : 'COLOR *= uPgCanvasModulate;'}
  // Recolor the shaded result, not a multiply tint: a green source texture
  // otherwise cannot become red. Keep shape/alpha and a restrained bright core.
  if (uPgProjectilePalette.a > 0.5) {
    float peak = max(0.0, max(COLOR.r, max(COLOR.g, COLOR.b)));
    float whiteCore = clamp(min(COLOR.r, min(COLOR.g, COLOR.b)) / max(peak, 0.00001), 0.0, 1.0);
    float value = min(peak, 1.0) + max(peak - 1.0, 0.0) / (peak + 3.0) * 0.35;
    if (uPgProjectilePalette.r > 0.9 && uPgProjectilePalette.g < 0.1 && uPgProjectilePalette.b < 0.1) {
      // Reserved enemy-red palette. Read highlights before source blink/HDR
      // modulation: tinting the already-red result erased every white core.
      // Preserve texture alpha, geometry and authored light/dark detail.
      vec3 ink = max(${batchTextures ? 'pgTexel' : 'pgSample_TEXTURE(UV)'}.rgb * pgColor.rgb, vec3(0.0));
      float inkPeak = max(ink.r, max(ink.g, ink.b));
      float neutral = min(ink.r, min(ink.g, ink.b)) / max(inkPeak, 0.00001);
      float body = clamp(inkPeak, 0.0, 1.0);
      float core = smoothstep(0.30, 0.92, neutral) * smoothstep(0.25, 0.85, body);
      core = max(core, smoothstep(0.30, 0.92, whiteCore) * smoothstep(0.25, 0.85, min(peak, 1.0)));
      vec3 layered = mix(vec3(0.12, 0.008, 0.022), vec3(0.95, 0.035, 0.09), smoothstep(0.03, 0.70, body));
      layered = mix(layered, vec3(1.0, 0.26, 0.16), smoothstep(0.55, 1.0, body) * 0.45);
      layered = mix(layered, vec3(1.0, 0.96, 0.86), core);
      COLOR.rgb = layered * smoothstep(0.0, 0.09, inkPeak) * (0.92 + 0.08 * min(value, 1.0));
    } else {
      COLOR.rgb = mix(uPgProjectilePalette.rgb, vec3(1.0), whiteCore * 0.18) * value;
    }
  }
  gl_FragColor = COLOR;
}`;
  return { source, vertex, fragment, uniforms, blend, requiresScreen: uniforms.some(u => /hint_screen_texture/.test(u.hints)), unshaded: modes.includes('unshaded'), compatibilityZeroLights:options.compatibilityZeroLights===true, meshOpacity, batchTextures };
}

/** Matrices are mandatory to avoid accidentally using viewport pixels as source
 * local/world coordinates. Texture defaults are not silently invented. */
type UniformUpload={uniform:CanvasUniform;matrix:boolean;size:number;method:string;premult:string;linearPixelSize:string};
const NON_FINITE=(value:number)=>!Number.isFinite(value);
const ZERO_PALETTE:[number,number,number,number]=[0,0,0,0];
const WHITE_MODULATE:[number,number,number,number]=[1,1,1,1];
const FULL_UV:[number,number,number,number]=[0,0,1,1];
export class PathogenicShaderPipeline extends Phaser.Renderer.WebGL.Pipelines.MultiPipeline {
  // The compiled layout is fixed; values and texture validation remain live.
  private readonly uniformUploads:UniformUpload[];
  // WebGL copies matrix values synchronously. Phaser passes force=true for
  // matrix uniforms, so reusing these upload buffers cannot suppress updates.
  private readonly screenMatrix=new Float32Array(9);
  private readonly localMatrix=new Float32Array(9);
  private readonly modelMatrix=new Float32Array(16);
  private readonly canBatchDraws:boolean;
  private batchTexture?:PathogenicSampleTexture;
  private batchKey:number[]=[];
  private incomingKey:number[]=[];
  constructor(game: Phaser.Game, readonly program: CompiledCanvasShader) {
    // Each shader owns a vertex buffer. Small effect batches should not
    // allocate a full Phaser sprite buffer per authored material.
    super({ game, vertShader: program.vertex, fragShader: program.fragment, forceZero: !program.batchTextures,
      batchSize:program.batchTextures?1024:256 });
    // Auxiliary samplers can validate/capture state at a precise render point.
    this.canBatchDraws=!program.uniforms.some(uniform=>uniform.type==='sampler2D');
    this.uniformUploads=program.uniforms.map(uniform=>{
      const matrix=uniform.type.startsWith('mat'),dimension=matrix?Number(uniform.type.at(-1)):Number(/vec([234])$/.exec(uniform.type)?.[1]??1);
      return {uniform,matrix,size:matrix?dimension*dimension:dimension,
        method:matrix?`setMatrix${dimension}fv`:`set${dimension}${/^(?:int|bool|ivec|bvec)/.test(uniform.type)?'i':'f'}`,premult:`pgPremult_${uniform.name}`,linearPixelSize:`pgLinearPixelSize_${uniform.name}`};
    });
  }
  boot() {
    Phaser.Renderer.WebGL.WebGLPipeline.prototype.boot.call(this);
    if(this.program.batchTextures)this.set1iv('uMainSampler',this.renderer.textureIndexes);
    else this.set1i('uMainSampler',0);
    this.set2f('uResolution',this.renderer.width,this.renderer.height);
  }
  private setLinearSampling(name:string,texture?:PathogenicSampleTexture) {
    if(texture?.pathogenicManualLinear){
      if(!(texture.width>0&&texture.height>0))throw new PathogenicShaderCoverageError(this.program.source.path,'invalid manual-linear texture size');
      this.set2f(name,1/texture.width,1/texture.height);
    }else this.set2f(name,0,0);
  }
  private readBatchKey(data:PathogenicShaderDraw,texture:PathogenicSampleTexture):boolean {
    const key=this.incomingKey,shader=this.currentShader;
    key.length=0;
    const add=(name:string,value:number|number[])=>{
      if(!shader.hasUniform(name))return;
      if(typeof value==='number')key.push(value);else key.push(...value);
    };
    add('uPgTime',data.time);
    if(shader.hasUniform('uPgColor')){
      const [r,g,b,a]=data.color;
      key.push(r,g,b,this.program.meshOpacity?1:a);
    }
    add('uPgProjectilePalette',data.projectilePalette??ZERO_PALETTE);
    add('uPgCanvasModulate',data.canvasModulate??WHITE_MODULATE);
    add('uPgUvRect',data.uvRect??FULL_UV);add('uPgTexturePixelSize',data.textureSize);
    add('uPgScreenToLocal',data.screenToLocal);add('uPgLocalToScreen',data.localToScreen);
    add('MODEL_MATRIX',data.modelMatrix);add('pgPremult_TEXTURE',data.mainPremultiplied===false?0:1);
    add('uPgMainRepeat',data.mainRepeat?1:0);
    if(texture.pathogenicManualLinear){
      if(!(texture.width>0&&texture.height>0))return false;
      key.push(1,texture.width,texture.height);
    }else key.push(0);
    for(const upload of this.uniformUploads){
      const {uniform,matrix,size}=upload,value=data.uniforms?.[uniform.name]??uniform.defaultValue;
      if(Array.isArray(value)){
        if(value.length!==size||value.some(NON_FINITE))return false;
        key.push(...value);
      }else{
        const scalar=Number(value);
        if(value===undefined||matrix||size!==1||!Number.isFinite(scalar))return false;
        key.push(scalar);
      }
    }
    return true;
  }
  onBind(object?: Phaser.GameObjects.GameObject) {
    // PipelineManager.set(pipeline) is also a legal lifecycle bind without a
    // GameObject. It submits no source draw; validate when an object is bound.
    if(!object)return;
    const data = object?.getData('pathogenicShader') as PathogenicShaderDraw | undefined;
    const fail = (reason: string): never => { throw new PathogenicShaderCoverageError(this.program.source.path, reason); };
    if (!data) throw new PathogenicShaderCoverageError(this.program.source.path, 'missing pathogenicShader draw data');
    if (data.lighting !== 'unlit') fail('a lit canvas needs the Godot light pass');
    if(this.program.compatibilityZeroLights&&(!data.compatibility||data.compatibility.renderer!=='compatibility'||data.compatibility.lightCount!==0||data.compatibility.directionalLightCount!==0))
      fail('Compatibility zero-light specialization requires an explicit zero point/directional light assertion on every draw');
    if (!Number.isFinite(data.time) || !data.color.every(Number.isFinite)) fail('non-finite source time/color');
    if (!this.program.batchTextures) {
      if (data.textureSize.some(n => !(n > 0))) fail('invalid texture size');
      if (data.screenToLocal.length !== 9 || data.localToScreen.length !== 9 || data.modelMatrix.length !== 16) fail('invalid source transform');
      if (!data.screenToLocal.every(Number.isFinite)||!data.localToScreen.every(Number.isFinite)||!data.modelMatrix.every(Number.isFinite))
        fail('non-finite source transform');
    }
    const [red,green,blue,alpha]=data.color;
    if(this.program.meshOpacity){
      if(!(object instanceof Phaser.GameObjects.Mesh))fail('vertex opacity requires the source mesh renderer');
      // MeshWebGLRenderer copies tintFill unchanged to its float inTintEffect
      // slot. This pipeline uses the slot for opacity instead of a tint mode.
      (object as unknown as {tintFill:number}).tintFill=alpha;
    }
    const frameTexture=(object as Phaser.GameObjects.Mesh).frame?.glTexture;
    const hasKey=this.canBatchDraws&&frameTexture&&this.readBatchKey(data,frameTexture);
    if(hasKey&&this.vertexCount>0&&(this.program.batchTextures||this.batchTexture===frameTexture)&&this.incomingKey.length===this.batchKey.length&&
      this.incomingKey.every((value,index)=>Object.is(value,this.batchKey[index])))return;
    this.flush();
    this.batchTexture=undefined;
    this.set1f('uPgTime', data.time);
    this.set4f('uPgColor', red, green, blue, this.program.meshOpacity?1:alpha);
    this.set4f('uPgProjectilePalette', ...(data.projectilePalette ?? ZERO_PALETTE) as [number,number,number,number]);
    this.set4f('uPgCanvasModulate', ...(data.canvasModulate || WHITE_MODULATE) as [number, number, number, number]);
    if(!this.program.batchTextures){
      this.set4f('uPgUvRect', ...(data.uvRect || FULL_UV) as [number, number, number, number]);
      this.set2f('uPgTexturePixelSize', 1 / data.textureSize[0], 1 / data.textureSize[1]);
      this.screenMatrix.set(data.screenToLocal);this.localMatrix.set(data.localToScreen);this.modelMatrix.set(data.modelMatrix);
      this.setMatrix3fv('uPgScreenToLocal', false, this.screenMatrix);
      this.setMatrix3fv('uPgLocalToScreen', false, this.localMatrix);
      this.setMatrix4fv('MODEL_MATRIX', false, this.modelMatrix);
      this.set1f('pgPremult_TEXTURE', data.mainPremultiplied === false ? 0 : 1);
      this.set1f('uPgMainRepeat',data.mainRepeat?1:0);
      // Inspect the bound frame to handle texture replacement and context restore.
      this.setLinearSampling('pgLinearPixelSize_TEXTURE',frameTexture);
    }
    let unit = 1;
    for (const upload of this.uniformUploads) {
      const uniform=upload.uniform;
      if (uniform.type === 'sampler2D') {
        const binding = data.textures?.[uniform.name];
        if (!binding) throw new PathogenicShaderCoverageError(this.program.source.path, `missing texture ${uniform.name} (${uniform.hints || 'no default'})`);
        binding.validate?.();
        if (unit >= this.renderer.maxTextures) fail('texture unit capacity exceeded');
        const texture=binding.texture;
        this.bindTexture(texture, unit);
        this.set1i(uniform.name, unit++);
        this.set1f(upload.premult, binding.premultiplied ? 1 : 0);
        this.setLinearSampling(upload.linearPixelSize,texture);
        continue;
      }
      const value = data.uniforms?.[uniform.name] ?? uniform.defaultValue;
      if (value === undefined) fail(`missing uniform ${uniform.name}`);
      if(Array.isArray(value)){
        if(value.some(NON_FINITE))fail(`non-finite uniform ${uniform.name}`);
        if(value.length!==upload.size)fail(upload.matrix?`wrong matrix size ${uniform.name}`:`wrong uniform vector size ${uniform.name}`);
        if(upload.matrix)(this as any)[upload.method](uniform.name,false,value);
        else (this as any)[upload.method](uniform.name,...value);
      }else{
        const scalar=Number(value);
        if(!Number.isFinite(scalar))fail(`non-finite uniform ${uniform.name}`);
        if(upload.matrix)fail(`wrong matrix size ${uniform.name}`);
        if(upload.size!==1)fail(`wrong uniform vector size ${uniform.name}`);
        (this as any)[upload.method](uniform.name,scalar);
      }
    }
    if(hasKey){
      this.batchTexture=frameTexture;
      const previous=this.batchKey;this.batchKey=this.incomingKey;this.incomingKey=previous;
    }
  }
}

/** Godot outputs straight RGB. Use these dedicated blend factors rather than
 * Phaser's premultiplied NORMAL/ADD modes. Matches transparent Godot GLES3 RT. */
export interface RegisteredPathogenicShader {key: string; blendMode: number; program: CompiledCanvasShader}
const registeredShaders = new WeakMap<Phaser.Game,{sources:Map<string,Map<string,RegisteredPathogenicShader>>;count:number}>();
const registeredBlendModes = new WeakMap<Phaser.Game,Map<CompiledCanvasShader['blend'],number>>();
export function registerPathogenicShader(game: Phaser.Game, source: CanvasShaderSource, options: CanvasShaderCompileOptions = {}): RegisteredPathogenicShader {
  const renderer = game.renderer;
  if (!(renderer instanceof Phaser.Renderer.WebGL.WebGLRenderer))
    throw new PathogenicShaderCoverageError(source.path, 'WebGL renderer required');
  let cache=registeredShaders.get(game);if(!cache){cache={sources:new Map(),count:0};registeredShaders.set(game,cache);}
  // Include actual code even when callers reuse stale/absent sha256 fields.
  // Key the full code as a string instead of serializing it again for every
  // mesh. Keep code identity even if a caller reuses a stale sha256.
  const identity=JSON.stringify([source.path,source.sha256??'',options.compatibilityZeroLights===true,
    options.meshOpacity===true,options.batchTextures===true]);
  const versions=cache.sources.get(identity),cached=versions?.get(source.code);if(cached)return cached;
  const program = compilePathogenicCanvasShader(source,options);
  const gl = renderer.gl;
  const factors: Record<CompiledCanvasShader['blend'], number[]> = {
    mix: [gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA],
    add: [gl.SRC_ALPHA, gl.ONE, gl.SRC_ALPHA, gl.ONE],
    sub: [gl.SRC_ALPHA, gl.ONE, gl.SRC_ALPHA, gl.ONE],
    mul: [gl.DST_COLOR, gl.ZERO, gl.DST_ALPHA, gl.ZERO],
    premul_alpha: [gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA],
  };
  const key = `Pathogenic:${source.sha256 || source.path}:${options.compatibilityZeroLights?'compatibility-zero-lights':'unlit'}:${cache.count}`;
  if (!renderer.pipelines.has(key)) {
    try{renderer.pipelines.add(key,new PathogenicShaderPipeline(game,program));}
    catch(error){renderer.pipelines.remove(key);throw new PathogenicShaderCoverageError(source.path,`GPU pipeline registration failed: ${String(error)}`);}
  }
  let blends=registeredBlendModes.get(game);if(!blends){blends=new Map();registeredBlendModes.set(game,blends);}
  let blendMode=blends.get(program.blend);
  if(blendMode===undefined){blendMode=renderer.addBlendMode(factors[program.blend], program.blend === 'sub' ? gl.FUNC_REVERSE_SUBTRACT : gl.FUNC_ADD);blends.set(program.blend,blendMode);}
  const registered={key,blendMode,program},entries=versions??new Map<string,RegisteredPathogenicShader>();
  entries.set(source.code,registered);cache.sources.set(identity,entries);cache.count++;return registered;
}

/** Exact unsigned integer hash from particle_blood_stream.gdshader. */
export function pathogenicParticleHash(n: number): number {
  n = ((n << 13) ^ n) >>> 0;
  n = (Math.imul(n, (Math.imul(Math.imul(n, n), 15731) + 789221) | 0) + 1376312589) >>> 0;
  return (n & 0x7fffffff) / 0x7fffffff;
}
export interface BloodStreamParameters {
  curve_min: [number, number]; curve_max: [number, number];
  stream_half_width: number; flow_speed: number; flow_speed_random: number; lateral_falloff: number;
  base_color: [number, number, number, number]; scale_min: number; scale_max: number;
  align_mode: number; angle_min_rad: number; angle_max_rad: number; angular_velocity: number;
  anim_speed_min: number; anim_speed_max: number; anim_offset_min: number; anim_offset_max: number;
}
export type BloodStreamTextureSampler = (name: 'curve_texture' | 'alpha_curve' | 'scale_curve' | 'angle_curve', u: number, v: number) => [number, number, number, number];
/** CPU translation of start/process, with source uniforms passed explicitly.
 * age is emitter-speed-scaled simulation age; texture sampler must reproduce
 * the source float/data textures and interpolation (never color-convert them).
 * Float64 JS arithmetic is not claimed bit-identical to GPU float32. */
export function samplePathogenicBloodStream(number: number, randomSeed: number, age: number, lifetime: number, p: BloodStreamParameters, sample: BloodStreamTextureSampler) {
  if (!(lifetime > 0) || !Number.isFinite(age) || ![0, 1].includes(p.align_mode))
    throw new PathogenicShaderCoverageError('particle_blood_stream.gdshader', 'invalid particle age/lifetime/align mode');
  const mix = (a: number, b: number, t: number) => a + (b - a) * t;
  const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
  const seed = (Math.imul(number >>> 0, 747796405) + randomSeed) >>> 0;
  const rnd = (offset: number) => pathogenicParticleHash((seed + offset) >>> 0);
  const percent = clamp(age / lifetime, 0, 1);
  const lateralRandom = (rnd(0) - .5) * 2;
  const speedMult = mix(1 - p.flow_speed_random, 1, rnd(6));
  const progression = rnd(1) + percent * p.flow_speed * speedMult;
  const t = progression - Math.floor(progression);
  const at = sample('curve_texture', t, .5);
  const tangent = [at[2] * 2 - 1, at[3] * 2 - 1];
  const perp = [-tangent[1], tangent[0]];
  const lateral = Math.sign(lateralRandom) * Math.pow(Math.abs(lateralRandom), 1 / Math.max(p.lateral_falloff, .0001));
  const position = [0, 1].map(i => mix(p.curve_min[i], p.curve_max[i], at[i]) + perp[i] * lateral * p.stream_half_width);
  const probeT = clamp(t + 1 / 512, 0, 1), probe = sample('curve_texture', probeT, .5);
  const distance = Math.hypot(...[0, 1].map(i => (probe[i] - at[i]) * (p.curve_max[i] - p.curve_min[i])));
  const velocityScale = distance / Math.max(probeT - t, .0001) * p.flow_speed * speedMult / lifetime;
  const scaleMod = sample('scale_curve', percent, 0), baseScale = mix(p.scale_min, p.scale_max, rnd(2));
  const scale = [0, 1, 2].map(i => Math.max(baseScale * scaleMod[i], .001));
  const angle = mix(p.angle_min_rad, p.angle_max_rad, rnd(3)) * sample('angle_curve', percent, 0)[0] + p.angular_velocity * percent * lifetime;
  const c = Math.cos(angle), s = Math.sin(angle);
  const x = p.align_mode === 0 ? [tangent[0] * c - perp[0] * s, tangent[1] * c - perp[1] * s] : [c, -s];
  const y = p.align_mode === 0 ? [tangent[0] * s + perp[0] * c, tangent[1] * s + perp[1] * c] : [s, c];
  return {
    position, velocity: tangent.map(v => v * velocityScale),
    basisX: x.map(v => v * scale[0]), basisY: y.map(v => v * scale[1]), scaleZ: scale[2],
    color: [p.base_color[0], p.base_color[1], p.base_color[2], p.base_color[3] * sample('alpha_curve', percent, 0)[0]],
    animation: p.align_mode === 1 ? mix(p.anim_offset_min, p.anim_offset_max, rnd(5)) + percent * mix(p.anim_speed_min, p.anim_speed_max, rnd(4)) : 0,
  };
}

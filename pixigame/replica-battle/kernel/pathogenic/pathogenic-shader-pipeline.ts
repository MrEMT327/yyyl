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
}
export interface CanvasUniform { name: string; type: string; hints: string; defaultValue?: ShaderUniformValue }
export interface CompiledCanvasShader {
  source: CanvasShaderSource; vertex: string; fragment: string;
  uniforms: CanvasUniform[]; blend: 'mix' | 'add' | 'sub' | 'mul' | 'premul_alpha';
  requiresScreen: boolean; unshaded: boolean; compatibilityZeroLights: boolean;
}
export interface ShaderTextureBinding {
  texture: Phaser.Renderer.WebGL.Wrappers.WebGLTextureWrapper;
  /** True for ordinary Phaser image uploads; false for straight/float data. */
  premultiplied: boolean;
  /** Runtime validation, e.g. a current-frame backbuffer copy with no feedback. */
  validate?: () => void;
}
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
  const samplers = ['TEXTURE', ...uniforms.filter(u => u.type === 'sampler2D').map(u => u.name)];
  const replaceTextures = (input: string) => {
    let result = input;
    for (const name of samplers) result = result.replace(new RegExp(`\\btexture\\s*\\(\\s*${name}\\s*,`, 'g'), `pgSample_${name}(`);
    if (/\btexture\s*\(/.test(result)) fail('indirect or unknown texture sampler');
    return result;
  };
  const samplerHelpers = samplers.map(name => {
    const main = name === 'TEXTURE', sampler = main ? 'uMainSampler' : name;
    return `uniform float pgPremult_${name};
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
  vec4 value = texture2D(${sampler}, ${main ? 'uPgUvRect.xy + uv * uPgUvRect.zw' : 'uv'});
  return pgDecode_${name}(value);
}`;
  }).join('\n');
  const common = `precision highp float;
uniform float uPgTime;
uniform sampler2D uMainSampler;
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
varying vec2 pgUv;
varying vec2 pgVertex;
varying vec4 pgColor;
void main() {
  VERTEX = (uPgScreenToLocal * vec3(inPosition, 1.0)).xy;
  UV = (inTexCoord - uPgUvRect.xy) / uPgUvRect.zw;
  COLOR = vec4(inTint.bgr, inTint.a) * uPgColor;
  SCREEN_UV = vec2(0.0);
  ${replaceTextures(vertexFn.body)}
  pgUv = UV; pgVertex = VERTEX; pgColor = COLOR;
  vec2 screenPosition = (uPgLocalToScreen * vec3(VERTEX, 1.0)).xy;
  gl_Position = uProjectionMatrix * vec4(screenPosition, 1.0, 1.0);
}`;
  const fragment = `${common}
varying vec2 pgUv;
varying vec2 pgVertex;
varying vec4 pgColor;
void main() {
  UV = pgUv; VERTEX = pgVertex;
  SCREEN_UV = gl_FragCoord.xy / uResolution;
  COLOR = pgColor * pgSample_TEXTURE(UV);
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
      vec3 ink = max(pgSample_TEXTURE(UV).rgb * pgColor.rgb, vec3(0.0));
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
  return { source, vertex, fragment, uniforms, blend, requiresScreen: uniforms.some(u => /hint_screen_texture/.test(u.hints)), unshaded: modes.includes('unshaded'), compatibilityZeroLights:options.compatibilityZeroLights===true };
}

/** Matrices are mandatory to avoid accidentally using viewport pixels as source
 * local/world coordinates. Texture defaults are not silently invented. */
export class PathogenicShaderPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  // WebGL copies matrix values synchronously. Phaser passes force=true for
  // matrix uniforms, so reusing these upload buffers cannot suppress updates.
  private readonly screenMatrix=new Float32Array(9);
  private readonly localMatrix=new Float32Array(9);
  private readonly modelMatrix=new Float32Array(16);
  constructor(game: Phaser.Game, readonly program: CompiledCanvasShader) {
    super({ game, vertShader: program.vertex, fragShader: program.fragment });
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
    if (!Number.isFinite(data.time) || data.textureSize.some(n => !(n > 0))) fail('invalid time/texture size');
    if (data.screenToLocal.length !== 9 || data.localToScreen.length !== 9 || data.modelMatrix.length !== 16) fail('invalid source transform');
    if (!data.color.every(Number.isFinite)||!data.screenToLocal.every(Number.isFinite)||!data.localToScreen.every(Number.isFinite)||!data.modelMatrix.every(Number.isFinite)) fail('non-finite source transform/color');
    this.flush();
    this.set1f('uPgTime', data.time);
    this.set4f('uPgColor', ...data.color);
    this.set4f('uPgProjectilePalette', ...(data.projectilePalette ?? [0,0,0,0]) as [number,number,number,number]);
    this.set4f('uPgCanvasModulate', ...(data.canvasModulate || [1, 1, 1, 1]) as [number, number, number, number]);
    this.set4f('uPgUvRect', ...(data.uvRect || [0, 0, 1, 1]) as [number, number, number, number]);
    this.set2f('uPgTexturePixelSize', 1 / data.textureSize[0], 1 / data.textureSize[1]);
    this.screenMatrix.set(data.screenToLocal);this.localMatrix.set(data.localToScreen);this.modelMatrix.set(data.modelMatrix);
    this.setMatrix3fv('uPgScreenToLocal', false, this.screenMatrix);
    this.setMatrix3fv('uPgLocalToScreen', false, this.localMatrix);
    this.setMatrix4fv('MODEL_MATRIX', false, this.modelMatrix);
    this.set1f('pgPremult_TEXTURE', data.mainPremultiplied === false ? 0 : 1);
    this.set1f('uPgMainRepeat',data.mainRepeat?1:0);
    let unit = 1;
    for (const uniform of this.program.uniforms) {
      if (uniform.type === 'sampler2D') {
        const binding = data.textures?.[uniform.name];
        if (!binding) throw new PathogenicShaderCoverageError(this.program.source.path, `missing texture ${uniform.name} (${uniform.hints || 'no default'})`);
        binding.validate?.();
        if (unit >= this.renderer.maxTextures) fail('texture unit capacity exceeded');
        this.bindTexture(binding.texture, unit);
        this.set1i(uniform.name, unit++);
        this.set1f(`pgPremult_${uniform.name}`, binding.premultiplied ? 1 : 0);
        continue;
      }
      const value = data.uniforms?.[uniform.name] ?? uniform.defaultValue;
      if (value === undefined) fail(`missing uniform ${uniform.name}`);
      const values = Array.isArray(value) ? value : [Number(value)];
      if (values.some(v => !Number.isFinite(v))) fail(`non-finite uniform ${uniform.name}`);
      const integer = /^(?:int|bool|ivec|bvec)/.test(uniform.type);
      if (uniform.type.startsWith('mat')) {
        const n = Number(uniform.type.at(-1));
        if (values.length !== n * n) fail(`wrong matrix size ${uniform.name}`);
        (this as any)[`setMatrix${n}fv`](uniform.name, false, values);
      } else {
        const dimension = /vec([234])$/.exec(uniform.type);
        if (values.length !== (dimension ? Number(dimension[1]) : 1)) fail(`wrong uniform vector size ${uniform.name}`);
        (this as any)[`set${values.length}${integer ? 'i' : 'f'}`](uniform.name, ...values);
      }
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
  const identity=JSON.stringify([source.path,source.sha256??'',options.compatibilityZeroLights===true]);
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

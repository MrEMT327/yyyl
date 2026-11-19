// Authored battle material compiler from the game. Input is an effect shader and its fixed lighting specialization.
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
uniform sampler2D uMainSampler;
uniform vec4 uPgColor;
uniform vec4 uPgProjectilePalette;
uniform vec4 uPgCanvasModulate;
uniform vec4 uPgUvRect;
uniform vec2 uPgTexturePixelSize;
uniform float uPgMainRepeat;
uniform vec2 uResolution;
uniform vec4 uPgViewport;
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
  SCREEN_UV = (gl_FragCoord.xy - uPgViewport.xy) / uPgViewport.zw;
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

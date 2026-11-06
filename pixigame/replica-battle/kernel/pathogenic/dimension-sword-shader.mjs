// The cut has one fine edge. Scene echoes use a continuous falloff with no
// colored face, strip boundary, outer outline, or second parallel light edge.
export const DIMENSION_SWORD_GLSL = `
uniform float uDimensionCount;
uniform vec2 uDimensionViewport;
uniform vec4 uDimensionLine[3];
uniform vec4 uDimensionShape[3];
uniform vec4 uDimensionStyle[3];
vec4 dimensionResolvedAt(vec2 uv) {
  uv = clamp(uv, uPixel * .5, vec2(1.) - uPixel * .5);
  vec4 c = texture2D(uScene, uv);
  vec3 glow = godotGlowUpsample(uInput, uv, uPixel).rgb;
  return vec4(godotGlowResolve(c.rgb, glow, uIntensity), c.a);
}
vec2 dimensionUvOffset(vec2 pixels) {
  return vec2(pixels.x, -pixels.y) / uDimensionViewport;
}
vec4 dimensionResolve() {
  if (uDimensionCount < .5) return dimensionResolvedAt(vUv);
  vec2 p = vec2(vUv.x, 1. - vUv.y) * uDimensionViewport;
  vec2 shift = vec2(0.);
  for (int i = 0; i < 3; i++) {
    if (float(i) >= uDimensionCount) break;
    vec4 line = uDimensionLine[i], shape = uDimensionShape[i], style = uDimensionStyle[i];
    vec2 n = vec2(-line.w, line.z), q = p - line.xy;
    float along = dot(q, line.zw), across = dot(q, n);
    float endMask = 1. - smoothstep(shape.x * .76, shape.x, abs(along));
    float width = clamp(shape.y * .6, 12., 24.);
    float falloff = exp(-across * across / (width * width) * 2.) * endMask;
    shift += n * sign(across) * min(6., shape.y * .15) * style.x * falloff;
  }
  float shiftLength = length(shift);
  if (shiftLength > 8.) shift *= 8. / shiftLength;
  vec4 color = dimensionResolvedAt(vUv + dimensionUvOffset(shift));
  for (int i = 0; i < 3; i++) {
    if (float(i) >= uDimensionCount) break;
    vec4 line = uDimensionLine[i], shape = uDimensionShape[i], style = uDimensionStyle[i];
    vec2 n = vec2(-line.w, line.z), q = p - line.xy;
    float along = dot(q, line.zw), across = dot(q, n), d = abs(across);
    float endMask = 1. - smoothstep(shape.x * .76, shape.x, abs(along));
    float width = clamp(shape.y * .6, 12., 24.);
    float falloff = exp(-d * d / (width * width) * 2.) * endMask;
    vec2 ghostShift = n * sign(across) * (3. + 7. * style.x);
    vec3 ghost = dimensionResolvedAt(vUv - dimensionUvOffset(ghostShift)).rgb;
    color.rgb = mix(color.rgb, ghost, falloff * style.x * .12);
    float edge = exp(-d * 3.1);
    float halo = exp(-d * .95) * .065;
    vec3 light = vec3(.28, .62, 1.1) * halo + mix(vec3(.54, .86, 1.3), vec3(1.15, 1.3, 1.45), style.z) * edge;
    float cell = floor((along + shape.z * 130.) / 63.);
    float rnd = fract(sin(cell * 43.17 + shape.z * 71.3) * 12731.);
    float sparkX = mod(along + shape.z * 130., 63.) - 31.5;
    float sparkY = across - sign(rnd - .5) * (2. + style.w * 12.);
    float spark = exp(-abs(sparkX) * 1.8 - abs(sparkY) * 2.) * step(.76, rnd) * (1. - style.z) * style.x;
    color.rgb += (light + vec3(.65, 1., 1.25) * spark) * endMask * style.y;
  }
  return color;
}
`;

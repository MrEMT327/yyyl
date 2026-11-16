import Phaser from 'phaser';

/** Adapted from the APK Effects/UVFlow, Effects/TexSheet and Legacy
 * Particles/Additive GLES.
 * Current binder materials use the default white mask. Particle endpoint
 * simulation is handled separately; no glow texture is stretched into a line. */
export class OriginalBeamPipeline extends Phaser.Renderer.WebGL.Pipelines.SinglePipeline {
  constructor(game: Phaser.Game) {
    super({ game, fragShader: `
      precision highp float;
      uniform sampler2D uMainSampler;
      uniform vec4 uMainST;
      uniform vec2 uScroll;
      uniform vec4 uMaterialColor;
      uniform vec4 uStartColor;
      uniform vec4 uEndColor;
      uniform float uGradientStep;
      uniform float uLegacy;
      uniform vec4 uSheet;
      uniform float uTime;
      varying vec2 outTexCoord;
      void main() {
        vec2 uv = outTexCoord * uMainST.xy + uMainST.zw + uScroll;
        if (uSheet.w > .5) {
          // Effects/TexSheet: the original 1x8 lightning atlas advances at
          // floor(_Time.y * _Speed). Unity UVs start at the bottom; the exported
          // PNG/Phaser UVs start at the top. Convert around the native formula,
          // rather than displaying all eight lightning frames simultaneously.
          vec2 nativeUV = vec2(outTexCoord.x, 1.0 - outTexCoord.y)
            * uMainST.xy + vec2(uMainST.z, -uMainST.w);
          float frame = floor(uTime * uSheet.z);
          float row = floor(frame / uSheet.x);
          float column = frame - row * uSheet.x;
          vec2 cells = floor(uSheet.xy);
          nativeUV = (nativeUV + vec2(column, uSheet.y - 1.0 - row)) / cells;
          uv = vec2(nativeUV.x, 1.0 - nativeUV.y);
        }
        vec4 tex = texture2D(uMainSampler, fract(uv));
        float t = uGradientStep > .5 ? step(1.0, outTexCoord.x) : outTexCoord.x;
        vec4 color = mix(uStartColor, uEndColor, t) * uMaterialColor;
        color *= 1.0 + uLegacy;
        float alpha = clamp(tex.a * color.a, 0.0, 1.0);
        vec3 straightRGB = tex.a > 0.00001 ? tex.rgb / tex.a : vec3(0.0);
        gl_FragColor = vec4(straightRGB * color.rgb * alpha, alpha);
      }
    ` });
  }
  onBind(object?: Phaser.GameObjects.GameObject) {
    const data = object?.getData('beamMaterial');
    if (!data) return;
    // These uniforms vary per beam. Flush before updating even for the same texture.
    this.flush();
    const material = data.material, tex = material.textures.find((t: any) => t.slot === '_MainTex');
    const speed = material.colors?._MainSpeed || {}, color = material.colors?._TintColor || { r: 1, g: 1, b: 1, a: 1 };
    const g = data.gradient, start = g?.key0 || { r: 1, g: 1, b: 1, a: 1 }, end = g?.key1 || start;
    this.set4f('uMainST', tex.scale.x, tex.scale.y, tex.offset.x, -tex.offset.y);
    this.set2f('uScroll', (speed.r || 0) * data.time, -(speed.g || 0) * data.time);
    this.set4f('uMaterialColor', color.r, color.g, color.b, color.a);
    this.set4f('uStartColor', start.r, start.g, start.b, start.a);
    this.set4f('uEndColor', end.r, end.g, end.b, end.a);
    this.set1f('uGradientStep', g?.m_Mode === 1 ? 1 : 0);
    this.set1f('uLegacy', material.shaderName === 'Legacy Shaders/Particles/Additive' ? 1 : 0);
    const sheet = material.shaderName === 'Effects/TexSheet', floats = material.floats || {};
    this.set4f('uSheet', floats._U ?? 1, floats._V ?? 1, floats._Speed ?? 0, sheet ? 1 : 0);
    this.set1f('uTime', data.time);
  }
}

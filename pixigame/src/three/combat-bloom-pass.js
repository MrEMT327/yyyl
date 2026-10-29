import { DataTexture, Vector2 } from 'three';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// Combat composites renderTargetsHorizontal[0] directly with its own screen
// blend. The standard pass also copies that light back into readBuffer, which
// combat never displays. A fifth blur with zero weight is equally unused.
export class CombatBloomPass extends UnrealBloomPass {
  constructor(resolution = new Vector2(1, 1), strength = 1.25, radius = 0, threshold = .16) {
    super(resolution, strength, radius, threshold);
    this.zeroMip = new DataTexture(new Uint8Array(4), 1, 1);
    this.zeroMip.needsUpdate = true;
  }

  render(renderer, writeBuffer, readBuffer, delta, maskActive) {
    const u = this.compositeMaterial.uniforms;
    // Preserve standard behavior if a diagnostic changes the bloom profile.
    if (maskActive || this.renderToScreen || this.radius !== 0 || u.bloomFactors.value[4] !== 0) {
      u.blurTexture5.value = this.renderTargetsVertical[4].texture;
      return super.render(renderer, writeBuffer, readBuffer, delta, maskActive);
    }
    u.blurTexture5.value = this.zeroMip;
    renderer.getClearColor(this._oldClearColor);
    const alpha = renderer.getClearAlpha(), autoClear = renderer.autoClear;
    try {
      renderer.autoClear = false; renderer.setClearColor(this.clearColor, 0);
      this.highPassUniforms.tDiffuse.value = readBuffer.texture;
      this.highPassUniforms.luminosityThreshold.value = this.threshold;
      this._fsQuad.material = this.materialHighPassFilter;
      renderer.setRenderTarget(this.renderTargetBright); renderer.clear(); this._fsQuad.render(renderer);
      let input = this.renderTargetBright;
      for (let i = 0; i < 4; i++) {
        const material = this.separableBlurMaterials[i]; this._fsQuad.material = material;
        material.uniforms.colorTexture.value = input.texture;
        material.uniforms.direction.value = UnrealBloomPass.BlurDirectionX;
        renderer.setRenderTarget(this.renderTargetsHorizontal[i]); renderer.clear(); this._fsQuad.render(renderer);
        material.uniforms.colorTexture.value = this.renderTargetsHorizontal[i].texture;
        material.uniforms.direction.value = UnrealBloomPass.BlurDirectionY;
        renderer.setRenderTarget(this.renderTargetsVertical[i]); renderer.clear(); this._fsQuad.render(renderer);
        input = this.renderTargetsVertical[i];
      }
      this._fsQuad.material = this.compositeMaterial;
      u.bloomStrength.value = this.strength; u.bloomRadius.value = this.radius; u.bloomTintColors.value = this.bloomTintColors;
      renderer.setRenderTarget(this.renderTargetsHorizontal[0]); renderer.clear(); this._fsQuad.render(renderer);
    } finally {
      renderer.setClearColor(this._oldClearColor, alpha); renderer.autoClear = autoClear;
    }
  }

  dispose() { super.dispose(); this.zeroMip.dispose(); }
}

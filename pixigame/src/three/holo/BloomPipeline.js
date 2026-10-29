import * as THREE from 'three';
// Adapted from the user's E:/_games/镭射卡 project for offscreen card artwork.

const fullscreenVertex = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export class BloomPipeline {
  constructor(renderer, width, height) {
    this.renderer = renderer;
    this.enabled = true;
    this.strength = .24;
    this.threshold = .94;
    this.radius = .32;

    this.sceneTarget = this.makeTarget(width, height, true);
    this.ping = this.makeTarget(Math.max(1, width >> 1), Math.max(1, height >> 1), false);
    this.pong = this.makeTarget(Math.max(1, width >> 1), Math.max(1, height >> 1), false);

    this.quadScene = new THREE.Scene();
    this.quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null);
    this.quadScene.add(this.quad);

    this.brightMaterial = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, threshold: { value: this.threshold } },
      vertexShader: fullscreenVertex,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform float threshold;
        varying vec2 vUv;
        void main() {
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          float l = max(max(c.r, c.g), c.b);
          float m = smoothstep(threshold, threshold + .28, l);
          gl_FragColor = vec4(c * m, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });

    this.blurMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        texel: { value: new THREE.Vector2(1 / this.ping.width, 1 / this.ping.height) },
        direction: { value: new THREE.Vector2(1, 0) },
        radius: { value: this.radius }
      },
      vertexShader: fullscreenVertex,
      fragmentShader: /* glsl */`
        uniform sampler2D tDiffuse;
        uniform vec2 texel;
        uniform vec2 direction;
        uniform float radius;
        varying vec2 vUv;
        void main() {
          vec2 d = direction * texel * mix(0.65, 2.2, radius);
          vec3 sum = texture2D(tDiffuse, vUv).rgb * .227027;
          sum += texture2D(tDiffuse, vUv + d * 1.384615).rgb * .316216;
          sum += texture2D(tDiffuse, vUv - d * 1.384615).rgb * .316216;
          sum += texture2D(tDiffuse, vUv + d * 3.230769).rgb * .070270;
          sum += texture2D(tDiffuse, vUv - d * 3.230769).rgb * .070270;
          gl_FragColor = vec4(sum, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
      toneMapped: false
    });

    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tScene: { value: null },
        tBloom: { value: null },
        strength: { value: this.strength }
      },
      vertexShader: fullscreenVertex,
      fragmentShader: /* glsl */`
        uniform sampler2D tScene;
        uniform sampler2D tBloom;
        uniform float strength;
        varying vec2 vUv;
        void main() {
          vec3 base = texture2D(tScene, vUv).rgb;
          vec3 bloom = texture2D(tBloom, vUv).rgb;
          gl_FragColor = vec4(base + bloom * strength, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }
      `,
      depthTest: false,
      depthWrite: false,
      toneMapped: true
    });
  }

  makeTarget(width, height, depthBuffer) {
    const rt = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer,
      stencilBuffer: false
    });
    rt.texture.generateMipmaps = false;
    return rt;
  }

  draw(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.quadScene, this.quadCamera);
  }

  render(scene, camera, output = null) {
    if (!this.enabled) {
      this.renderer.setRenderTarget(output);
      this.renderer.render(scene, camera);
      return;
    }

    this.renderer.setRenderTarget(this.sceneTarget);
    this.renderer.clear();
    this.renderer.render(scene, camera);

    this.brightMaterial.uniforms.tDiffuse.value = this.sceneTarget.texture;
    this.brightMaterial.uniforms.threshold.value = this.threshold;
    this.draw(this.brightMaterial, this.ping);

    this.blurMaterial.uniforms.radius.value = this.radius;
    this.blurMaterial.uniforms.tDiffuse.value = this.ping.texture;
    this.blurMaterial.uniforms.direction.value.set(1, 0);
    this.draw(this.blurMaterial, this.pong);

    this.blurMaterial.uniforms.tDiffuse.value = this.pong.texture;
    this.blurMaterial.uniforms.direction.value.set(0, 1);
    this.draw(this.blurMaterial, this.ping);

    this.compositeMaterial.uniforms.tScene.value = this.sceneTarget.texture;
    this.compositeMaterial.uniforms.tBloom.value = this.ping.texture;
    this.compositeMaterial.uniforms.strength.value = this.strength;
    this.draw(this.compositeMaterial, output);
  }

  setSize(width, height) {
    this.sceneTarget.setSize(width, height);
    const w = Math.max(1, width >> 1);
    const h = Math.max(1, height >> 1);
    this.ping.setSize(w, h);
    this.pong.setSize(w, h);
    this.blurMaterial.uniforms.texel.value.set(1 / w, 1 / h);
  }

  dispose() {
    this.sceneTarget.dispose(); this.ping.dispose(); this.pong.dispose();
    this.brightMaterial.dispose(); this.blurMaterial.dispose(); this.compositeMaterial.dispose();
    this.quad.geometry.dispose();
  }
}

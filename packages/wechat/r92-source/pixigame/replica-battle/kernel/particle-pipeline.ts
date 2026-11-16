import Phaser from 'phaser';

/** Effects/Particle multiplies the source by vertex color and _TintColor.
 * Keep HDR RGB gain separate from Phaser's packed 8-bit tint. Textures are
 * premultiplied on upload, so only RGB gets the gain, not source alpha. */
export class OriginalParticlePipeline extends Phaser.Renderer.WebGL.Pipelines.MultiPipeline {
  private gain = -1;
  constructor(game: Phaser.Game) {
    super({ game, fragShader: `
      precision mediump float;
      uniform sampler2D uMainSampler[%count%];
      uniform float uTintGain;
      varying vec2 outTexCoord;
      varying float outTexId;
      varying float outTintEffect;
      varying vec4 outTint;
      void main() {
        vec4 texture;
        %forloop%
        vec4 color = texture * vec4(outTint.bgr * outTint.a, outTint.a);
        color.rgb *= uTintGain;
        gl_FragColor = color;
      }
    ` });
  }
  onBind(object?: Phaser.GameObjects.GameObject) {
    const gain = Number(object?.getData('tintGain') ?? 1);
    if (gain !== this.gain) {
      // Uniforms are per batch: submit the preceding objects before changing it.
      this.flush(); this.set1f('uTintGain', gain); this.gain = gain;
    }
  }
  onRebind() { this.gain = -1; }
}

export interface ParticleMeshData { vertices: Array<{ x: number; z: number; u: number; v: number; tint?: number; alpha?: number }>; indices: number[] }
export class OriginalParticleMesh extends Phaser.GameObjects.Mesh {
  constructor(scene: Phaser.Scene, texture: string) {
    super(scene, 0, 0, texture);
    this.hideCCW = false;
    this.setOrtho(this.width, this.height);
    this.ignoreDirtyCache = true;
  }
  setGeometry(data: ParticleMeshData, pixelsPerUnit: number, tint: number) {
    if (this.vertices.length !== data.indices.length) {
      this.clear();
      this.addVertices(data.vertices.flatMap(v => [v.x * pixelsPerUnit, v.z * pixelsPerUnit]), data.vertices.flatMap(v => [v.u, v.v]), data.indices, false, undefined, tint);
    } else {
      // GenerateVerts expands indexed data; preserve that mapping when animating.
      for (let i = 0; i < data.indices.length; i++) {
        const point = data.vertices[data.indices[i]], vertex = this.vertices[i];
        vertex.x = point.x * pixelsPerUnit; vertex.y = point.z * pixelsPerUnit;
        vertex.setUVs(point.u, point.v); vertex.color = tint;
      }
    }
    for (let i = 0; i < data.indices.length; i++) {
      const point = data.vertices[data.indices[i]];
      this.vertices[i].color = point.tint ?? tint;
      this.vertices[i].alpha = point.alpha ?? 1;
    }
    this.preUpdate(0, 0);
    return this;
  }
}

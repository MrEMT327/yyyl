import { sampleOriginalEffect, type OriginalEffectSprite } from './original-effects';

type Data = Record<string, any>;
type Draw = { sprite: OriginalEffectSprite; material: Data };

/** UIParticle's XY mesh and the APK's Particle/UVFlow fragment formulas.
 * One offscreen GL context serves all bursts. Ordered blend runs are composited
 * directly over the stage: putting additive canvases inside the transformed
 * card would isolate them from the game and leave dark rectangles behind.
 */
export class OriginalUiBurst {
  private data: Data | null = null;
  private images = new Map<string, HTMLImageElement>();
  private textures = new Map<string, WebGLTexture>();
  private views = new Map<HTMLElement, HTMLCanvasElement[]>();
  private surface = document.createElement('canvas');
  private gl: WebGLRenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private buffer: WebGLBuffer | null = null;
  private uniforms = new Map<string, WebGLUniformLocation | null>();

  constructor() {
    void fetch('data/ui-burst-particles.json').then(r => {
      if (!r.ok) throw new Error(`UI burst resource: ${r.status}`);
      return r.json();
    }).then((data: Data) => {
      for (const effect of Object.values<Data>(data.effects)) {
        // UIParticle disables the native renderer after taking over BakeMesh.
        // Its own ordered particle list, not renderer.enabled, is authoritative.
        effect.layers = effect.layers.filter((l: Data) => l.uiRenderable)
          .sort((a: Data, b: Data) => effect.particleOrder.indexOf(String(a.id)) - effect.particleOrder.indexOf(String(b.id)))
          .map((l: Data, order: number) => ({ ...l, renderer: { ...l.renderer, m_SortingOrder: order } }));
      }
      this.data = data;
      for (const [key, texture] of Object.entries<Data>(data.textures)) {
        const image = new Image(); image.src = texture.url; this.images.set(key, image);
      }
    }).catch(error => console.error('突破粒子资源加载失败', error));
  }

  prune(cards: HTMLElement[]) {
    for (const [card, canvases] of this.views) if (!cards.includes(card) || !card.isConnected) {
      canvases.forEach(canvas => canvas.remove()); this.views.delete(card);
    }
  }

  draw(card: HTMLElement, time: number, offsetX: number, offsetY: number) {
    const data = this.data, stage = card.closest<HTMLElement>('#stage');
    if (!data || !stage) return;
    const tier = data.tiers[card.dataset.tier || 'y']; if (!tier) return;
    const draws: Draw[] = [];
    for (const group of tier.groups) {
      let active = false, started = 0;
      for (const transition of group.transitions) {
        if (transition.time > time) break;
        if (transition.active && !active) started = transition.time;
        active = transition.active;
      }
      if (!active) continue;
      const effect = data.effects[group.effect];
      for (const sprite of sampleOriginalEffect(data, group.effect, time - started, 71, { projection: 'xy' })) {
        const layer = effect.layers.find((l: Data) => String(l.id) === sprite.layerId);
        if (layer) draws.push({ sprite, material: layer.materials[0] });
      }
    }
    const runs: Draw[][] = [];
    for (const draw of draws) {
      const last = runs[runs.length - 1];
      if (last?.[0].sprite.blend === draw.sprite.blend) last.push(draw);
      else runs.push([draw]);
    }
    let canvases = this.views.get(card);
    if (!canvases) { canvases = []; this.views.set(card, canvases); }
    while (canvases.length > runs.length) canvases.pop()!.remove();
    if (!runs.length || !this.init()) return;
    const bounds = stage.getBoundingClientRect(), rect = card.getBoundingClientRect();
    const unit = rect.width / 328, ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(bounds.width * ratio)), height = Math.max(1, Math.round(bounds.height * ratio));
    if (this.surface.width !== width || this.surface.height !== height) { this.surface.width = width; this.surface.height = height; }
    const gl = this.gl!; gl.viewport(0, 0, width, height); gl.useProgram(this.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const position = gl.getAttribLocation(this.program!, 'aPosition'), uv = gl.getAttribLocation(this.program!, 'aUV');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 16, 8);
    const cx = rect.left - bounds.left + rect.width / 2 + offsetX * unit;
    const cy = rect.top - bounds.top + rect.height / 2 - offsetY * unit;
    runs.forEach((run, index) => {
      const additive = run[0].sprite.blend === 'add';
      let canvas = canvases![index];
      if (!canvas) {
        canvas = document.createElement('canvas'); canvas.className = 'original-burst'; canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3';
        stage.append(canvas); canvases!.push(canvas);
      }
      canvas.style.mixBlendMode = additive ? 'plus-lighter' : 'normal';
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      // Opaque black plus-lighter is identity over the existing stage. This also
      // preserves RGB above particle alpha without invalid premultiplied pixels.
      gl.clearColor(0, 0, 0, additive ? 1 : 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.ONE, additive ? gl.ONE : gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      for (const draw of run) this.particle(draw, performance.now() / 1000, cx, cy, unit, bounds.width, bounds.height, additive);
      const ctx = canvas.getContext('2d');
      if (ctx) { ctx.clearRect(0, 0, width, height); ctx.drawImage(this.surface, 0, 0); }
    });
  }

  private init() {
    if (this.program) return true;
    const gl = this.surface.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, preserveDrawingBuffer: true });
    if (!gl) return false;
    this.gl = gl;
    const shader = (kind: number, code: string) => {
      const shader = gl.createShader(kind)!; gl.shaderSource(shader, code); gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); return null; }
      return shader;
    };
    const vertex = shader(gl.VERTEX_SHADER, `attribute vec2 aPosition; attribute vec2 aUV; varying vec2 vUV;
      void main(){ gl_Position=vec4(aPosition,0.,1.); vUV=aUV; }`);
    const fragment = shader(gl.FRAGMENT_SHADER, `precision highp float;
      uniform sampler2D uMain; uniform sampler2D uMask;
      uniform vec4 uColor; uniform vec4 uMainST; uniform vec4 uMaskST;
      uniform vec2 uMainScroll; uniform vec2 uMaskScroll; uniform float uFlow; uniform float uAdd;
      varying vec2 vUV;
      void main(){
        vec2 uv=vec2(vUV.x,1.-vUV.y);
        vec2 mainUV=uv*uMainST.xy+uMainST.zw+uMainScroll;
        vec4 tex=texture2D(uMain,vec2(mainUV.x,1.-mainUV.y));
        float mask=1.;
        if(uFlow>.5){vec2 maskUV=uv*uMaskST.xy+uMaskST.zw+uMaskScroll;
          vec4 m=texture2D(uMask,vec2(maskUV.x,1.-maskUV.y)); mask=m.r*m.a;}
        float a=clamp(tex.a*uColor.a*mask,0.,1.);
        vec3 rgb=tex.rgb*uColor.rgb;
        // DOM normal-alpha surfaces require valid premultiplied color.
        if(uAdd<.5)rgb=clamp(rgb,0.,1.);
        gl_FragColor=vec4(rgb*a,a);
      }`);
    if (!vertex || !fragment) return false;
    const program = gl.createProgram()!; gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return false; }
    this.program = program; this.buffer = gl.createBuffer(); return true;
  }

  private uniform(name: string) {
    if (!this.uniforms.has(name)) this.uniforms.set(name, this.gl!.getUniformLocation(this.program!, name));
    return this.uniforms.get(name)!;
  }

  private texture(key: string, unit: number) {
    const gl = this.gl!, image = this.images.get(key);
    if (!image?.complete || !image.naturalWidth) return false;
    gl.activeTexture(gl.TEXTURE0 + unit);
    let texture = this.textures.get(key);
    if (!texture) {
      texture = gl.createTexture()!; this.textures.set(key, texture); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      const settings = this.data!.textures[key].settings;
      const wrap = (mode: number) => mode === 0 ? gl.REPEAT : mode === 2 ? gl.MIRRORED_REPEAT : gl.CLAMP_TO_EDGE;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap(settings.m_WrapU));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap(settings.m_WrapV));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, settings.m_FilterMode === 0 ? gl.NEAREST : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, settings.m_FilterMode === 0 ? gl.NEAREST : gl.LINEAR);
    } else gl.bindTexture(gl.TEXTURE_2D, texture);
    return true;
  }

  private particle({ sprite: s, material: mat }: Draw, time: number, cx: number, cy: number, unit: number, width: number, height: number, additive: boolean) {
    const gl = this.gl!, main = mat.textures.find((t: Data) => t.slot === '_MainTex');
    const mask = mat.textures.find((t: Data) => t.slot === '_MaskTex');
    if (!this.texture(s.key, 0) || (mask && !this.texture(mask.key, 1))) return;
    const flow = mat.shaderName === 'Effects/UVFlow';
    gl.uniform1i(this.uniform('uMain'), 0); gl.uniform1i(this.uniform('uMask'), mask ? 1 : 0);
    gl.uniform1f(this.uniform('uFlow'), flow ? 1 : 0); gl.uniform1f(this.uniform('uAdd'), additive ? 1 : 0);
    for (const [name, tex] of [['Main', main], ['Mask', mask]] as const) {
      gl.uniform4f(this.uniform(`u${name}ST`), tex?.scale.x ?? 1, tex?.scale.y ?? 1, tex?.offset.x ?? 0, tex?.offset.y ?? 0);
      const speed = flow ? mat.colors[`_${name}Speed`] : null;
      const fract = (value: number) => value - Math.floor(value);
      gl.uniform2f(this.uniform(`u${name}Scroll`), fract((speed?.r || 0) * time), fract((speed?.g || 0) * time));
    }
    const gain = (s.tintGain || 1) / 255;
    gl.uniform4f(this.uniform('uColor'), ((s.tint >> 16) & 255) * gain, ((s.tint >> 8) & 255) * gain, (s.tint & 255) * gain, s.alpha);
    const texture = this.data!.textures[s.key], crop = s.crop || { x: 0, y: 0, width: texture.width, height: texture.height };
    const cos = Math.cos(s.rotation), sin = Math.sin(s.rotation), vertices: number[] = [];
    for (const [x, y] of [[0,0],[1,0],[0,1],[0,1],[1,0],[1,1]]) {
      const px = (x - s.originX) * s.width, py = (y - s.originY) * s.height;
      const screenX = cx + (s.x + px * cos - py * sin) * unit;
      const screenY = cy + (-s.z + px * sin + py * cos) * unit;
      vertices.push(screenX / width * 2 - 1, 1 - screenY / height * 2, (crop.x + x * crop.width) / texture.width, (crop.y + y * crop.height) / texture.height);
    }
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STREAM_DRAW); gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

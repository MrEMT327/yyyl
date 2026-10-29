import {performanceMonitor} from '../performance-monitor.js';
import {trackWebGLRenderer} from '../renderer-metrics.js';
import {createPortraitAtlasBatch} from './portrait-atlas-batch.js';
import {decodePortraitFrames} from './portrait-frame-codec.js';
const ROOT = `${import.meta.env?.BASE_URL ?? '/'}art/white-gold-knight-v11/`;
const MANIFEST_URL = `${ROOT}runtime/manifest.json`;
const PIXI_URL = `${ROOT}pixi-8.19.0.min.js`;

let pixiPromise;
const textureSlots = new Map();
let portraitSerial=0;

function localUrl(path, base = location.href) {
  const url = new URL(path, base);
  if (url.origin !== location.origin) throw new Error('立绘只允许读取同源资源');
  return url.href;
}

function loadPixi() {
  if (globalThis.PIXI?.Application) return Promise.resolve(globalThis.PIXI);
  if (!pixiPromise) {
    pixiPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = localUrl(PIXI_URL);
      script.async = true;
      script.onload = () => {
        script.onload = script.onerror = null;
        if (globalThis.PIXI?.Application) resolve(globalThis.PIXI);
        else reject(new Error('立绘渲染器未正确加载'));
      };
      script.onerror = () => {
        script.onload = script.onerror = null;
        script.remove();
        reject(new Error('立绘渲染器读取失败'));
      };
      document.head.appendChild(script);
    });
  }
  return pixiPromise;
}

// Share Pixi's asset cache, but release our textures after the last player exits.
// Serializing each slot also covers destroy/recreate during an in-flight load.
function acquireTexture(PIXI, url) {
  let slot = textureSlots.get(url);
  if (!slot) {
    slot = { users: 0, texture: null, operation: Promise.resolve() };
    textureSlots.set(url, slot);
  }
  slot.users += 1;
  slot.operation = slot.operation.catch(() => {}).then(async () => {
    if (!slot.texture) {
      try { slot.texture = await PIXI.Assets.load(url); }
      catch (cause) { throw new Error(`立绘纹理读取失败: ${url}`, { cause }); }
    }
  });
  const promise = slot.operation.then(() => slot.texture);
  let released = false;
  return {
    promise,
    release() {
      if (released) return;
      released = true;
      slot.users -= 1;
      slot.operation = slot.operation.catch(() => {}).then(async () => {
        if (slot.users || !slot.texture) return;
        slot.texture = null;
        await PIXI.Assets.unload(url);
      }).catch(() => {});
    },
  };
}

/** Keeps one transparent portrait canvas alive across lobby DOM refreshes. */
export function createLobbyPortraitPlayer({batching=true}={}) {
  let host = null;
  let visible = true;
  let state = 'idle';
  let destroyed = false;
  let warned = false;
  let error = null;
  let loading = null;
  let controller = null;
  let app = null;
  let manifest = null;
  let actor = null;
  let drawFrame = null;
  let frameIndex = 0;
  let seconds = 0;
  let previous = 0;
  let resizeObserver = null;
  let rendererMetrics=null,framePrepared=false;
  let atlasBatch=null;
  const regionTextures=[];
  const meshes = [];
  const maskScenes = new Map();
  const textureHandles = [];
  const motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');

  function markState(next) {
    state = next;
    if (host) {
      host.dataset.portraitState = next;
      host.classList.toggle('is-ready', next === 'ready');
    }
  }

  function syncPlayback() {
    if (!app) return;
    const play = state === 'ready' && visible && !document.hidden
      && host?.isConnected && !motionQuery?.matches;
    if (play) {
      if (!app.ticker.started) {
        previous = performance.now();
        app.start();
      }
    } else app.stop();
  }

  function fit() {
    if (!app || !host || !actor || destroyed) return;
    const { width, height } = host.getBoundingClientRect();
    if (width <= 0 || height <= 0) {
      app.stop();
      return;
    }
    const [sourceWidth, sourceHeight] = manifest.canvasSize;
    app.renderer.resize(width, height);
    const scale = Math.min(width / sourceWidth, height / sourceHeight);
    actor.scale.set(scale);
    actor.position.set((width - sourceWidth * scale) / 2, (height - sourceHeight * scale) / 2);
    app.render();
    syncPlayback();
  }

  function disposeRuntime() {
    rendererMetrics?.destroy();rendererMetrics=null;
    atlasBatch?.destroy();atlasBatch=null;
    if (app) {
      app.stop();
      app.canvas.removeEventListener('webglcontextlost', onContextLost);
      app.destroy({ removeView: true }, { children: true, texture: false, textureSource: false });
      app = null;
    }
    for (const { scene, texture } of maskScenes.values()) {
      scene.destroy({ children: true, texture: false, textureSource: false });
      texture.destroy(true);
    }
    maskScenes.clear();
    for (const { geometry, shader } of meshes) {
      geometry.destroy(true);
      shader?.destroy();
    }
    meshes.length = 0;
    for(const texture of regionTextures)texture.destroy(false);regionTextures.length=0;
    actor = null;
    drawFrame = null;
    for (const handle of textureHandles) handle.release();
    textureHandles.length = 0;
  }

  function fail(reason) {
    if (destroyed) return;
    error = reason;
    markState('error');
    controller?.abort();
    resizeObserver?.disconnect();
    disposeRuntime();
    if (!warned) {
      warned = true;
      console.warn('动态立绘载入失败，保留静态立绘。', reason);
    }
  }

  function onContextLost() {
    fail(new Error('立绘 WebGL 上下文已丢失'));
  }

  async function read(url) {
    let response;
    try { response = await fetch(url, { signal: controller.signal }); }
    catch (cause) { throw new Error(`立绘资源请求失败: ${url}`, { cause }); }
    if (!response.ok) throw new Error(`立绘资源读取失败 ${response.status}: ${url}`);
    return response;
  }

  async function load() {
    controller = new AbortController();
    markState('loading');
    const manifestUrl = localUrl(MANIFEST_URL);
    const [PIXI, config] = await Promise.all([
      loadPixi(), read(manifestUrl).then(response => response.json()),
    ]);
    if (destroyed) return false;
    if (config.schema !== 'source-mesh-target-cache-v1' || config.baseline !== 'idle-frame-0'
      || config.canvasSize?.[0] !== 1118 || config.canvasSize?.[1] !== 1407
      || !(config.fps > 0) || !(config.frameCount > 0) || !(config.durationSeconds > 0)) {
      throw new Error('立绘缓存格式或注册基准不符');
    }
    manifest = config;
    const atlas=batching?await (await read(localUrl('atlas-v1/manifest.json',manifestUrl))).json():null;
    const textureUrls = atlas?atlas.pages.map(page=>localUrl(`atlas-v1/${page.file}`,manifestUrl)):[...new Set([
      ...manifest.layers.map(layer => localUrl(layer.texture, manifestUrl)),
      ...(manifest.lightingPasses || []).filter(pass => !pass.maskLayerId)
        .map(pass => localUrl(pass.maskTexture, manifestUrl)),
    ])];
    for (const url of textureUrls) textureHandles.push(acquireTexture(PIXI, url));
    const framesUrl = localUrl(manifest.frames, manifestUrl);
    const results = await Promise.allSettled([
      read(framesUrl).then(async response => {
        try {
          // Vite sends Content-Encoding: gzip and browsers decode that response;
          // static hosts may instead serve the original .gz bytes unchanged.
          const payload = await response.arrayBuffer();
          const bytes = new Uint8Array(payload, 0, Math.min(2, payload.byteLength));
          if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return payload;
          if (!globalThis.DecompressionStream) throw new Error('浏览器不支持立绘缓存解压');
          return await new Response(new Blob([payload]).stream()
            .pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
        } catch (cause) { throw new Error(`立绘网格缓存解压失败: ${framesUrl}`, { cause }); }
      }),
      ...textureHandles.map(handle => handle.promise),
    ]);
    if (destroyed) return false;
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    const binary = decodePortraitFrames(results[0].value, manifest);
    if (binary.byteLength !== manifest.frameCount * manifest.frameStrideBytes) {
      throw new Error('立绘网格缓存长度不符');
    }
    const pages=atlas?textureUrls.map((_,index)=>results[index+1].value):null;
    const textures = atlas?new Map(Object.entries(atlas.entries).map(([path,entry])=>{
      const texture=new PIXI.Texture({source:pages[entry.page].source,frame:new PIXI.Rectangle(...entry.rect)});regionTextures.push(texture);return [localUrl(path,manifestUrl),texture];
    })):new Map(textureUrls.map((url, index) => [url, results[index + 1].value]));
    const fieldSpecs = Object.fromEntries(manifest.fields.map(field => [field.name, field]));
    for (const name of ['positions', 'opacities', 'renderOrders']) {
      if (!fieldSpecs[name]) throw new Error(`立绘缓存缺少 ${name}`);
    }
    const view = (frame, name) => {
      const spec = fieldSpecs[name];
      const Type = spec.type === 'float32' ? Float32Array : Int32Array;
      return new Type(binary, frame * manifest.frameStrideBytes + spec.byteOffset, spec.count);
    };

    const created = new PIXI.Application();
    try {
      await created.init({
        width: 1, height: 1, backgroundAlpha: 0, antialias: true,
        preference: 'webgl', resolution: Math.min(globalThis.devicePixelRatio || 1, 2),
        autoDensity: true, autoStart: false, sharedTicker: false,
      });
    } catch (initError) {
      if (created.renderer) created.destroy({ removeView: true }, { children: true });
      throw initError;
    }
    if (destroyed) {
      created.destroy({ removeView: true }, { children: true });
      return false;
    }
    app = created;
    if(app.renderer.gl){
      rendererMetrics=trackWebGLRenderer(app.renderer.gl,performanceMonitor,`portrait-atlas-${++portraitSerial}`,()=>Boolean(visible&&host?.isConnected&&!document.hidden));
      const render=app.renderer.render.bind(app.renderer);
      app.renderer.render=function(options){if(!options?.target){if(!framePrepared)rendererMetrics?.beginFrame();framePrepared=false;}return render(options);};
    }
    app.canvas.className = 'lobby-portrait-canvas';
    app.canvas.setAttribute('aria-hidden', 'true');
    app.canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;background:transparent';
    app.canvas.addEventListener('webglcontextlost', onContextLost);
    actor = new PIXI.Container({ sortableChildren: true });
    app.stage.addChild(actor);
    for (const layer of manifest.layers.filter(item => item.isMask)) {
      maskScenes.set(layer.id, {
        scene: new PIXI.Container({ sortableChildren: true }),
        texture: PIXI.RenderTexture.create({ width: 1118, height: 1407, resolution: 1 }),
      });
    }

    const makeShader = (layer, texture, lights) => {
      const clips = layer.masks || [];
      if (!lights.length && !clips.length) return null;
      const resources = { uTexture: texture.source };
      const uniforms = { uCanvasSize: { value: new Float32Array(manifest.canvasSize), type: 'vec2<f32>' } };
      let declarations = '', operations = '';
      for (let n = 0; n < lights.length; n++) {
        const pass = lights[n];
        const mask = pass.maskLayerId ? maskScenes.get(pass.maskLayerId)?.texture
          : textures.get(localUrl(pass.maskTexture, manifestUrl));
        if (!mask) throw new Error(`Missing dynamic lighting mask ${pass.maskLayerId}`);
        resources[`uLightMask${n}`] = mask.source;
        uniforms[`uOpacity${n}`] = { value: pass.baselineOpacity, type: 'f32' };
        uniforms[`uBase${n}`] = { value: pass.baselineOpacity, type: 'f32' };
        declarations += `uniform sampler2D uLightMask${n}; uniform float uOpacity${n}; uniform float uBase${n};\n`;
        let expression;
        if (pass.mode === 'multiply-ratio') expression = `color *= (1.0-uOpacity${n}*maskValue)/max(1.0-uBase${n}*maskValue,0.0001);`;
        else if (pass.mode === 'screen-ratio') expression = `color = 1.0-(1.0-color)*(1.0-uOpacity${n}*maskValue)/max(1.0-uBase${n}*maskValue,0.0001);`;
        else if (pass.mode === 'add-difference') expression = `color += (uOpacity${n}-uBase${n})*maskValue;`;
        else throw new Error(`Unsupported lighting mode: ${pass.mode}`);
        const sampleCoord = pass.maskLayerId ? 'vCanvasPos/uCanvasSize' : 'vUV';
        operations += `{float maskValue=texture(uLightMask${n},${sampleCoord}).a; if(abs(uOpacity${n}-uBase${n})>0.00000001){${expression}}}\n`;
      }
      let clipping = 'float clipAlpha=1.0;';
      if (clips.length) {
        clipping = 'float clipAlpha=0.0;';
        clips.forEach((id, n) => {
          if (!maskScenes.has(id)) throw new Error(`Missing eye aperture ${id}`);
          resources[`uClipMask${n}`] = maskScenes.get(id).texture.source;
          declarations += `uniform sampler2D uClipMask${n};\n`;
          clipping += `clipAlpha=max(clipAlpha,texture(uClipMask${n},vCanvasPos/uCanvasSize).a);`;
        });
        if (layer.invertMask) clipping += 'clipAlpha=1.0-clipAlpha;';
      }
      resources.lightingUniforms = uniforms;
      return PIXI.Shader.from({ gl: {
        vertex: `in vec2 aPosition; in vec2 aUV;
          uniform mat3 uProjectionMatrix; uniform mat3 uWorldTransformMatrix; uniform mat3 uTransformMatrix;
          uniform vec4 uWorldColorAlpha; uniform vec4 uColor;
          out vec2 vUV; out vec2 vCanvasPos; out vec4 vColor;
          void main(){vUV=aUV;vCanvasPos=aPosition;vColor=uColor*uWorldColorAlpha;
          gl_Position=vec4((uProjectionMatrix*uWorldTransformMatrix*uTransformMatrix*vec3(aPosition,1.0)).xy,0.0,1.0);}`,
        fragment: `in vec2 vUV; in vec2 vCanvasPos; in vec4 vColor;
          uniform sampler2D uTexture; uniform vec2 uCanvasSize; ${declarations}
          out vec4 finalColor;
          void main(){vec4 base=texture(uTexture,vUV);vec3 color=base.a>0.00001?base.rgb/base.a:vec3(0.0);
          ${operations} ${clipping}
          finalColor=vec4(clamp(color,0.0,1.0)*base.a,base.a)*clipAlpha*vColor;}`,
      }, resources });
    };

    for (const [frameIndex,layer] of manifest.layers.entries()) {
      if(atlas&&!layer.isMask)continue;
      const texture = textures.get(localUrl(layer.texture, manifestUrl));
      const geometry = new PIXI.MeshGeometry({
        positions: new Float32Array(layer.restVertices.flat()),
        uvs: new Float32Array(layer.uvs), indices: new Uint32Array(layer.indices),
      });
      // The default 100-vertex heuristic splits these authored deformation
      // meshes. Pixi's batch path supports their full topology and opacity.
      geometry.batchMode='batch';
      const lights = (manifest.lightingPasses || []).filter(pass => pass.targetLayerId === layer.id);
      const shader = makeShader(layer, texture, lights);
      const mesh = new PIXI.Mesh({ geometry, texture, shader, blendMode: layer.blendMode ?? 'normal' });
      meshes.push({ mesh, geometry, layer, shader, lights,frameIndex });
      if (layer.isMask) maskScenes.get(layer.id).scene.addChild(mesh);
      else actor.addChild(mesh);
    }
    if(atlas){atlasBatch=createPortraitAtlasBatch(PIXI,{manifest,atlas,pages,maskScenes});actor.addChild(atlasBatch.mesh);}
    drawFrame = index => {
      rendererMetrics?.beginFrame();framePrepared=true;
      const positions = view(index, 'positions');
      const opacities = view(index, 'opacities');
      const orders = view(index, 'renderOrders');
      const lightingValues = fieldSpecs.lightingOpacities ? view(index, 'lightingOpacities') : null;
      meshes.forEach(({ mesh, geometry, layer, shader, lights,frameIndex }, i) => {
        const start = layer.positionFloatOffset;
        geometry.positions.set(positions.subarray(start, start + layer.vertexCount * 2));
        geometry.attributes.aPosition.buffer.update();
        mesh.alpha = opacities[frameIndex];
        mesh.zIndex = orders[frameIndex];
        if (shader && lightingValues) lights.forEach((pass, n) => {
          shader.resources.lightingUniforms.uniforms[`uOpacity${n}`] = lightingValues[pass.opacityIndex];
        });
      });
      atlasBatch?.update(positions,opacities,orders,lightingValues);
      for (const { scene, texture } of maskScenes.values()) {
        app.renderer.render({ container: scene, target: texture, clear: true, clearColor: [0, 0, 0, 0] });
      }
      frameIndex = index;
    };
    drawFrame(0);
    app.ticker.maxFPS = manifest.fps;
    app.ticker.add(() => {
      if (!visible || document.hidden || !host?.isConnected || motionQuery?.matches) {
        app.stop();
        return;
      }
      const now = performance.now();
      seconds = (seconds + (now - previous) / 1000) % manifest.durationSeconds;
      previous = now;
      const next = Math.min(manifest.frameCount - 1, Math.floor(seconds * manifest.fps));
      if (next !== frameIndex) {
        try { performanceMonitor.frame('portrait');performanceMonitor.measure('portrait',()=>drawFrame(next)); } catch (reason) { fail(reason); }
      }
    });
    if (host) host.appendChild(app.canvas);
    fit();
    app.render();
    markState('ready');
    syncPlayback();
    return true;
  }

  function ensureLoaded() {
    if (destroyed || state === 'error') return Promise.resolve(false);
    if (!visible || !host || document.hidden) return Promise.resolve(state === 'ready');
    if (!loading) loading = load().catch(reason => {
      fail(reason);
      return false;
    });
    return loading;
  }

  function onVisibility() {
    syncPlayback();
    if (!document.hidden) void ensureLoaded();
  }

  function onMotionPreference() {
    if (app && drawFrame && motionQuery?.matches) {
      seconds = 0;
      drawFrame(0);
      app.render();
    }
    syncPlayback();
  }

  document.addEventListener('visibilitychange', onVisibility);
  if (motionQuery?.addEventListener) motionQuery.addEventListener('change', onMotionPreference);
  else motionQuery?.addListener?.(onMotionPreference);

  return {
    attach(nextHost) {
      if (destroyed) return Promise.resolve(false);
      if (!nextHost) {
        if (host) {
          host.classList.remove('is-ready');
          delete host.dataset.portraitState;
        }
        resizeObserver?.disconnect();
        app?.canvas.remove();
        host = null;
        syncPlayback();
        return Promise.resolve(false);
      }
      if (!nextHost.appendChild) throw new TypeError('立绘需要一个有效的宿主元素');
      if (host !== nextHost) {
        if (host) {
          host.classList.remove('is-ready');
          delete host.dataset.portraitState;
        }
        resizeObserver?.disconnect();
        host = nextHost;
        if (globalThis.ResizeObserver) {
          resizeObserver ||= new ResizeObserver(fit);
          resizeObserver.observe(host);
        }
      }
      if (app) host.appendChild(app.canvas);
      markState(state);
      fit();
      syncPlayback();
      return ensureLoaded();
    },
    setVisible(value) {
      if (destroyed) return Promise.resolve(false);
      visible = Boolean(value);
      syncPlayback();
      return visible ? ensureLoaded() : Promise.resolve(state === 'ready');
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      markState('destroyed');
      controller?.abort();
      resizeObserver?.disconnect();
      resizeObserver = null;
      document.removeEventListener('visibilitychange', onVisibility);
      if (motionQuery?.removeEventListener) motionQuery.removeEventListener('change', onMotionPreference);
      else motionQuery?.removeListener?.(onMotionPreference);
      disposeRuntime();
      host = null;
      manifest = null;
    },
    seekFrame(index) {
      if(!app||state!=='ready'||!Number.isFinite(index))return false;
      app.stop();const frame=Math.max(0,Math.min(manifest.frameCount-1,Math.floor(index)));
      seconds=frame/manifest.fps;drawFrame(frame);app.render();return true;
    },
    get state() { return state; },
    get ready() { return state === 'ready'; },
    get frameIndex() { return frameIndex; },
    get playing() { return Boolean(app?.ticker.started); },
    get app() { return app; },
    get canvas() { return app?.canvas || null; },
    get manifest() { return manifest; },
    get error() { return error; },
  };
}

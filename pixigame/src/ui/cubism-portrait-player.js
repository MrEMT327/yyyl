import {performanceMonitor} from '../performance-monitor.js';
import {trackWebGLRenderer} from '../renderer-metrics.js';
import {installCubismBatcher} from './cubism-batcher.js';
import { CubismFramework, LogLevel, Option } from '../vendor/cubism/src/live2dcubismframework';
import { CubismMoc } from '../vendor/cubism/src/model/cubismmoc';
import { CubismMotion, MotionBehavior } from '../vendor/cubism/src/motion/cubismmotion';
import { CubismMotionManager } from '../vendor/cubism/src/motion/cubismmotionmanager';
import { CubismPhysics } from '../vendor/cubism/src/physics/cubismphysics';
import { CubismRenderer_WebGL } from '../vendor/cubism/src/rendering/cubismrenderer_webgl';
import { CubismMatrix44 } from '../vendor/cubism/src/math/cubismmatrix44';
import { csmVector } from '../vendor/cubism/src/type/csmvector';
import { createConsumerParameterInputAdapter } from './live2d-r13/parameter-input-adapter.mjs';
import { createRenderPositionAdapter } from './live2d-r13/render-position-adapter.mjs';
import { createLegCrossSectionField } from './live2d-r13/leg-cross-section-field.mjs';
import { createEyeSizeField } from './live2d-r13/eye-size-field.mjs';
import { portraitCamera } from './portrait-layout.js';
import { createPortraitRenderCache } from './portrait-render-cache.js';
import { createPortraitTextureRegions } from './portrait-texture-regions.js';
import { createSourceAttachmentOffsets } from './source-attachment-offset.js';
import { decodePackedCubismMoc } from './cubism-moc-loader.js';
import { MOC_PACK_ENCODING } from './cubism-moc-codec.js';

const BASE = import.meta.env?.BASE_URL ?? '/';
let corePromise;
let frameworkUsers = 0;
let metricsSerial = 0;

function localUrl(path, base = location.href) {
  const url = new URL(path, base);
  if (url.origin !== location.origin) throw new Error('立绘只允许读取同源资源');
  return url.href;
}

function loadCore(coreUrl) {
  const ready = () => new Promise((resolve, reject) => {
    const deadline = performance.now() + 10000;
    const check = () => {
      try {
        if (globalThis.Live2DCubismCore?.Version.csmGetVersion() > 0) { resolve(); return; }
      } catch { /* Core's embedded runtime can finish after the script load event. */ }
      if (performance.now() >= deadline) reject(new Error('Cubism Core 初始化超时'));
      else setTimeout(check, 16);
    };
    check();
  });
  if (globalThis.Live2DCubismCore?.Moc) return corePromise ||= ready();
  if (!corePromise) corePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = localUrl(coreUrl);
    script.async = true;
    script.onload = () => {
      script.onload = script.onerror = null;
      if (globalThis.Live2DCubismCore?.Moc) ready().then(resolve, reject);
      else reject(new Error('Cubism Core 未正确加载'));
    };
    script.onerror = () => {
      script.onload = script.onerror = null;
      script.remove();
      reject(new Error('Cubism Core 读取失败'));
    };
    document.head.appendChild(script);
  });
  return corePromise;
}

function retainFramework(initialMemoryBytes = 0) {
  if (!CubismFramework.isStarted()) {
    const options = new Option();
    options.loggingLevel = LogLevel.LogLevel_Off;
    options.logFunction = () => {};
    if (!CubismFramework.startUp(options)) throw new Error('Cubism Framework 启动失败');
  }
  if (!CubismFramework.isInitialized()) CubismFramework.initialize(initialMemoryBytes);
  frameworkUsers += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    frameworkUsers -= 1;
    if (frameworkUsers === 0 && CubismFramework.isInitialized()) CubismFramework.dispose();
  };
}

// Port of the supplied compatibility/motion_compat.py: only stable Target
// grouping and the three aggregate counts change; curve/event values survive.
export function normalizeCubismMotion(source) {
  const data = JSON.parse(JSON.stringify(source));
  if (data.Version !== 3 || !Array.isArray(data.Curves) || !data.Curves.length
    || !Number.isFinite(data.Meta?.Duration) || data.Meta.Duration <= 0
    || !Number.isFinite(data.Meta?.Fps) || data.Meta.Fps <= 0) {
    throw new Error('不支持的 motion3 数据');
  }
  const targets = { Model: 0, Parameter: 1, PartOpacity: 2 };
  for (const curve of data.Curves) {
    if (!Object.hasOwn(targets, curve.Target) || typeof curve.Id !== 'string' || !curve.Id) {
      throw new Error('动作曲线目标或 ID 无效');
    }
  }
  data.Curves.sort((a, b) => targets[a.Target] - targets[b.Target]);
  let segmentCount = 0, pointCount = 0;
  for (const curve of data.Curves) {
    const stream = curve.Segments;
    if (!Array.isArray(stream) || stream.length < 5 || !stream.every(Number.isFinite)) {
      throw new Error('动作曲线数据无效');
    }
    pointCount += 1;
    let previousTime = stream[0];
    for (let offset = 2; offset < stream.length;) {
      const kind = stream[offset];
      const width = kind === 1 ? 7 : 3;
      if (![0, 1, 2, 3].includes(kind) || offset + width > stream.length
        || stream[offset + width - 2] <= previousTime) throw new Error('动作曲线片段无效');
      previousTime = stream[offset + width - 2];
      segmentCount += 1;
      pointCount += kind === 1 ? 3 : 1;
      offset += width;
    }
  }
  if ((data.Meta.UserDataCount || 0) !== (data.UserData || []).length) {
    throw new Error('动作事件计数不符');
  }
  Object.assign(data.Meta, {
    CurveCount: data.Curves.length, TotalSegmentCount: segmentCount, TotalPointCount: pointCount,
  });
  return data;
}

/** Native Cubism model player shared by the lobby and the motion preview. */
export function createCubismPortraitPlayer({
  assetBase = BASE,
  modelPath = 'art/pilot-06-v09c/bulaimodun_2/bulaimodun_2.model3.json',
  texturePaths = null,
  camera = null,
  hiddenDrawableIndices = [],
  mouthTextureTargets = [],
  mouthInteriorOpacityTargets = [],
  mouthOpenParameter = 'ParamMouthOpenY',
  mouthOpenThreshold = 0.12,
  eyeSizeAdapter = null,
  renderAdapter = null,
  handInputAdapter = null,
  mipmaps = false,
  eyeOpenAdapter = null,
  minimumResolution = 1,
  geometryDiagnostics = false,
  textureRegions = [],
  drawableOpacityMultipliers = [],
  sampleFps = 30,
  textureRouting = [],
  attachmentOffsets = [],
  motionGroups = {},
  createModelAdapter = null,
  transitionSeconds = 0,
  initialMemoryBytes = 0,
} = {}) {
  if (!Number.isFinite(sampleFps) || sampleFps < 1 || sampleFps > 120) throw new RangeError('立绘采样帧率必须为 1–120');
  if (!Number.isFinite(transitionSeconds) || transitionSeconds < 0 || transitionSeconds > 2) throw new RangeError('立绘过渡时长必须为 0–2 秒');
  const step = 1 / sampleFps;
  const assetRoot = new URL(localUrl(assetBase));
  if (!assetRoot.pathname.endsWith('/')) assetRoot.pathname += '/';
  assetRoot.search = assetRoot.hash = '';
  const modelUrl = localUrl(modelPath, assetRoot.href);
  const coreUrl = localUrl('art/live2d-runtime/live2dcubismcore.min.js', assetRoot.href);
  let host = null, visible = true, paused = false, destroyed = false;
  let state = 'idle', error = null, warned = false, loading = null;
  let controller = null, releaseFramework = null, setting = null;
  let canvas = null, gl = null, moc = null, model = null, renderer = null, physics = null, manager = null;
  let consumerInput = null, renderPositionAdapter = null, textureRegionAdapter = null, attachmentAdapter = null;
  let modelAdapter = null;
  let observer = null, raf = null, previous = 0, accumulator = 0;
  let rendererMetrics = null;
  let meshBatcher = null;
  let current = null, currentTime = 0, returnToIdle = false, explicitPlayback = false;
  let motionRequest = 0, renderedFrames = 0, initialParameters = null, initialParts = null;
  const textures = [], images = new Set(), motionRefs = new Map(), motions = new Map(), pendingMotions = new Map();
  const projection = new CubismMatrix44();
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');

  function updateHost() {
    if (!host) return;
    const values={portraitState:state,motion:current?.name||'idle',time:currentTime.toFixed(1),playing:String(raf!==null)};
    for(const [key,value] of Object.entries(values))if(host.dataset[key]!==value)host.dataset[key]=value;
    host.classList.toggle('is-ready', state === 'ready');
  }

  function clearHost() {
    if (!host) return;
    host.classList.remove('is-ready');
    for (const key of ['portraitState', 'motion', 'time', 'playing']) delete host.dataset[key];
  }

  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    previous = 0;
    accumulator = 0;
    updateHost();
  }

  function canPlay() {
    return !destroyed && state === 'ready' && visible && host?.isConnected
      && !document.hidden && !paused && (!reducedMotion?.matches || explicitPlayback);
  }

  function syncPlayback() {
    if (!canPlay()) { stop(); return; }
    if (raf === null) {
      previous = performance.now();
      raf = requestAnimationFrame(tick);
      updateHost();
    }
  }

  function draw() {
    if (!gl || !renderer || destroyed) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    renderer.setMvpMatrix(projection);
    renderer.setRenderState(null, [0, 0, canvas.width, canvas.height]);
    rendererMetrics?.beginFrame();
    renderer.drawModel();
    renderedFrames += 1;
    updateHost();
  }

  function setRenderSize(width, height) {
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    if (camera?.scaleNdc?.length === 2 && camera?.translateNdc?.length === 2) {
      const fitted = portraitCamera(camera,width,height);
      projection.loadIdentity();
      projection.scale(...fitted.scale);
      projection.translate(...fitted.translate);
      return;
    }
    const info = model.getModel().canvasinfo;
    const unitsWide = info.CanvasWidth / info.PixelsPerUnit;
    const unitsHigh = info.CanvasHeight / info.PixelsPerUnit;
    const scale = Math.min(width / unitsWide, height / unitsHigh);
    const sx = 2 * scale / width, sy = 2 * scale / height;
    projection.loadIdentity();
    projection.scale(sx, sy);
    projection.translate(-((info.CanvasWidth / 2 - info.CanvasOriginX) / info.PixelsPerUnit) * sx,
      -((info.CanvasOriginY - info.CanvasHeight / 2) / info.PixelsPerUnit) * sy);
  }

  function fit() {
    if (!host || !canvas || !model || !gl || destroyed) return;
    const rect = host.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) { stop(); return; }
    const dpr = Math.min(Math.max(globalThis.devicePixelRatio || 1, minimumResolution), 2);
    setRenderSize(Math.max(1, Math.round(rect.width * dpr)), Math.max(1, Math.round(rect.height * dpr)));
    try { draw(); } catch (reason) { fail(reason); }
    syncPlayback();
  }

  function resetModel() {
    const core = model.getModel();
    core.parameters.values.set(initialParameters);
    core.parts.opacities.set(initialParts);
    model.setModelOapcity(1);
    model.saveParameters();
    physics?.initialize();
  }

  function evaluateModel(mode, sourceTime, delta = 0) {
    if (consumerInput) consumerInput.update({ mode, sourceTime });
    else model.update();
    modelAdapter?.prepare({delta,mode,sourceTime});
  }

  function begin(record, explicit = false, reset = false) {
    modelAdapter?.begin({duration:reset || reducedMotion?.matches ? 0 : transitionSeconds});
    manager.stopAllMotions();
    if (reset) resetModel();
    current = record;
    currentTime = 0;
    accumulator = 0;
    returnToIdle = false;
    explicitPlayback = explicit;
    record.motion.setLoop(record.name === 'idle');
    record.motion.setLoopFadeIn(false);
    manager.startMotionPriority(record.motion, false, record.name === 'idle' ? 1 : 3);
    model.loadParameters();
    manager.updateMotion(model, 0);
    model.saveParameters();
    if (reset) physics?.stabilization(model);
    evaluateModel(record.name, 0);
    previous = performance.now();
    updateHost();
  }

  function advance(delta) {
    if (returnToIdle) {
      begin(motions.get('idle'), false, Boolean(reducedMotion?.matches));
      if (reducedMotion?.matches) return;
    }
    model.loadParameters();
    manager.updateMotion(model, delta);
    model.saveParameters();
    physics?.evaluate(model, delta);
    evaluateModel(current.name, currentTime + delta, delta);
    currentTime += delta;
    if (current.name === 'idle') currentTime %= current.duration;
    else if (manager.isFinished()) {
      currentTime = current.duration;
      returnToIdle = true;
    }
  }

  function tick(now) {
    raf = null;
    if (!canPlay()) { stop(); return; }
    const sampleAt=performanceMonitor.enabled?performance.now():0;
    accumulator += Math.min((now - previous) / 1000, 0.25);
    previous = now;
    let changed = false;
    try {
      while (accumulator + 1e-8 >= step && canPlay()) {
        accumulator -= step;
        advance(step);
        changed = true;
      }
      if (changed) draw();
    } catch (reason) { fail(reason); return; }
    if (canPlay()) raf = requestAnimationFrame(tick);
    else stop();
    updateHost();
    if(changed&&performanceMonitor.enabled){performanceMonitor.frame('portrait');performanceMonitor.record('portrait',performance.now()-sampleAt);}
  }

  function cleanup() {
    stop();
    rendererMetrics?.destroy();
    rendererMetrics = null;
    meshBatcher?.destroy();
    meshBatcher = null;
    canvas?.removeEventListener('webglcontextlost', onContextLost);
    canvas?.remove();
    manager?.release();
    manager = null;
    modelAdapter?.detach();
    modelAdapter = null;
    attachmentAdapter?.detach();
    attachmentAdapter = null;
    renderPositionAdapter?.detach();
    textureRegionAdapter?.detach();
    textureRegionAdapter = null;
    renderPositionAdapter = null;
    consumerInput = null;
    for (const record of motions.values()) record.motion.release();
    motions.clear();
    physics?.release();
    physics = null;
    renderer?.release();
    renderer = null;
    if (gl) {
      for (const texture of textures) gl.deleteTexture(texture);
      textures.length = 0;
    }
    if (model && moc) moc.deleteModel(model);
    model = null;
    moc?.release();
    moc = null;
    releaseFramework?.();
    releaseFramework = null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    gl = null;
    canvas = null;
    for (const image of images) image.src = '';
    images.clear();
    current = null;
    initialParameters = initialParts = null;
  }

  function fail(reason) {
    if (destroyed) return;
    error = reason;
    state = 'error';
    controller?.abort();
    observer?.disconnect();
    cleanup();
    updateHost();
    if (!warned) {
      warned = true;
      console.warn('Cubism 立绘载入失败，保留静态立绘。', reason);
    }
  }

  function onContextLost(event) {
    event.preventDefault();
    fail(new Error('Cubism WebGL 上下文已丢失'));
  }

  async function read(path, kind = 'arrayBuffer', baseUrl = modelUrl) {
    const url = localUrl(path, baseUrl);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response[kind]();
    } catch (cause) { throw new Error(`Cubism 资源读取失败: ${url}`, { cause }); }
  }

  async function loadImage(path, baseUrl = modelUrl) {
    const blob = await read(path, 'blob', baseUrl);
    if (destroyed) return null;
    const image = new Image();
    images.add(image);
    const url = URL.createObjectURL(blob);
    try {
      await new Promise((resolve, reject) => {
        const signal = controller.signal;
        const finish = reason => {
          image.onload = image.onerror = null;
          signal.removeEventListener('abort', aborted);
          if (reason) reject(reason); else resolve();
        };
        const aborted = () => { image.src = ''; finish(new DOMException('Aborted', 'AbortError')); };
        image.onload = () => finish();
        image.onerror = () => finish(new Error(`Cubism 纹理解码失败: ${path}`));
        signal.addEventListener('abort', aborted, { once: true });
        if (signal.aborted) aborted();
        else image.src = url;
      });
      return image;
    } finally { URL.revokeObjectURL(url); }
  }

  async function loadMotion(name) {
    if (motions.has(name)) return motions.get(name);
    if (pendingMotions.has(name)) return pendingMotions.get(name);
    const ref = motionRefs.get(name);
    if (!ref) throw new Error(`未知动作: ${name}`);
    const pending = (async () => {
      const source = normalizeCubismMotion(await read(ref.File, 'json'));
      if (destroyed || state === 'error') return null;
      const bytes = new TextEncoder().encode(JSON.stringify(source));
      const motion = CubismMotion.create(bytes.buffer, bytes.byteLength);
      if (!motion) throw new Error(`Cubism 动作解析失败: ${name}`);
      const ids = groupName => {
        const result = new csmVector();
        const group = setting.Groups?.find(item => item.Target === 'Parameter' && item.Name === groupName);
        for (const id of group?.Ids || []) result.pushBack(CubismFramework.getIdManager().getId(id));
        return result;
      };
      motion.setEffectIds(ids('EyeBlink'), ids('LipSync'));
      motion.setMotionBehavior(MotionBehavior.MotionBehavior_V1);
      if (Number.isFinite(ref.FadeInTime) && ref.FadeInTime >= 0) motion.setFadeInTime(ref.FadeInTime);
      if (Number.isFinite(ref.FadeOutTime) && ref.FadeOutTime >= 0) motion.setFadeOutTime(ref.FadeOutTime);
      const record = { name, motion, duration: source.Meta.Duration, fps: source.Meta.Fps };
      motions.set(name, record);
      return record;
    })();
    pendingMotions.set(name, pending);
    try { return await pending; } finally { pendingMotions.delete(name); }
  }

  async function load() {
    state = 'loading';
    updateHost();
    controller = new AbortController();
    const [, modelSetting] = await Promise.all([loadCore(coreUrl), read(modelUrl, 'json')]);
    if (destroyed) return false;
    setting = modelSetting;
    const refs = setting.FileReferences;
    const idleGroup = Object.keys(motionGroups).find(group => motionGroups[group] === 'idle') || 'idle';
    if (!refs?.Moc || !refs.Textures?.length || !refs.Motions?.[idleGroup]?.[0]?.File) {
      throw new Error('Cubism model3 缺少模型、纹理或待机动作');
    }
    const selectedTexturePaths = texturePaths || refs.Textures;
    if (!Array.isArray(selectedTexturePaths) || !selectedTexturePaths.length) {
      throw new Error('Cubism 模型缺少可用的纹理');
    }
    const textureBase = texturePaths ? assetRoot.href : modelUrl;
    for (const [group, entries] of Object.entries(refs.Motions)) {
      if (entries[0]?.File) motionRefs.set(motionGroups[group] || group, entries[0]);
    }
    releaseFramework = retainFramework(initialMemoryBytes);
    const loadMoc=async()=>{
      const bytes=await read(refs.Moc);
      if(!setting.MocEncoding)return bytes;
      if(setting.MocEncoding!==MOC_PACK_ENCODING)throw new Error('Cubism 模型压缩编码不支持');
      return decodePackedCubismMoc(bytes,{signal:controller.signal});
    };
    const results = await Promise.allSettled([
      loadMoc(), refs.Physics ? read(refs.Physics) : Promise.resolve(null),
      ...selectedTexturePaths.map(path=>loadImage(path,textureBase)), loadMotion('idle'), loadMotion('touch_head'),
    ]);
    if (destroyed) return false;
    const failed = results.find(result => result.status === 'rejected');
    if (failed) throw failed.reason;
    moc = CubismMoc.create(results[0].value, false);
    if (!moc) throw new Error('Cubism moc3 无法读取');
    model = moc.createModel();
    if (!model) throw new Error('Cubism 模型无法创建');
    if (hiddenDrawableIndices.length) {
      const hidden = new Set(hiddenDrawableIndices);
      if ([...hidden].some(index=>!Number.isInteger(index)||index<0||index>=model.getDrawableCount())) {
        throw new Error('立绘隐藏图层配置无效');
      }
      // Apply the authored scene exclusions before either renderer submits
      // drawables. Core refreshes its visibility flags on every model update.
      const nativeVisible = model.getDrawableDynamicFlagIsVisible.bind(model);
      model.getDrawableDynamicFlagIsVisible = index => !hidden.has(index) && nativeVisible(index);
    }
    if (textureRouting.length) {
      const nativeTexture = model.getDrawableTextureIndex.bind(model), routes = new Map();
      for (const {index,id,texture} of textureRouting) {
        if (model.getModel().drawables.ids[index] !== id || !Number.isInteger(texture) || texture < 0 || texture >= selectedTexturePaths.length) throw new Error('立绘纹理通道配置无效');
        routes.set(index,texture);
      }
      model.getDrawableTextureIndex = index => routes.get(index) ?? nativeTexture(index);
    }
    if (mouthTextureTargets.length) {
      const nativeTextureIndex = model.getDrawableTextureIndex.bind(model);
      const routed = new Set(mouthTextureTargets);
      model.getDrawableTextureIndex = index => routed.has(index) ? 1 : nativeTextureIndex(index);
    }
    if (textureRegions.length) {
      if (textureRegions.some(region=>region.texture>=selectedTexturePaths.length)) throw new Error('立绘精修贴图未提供');
      textureRegionAdapter = createPortraitTextureRegions(model,textureRegions);
    }
    if (mouthInteriorOpacityTargets.length) {
      const parameters = model.getModel().parameters;
      const parameterIndex = Array.from(parameters.ids).indexOf(mouthOpenParameter);
      if (parameterIndex < 0) throw new Error(`缺少嘴部参数: ${mouthOpenParameter}`);
      const nativeOpacity = model.getDrawableOpacity.bind(model);
      const interior = new Set(mouthInteriorOpacityTargets);
      model.getDrawableOpacity = index => {
        const opacity = nativeOpacity(index);
        if (!interior.has(index)) return opacity;
        const open = Math.max(0,Math.min(1,parameters.values[parameterIndex]/mouthOpenThreshold));
        return opacity*open*open*(3-2*open);
      };
    }
    if (drawableOpacityMultipliers.length) {
      const opacity = model.getDrawableOpacity.bind(model);
      const multipliers = new Map();
      for (const {index,id,value} of drawableOpacityMultipliers) {
        if (model.getModel().drawables.ids[index] !== id || !Number.isFinite(value) || value < 0 || value > 1) throw new Error('立绘透明度配置无效');
        multipliers.set(index,value);
      }
      model.getDrawableOpacity = index => opacity(index)*(multipliers.get(index) ?? 1);
    }
    initialParameters = new Float32Array(model.getModel().parameters.values);
    if (attachmentOffsets.length) attachmentAdapter = createSourceAttachmentOffsets(model,attachmentOffsets);
    initialParts = new Float32Array(model.getModel().parts.opacities);
    model.saveParameters();
    if (results[1].value) physics = CubismPhysics.create(results[1].value, results[1].value.byteLength);
    manager = new CubismMotionManager();
    manager.setEventCallback(() => {});
    if (renderAdapter?.enabled) {
      const legField = createLegCrossSectionField(renderAdapter.contract);
      const eyeField = createEyeSizeField(eyeSizeAdapter || {scale:1});
      const legTargets = new Set(legField.targets);
      const targets = [...new Set([...legField.targets,...eyeField.targets])];
      const createAdapter = geometryDiagnostics ? createRenderPositionAdapter : createPortraitRenderCache;
      renderPositionAdapter = createAdapter(model,{
        enabled:true,
        targets,
        transform:(index,xy,context)=>legTargets.has(index)
          ?legField.transform(index,xy,context)
          :eyeField.transform(index,xy,context),
        label:'white-gold-r13-local-adapter',
      });
    }
    if (handInputAdapter) {
      consumerInput = createConsumerParameterInputAdapter(model,{
        eye:eyeOpenAdapter || setting.eyeOpenAdapter || {enabled:false},
        hand:handInputAdapter,
        handContract:handInputAdapter.contract,
      });
    }
    if (createModelAdapter) {
      model.update();
      modelAdapter = createModelAdapter(model);
    }
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    canvas.className = 'lobby-portrait-canvas cubism-portrait-canvas';
    canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;background:transparent';
    canvas.setAttribute('aria-hidden', 'true');
    gl = canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: true, antialias: true,
      preserveDrawingBuffer: true, powerPreference: 'low-power',
    });
    if (!gl) throw new Error('浏览器无法创建 Cubism WebGL 上下文');
    rendererMetrics = trackWebGLRenderer(gl, performanceMonitor, `portrait-${++metricsSerial}`,
      () => Boolean(!destroyed && visible && host?.isConnected && !document.hidden));
    canvas.addEventListener('webglcontextlost', onContextLost);
    renderer = new CubismRenderer_WebGL();
    renderer.initialize(model);
    renderer.startUp(gl);
    renderer.setIsPremultipliedAlpha(true);
    meshBatcher = installCubismBatcher(renderer,gl);
    // The selected atlases include mouth/detail replacements beyond model3's
    // original texture list; every fetched atlas must receive its GPU slot.
    for (let i = 0; i < selectedTexturePaths.length; i++) {
      const image = results[i + 2].value;
      const texture = gl.createTexture();
      if (!texture) throw new Error('Cubism 纹理无法创建');
      textures.push(texture);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, 1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,mipmaps?gl.LINEAR_MIPMAP_LINEAR:gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
      renderer.bindTexture(i, texture);
      image.src = '';
      images.delete(image);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    begin(motions.get('idle'), false, true);
    if (host) host.appendChild(canvas);
    fit();
    if (state === 'error') return false;
    state = 'ready';
    updateHost();
    syncPlayback();
    return true;
  }

  function ensureLoaded() {
    if (destroyed || state === 'error') return Promise.resolve(false);
    if (!host || !visible || document.hidden) return Promise.resolve(state === 'ready');
    if (!loading) loading = load().catch(reason => { fail(reason); return false; });
    return loading;
  }

  function onVisibility() {
    syncPlayback();
    if (!document.hidden) void ensureLoaded();
  }

  function onReducedMotion() {
    if (reducedMotion?.matches && model && motions.has('idle')) {
      try { begin(motions.get('idle'), false, true); draw(); } catch (reason) { fail(reason); }
    }
    syncPlayback();
  }

  document.addEventListener('visibilitychange', onVisibility);
  if (reducedMotion?.addEventListener) reducedMotion.addEventListener('change', onReducedMotion);
  else reducedMotion?.addListener?.(onReducedMotion);

  return {
    attach(nextHost) {
      if (destroyed) return Promise.resolve(false);
      if (nextHost && !nextHost.appendChild) throw new TypeError('立绘需要有效的宿主元素');
      if (nextHost !== host) {
        clearHost();
        observer?.disconnect();
        canvas?.remove();
        host = nextHost || null;
        if (host && globalThis.ResizeObserver) {
          observer ||= new ResizeObserver(fit);
          observer.observe(host);
        }
      }
      if (host && canvas) host.appendChild(canvas);
      updateHost();
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
    async playMotion(name) {
      const request = ++motionRequest;
      if (!await ensureLoaded() || destroyed) return false;
      try {
        const record = await loadMotion(name);
        if (!record || destroyed || request !== motionRequest) return false;
        paused = false;
        begin(record, true);
        draw();
        syncPlayback();
        return true;
      } catch (reason) {
        if (!destroyed) console.warn(`Cubism 动作播放失败: ${name}`, reason);
        return false;
      }
    },
    setPaused(value) {
      if (destroyed) return;
      paused = Boolean(value);
      if (!paused) explicitPlayback = true;
      syncPlayback();
    },
    restart() {
      if (!current || destroyed) return false;
      try {
        begin(current, true, true);
        draw();
        syncPlayback();
        return true;
      } catch (reason) { fail(reason); return false; }
    },
    // Deterministic paused sampling for the developer's motion review. Advance
    // the same fixed simulation steps, including cloth settling, as live play.
    seek(time) {
      if (destroyed || state !== 'ready' || !current || !Number.isFinite(time)) return false;
      const record=current,target=Math.max(0,Math.min(record.duration,time));
      stop();paused=true;
      try {
        begin(record,true,true);
        const frames=Math.floor(target/step+1e-7);
        for(let i=0;i<frames;i++)advance(step);
        const remainder=target-frames*step;
        if(remainder>1e-7)advance(remainder);
        draw();updateHost();return true;
      } catch(reason){fail(reason);return false;}
    },
    stepFrames(count = 1) {
      if (destroyed || state !== 'ready' || !paused || !Number.isInteger(count) || count < 1 || count > 600) return false;
      try { for(let i=0;i<count;i++)advance(step);draw();updateHost();return true; }
      catch(reason){fail(reason);return false;}
    },
    captureFrame(size = 1024) {
      if (destroyed || state !== 'ready' || !canvas || !model || !gl) return null;
      if (!Number.isFinite(size) || size < 1) throw new RangeError('导出尺寸必须是正数');
      const edge = Math.round(size);
      const width = canvas.width, height = canvas.height;
      const matrix = new Float32Array(projection.getArray());
      try {
        setRenderSize(edge, edge);
        draw();
        return canvas.toDataURL('image/png');
      } finally {
        canvas.width = width;
        canvas.height = height;
        projection.setMatrix(matrix);
        draw();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      motionRequest += 1;
      state = 'destroyed';
      controller?.abort();
      observer?.disconnect();
      observer = null;
      document.removeEventListener('visibilitychange', onVisibility);
      if (reducedMotion?.removeEventListener) reducedMotion.removeEventListener('change', onReducedMotion);
      else reducedMotion?.removeListener?.(onReducedMotion);
      cleanup();
      clearHost();
      host = null;
      setting = null;
      motionRefs.clear();
    },
    get state() { return state; },
    get ready() { return state === 'ready'; },
    get playing() { return raf !== null; },
    get paused() { return paused; },
    get motionName() { return current?.name || 'idle'; },
    get duration() { return current?.duration || 0; },
    get currentTime() { return currentTime; },
    get frameIndex() { return Math.floor(currentTime * sampleFps + 1e-6); },
    get sampleFps() { return sampleFps; },
    get renderedFrames() { return renderedFrames; },
    get availableMotions() { return [...motionRefs.keys()]; },
    get canvas() { return canvas; },
    get model() { return model; },
    get renderer() { return renderer; },
    get batcher() { return meshBatcher; },
    get error() { return error; },
    get refinementState() { return modelAdapter?.state?.() || null; },
  };
}

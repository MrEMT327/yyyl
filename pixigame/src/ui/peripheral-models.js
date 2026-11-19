import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { gunzipSync } from 'three/addons/libs/fflate.module.js';
import { toByteArray } from 'base64-js';
import { ConfigFighter } from '../three/aircraft/v34/aircraft/ConfigFighter.js';
import { fighterForPilot, instantiateFighterPackage, loadFighterPackages, isFighterPackageReady } from '../three/aircraft/fighter-packages.js';
import { createKestrelEquipment } from '../three/aircraft/kestrel-equipment.js';
import { createModelOrbitInteraction } from './model-orbit-interaction.js';
import { createFixedPartMounts } from '../fixed-parts/mounts.js';
import { peripheralModelLoadout, peripheralModelLoadoutKey } from './peripheral-model-loadout.js';
import { createAircraftStyle, aircraftFinishConfig } from '../three/aircraft/aircraft-style.js';
import { AIRCRAFT_RENDER_STYLE, createAircraftLighting } from '../three/aircraft/aircraft-lighting.js';
import { performanceMonitor } from '../performance-monitor.js';
import {createPreviewBatcher} from './preview-batcher.js';
import {aircraftShowcasePose} from './aircraft-showcase-motion.js';
import {createCombatAircraftRenderer, warmRenderPrograms} from '../replica/project-aircraft-render.js';
import {createAircraftFxRenderer} from '../three/aircraft/aircraft-fx-renderer.js';
import {AIRCRAFT_PREVIEW_PIXEL_RATIO,AIRCRAFT_PREVIEW_SAMPLES} from '../three/aircraft/aircraft-preview-quality.js';
import {stabilizeAircraftPanelDepth} from './aircraft-panel-depth.js';
import {preloadSortieAircraftImage} from './sortie-aircraft-image.js';
import {releaseOwnedCanvas} from './release-owned-canvas.js';
import { studioWidth, studioHeight, studioCubeUv } from './aircraft-preview-studio-data.js';

const shaderWarmupMs = 2500;

function bakedStudioEnvironment() {
  const data = gunzipSync(toByteArray(studioCubeUv));
  const area = studioWidth * studioHeight;
  const pixels = new Uint16Array(area * 4);
  for (let i = 0; i < area; i++) {
    const texel = i * 4;
    const above = i >= studioWidth ? pixels[texel - studioWidth * 4] : 0;
    const delta = data[i] | (data[area + i] << 8);
    const light = (above + delta) & 0xffff;
    pixels[texel] = light;
    pixels[texel + 1] = light;
    pixels[texel + 2] = light;
    pixels[texel + 3] = 0x3c00;
  }
  const texture = new THREE.DataTexture(pixels, studioWidth, studioHeight, THREE.RGBAFormat, THREE.HalfFloatType,
    THREE.CubeUVReflectionMapping, THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping, THREE.LinearFilter, THREE.LinearFilter);
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, dispose: () => texture.dispose() };
}

// One context for the lobby. Aircraft packages and weapon meshes are shared with
// combat; the lobby never substitutes a generated painting for a game model.
export function createPeripheralModels({ onReady = () => {}, captureThumbnail, screen, warmShaders = false } = {}) {
  const images = new Map();
  let model, host, aircraftId = 'pilot-01', snapshot = {}, disposed = false, frame = null, shown=true;
  let attachedHost = null, aircraftLoad = null;
  // The PSD home has no aircraft canvas. Allocate a WebGL context only when a
  // visible preview or an aircraft thumbnail actually requests one.
  const mountPreview = () => {
    frame = null;
    if (disposed || !shown || !host?.isConnected || attachedHost === host) return;
    if(warmShaders&&!model&&!isFighterPackageReady(aircraftId)){
      const load={id:aircraftId,failed:false};
      aircraftLoad=load;
      loadFighterPackages({pilotIds:[load.id]}).then(()=>{
        if(aircraftLoad!==load)return;
        aircraftLoad=null;
        schedule();
      },error=>{
        if(aircraftLoad!==load)return;
        load.failed=true;
        console.warn('[peripheral aircraft]',error);
      });
      return;
    }
    model ??= performanceMonitor.measure('preview-setup',()=>createModelRenderer({ images, onReady, captureThumbnail, warmShaders,screen }));
    attachedHost = host;
    model.attach(host,aircraftId);
    model.showAircraft(aircraftId, snapshot);
  };
  const cancel=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;};
  const schedule = () => {
    if (disposed || !shown || !host?.isConnected || attachedHost === host || frame !== null || aircraftLoad?.id===aircraftId) return;
    // Give the page and its existing still image a frame before WebGL setup.
    if (model && !warmShaders) mountPreview();
    else frame = requestAnimationFrame(warmShaders ? () => { frame = requestAnimationFrame(mountPreview); } : mountPreview);
  };
  const release=()=>{
    cancel();
    const previous=model;
    model=null; attachedHost=null; aircraftLoad=null;
    previous?.destroy();
  };
  return {
    images, get available() { return model?.available ?? true; },
    get attached() { return Boolean(host?.isConnected); },
    attach(nextHost) {
      if (host !== nextHost) {
        cancel();
        if(aircraftLoad?.failed)aircraftLoad=null;
      }
      host = nextHost;
      if (host) schedule();
      else { model?.attach(null); attachedHost=null; }
    },
    showAircraft(id, state = snapshot) {
      aircraftId = id || 'pilot-01'; snapshot = state || {};
      // WeChat requests the loading-screen image when opening a sortie.
      if(!warmShaders)void preloadSortieAircraftImage(aircraftId);
      if (attachedHost === host) model?.showAircraft(aircraftId, snapshot);
      else schedule();
    },
    slotPoint(id) { return model?.slotPoint?.(id) || null; },
    update(dt, visible=true) { shown=visible; if(!shown)cancel(); else schedule(); model?.update(dt, visible&&attachedHost===host); },
    release,
    destroy() { disposed = true; host=null; release(); images.clear(); },
  };
}

export function createModelRenderer({onReady=()=>{},images=new Map(),captureThumbnail,warmShaders=false,screen,embedded}){
  const lease=embedded ? null : screen?.previewLease();
  lease?.acquire();
  const canvas=embedded&&screen.display?screen.display.input:screen?.three.domElement??document.createElement('canvas');
  let renderer;
  // This canvas is presented at 30 Hz and moved between live UI hosts. Retain
  // its last pixels through skipped draws and DOM refreshes, just as on pause.
  try { renderer = screen?.three??new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true }); }
  catch (error) { releaseOwnedCanvas(canvas);console.warn('[peripheral models]', error); return { attach() {}, showAircraft() {}, update() {}, destroy() {}, images: new Map(), available: false }; }
  const nativePreview=warmShaders&&!captureThumbnail;
  const parallelShaders = nativePreview && renderer.extensions.has('KHR_parallel_shader_compile');
  // Avoid compiling the reflective studio and volumetric passes on the UI
  // thread when a WeChat device cannot build those programs in parallel.
  const singlePass = nativePreview && !parallelShaders;
  // Supersample low-DPI previews without exceeding the existing 2x GPU budget.
  const previewPixelRatio = AIRCRAFT_PREVIEW_PIXEL_RATIO;
  let previewExposure=1.12;
  if(!embedded){
  renderer.setPixelRatio(previewPixelRatio);
  renderer.setSize(600, 390, false);
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  canvas.className = 'pl-model-canvas';canvas.setAttribute('data-engine',`three.js r${THREE.REVISION}`);
  }
  canvas.dataset.modelReady = 'false';
  const exhaustRenderer = singlePass ? null : createCombatAircraftRenderer(renderer, 1, 1);
  const fxRenderer = singlePass ? null : createAircraftFxRenderer(renderer,{samples:AIRCRAFT_PREVIEW_SAMPLES,stableCoverage:true,temporalCoverage:!captureThumbnail});
  const drawingSize = new THREE.Vector2();
  const exhaustFighter = {runtime:null};
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene(), mount = new THREE.Group(), attitude = new THREE.Group(); scene.add(mount); mount.add(attitude);
  const batcher=createPreviewBatcher(mount);
  // Metal needs a reflected environment as well as directional lighting.
  // Without one, reflective surfaces become flat dark blocks and glass loses depth.
  let environment;
  if (parallelShaders) {
    environment = bakedStudioEnvironment();
  } else if (!singlePass) {
    const studio = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
    environment = pmrem.fromScene(studio, .04); studio.dispose(); pmrem.dispose();
  }
  createAircraftLighting(scene);
  // A's hull occupies about half the screen width; leave gutters at the PSD slots.
  const equipmentCamera = new THREE.OrthographicCamera(-13, 13, 8.45, -8.45, .1, 160);
  const camera = equipmentCamera;
  const coverageContext={camera,object:mount,depth:null,allowHistory:false,pose:0};
  camera.position.set(7, 20, -25); camera.lookAt(0, 0, -.5);
  // A transparent receiver grounds the actual hull and equipped parts in the PSD hangar.
  const shadowImage=document.createElement('canvas');shadowImage.width=shadowImage.height=64;
  const shadowContext=shadowImage.getContext('2d'),gradient=shadowContext.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'#11294199');gradient.addColorStop(1,'#11294100');shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,64,64);
  const shadowTexture=new THREE.CanvasTexture(shadowImage);
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(32, 28), new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.26,depthWrite:false,toneMapped:false}));
  shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = -2.2;
  shadowFloor.visible = false; scene.add(shadowFloor);
  let currentId, currentFitKey, requestedId = 'pilot-01', requestedSnapshot = {}, runtime, equipment, fixedParts,
    elapsed = 0, showcaseElapsed = 0, visible = true, disposed = false, lastFrame = -1;
  let pendingReady = false, jetRestScales=[];
  let warmingPreview;
  let pendingPrograms;
  const preparedPrograms = new WeakSet();
  let previewRequested = false;
  let equipmentStyle,panelDepth;
  const releaseMetrics=embedded?()=>{}:performanceMonitor.registerRenderer('preview',()=>({active:visible&&canvas.isConnected&&!document.hidden,...renderer.info.render,...renderer.info.memory,batching:batcher.stats}));
  const orbit = createModelOrbitInteraction(canvas, {region:embedded,
    onChange: () => { lastFrame = -1; },
    onDragEnd: () => { if (pendingReady && !disposed) { pendingReady = false; onReady(); } },
  });
  let viewProfile = 'default';
  const isShowcase = () => !captureThumbnail && ['equipment','catalog'].includes(viewProfile);
  const isAnimated = () => !reducedMotion.matches && (viewProfile === 'patrol' || isShowcase());
  const showcasePose = () => aircraftShowcasePose(showcaseElapsed, runtime?.deployment.duration, reducedMotion.matches);
  function restartShowcase() {
    elapsed = showcaseElapsed = 0; lastFrame = -1;
    runtime?.deployment.setImmediate(false);
  }
  let observedHost=null;
  const renderSize=new THREE.Vector2();
  function fitViewport(thumbnail=false, bounds=embedded?.bounds()||canvas.parentElement?.getBoundingClientRect()) {
    const ratio=viewProfile==='patrol'?600/240:600/390;
    const limit=['equipment','battle'].includes(viewProfile)?960:600;
    const width=thumbnail?600:bounds?.width&&bounds?.height
      ? Math.min(limit,Math.max(128,Math.ceil(Math.min(bounds.width,bounds.height*ratio)))) : limit;
    const height=thumbnail?390:Math.round(width/ratio);
    const size=embedded?renderSize.set(embedded.target.width/previewPixelRatio,embedded.target.height/previewPixelRatio):renderer.getSize(renderSize);
    if(size.x===width&&size.y===height)return false;
    canvas.dataset.modelReady='false';
    if(embedded)embedded.target.setSize(width*previewPixelRatio,height*previewPixelRatio);
    else renderer.setSize(width,height,false);
    camera.top=13*height/width;camera.bottom=-camera.top;camera.updateProjectionMatrix();
    lastFrame=-1;return true;
  }
  const viewportObserver=new ResizeObserver(()=>{
    if(!disposed&&visible&&canvas.isConnected&&fitViewport()&&runtime&&currentId===requestedId)renderModel();
  });
  function applyViewLighting() {
    scene.environmentIntensity = AIRCRAFT_RENDER_STYLE.environmentIntensity;
    scene.fog = null;
    previewExposure=runtime?.asset.solid.userData.cleanAircraftSurface ? .92 : AIRCRAFT_RENDER_STYLE.exposure;
    if(!embedded)renderer.toneMappingExposure=previewExposure;
    shadowFloor.visible = viewProfile === 'equipment';
    if (runtime && !equipmentStyle) equipmentStyle = createAircraftStyle(mount);
    equipmentStyle?.setEnabled(true);
  }
  function setCameraView(profile,thumbnail=false,bounds) {
    fxRenderer?.resetHistory();
    viewProfile = profile;
    applyViewLighting();
    fitViewport(thumbnail,bounds);
    canvas.dataset.viewProfile = profile;
    // All previews keep the approved parallel projection; only viewing direction varies.
    camera.position.set(...(profile === 'equipment' ? [19, 29, -28] : profile === 'patrol' ? [21, 8, -3] : profile === 'battle' ? [27, 13, -26] : [7, 20, -25]));
    // Patrol exposes the aircraft's authored engine jets on the effects layer.
    camera.layers.set(0); if (profile === 'patrol') camera.layers.enable(1);
    if (runtime?.asset.solid.userData.cleanAircraftSurface) camera.layers.enable(1);
    camera.lookAt(0, 0, -.5); camera.updateProjectionMatrix(); lastFrame = -1;
  }
  function notifyReady() { if (orbit.dragging) pendingReady = true; else if (!disposed) onReady(); }
  function applyViewPose() {
    if (viewProfile === 'patrol') {
      const t = reducedMotion.matches ? 0 : elapsed;
      // Keep the nose pointing along the route, with a gentle climb and banking correction.
      mount.rotation.set(Math.cos(t * .76) * .026, Math.sin(t * .38) * .018, Math.sin(t * .48) * .055, 'YXZ');
      mount.position.set(0, Math.sin(t * .76) * .28 + Math.sin(t * 1.7) * .025, Math.sin(t * .38) * .30);
      if (runtime) {
        const defaults = fighterForPilot(currentId).defaults;
        runtime.config.exhaustLength = (defaults.exhaustLength ?? 1) * (.78 + Math.sin(t * 7) * .025);
        runtime.config.engineGlow = (defaults.engineGlow ?? .9) * (.75 + Math.sin(t * 5) * .025);
      }
      return;
    }
    const pose = isShowcase() ? showcasePose() : {pitch:0,yaw:0,bob:0};
    mount.rotation.set(orbit.pitch + pose.pitch, orbit.yaw + (orbit.interacted ? 0 : pose.yaw), 0, 'YXZ');
    mount.position.set(0, pose.bob, 0);
    if (runtime) {
      const defaults = fighterForPilot(currentId).defaults;
      runtime.config.exhaustLength = defaults.exhaustLength;
      runtime.config.engineGlow = defaults.engineGlow;
    }
  }
  function sampleModel(time) {
    if (isShowcase()) {
      const pose = showcasePose();
      // Evaluate the original reversible curve at the preview clock. Seeding
      // lastTime prevents ConfigFighter.sample from advancing it a second time.
      runtime.deployment.seekTimeline(pose.timeline);
      runtime.deployment.lastTime = time;
      runtime.config.deployed = pose.phase === 'deploy' || pose.phase === 'hold';
      if(runtime.asset.solid.userData.cleanAircraftSurface){
        runtime.config.boost=!reducedMotion.matches&&['deploy','hold'].includes(pose.phase);
        runtime.config.exhaustLength=(fighterForPilot(currentId).defaults.exhaustLength??1)*1.35;
        runtime.config.engineGlow=(fighterForPilot(currentId).defaults.engineGlow??1)*(runtime.config.boost?1.5:1.15);
      }
      if(performanceMonitor.enabled){canvas.dataset.deploymentPhase=pose.phase;canvas.dataset.deploymentProgress=pose.progress.toFixed(3);}
    }
    runtime.sample(time); equipment?.update(time, runtime); fixedParts?.update();
    if(runtime.asset.solid.userData.cleanAircraftSurface)for(const [i,jet]of runtime.jets.entries()){
      const base=jetRestScales[i];if(!base)continue;
      jet.object.scale.x=base.x*(runtime.config.boost?1.3:1.1);
      jet.object.scale.y=base.y*(runtime.config.boost?1.3:1.1);
    }
    if(performanceMonitor.enabled){
      canvas.dataset.engineMode=runtime.config.boost?'boost':'idle';
      canvas.dataset.deploymentFx=runtime.weapons?.sparks.visible?'active':'idle';
      canvas.dataset.animationTime=time.toFixed(3);
    }
  }
  function withPreviewGeometry(draw) {
    runtime.prepareRender(camera);
    const cleanSurface=runtime.asset.solid.userData.cleanAircraftSurface;
    const effects=[!cleanSurface&&runtime.asset.nodes.get(runtime.asset.effects.attachRoot),runtime.asset.nodes.get(runtime.asset.effects.worldRoot),runtime.specialFx?.root,runtime.specialFx?.ribbonRoot,runtime.weapons?.root];
    if(singlePass)for(const {object} of runtime.jets)effects.push(object);
    const hiddenFx=effects.filter(Boolean).map(node=>[node,node.visible]);
    for(const [node]of hiddenFx)node.visible=false;
    try {
      batcher.update();
      return draw(cleanSurface);
    } finally { batcher.restore(); for(const [node,wasVisible]of hiddenFx)node.visible=wasVisible; }
  }
  function renderModel() {
    if (warmingPreview) return;
    const draw=()=>{
      renderer.setRenderTarget(embedded?.target??null);
      withPreviewGeometry(cleanSurface=>{
        renderer.clear();
        if(performanceMonitor.enabled)canvas.dataset.fxJets=JSON.stringify(runtime.jets.map(({object})=>({visible:object.visible,mask:object.layers.mask,camera:camera.layers.mask,gain:object.material.uniforms.uGain.value,scale:object.scale.toArray()})));
        if(cleanSurface&&fxRenderer){
          if(embedded)drawingSize.set(embedded.target.width,embedded.target.height);else renderer.getDrawingBufferSize(drawingSize);exhaustRenderer.resize(drawingSize.x,drawingSize.y);exhaustFighter.runtime=runtime;
          coverageContext.allowHistory=!runtime.deployment.moving&&!orbit.dragging;
          coverageContext.pose=runtime.deployment.progress;
          fxRenderer.render(()=>{
            exhaustRenderer.render(scene,camera,exhaustFighter,embedded?.bounds().width||canvas.clientWidth||drawingSize.x);
            coverageContext.depth=runtime.depthInfo?.texture;
          },drawingSize.x,drawingSize.y,isShowcase()?coverageContext:undefined);
        }
        else renderer.render(scene,camera);
      });
    };
    performanceMonitor.measure('preview',()=>embedded?embedded.draw(previewExposure,draw):draw());
    lastFrame=Math.floor((isAnimated()?elapsed:0)*30);
    if(canvas.dataset.modelReady!=='true')canvas.dataset.modelReady='true';
  }
  async function warmFirstFrame(model, notify) {
    const current = () => !disposed && runtime === model;
    const deadline = performance.now() + shaderWarmupMs;
    const waiting = () => current() && performance.now() < deadline;
    warmingPreview = model;
    canvas.dataset.modelReady = 'false';
    try {
      await withPreviewGeometry(cleanSurface => {
        if (!cleanSurface) return warmRenderPrograms(renderer,scene,camera,waiting);
        if(embedded)drawingSize.set(embedded.target.width,embedded.target.height);else renderer.getDrawingBufferSize(drawingSize);
        exhaustRenderer.resize(drawingSize.x,drawingSize.y);
        exhaustFighter.runtime = model;
        return exhaustRenderer.warmup(scene,camera,exhaustFighter,true,waiting);
      });
    } catch(error) { if(current())console.warn('[peripheral shaders]',error); }
    if (!current()) return;
    warmingPreview = null;
    if (visible && canvas.isConnected && !document.hidden && currentId===requestedId) { renderModel(); if(notify)notifyReady(); }
  }
  function advanceSinglePassWarmup() {
    if (!pendingPrograms) {
      // Three's compile() also visits invisible objects. Submit only the
      // geometry used by this preview, with the same lighting as its first draw.
      const drawList = new THREE.Group();
      drawList.traverse = visit => scene.traverseVisible(object => {
        if (object.layers.test(camera.layers)) visit(object);
      });
      withPreviewGeometry(() => renderer.compile(drawList, camera, scene));
      renderer.getContext().flush();
      pendingPrograms = renderer.info.programs.filter(program => !preparedPrograms.has(program));
      return;
    }
    const program = pendingPrograms.shift();
    if (program) {
      // Without KHR_parallel_shader_compile this first query can block.
      // Wait for one program per visible frame so input and paint can run.
      if (program.program) program.getUniforms();
      preparedPrograms.add(program);
      return;
    }
    warmingPreview = null;
    pendingPrograms = null;
    renderModel();
    notifyReady();
  }
  function drawAircraft(id, notify = true, snapshot = requestedSnapshot) {
    const loadout = peripheralModelLoadout(id, snapshot), fitKey = peripheralModelLoadoutKey(loadout);
    if (!isFighterPackageReady(id) || disposed || runtime && id === currentId && fitKey === currentFitKey) return;
    const setupAt=performanceMonitor.enabled?performance.now():0;
    currentId = id; currentFitKey = fitKey;
    fxRenderer?.resetHistory();
    canvas.dataset.modelReady = 'false';
    batcher.clear();equipmentStyle?.dispose(); equipmentStyle = null;panelDepth?.dispose();panelDepth=null;
    fixedParts?.dispose(); fixedParts = null; equipment?.dispose(); equipment = null; runtime?.dispose(); runtime = null; attitude.clear();
    const asset = instantiateFighterPackage(id), entry = fighterForPilot(id);
    const effects=asset.effects;
    // The scene uses tinted glass. An old flight binding would re-enable
    // refraction after setup and cause an extra scene render on every frame.
    asset.effects={...effects,bindings:effects.bindings.filter(binding=>!(binding.target.material&&binding.property==='transmission'))};
    // Keep original anchors and deployment effects when pruning hidden flight resources.
    if(nativePreview)Object.assign(asset.effects,{
      motion:{...effects.motion,flightDynamics:null},deck:{...effects.deck,enabled:false},specialFx:{...effects.specialFx,disabled:true},
    });
    // Run before ConfigFighter's rigid batching so the overlapping bay walls
    // retain their depth precedence through merging and the deployment joints.
    panelDepth=stabilizeAircraftPanelDepth(asset.solid);
    scene.environment = environment?.texture ?? null;
    if(!embedded)renderer.setPixelRatio(previewPixelRatio);
    applyViewLighting();
    equipment = createKestrelEquipment(asset);
    const span = Math.max(asset.view.bounds.max[0] - asset.view.bounds.min[0], asset.view.bounds.max[2] - asset.view.bounds.min[2]);
    attitude.scale.setScalar(15.75509262084961 / span);
    runtime = new ConfigFighter({ scene: attitude, asset, deploymentOnly: nativePreview, config: { ...entry.defaults, cruise: false, firing: false, weaponFireEffects:false, altitude: 0, scale: 1, lightIntensity: asset.solid.userData.cleanAircraftSurface ? entry.defaults.lightIntensity : 0, ...aircraftFinishConfig(entry), trails: 0, particles: 0 }, globals: { glow: 1, particleCount: 0 } });
    for (const {object} of runtime.deployment.parts) object.userData.uiArticulation = true;
    restartShowcase();
    runtime.flight = null; runtime.deck.visible = false; runtime.quality = 'low';
    runtime.poseAtTime = (_time, position, quaternion) => { position.set(0, 0, 0); quaternion.identity(); };
    runtime.veilKinematics = { pose: runtime.poseAtTime, socketAt: (_time, socket, out) => out.copy(socket), socketVelocity: (_time, _socket, out) => out.set(0, 0, 0) };
    if (!asset.solid.userData.cleanAircraftSurface) for (const light of runtime.lights) light.object.removeFromParent();
    camera.layers.set(0);if(asset.solid.userData.cleanAircraftSurface||viewProfile==='patrol')camera.layers.enable(1);
    canvas.dataset.modelVersion=entry.version;
    runtime.spawn(new THREE.Vector3()); equipment?.update(0, runtime); lastFrame = -1;
    jetRestScales=runtime.jets.map(({object})=>object.scale.clone());
    fxRenderer?.setColor(entry.defaults.engineColor||'#66d7f0');
    // Reuse battle's authored seats and original module meshes. The normalized
    // hull and its mounts share the outer orbit group, so dragging cannot detach hardware.
    fixedParts = createFixedPartMounts({ view: { fighterId: entry.slug, object3D: mount }, mount, attitude, runtime, loadout });
    fixedParts.root.name = 'fixed-parts-hangar';
    shadowFloor.position.y = asset.view.bounds.min[1] * attitude.scale.x - .65;
    applyViewLighting();
    // Refraction would redraw the preview before the glass pass. Set the menu
    // material once after styling and fitting the hull, rather than per frame.
    mount.traverse(node=>{for(const material of [].concat(node.material||[]))if(material.isMeshPhysicalMaterial&&material.transmission>0){material.transmission=0;material.needsUpdate=true;}});
    canvas.dataset.mountedWeapons = JSON.stringify(Object.fromEntries(loadout.weapons.flatMap(w => w.slots.map(slot => [slot, w.itemId]))));
    canvas.dataset.aircraftId = id;
    // Inventory thumbnails always use the same pose. Caching another aircraft
    // must never change the orientation the player is currently inspecting.
    // The offline baking tool opts into capture. No runtime UI reads GPU pixels.
    if (captureThumbnail) {
      const activeView = viewProfile; setCameraView('default',true);
      mount.rotation.set(0, 0, 0); mount.position.set(0, 0, 0); renderModel();
      images.set(id, captureThumbnail(canvas,id)); setCameraView(activeView);
    }
    applyViewPose(); sampleModel(0);
    if (parallelShaders) void warmFirstFrame(runtime,notify).catch(error=>console.warn('[peripheral aircraft]',error));
    else if (singlePass) {
      warmingPreview = runtime;
      pendingPrograms = null;
    }
    else { renderModel(); if (notify) notifyReady(); }
    if(performanceMonitor.enabled)performanceMonitor.record('preview-setup',performance.now()-setupAt);
  }
  function showAircraft(id, snapshot = requestedSnapshot) {
    requestedId = id || 'pilot-01'; requestedSnapshot = snapshot || {};
    if (nativePreview) { previewRequested = true; return; }
    showRequestedAircraft();
  }
  function showRequestedAircraft() {
    if(!visible||!canvas.isConnected)return;
    if (isFighterPackageReady(requestedId)) { drawAircraft(requestedId); return; }
    canvas.dataset.modelReady = 'false';
    const wanted = requestedId;
    loadFighterPackages({ pilotIds: [wanted] }).then(() => {
      if (!disposed && visible && canvas.isConnected && requestedId === wanted) drawAircraft(wanted);
    }).catch(error => console.warn('[peripheral aircraft]', error));
  }
  return {
    images, available: true,
    attach(host,id=host?.dataset.modelAircraft) {
      if(embedded){
        visible=!!host;if(!host){orbit.cancel();return;}
        if(id)requestedId=id;
        if(viewProfile!==embedded.profile){setCameraView(embedded.profile,false,embedded.bounds());restartShowcase();applyViewPose();}
        else if(fitViewport(false,embedded.bounds())&&runtime)renderModel();
        return;
      }
      if (!host) {
        // A cached native tab already owns the last painted frame.
        if(lease)lease.release();else if(!warmShaders||canvas.isConnected)canvas.remove();
        viewportObserver.disconnect(); observedHost=null; orbit.cancel();
        return;
      }
      if(lease&&!screen.preview){lease.acquire();renderer.setPixelRatio(previewPixelRatio);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;canvas.className='pl-model-canvas';}
      visible = true;
      const currentModel=runtime&&(!id||id===currentId);
      if(id)requestedId=id;
      if(!currentModel)canvas.dataset.modelReady='false';
      const entering = observedHost === null;
      const moved=canvas.parentNode!==host;
      // The absolutely positioned canvas cannot affect its host's size.
      const bounds = nativePreview && moved ? host.getBoundingClientRect() : undefined;
      if (moved) { host.append(canvas); orbit.reattach(); }
      if(observedHost!==host){viewportObserver.disconnect();observedHost=host;viewportObserver.observe(host);}
      const profile = ['equipment','catalog','patrol'].includes(host.dataset.modelView) ? host.dataset.modelView : host.classList.contains('bc-aircraft') ? 'battle' : 'default';
      canvas.tabIndex = profile === 'patrol' ? -1 : 0;
      canvas.inert = profile === 'patrol';
      orbit.setYawOnly(profile === 'battle');
      if (profile !== viewProfile || entering && (!warmShaders || moved)) { setCameraView(profile,false,bounds); restartShowcase(); applyViewPose(); if (currentModel) { sampleModel(0); renderModel(); } }
      else {
        const resized=fitViewport(false,bounds);
        // A rebuilt catalog can reattach during a skipped 30 Hz update. Present
        // the current pose immediately; do not restart the deployment clock.
        if(currentModel&&(moved||resized))renderModel();
      }
      if(runtime&&!warmingPreview&&currentId===host.dataset.modelAircraft)notifyReady();
    },
    showAircraft,
    slotPoint(id) {
      const slot=fixedParts?.slots.find(s=>s.id===id);
      if(!slot||!canvas.isConnected)return null;
      fixedParts.root.updateWorldMatrix(true,false);
      const point=fixedParts.root.localToWorld(new THREE.Vector3().fromArray(slot.position)).project(camera);
      if(point.z < -1 || point.z > 1)return null;
      const bounds=canvas.getBoundingClientRect();
      // CSS object-fit:contain letterboxes the canvas inside the preview.
      const fit=Math.min(bounds.width/canvas.width,bounds.height/canvas.height);
      const width=canvas.width*fit,height=canvas.height*fit;
      return {x:bounds.left+(bounds.width-width)/2+(point.x+1)*width/2,y:bounds.top+(bounds.height-height)/2+(1-point.y)*height/2};
    },
    update(dt = .016, isVisible = true) {
      const resumed = isVisible && !visible;
      visible = isVisible; if (disposed) return;
      if (!visible || document.hidden || (lease&&screen.preview!==lease) || !canvas.isConnected) { orbit.cancel(); return; }
      if (resumed) showAircraft(requestedId, requestedSnapshot);
      if (previewRequested) {
        previewRequested = false;
        const previous = runtime;
        showRequestedAircraft();
        if (runtime !== previous) return;
      }
      if (!runtime || currentId!==requestedId) return;
      if (warmingPreview) {
        if (singlePass) advanceSinglePassWarmup();
        return;
      }
      elapsed += Math.min(.05, Math.max(0, dt));
      if (!orbit.dragging) showcaseElapsed += Math.min(.05, Math.max(0, dt));
      // One current aircraft runs at 30 fps; lists never allocate renderers.
      // Hidden/covered pages return above, so resuming cannot jump the timeline.
      const sampleTime = isAnimated() ? elapsed : 0;
      const frame = Math.floor(sampleTime * 30); if (frame === lastFrame) return; lastFrame = frame;
      applyViewPose();
      sampleModel(sampleTime); renderModel();
    },
    destroy() {
      if (disposed) return; disposed = true;
      releaseMetrics();batcher.destroy();viewportObserver.disconnect();orbit.destroy();
      equipmentStyle?.dispose();panelDepth?.dispose();fixedParts?.dispose();equipment?.dispose();runtime?.dispose();
      exhaustRenderer?.dispose();fxRenderer?.dispose();shadowFloor.geometry.dispose();shadowFloor.material.dispose();
      shadowTexture.dispose();releaseOwnedCanvas(shadowImage);environment?.dispose();
      if(lease)lease.release();else if(!embedded){renderer.dispose();renderer.forceContextLoss();releaseOwnedCanvas(canvas);}
      images.clear();scene.clear();
    },
  };
}

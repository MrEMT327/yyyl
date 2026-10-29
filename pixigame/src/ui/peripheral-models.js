import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ConfigFighter } from '../three/aircraft/v34/aircraft/ConfigFighter.js';
import { fighterForPilot, instantiateFighterPackage, loadFighterPackages, isFighterPackageReady } from '../three/aircraft/fighter-packages.js';
import { createKestrelEquipment } from '../three/aircraft/kestrel-equipment.js';
import { createModelOrbitInteraction } from './model-orbit-interaction.js';
import { createFixedPartMounts } from '../fixed-parts/mounts.js';
import { peripheralModelLoadout, peripheralModelLoadoutKey } from './peripheral-model-loadout.js';
import { createEquipmentAircraftStyle } from './equipment-aircraft-style.js';
import { performanceMonitor } from '../performance-monitor.js';
import {createPreviewBatcher} from './preview-batcher.js';

// One context for the lobby. Aircraft packages and weapon meshes are shared with
// combat; the lobby never substitutes a generated painting for a game model.
export function createPeripheralModels({ onReady = () => {}, captureThumbnail } = {}) {
  const images = new Map();
  let model, host, aircraftId = 'pilot-01', snapshot = {}, disposed = false, frame = null, shown=true;
  // The PSD home has no aircraft canvas. Allocate a WebGL context only when a
  // visible preview or an aircraft thumbnail actually requests one.
  const ensure = () => {
    frame = null;
    if (disposed || model || !shown || !host?.isConnected) return;
    model = performanceMonitor.measure('preview-setup',()=>createModelRenderer({ images, onReady, captureThumbnail }));
    if (host?.isConnected) model.attach(host);
    model.showAircraft(aircraftId, snapshot);
  };
  const cancel=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;};
  const schedule = () => { if (!disposed && shown && host?.isConnected && !model && frame === null) frame = requestAnimationFrame(ensure); };
  return {
    images, get available() { return model?.available ?? true; },
    attach(nextHost) { host = nextHost; if(!host)cancel(); if (model) model.attach(nextHost); else if (host) schedule(); },
    showAircraft(id, state = snapshot) { aircraftId = id || 'pilot-01'; snapshot = state || {}; model?.showAircraft(aircraftId, snapshot); },
    // Compatibility for older callers. Lists use the baked UI manifest and
    // cannot create a WebGL context, a fighter, or a GPU readback.
    requestThumbnail() {},
    slotPoint(id) { return model?.slotPoint?.(id) || null; },
    update(dt, visible=true) { shown=visible; if(!shown)cancel(); else schedule(); model?.update(dt, visible); },
    destroy() { disposed = true; cancel(); model?.destroy(); images.clear(); },
  };
}

function createModelRenderer({ onReady, images, captureThumbnail }) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); }
  catch (error) { console.warn('[peripheral models]', error); return { attach() {}, showAircraft() {}, update() {}, destroy() {}, images: new Map(), available: false }; }
  // Supersample low-DPI previews without exceeding the existing 2x GPU budget.
  const previewPixelRatio = Math.min(2, Math.max(1.5, window.devicePixelRatio || 1));
  renderer.setPixelRatio(previewPixelRatio);
  renderer.setSize(600, 390, false);
  renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.12;
  const canvas = renderer.domElement; canvas.className = 'pl-model-canvas';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const scene = new THREE.Scene(), mount = new THREE.Group(), attitude = new THREE.Group(); scene.add(mount); mount.add(attitude);
  const batcher=createPreviewBatcher(mount);
  // Metal needs a reflected environment as well as directional lighting.
  // Without one, reflective surfaces become flat dark blocks and glass loses depth.
  const studio = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(studio, .04); studio.dispose(); pmrem.dispose();
  const hemisphere = new THREE.HemisphereLight('#e7f6ff', '#566a88', 2);
  scene.add(hemisphere); const studioLights = [];
  for (const [color, intensity, position] of [['#ffffff', 3.6, [-7, 12, -12]], ['#96d8ff', 3, [9, 5, 8]], ['#b5c9dd', 1.5, [4, -5, 10]]]) {
    const light = new THREE.DirectionalLight(color, intensity); light.position.set(...position); scene.add(light); studioLights.push(light);
  }
  const perspectiveCamera = new THREE.PerspectiveCamera(32, 600 / 390, .1, 160);
  // A's hull occupies about half the screen width; leave gutters at the PSD slots.
  const equipmentCamera = new THREE.OrthographicCamera(-13, 13, 8.45, -8.45, .1, 160);
  let camera = perspectiveCamera;
  camera.position.set(7, 20, -25); camera.lookAt(0, 0, -.5);
  // A transparent receiver grounds the actual hull and equipped parts in the PSD hangar.
  const shadowImage=document.createElement('canvas');shadowImage.width=shadowImage.height=64;
  const shadowContext=shadowImage.getContext('2d'),gradient=shadowContext.createRadialGradient(32,32,0,32,32,32);
  gradient.addColorStop(0,'#11294199');gradient.addColorStop(1,'#11294100');shadowContext.fillStyle=gradient;shadowContext.fillRect(0,0,64,64);
  const shadowTexture=new THREE.CanvasTexture(shadowImage);
  const shadowFloor = new THREE.Mesh(new THREE.PlaneGeometry(32, 28), new THREE.MeshBasicMaterial({map:shadowTexture,transparent:true,opacity:.26,depthWrite:false,toneMapped:false}));
  shadowFloor.rotation.x = -Math.PI / 2; shadowFloor.position.y = -2.2;
  shadowFloor.receiveShadow = true; shadowFloor.visible = false; scene.add(shadowFloor);
  renderer.shadowMap.type = THREE.VSMShadowMap;
  const keyLight = studioLights[0];
  keyLight.shadow.mapSize.set(1024, 1024);
  Object.assign(keyLight.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 75 });
  keyLight.shadow.camera.updateProjectionMatrix();
  keyLight.shadow.bias = -.0003; keyLight.shadow.normalBias = .035;
  keyLight.shadow.radius = 8; keyLight.shadow.blurSamples = 8;
  let currentId, currentFitKey, requestedId = 'pilot-01', requestedSnapshot = {}, runtime, equipment, fixedParts,
    elapsed = 0, visible = true, disposed = false, lastFrame = -1;
  let pendingReady = false;
  let equipmentStyle;
  const releaseMetrics=performanceMonitor.registerRenderer('preview',()=>({active:visible&&canvas.isConnected&&!document.hidden,...renderer.info.render,...renderer.info.memory,batching:batcher.stats}));
  const orbit = createModelOrbitInteraction(canvas, {
    onChange: () => { lastFrame = -1; },
    onDragEnd: () => { if (pendingReady && !disposed) { pendingReady = false; onReady(); } },
  });
  let viewProfile = 'default';
  let observedHost=null;
  function fitViewport(thumbnail=false) {
    const ratio=viewProfile==='patrol'?600/240:600/390;
    const limit=['equipment','battle'].includes(viewProfile)?960:600;
    const bounds=canvas.parentElement?.getBoundingClientRect();
    const width=thumbnail?600:bounds?.width&&bounds?.height
      ? Math.min(limit,Math.max(128,Math.ceil(Math.min(bounds.width,bounds.height*ratio)))) : limit;
    const height=thumbnail?390:Math.round(width/ratio);
    const size=renderer.getSize(new THREE.Vector2());
    if(size.x===width&&size.y===height)return;
    renderer.setSize(width,height,false);
    if(camera.isPerspectiveCamera){camera.aspect=width/height;camera.updateProjectionMatrix();}
    lastFrame=-1;
  }
  const viewportObserver=new ResizeObserver(()=>{if(!disposed&&visible&&canvas.isConnected)fitViewport();});
  const patrolFog = new THREE.Fog('#cadce9', 18, 95);
  function applyViewLighting() {
    const patrol = viewProfile === 'patrol', illustrated = viewProfile === 'equipment';
    scene.environmentIntensity = illustrated ? .6 : patrol ? 1 : .85;
    scene.fog = patrol ? patrolFog : null;
    renderer.toneMappingExposure = illustrated ? 1.08 : patrol ? 1.02 : .92;
    hemisphere.intensity = illustrated ? 1.05 : patrol ? 1.45 : .95;
    studioLights.forEach((light, i) => {
      light.intensity = (illustrated ? [2.7, 1.15, 1.9] : patrol ? [2, 1.4, .45] : [2.6, 2.8, .65])[i];
      light.position.set(...(illustrated ? [[-10, 22, -12], [14, 7, -3], [3, 12, 16]] : [[-7, 12, -12], [9, 5, 8], [4, -5, 10]])[i]);
    });
    studioLights[0].color.set(patrol ? '#fff3e3' : '#ffffff');
    keyLight.castShadow = false; shadowFloor.visible = illustrated;
    renderer.shadowMap.enabled = false;
    if (illustrated && runtime && !equipmentStyle) equipmentStyle = createEquipmentAircraftStyle(mount);
    equipmentStyle?.setEnabled(illustrated);
  }
  function setCameraView(profile,thumbnail=false) {
    viewProfile = profile;
    applyViewLighting();
    camera = profile === 'equipment' ? equipmentCamera : perspectiveCamera;
    fitViewport(thumbnail);
    canvas.dataset.viewProfile = profile;
    // Equipment uses a compressed illustration-like view; other pages keep their optics.
    camera.position.set(...(profile === 'equipment' ? [19, 29, -28] : profile === 'patrol' ? [21, 8, -3] : profile === 'battle' ? [27, 13, -26] : [7, 20, -25]));
    // Patrol exposes the aircraft's authored engine jets on the effects layer.
    camera.layers.set(0); if (profile === 'patrol') camera.layers.enable(1);
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
    const t = 0;
    mount.rotation.set(orbit.pitch, orbit.yaw + (orbit.interacted || viewProfile === 'equipment' ? 0 : Math.sin(t * .25) * .06), 0, 'YXZ');
    mount.position.set(0, Math.sin(t * .8) * (viewProfile === 'battle' ? .015 : viewProfile === 'equipment' ? .04 : .12), 0);
    if (runtime) {
      const defaults = fighterForPilot(currentId).defaults;
      runtime.config.exhaustLength = defaults.exhaustLength;
      runtime.config.engineGlow = defaults.engineGlow;
    }
  }
  function renderModel() {
    performanceMonitor.measure('preview',()=>{
      renderer.setRenderTarget(null); runtime.prepareRender(camera);
      // Refraction re-renders the whole preview before the glass pass. Menu
      // glass keeps its tint, transparency and clearcoat without that pass.
      mount.traverse(node=>{for(const material of [].concat(node.material||[]))if(material.isMeshPhysicalMaterial&&material.transmission>0){material.transmission=0;material.needsUpdate=true;}});
      // Menu inspection keeps the real hull and modules. Volumetric flight
      // effects are for combat; suppress them only for this preview draw.
      const hiddenFx=[runtime.asset.nodes.get(runtime.asset.effects.attachRoot),runtime.asset.nodes.get(runtime.asset.effects.worldRoot),runtime.specialFx?.root,runtime.specialFx?.ribbonRoot].filter(Boolean).map(node=>[node,node.visible]);
      for(const [node]of hiddenFx)node.visible=false;
      try{batcher.update();renderer.clear();renderer.render(scene,camera);}finally{batcher.restore();for(const [node,wasVisible]of hiddenFx)node.visible=wasVisible;}
    });
    lastFrame=Math.floor((viewProfile==='patrol'&&!reducedMotion.matches?elapsed:0)*30);
  }
  function drawAircraft(id, notify = true, snapshot = requestedSnapshot) {
    const loadout = peripheralModelLoadout(id, snapshot), fitKey = peripheralModelLoadoutKey(loadout);
    if (!isFighterPackageReady(id) || disposed || id === currentId && fitKey === currentFitKey) return;
    const setupAt=performanceMonitor.enabled?performance.now():0;
    currentId = id; currentFitKey = fitKey;
    batcher.clear();equipmentStyle?.dispose(); equipmentStyle = null;
    fixedParts?.dispose(); fixedParts = null; equipment?.dispose(); equipment = null; runtime?.dispose(); runtime = null; attitude.clear();
    const asset = instantiateFighterPackage(id), entry = fighterForPilot(id);
    scene.environment = environment.texture;
    renderer.setPixelRatio(previewPixelRatio);
    applyViewLighting();
    equipment = createKestrelEquipment(asset);
    const span = Math.max(asset.view.bounds.max[0] - asset.view.bounds.min[0], asset.view.bounds.max[2] - asset.view.bounds.min[2]);
    attitude.scale.setScalar(15.75509262084961 / span);
    runtime = new ConfigFighter({ scene: attitude, asset, config: { ...entry.defaults, cruise: false, firing: false, altitude: 0, scale: 1, lightIntensity: 0, bodyFx: .18, coreGlow: .6, surfaceGlow: .35, weaponGlow: .25, trails: 0, particles: 0 }, globals: { glow: 1, particleCount: 0 } });
    runtime.flight = null; runtime.deck.visible = false; runtime.quality = 'low';
    runtime.poseAtTime = (_time, position, quaternion) => { position.set(0, 0, 0); quaternion.identity(); };
    runtime.veilKinematics = { pose: runtime.poseAtTime, socketAt: (_time, socket, out) => out.copy(socket), socketVelocity: (_time, _socket, out) => out.set(0, 0, 0) };
    for (const light of runtime.lights) light.object.removeFromParent();
    runtime.spawn(new THREE.Vector3()); runtime.sample(0); equipment?.update(0, runtime); lastFrame = -1;
    // Reuse battle's authored seats and original module meshes. The normalized
    // hull and its mounts share the outer orbit group, so dragging cannot detach hardware.
    fixedParts = createFixedPartMounts({ view: { fighterId: entry.slug, object3D: mount }, mount, attitude, runtime, loadout });
    fixedParts.root.name = 'fixed-parts-hangar';
    shadowFloor.position.y = asset.view.bounds.min[1] * attitude.scale.x - .65;
    applyViewLighting();
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
    applyViewPose(); renderModel(); if (notify) notifyReady();
    if(performanceMonitor.enabled)performanceMonitor.record('preview-setup',performance.now()-setupAt);
  }
  function showAircraft(id, snapshot = requestedSnapshot) {
    requestedId = id || 'pilot-01'; requestedSnapshot = snapshot || {};
    if(!visible||!canvas.isConnected)return;
    if (isFighterPackageReady(requestedId)) { drawAircraft(requestedId); return; }
    const wanted = requestedId;
    loadFighterPackages({ pilotIds: [wanted] }).then(() => {
      if (!disposed && visible && canvas.isConnected && requestedId === wanted) drawAircraft(wanted);
    }).catch(error => console.warn('[peripheral aircraft]', error));
  }
  return {
    images, available: true,
    attach(host) {
      if (!host) { canvas.remove(); viewportObserver.disconnect(); observedHost=null; orbit.cancel(); return; }
      if (canvas.parentNode !== host) { host.append(canvas); orbit.reattach(); }
      if(observedHost!==host){viewportObserver.disconnect();observedHost=host;viewportObserver.observe(host);}
      const profile = host.dataset.modelView === 'equipment' ? 'equipment' : host.dataset.modelView === 'patrol' ? 'patrol' : host.classList.contains('bc-aircraft') ? 'battle' : 'default';
      canvas.tabIndex = profile === 'patrol' ? -1 : 0;
      canvas.inert = profile === 'patrol';
      orbit.setYawOnly(profile === 'battle');
      if (profile !== viewProfile) { setCameraView(profile); applyViewPose(); if (runtime) renderModel(); }
      else fitViewport();
      if(runtime&&currentId===host.dataset.modelAircraft)notifyReady();
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
      visible = isVisible; if (disposed) return;
      if (!visible || document.hidden || !canvas.isConnected) { orbit.cancel(); return; }
      if (!runtime) return;
      elapsed += Math.min(.05, Math.max(0, dt));
      // The equipment hangar is a parked inspection view. Redraw only for a
      // changed loadout, viewport or orbit; other views keep their authored motion.
      const sampleTime = reducedMotion.matches || viewProfile!=='patrol' ? 0 : elapsed;
      const frame = Math.floor(sampleTime * 30); if (frame === lastFrame) return; lastFrame = frame;
      applyViewPose();
      runtime.sample(sampleTime); equipment?.update(sampleTime, runtime); fixedParts?.update(); renderModel();
    },
    destroy() { if (disposed) return; disposed = true; releaseMetrics();batcher.destroy(); viewportObserver.disconnect(); orbit.destroy(); equipmentStyle?.dispose(); fixedParts?.dispose(); equipment?.dispose(); runtime?.dispose(); shadowFloor.geometry.dispose(); shadowFloor.material.dispose();shadowTexture.dispose(); keyLight.shadow.dispose(); environment.dispose(); renderer.dispose(); canvas.remove(); images.clear(); scene.clear(); },
  };
}

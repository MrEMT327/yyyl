import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { loadFighterPackages, fighterForPilot } from '../three/aircraft/fighter-packages.js';
import { createFighterView } from '../three/aircraft/fighter-view.js';
import { setShowroomCameraPreset } from '../ui/showroom-camera.js';
import { DEMO_ITEMS, itemAtSlot } from './catalog.js';
import { createModuleGeometry } from './module-geometry.js';
import { fittingPilotId, resolveAircraftSlots } from './aircraft-slots.js';

function disposeTree(root) {
  const geometries = new Set(), materials = new Set();
  root.traverse(node => { if (node.geometry) geometries.add(node.geometry); if (node.material) materials.add(node.material); });
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); root.clear();
}

export async function createSlotDemoViewer({ viewport, onProject, pilotId = 'pilot-01' }) {
  await loadFighterPackages();
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0;
  viewport.prepend(canvas);
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = .95;
  const scene = new T.Scene(); scene.background = new T.Color('#0b1726');
  const room = new RoomEnvironment(), pmrem = new T.PMREMGenerator(renderer), environment = pmrem.fromScene(room, .04);
  room.dispose(); pmrem.dispose(); scene.environment = environment.texture; scene.environmentIntensity = .75;
  scene.add(new T.HemisphereLight('#e8f3ff', '#1b2835', 1));
  const key = new T.DirectionalLight('#e3f3ff', 2.1); key.position.set(-10, 18, -8); scene.add(key);
  const rim = new T.DirectionalLight('#74bece', 1.7); rim.position.set(8, 5, 7); scene.add(rim);
  const grid = new T.GridHelper(42, 42, '#2a4252', '#172d3f'); grid.position.y = -2;
  grid.material.transparent = true; grid.material.opacity = .42; scene.add(grid);
  const runway = new T.Mesh(new T.RingGeometry(10.8, 10.83, 100), new T.MeshBasicMaterial({ color: '#3c6879', side: T.DoubleSide, transparent: true, opacity: .5 }));
  runway.rotation.x = -Math.PI / 2; runway.position.y = -1.98; scene.add(runway);

  const fighter = createFighterView({ pilotId: fittingPilotId(pilotId), size: 1, nativeSpace: true });
  Object.assign(fighter.runtime.config, { bodyFx: .1, surfaceGlow: .25, coreGlow: .3, weaponGlow: .16, trails: 0, particles: 0 });
  scene.add(fighter.object3D);
  let slots = resolveAircraftSlots(fighter);
  const modules = new T.Group(), wiring = new T.Group(), pads = new T.Group(); scene.add(modules, wiring, pads);
  const padMeshes = new Map(), mounted = new Map();
  for (const slot of slots) {
    const material = new T.MeshStandardMaterial({ color: '#4c6572', metalness: .75, roughness: .3, emissive: '#000000' });
    const pad = new T.Mesh(new T.CylinderGeometry(.43, .5, .18, slot.kind === 'weapon' ? 8 : 24), material);
    pad.scale.setScalar(slot.scale); pad.position.fromArray(slot.position); pad.position.y -= .15 * slot.scale;
    pad.name = `Socket/${slot.id}`; pads.add(pad); padMeshes.set(slot.id, pad);
  }
  const camera = new T.PerspectiveCamera(40, 1, .1, 200), controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.enablePan = false; controls.minDistance = 15; controls.maxDistance = 52;
  controls.minPolarAngle = .035; controls.maxPolarAngle = Math.PI / 2 + .16; controls.rotateSpeed = .6;
  controls.target.set(0, .2, -.65);
  const cameraHome = () => {
    controls.enableDamping = false; controls.update();
    controls.target.set(0, .2, -.65); camera.position.set(8, 21, 20); controls.update(); controls.enableDamping = true;
  };
  cameraHome();
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target), renderPass = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new T.Vector2(1, 1), .18, .3, 1.8), output = new OutputPass();
  composer.addPass(renderPass); composer.addPass(bloom); composer.addPass(output);

  // Render the actual kits once for the inventory, using this same WebGL context.
  const thumbnails = new Map(), thumbScene = new T.Scene(); thumbScene.background = new T.Color('#172839');
  thumbScene.environment = environment.texture; thumbScene.environmentIntensity = 1.2;
  thumbScene.add(new T.HemisphereLight('#f1f8ff', '#253e50', 2));
  const thumbKey = new T.DirectionalLight('#ffffff', 3); thumbKey.position.set(-3, 7, -5); thumbScene.add(thumbKey);
  const thumbCamera = new T.PerspectiveCamera(34, 1.7, .1, 80);
  renderer.setPixelRatio(1); renderer.setSize(238, 140, false);
  for (const item of DEMO_ITEMS) {
    const kit = createModuleGeometry(item); thumbScene.add(kit);
    const bounds = new T.Box3().setFromObject(kit), centre = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
    const distance = Math.max(size.x * .68, size.y, size.z * .8) * 2.7;
    thumbCamera.position.copy(centre).addScaledVector(new T.Vector3(1, 1.25, -1.5).normalize(), distance);
    thumbCamera.lookAt(centre); renderer.render(thumbScene, thumbCamera);
    thumbnails.set(item.id, canvas.toDataURL('image/png')); kit.userData.dispose();
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));

  let current = {}, activeSlot = 'W1', compare = false, showSockets = true;
  let frame = 0, last = 0, elapsed = 0, destroyed = false, visible = false;
  const projection = new T.Vector3(), cameraDirection = new T.Vector3();
  function focus(slotId) {
    activeSlot = slotId;
    for (const [id, pad] of padMeshes) {
      const selected = id === activeSlot;
      pad.material.color.set(selected ? '#c0fff0' : itemAtSlot(current, id)?.color || '#4c6572');
      pad.material.emissive.set(selected ? '#246d60' : '#000000');
    }
  }
  function apply(placements) {
    current = placements;
    for (const slot of slots) {
      const item = itemAtSlot(current, slot.id), previous = mounted.get(slot.id);
      let kit = previous;
      if (previous?.userData.itemId !== item?.id) {
        previous?.userData.dispose(); mounted.delete(slot.id); kit = null;
      }
      if (!item) continue;
      if (!kit) { kit = createModuleGeometry(item); kit.userData.slotId = slot.id; modules.add(kit); mounted.set(slot.id, kit); }
      kit.position.fromArray(slot.position); kit.scale.setScalar(slot.scale);
      if (slot.kind === 'weapon' && slot.position[0] < 0) kit.scale.x *= -1;
    }
    disposeTree(wiring);
    const drawn = new Set();
    for (const slot of slots.filter(value => value.kind === 'connector')) {
      const item = itemAtSlot(current, slot.id); if (!item) continue;
      for (const id of slot.adjacent) {
        const edge = [slot.id, id].sort().join('-'); if (drawn.has(edge)) continue; drawn.add(edge);
        const a = new T.Vector3(...slot.position), b = new T.Vector3(...slots.find(value => value.id === id).position);
        a.y += .2; b.y += .15;
        const via = a.clone().lerp(b, .5); via.y = Math.max(a.y, b.y) + .18;
        const curve = new T.CatmullRomCurve3([a, a.clone().lerp(via, .55), via, b]);
        const connected = Boolean(itemAtSlot(current, id));
        const material = new T.MeshStandardMaterial({ color: connected ? item.color : '#516774', emissive: connected ? item.color : '#142330', emissiveIntensity: connected ? .45 : 0, metalness: .65, roughness: .4 });
        const cable = new T.Mesh(new T.TubeGeometry(curve, 16, connected ? .045 : .028, 6, false), material); cable.name = `Cable/${edge}`; wiring.add(cable);
      }
    }
    focus(activeSlot);
    canvas.dataset.mountedCount = String(mounted.size); canvas.dataset.logicalCount = String(Object.keys(current).length);
  }
  function resize() {
    const width = Math.max(1, viewport.clientWidth), height = Math.max(1, viewport.clientHeight);
    camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); composer.setSize(width, height);
  }
  const observer = new ResizeObserver(resize); observer.observe(viewport); resize();
  function animate(now) {
    frame = 0; if (destroyed || !visible || document.hidden) return;
    elapsed += Math.min(.04, Math.max(0, (now - last) / 1000)); last = now;
    controls.update(); fighter.updateAircraft(elapsed);
    grid.visible = runway.visible = camera.position.y > -1.6;
    composer.render(); camera.getWorldDirection(cameraDirection);
    for (const slot of slots) {
      projection.fromArray(slot.position); projection.y += .32;
      const inFront = projection.clone().sub(camera.position).dot(cameraDirection) > 0;
      projection.project(camera);
      onProject(slot.id, (projection.x * .5 + .5) * viewport.clientWidth, (-projection.y * .5 + .5) * viewport.clientHeight, showSockets && !compare && inFront && projection.z < 1);
    }
    canvas.dataset.viewDistance = camera.position.distanceTo(controls.target).toFixed(2);
    canvas.dataset.viewPolar = controls.getPolarAngle().toFixed(3);
    canvas.dataset.previewFrame = String(renderer.info.render.frame);
    frame = requestAnimationFrame(animate);
  }
  const start = () => { if (!frame && visible && !document.hidden && !destroyed) { last = performance.now(); frame = requestAnimationFrame(animate); } };
  const visibility = () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else start(); };
  document.addEventListener('visibilitychange', visibility); start();
  function setPilot(nextId, placements = current) {
    const id = fittingPilotId(nextId), entry = fighterForPilot(id);
    fighter.setPilot(id);
    Object.assign(fighter.runtime.config, { bodyFx: .1, surfaceGlow: .25, coreGlow: .3, weaponGlow: .16, trails: 0, particles: 0 });
    fighter.updateAircraft(elapsed);
    slots = resolveAircraftSlots(fighter);
    for (const slot of slots) {
      const pad = padMeshes.get(slot.id); pad.position.fromArray(slot.position);
      pad.position.y -= .15 * slot.scale; pad.scale.setScalar(slot.scale);
    }
    apply(placements);
    canvas.setAttribute('aria-label', `${entry.name}槽位装配三维预览，可拖动旋转和滚轮缩放`);
    canvas.dataset.pilotId = id; canvas.dataset.fighterId = entry.slug;
    canvas.dataset.slotPositions = JSON.stringify(slots.map(slot => ({ id: slot.id, position: slot.position })));
  }
  setPilot(pilotId);
  return {
    thumbnails, apply, focus, setPilot,
    setVisible(next) {
      visible = next;
      if (next) { resize(); start(); }
      else { cancelAnimationFrame(frame); frame = 0; }
    },
    setCompare(value) { compare = value; modules.visible = wiring.visible = pads.visible = !value; canvas.dataset.comparing = String(value); },
    setSockets(value) { showSockets = value; },
    view(preset) {
      if (preset === 'top') setShowroomCameraPreset(camera, controls, 'top');
      else if (preset === 'home') cameraHome();
      else {
        const offset = camera.position.clone().sub(controls.target), factor = preset === 'in' ? .84 : 1.19;
        offset.setLength(T.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance)); camera.position.copy(controls.target).add(offset); controls.update();
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; cancelAnimationFrame(frame); observer.disconnect(); document.removeEventListener('visibilitychange', visibility);
      controls.dispose(); mounted.forEach(kit => kit.userData.dispose()); disposeTree(wiring); disposeTree(pads);
      fighter.destroy({ children: true }); grid.geometry.dispose(); grid.material.dispose(); runway.geometry.dispose(); runway.material.dispose();
      bloom.dispose(); output.dispose(); renderPass.dispose(); composer.dispose(); environment.dispose(); renderer.dispose(); canvas.remove();
    },
  };
}

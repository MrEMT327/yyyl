import * as THREE from 'three';
import { ConfigFighter } from '../three/aircraft/v34/aircraft/ConfigFighter.js';
import { fighterForPilot, instantiateFighterPackage } from '../three/aircraft/fighter-packages.js';
import { createKestrelEquipment } from '../three/aircraft/kestrel-equipment.js';
import { resolveAircraftSlots } from '../slot-demo/aircraft-slots.js';
import { createPreviewFixedParts, readPreviewFixedParts } from './preview-fixed-parts.js';
import { createPreviewBatcher } from './preview-batcher.js';

// A native 3D scene rendered into the existing renderer's texture. No second
// WebGL context, display-tree emulation, or separate animation loop.
export function createSortieFighter({ renderer, pilotId, appearance, storage }) {
  const scene = new THREE.Scene(), presentation = new THREE.Group(), mount = new THREE.Group();
  scene.add(presentation); presentation.add(mount);
  const batcher = createPreviewBatcher(presentation);
  scene.environment = renderer.scene.environment;
  scene.environmentIntensity = .85;
  scene.add(new THREE.HemisphereLight('#e7f0f6', '#677786', 1.6));
  const key = new THREE.DirectionalLight('#f3f9ff', 3); key.position.set(-7,12,-12); scene.add(key);
  const rim = new THREE.DirectionalLight('#a8d4e9', 2.6); rim.position.set(9,3,8); scene.add(rim);
  const fill = new THREE.DirectionalLight('#b5c9dd', 1.1); fill.position.set(4,-5,10); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(33, 600/420, .1, 150);
  camera.position.set(12, 16, -24); camera.lookAt(0,0,-.5);
  const cameraTarget = new THREE.Vector3(0, 0, -.5);
  const homeOrbit = new THREE.Spherical().setFromVector3(camera.position.clone().sub(cameraTarget));
  const orbit = homeOrbit.clone();
  const target = new THREE.WebGLRenderTarget(900, 630, { depthBuffer: true, samples: 2 });
  let runtime, equipment, fixedParts, currentPilot, elapsed = 0, visible = false, lastFrame = -1, inspecting = false;
  function cameraUpdate() { camera.position.setFromSpherical(orbit).add(cameraTarget); camera.lookAt(cameraTarget); camera.updateMatrixWorld(true); lastFrame = -1; }
  function resetView() { orbit.copy(homeOrbit); inspecting = false; cameraUpdate(); }
  function setPilot(id, fittings) {
    if (currentPilot === id) {
      if (fittings && equipment?.setAppearance(fittings)) lastFrame = -1;
      if (fixedParts.apply(readPreviewFixedParts(id, storage))) lastFrame = -1;
      return;
    }
    fixedParts?.dispose(); equipment?.dispose(); runtime?.dispose(); mount.clear(); currentPilot = id; elapsed = 0; resetView();
    presentation.rotation.set(0, 0, 0); presentation.position.set(0, 0, 0);
    const asset = instantiateFighterPackage(id), entry = fighterForPilot(id);
    equipment = createKestrelEquipment(asset);
    const span = Math.max(asset.view.bounds.max[0]-asset.view.bounds.min[0],asset.view.bounds.max[2]-asset.view.bounds.min[2]);
    mount.scale.setScalar(15.75509262084961/span);
    runtime = new ConfigFighter({ scene: mount, asset, config: { ...entry.defaults,
      cruise: false, firing: false, altitude: 0, scale: 1, lightIntensity: 0,
      bodyFx: .18, coreGlow: .6, surfaceGlow: .35, weaponGlow: .25, trails: 0, particles: 0,
    }, globals: { glow: 1, particleCount: 0 } });
    runtime.flight = null; runtime.deck.visible = false; runtime.quality = 'low';
    runtime.poseAtTime = (_time, position, quaternion) => { position.set(0,0,0); quaternion.identity(); };
    runtime.veilKinematics = { pose: runtime.poseAtTime, socketAt: (_time,socket,out)=>out.copy(socket), socketVelocity: (_time,_socket,out)=>out.set(0,0,0) };
    for (const light of runtime.lights) light.object.removeFromParent();
    runtime.spawn(new THREE.Vector3()); runtime.sample(0); equipment?.update(0, runtime);
    const slots = resolveAircraftSlots({ object3D: mount, runtime, fighterId: entry.slug });
    fixedParts = createPreviewFixedParts({ parent: presentation, slots });
    fixedParts.apply(readPreviewFixedParts(id, storage));
    if (fittings) equipment?.setAppearance(fittings);
    lastFrame = -1;
  }
  const savedColor = new THREE.Color(), savedViewport = new THREE.Vector4(), savedScissor = new THREE.Vector4();
  const render = three => {
    if (!visible) return;
    // Limit the expensive aircraft pass to 30 fps; the UI remains at game rate.
    const frame = Math.floor(elapsed * 30);
    if (frame === lastFrame) return;
    lastFrame = frame;
    const oldTarget = three.getRenderTarget(), oldAlpha = three.getClearAlpha(), oldScissorTest = three.getScissorTest();
    three.getClearColor(savedColor); three.getViewport(savedViewport); three.getScissor(savedScissor);
    try {
      three.setRenderTarget(target); three.setScissorTest(false); three.setClearColor(0x000000, 0); three.clear();
      runtime.prepareRender(camera);
      mount.traverse(node => { for (const material of [].concat(node.material || []))
        if (material.isMeshPhysicalMaterial && material.transmission > 0) { material.transmission = 0; material.needsUpdate = true; } });
      const effects = [runtime.asset.nodes.get(runtime.asset.effects.attachRoot), runtime.asset.nodes.get(runtime.asset.effects.worldRoot),
        runtime.specialFx?.root, runtime.specialFx?.ribbonRoot].filter(Boolean).map(node => [node, node.visible]);
      for (const [node] of effects) node.visible = false;
      try { batcher.update(); three.render(scene, camera); }
      finally { batcher.restore(); for (const [node, wasVisible] of effects) node.visible = wasVisible; }
    } finally {
      three.setRenderTarget(oldTarget); three.setViewport(savedViewport); three.setScissor(savedScissor); three.setScissorTest(oldScissorTest); three.setClearColor(savedColor,oldAlpha);
    }
  };
  setPilot(pilotId, appearance); renderer.screenPasses.add(render);
  return {
    texture: target.texture, setPilot, resetView,
    get fixedParts() { return fixedParts.state; },
    get state() { return { pilotId: currentPilot, azimuth: orbit.theta, polar: orbit.phi, distance: orbit.radius, inspecting }; },
    rotate(dx, dy) {
      if (!dx && !dy) return;
      inspecting = true; orbit.theta -= dx * .009;
      orbit.phi = THREE.MathUtils.clamp(orbit.phi - dy * .007, .075, Math.PI - .075); cameraUpdate();
    },
    setVisible(value) { visible = value; if (!value) lastFrame = -1; },
    update(dt, reducedMotion = false) {
      if (!visible) return;
      elapsed += Math.max(0,Math.min(.05,dt));
      presentation.rotation.y = reducedMotion || inspecting ? 0 : Math.sin(elapsed*.25)*.06;
      presentation.position.y = reducedMotion || inspecting ? 0 : Math.sin(elapsed*.8)*.12;
      runtime.sample(elapsed); equipment?.update(elapsed,runtime);
    },
    destroy() { renderer.screenPasses.delete(render); batcher.destroy(); fixedParts.dispose(); equipment?.dispose(); runtime.dispose(); target.dispose(); scene.clear(); },
  };
}

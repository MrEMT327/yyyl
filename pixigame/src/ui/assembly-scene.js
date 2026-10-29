import * as T from 'three';
import { ConfigFighter } from '../three/aircraft/v34/aircraft/ConfigFighter.js';
import { fighterForPilot, instantiateFighterPackage } from '../three/aircraft/fighter-packages.js';
import { createKestrelEquipment } from '../three/aircraft/kestrel-equipment.js';
import { resolveAircraftSlots } from '../slot-demo/aircraft-slots.js';
import { itemAtSlot } from '../slot-demo/catalog.js';
import { createModuleGeometry } from '../slot-demo/module-geometry.js';
import { acquireFixedPartThumbnails } from './fixed-part-thumbnails.js';
import { createBlueprintSurface } from '../three/aircraft/blueprint-surface.js';

function disposeTree(group) {
  group.traverse(node => { node.geometry?.dispose(); node.material?.dispose(); });
  group.clear();
}

// Both the fitting preview and the inventory miniatures use the game's existing
// renderer. All geometry here is native Three; nothing creates a second canvas.
export function createAssemblyScene({ renderer, pilotId }) {
  const scene = new T.Scene(), mount = new T.Group();
  scene.environment = renderer.scene.environment; scene.environmentIntensity = .9;
  scene.add(mount, new T.HemisphereLight('#e9f4ff', '#677786', 1.8));
  const key = new T.DirectionalLight('#fff4e5', 3); key.position.set(-8, 16, -10); scene.add(key);
  const rim = new T.DirectionalLight('#b5d8e8', 2.6); rim.position.set(10, 4, 8); scene.add(rim);
  const fill = new T.DirectionalLight('#b5c9dd', 1.1); fill.position.set(4, -5, 10); scene.add(fill);
  const camera = new T.PerspectiveCamera(36, 600 / 425, .1, 150);
  const target = new T.WebGLRenderTarget(900, 638, { depthBuffer: true, samples: 2 });
  const cameraTarget = new T.Vector3(0, .2, -.65), orbit = new T.Spherical(32, .28, 0);
  const modules = new T.Group(), wiring = new T.Group(), pads = new T.Group(); scene.add(modules, wiring, pads);
  const mounted = new Map(), padMeshes = new Map();
  const thumbnailCache = acquireFixedPartThumbnails(renderer), thumbnails = new Map(thumbnailCache.textures);
  let runtime, equipment, blueprint, currentPilot, slots = [], current = {}, selected = 'W3';
  let visible = false, comparing = false, showSockets = true, elapsed = 0, dirty = true, lastFrame = -1, renderedFrames = 0;

  function cameraUpdate() {
    camera.position.setFromSpherical(orbit).add(cameraTarget); camera.lookAt(cameraTarget); camera.updateMatrixWorld(true); dirty = true;
  }
  function focus(id) {
    selected = id;
    for (const [slotId, pad] of padMeshes) {
      pad.material.color.set(slotId === id ? '#ffe5a2' : itemAtSlot(current, slotId)?.color || '#788ca0');
      pad.material.emissive.set(slotId === id ? '#765228' : '#000000');
    }
    dirty = true;
  }
  function apply(placements) {
    current = placements;
    for (const slot of slots) {
      const item = itemAtSlot(current, slot.id), previous = mounted.get(slot.id);
      let kit = previous;
      if (previous?.userData.itemId !== item?.id) { previous?.userData.dispose(); mounted.delete(slot.id); kit = null; }
      if (!item) continue;
      if (!kit) { kit = createModuleGeometry(item); modules.add(kit); mounted.set(slot.id, kit); }
      kit.position.fromArray(slot.position); kit.scale.setScalar(slot.scale);
      if (slot.kind === 'weapon' && slot.position[0] < 0) kit.scale.x *= -1;
    }
    disposeTree(wiring);
    const drawn = new Set();
    for (const slot of slots.filter(s => s.kind === 'connector')) {
      const item = itemAtSlot(current, slot.id); if (!item) continue;
      for (const id of slot.adjacent) {
        const edge = [slot.id, id].sort().join('-'); if (drawn.has(edge)) continue; drawn.add(edge);
        const a = new T.Vector3(...slot.position), b = new T.Vector3(...slots.find(s => s.id === id).position);
        a.y += .2; b.y += .15; const mid = a.clone().lerp(b, .5); mid.y = Math.max(a.y, b.y) + .18;
        const connected = Boolean(itemAtSlot(current, id));
        wiring.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3([a, a.clone().lerp(mid, .55), mid, b]), 16, connected ? .045 : .028, 6, false),
          new T.MeshStandardMaterial({ color: connected ? item.color : '#516774', emissive: connected ? item.color : '#142330', emissiveIntensity: connected ? .45 : 0, metalness: .65, roughness: .4 })));
      }
    }
    focus(selected);
  }
  function setPilot(id, placements = current) {
    if (id === currentPilot) { apply(placements); return; }
    blueprint?.dispose(); equipment?.dispose(); runtime?.dispose(); mount.clear(); currentPilot = id; elapsed = 0;
    const asset = instantiateFighterPackage(id), entry = fighterForPilot(id);
    equipment = createKestrelEquipment(asset);
    const span = Math.max(asset.view.bounds.max[0] - asset.view.bounds.min[0], asset.view.bounds.max[2] - asset.view.bounds.min[2]);
    mount.scale.setScalar(15.75509262084961 / span);
    runtime = new ConfigFighter({ scene: mount, asset, config: { ...entry.defaults, cruise: false, firing: false,
      altitude: 0, scale: 1, lightIntensity: 0, bodyFx: .1, surfaceGlow: .25, coreGlow: .3, weaponGlow: .16, trails: 0, particles: 0 }, globals: { glow: 1, particleCount: 0 } });
    runtime.flight = null; runtime.deck.visible = false; runtime.quality = 'low';
    runtime.poseAtTime = (_time, position, quaternion) => { position.set(0, 0, 0); quaternion.identity(); };
    runtime.veilKinematics = { pose: runtime.poseAtTime, socketAt: (_time, socket, out) => out.copy(socket), socketVelocity: (_time, _socket, out) => out.set(0, 0, 0) };
    for (const light of runtime.lights) light.object.removeFromParent();
    runtime.spawn(new T.Vector3()); runtime.sample(0); equipment?.update(0, runtime);
    slots = resolveAircraftSlots({ object3D: mount, runtime, fighterId: entry.slug }).filter(s=>s.kind==='weapon');
    blueprint = createBlueprintSurface(asset);
    new T.Box3().setFromObject(asset.solid).getCenter(cameraTarget);
    cameraUpdate();
    disposeTree(pads); padMeshes.clear();
    for (const slot of slots) {
      const pad = new T.Mesh(new T.CylinderGeometry(.56, .64, .18, 8), new T.MeshStandardMaterial({ color:0xb7eaff,emissive:0x225577,emissiveIntensity:.45,metalness:.25,roughness:.5 }));
      pad.scale.setScalar(slot.scale); pad.position.fromArray(slot.position); pad.position.y -= .15 * slot.scale;
      pads.add(pad); padMeshes.set(slot.id, pad);
    }
    apply(placements); dirty = true;
  }

  const color = new T.Color(), viewport = new T.Vector4(), scissor = new T.Vector4();
  function render(three) {
    if (!visible || (!dirty && Math.floor(elapsed * 30) === lastFrame)) return;
    const oldTarget = three.getRenderTarget(), alpha = three.getClearAlpha(), scissorTest = three.getScissorTest();
    three.getClearColor(color); three.getViewport(viewport); three.getScissor(scissor);
    try {
      three.setScissorTest(false); three.setClearColor(0, 0);
      three.setRenderTarget(target); three.clear(); runtime.prepareRender(camera); three.render(scene, camera);
      dirty = false; lastFrame = Math.floor(elapsed * 30); renderedFrames++;
    } finally {
      three.setRenderTarget(oldTarget); three.setViewport(viewport); three.setScissor(scissor); three.setScissorTest(scissorTest); three.setClearColor(color, alpha);
    }
  }
  setPilot(pilotId); cameraUpdate(); renderer.screenPasses.add(render);
  return {
    texture: target.texture, thumbnails, setPilot, apply, focus,
    get state() { return { pilotId: currentPilot, fighterId: fighterForPilot(currentPilot).slug, slots, mountedCount: mounted.size,
      logicalCount: Object.keys(current).length, distance: orbit.radius, polar: orbit.phi, azimuth: orbit.theta, thumbnailsReady: thumbnailCache.ready, renderedFrames }; },
    project(rect) {
      return slots.map(slot => {
        const p = new T.Vector3(...slot.position); p.y += .45; p.project(camera);
        return { id: slot.id, x: rect.x + (p.x * .5 + .5) * rect.width, y: rect.y + (-p.y * .5 + .5) * rect.height,
          visible: showSockets && !comparing && p.z > -1 && p.z < 1 && Math.abs(p.x) < .94 && Math.abs(p.y) < .9 };
      });
    },
    rotate(dx, dy) { orbit.theta -= dx * .009; orbit.phi = T.MathUtils.clamp(orbit.phi - dy * .007, .035, Math.PI / 2 + .16); cameraUpdate(); },
    zoom(factor) { orbit.radius = T.MathUtils.clamp(orbit.radius * factor, 15, 52); cameraUpdate(); },
    view(preset) { orbit.set(32, preset === 'top' ? .035 : .28, 0); cameraUpdate(); },
    setCompare(value) { comparing = value; modules.visible = wiring.visible = !value; pads.visible=showSockets&&!value;dirty = true; },
    setSockets(value) { showSockets = value; pads.visible=value&&!comparing;dirty=true; },
    setVisible(value) { if (value && !visible) dirty = true; visible = value; },
    update(dt) { if (visible) { elapsed += Math.max(0, Math.min(.05, dt)); runtime.sample(elapsed); equipment?.update(elapsed, runtime); } },
    destroy() {
      renderer.screenPasses.delete(render); mounted.forEach(kit => kit.userData.dispose()); disposeTree(wiring); disposeTree(pads);
      blueprint?.dispose(); equipment?.dispose(); runtime.dispose(); target.dispose(); thumbnailCache.release(); scene.clear();
    },
  };
}

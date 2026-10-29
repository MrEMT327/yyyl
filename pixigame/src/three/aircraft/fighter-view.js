import * as THREE from 'three';
import { Container } from '../display.js';
import { ConfigFighter } from './v34/aircraft/ConfigFighter.js';
import { makeBindings } from './v34/aircraft/Expressions.js';
import { fighterForPilot, instantiateFighterPackage } from './fighter-packages.js';
import { createKestrelEquipment } from './kestrel-equipment.js';
import { createFixedPartMounts } from '../../fixed-parts/mounts.js';

// V34's presentation defaults, independent of pilot statistics and weapons.
const VISUAL_OVERRIDES = {
  kestrel: {surfaceGlow:1.38,coreGlow:1.20,bodyFx:1.34,trailLength:1.08,weaponGlow:1.14},
  verdant: {surfaceGlow:1.14,coreGlow:1.38,bodyFx:1.22,trailLength:1.00,weaponGlow:1.10},
  crimson: {surfaceGlow:1.10,coreGlow:1.20,bodyFx:1.42,trailLength:1.08,weaponGlow:1.30},
  azure: {surfaceGlow:1.28,coreGlow:1.14,bodyFx:1.26,trailLength:1.14,weaponGlow:1.10},
  prism: {surfaceGlow:1.42,coreGlow:1.28,bodyFx:1.30,trailLength:1.16,weaponGlow:1.24},
  scarlet: {surfaceGlow:1.28,coreGlow:1.22,bodyFx:1.36,trailLength:1.14,weaponGlow:1.26},
  verdure: {surfaceGlow:1.26,coreGlow:1.44,bodyFx:1.28,trailLength:1.08,weaponGlow:1.18},
  bastion: {surfaceGlow:1.14,coreGlow:1.34,bodyFx:1.40,trailLength:1.12,weaponGlow:1.20},
  wraith: {surfaceGlow:1.30,coreGlow:1.14,bodyFx:1.22,trailLength:1.10,weaponGlow:1.04},
  auric: {surfaceGlow:1.24,coreGlow:1.50,bodyFx:1.32,trailLength:1.08,weaponGlow:1.20},
};

function supportClipping(material) {
  if (!material.isShaderMaterial || material.userData.fighterClipping) return;
  material.clipping = true;
  material.userData.fighterClipping = true;
  const main = /void\s+main\s*\(\s*\)\s*\{/;
  material.vertexShader = '#include <clipping_planes_pars_vertex>\n' + material.vertexShader.replace(main,
    '$&\n{\nvec4 mvPosition=modelViewMatrix*vec4(position,1.0);\n#include <clipping_planes_vertex>\n}\n');
  material.fragmentShader = '#include <clipping_planes_pars_fragment>\n' + material.fragmentShader.replace(main,
    '$&\n#include <clipping_planes_fragment>\n');
}

export function createFighterView({ pilotId = 'pilot-01', size = 22, nativeSpace = false } = {}) {
  const view = new Container();
  view._bounds = { x:-8*size, y:-8*size, width:16*size, height:16*size };
  const mount = new THREE.Group(), attitude = new THREE.Group();
  mount.rotation.x = nativeSpace ? 0 : Math.PI / 2;
  mount.scale.set(size, size, nativeSpace ? size : -size);
  mount.add(attitude); view.object3D.add(mount);
  const pose = {bank:0,pitch:0,roll:0};
  view.flightPose = pose;
  let runtime, equipment, appearance, time = 0, animationTime = 0, shielded = false, shieldStrength = 1, boost = false;
  let shieldNodes = [], shieldMaterials = [], shieldBindings = [];
  const visualMaterials = new Set();
  let cachedFixedParts = null, fixedPartsKey = '';
  const disposeFixedParts = () => {
    cachedFixedParts?.dispose();
    cachedFixedParts = null; fixedPartsKey = ''; view.fixedParts = null;
  };

  const prepareMaterials = () => {
    visualMaterials.clear();
    let preparedFrame = -1, preparedCamera;
    const prepare = (renderer, _scene, camera) => {
      if (preparedFrame === renderer.info.render.frame && preparedCamera === camera) return;
      preparedFrame = renderer.info.render.frame; preparedCamera = camera;
      runtime.prepareRender(camera);
    };
    runtime.group.traverse(object => {
      if (!object.material) return;
      object.onBeforeRender = prepare;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        visualMaterials.add(material);
        if (!nativeSpace) material.transparent = true;
        material.userData.preserveShaderOpacity = true;
        supportClipping(material);
        if (material.isShaderMaterial || material.blending === THREE.AdditiveBlending) object.userData.bloom = true;
      }
    });
  };

  view.setEquipment = next => {
    appearance = next;
    if (equipment?.setAppearance(next)) prepareMaterials();
    equipment?.update(animationTime, runtime);
  };

  view.setFixedParts = (loadout, presentation = {}) => {
    if (!loadout) {
      if (cachedFixedParts) cachedFixedParts.root.visible = false;
      view.fixedParts = null;
      return;
    }
    if (loadout.pilotId !== view.pilotId) throw Error('固定件快照与实战机型不一致');
    // Only geometry/seat identity matters here, not per-run damage or levels.
    // Keep one build per fighter view; changing equipment releases the old one.
    const key = JSON.stringify([loadout.pilotId, presentation.revision || '', ...[...loadout.weapons, ...loadout.connectors]
      .map(item => [item.itemId, item.slots])]);
    if (!cachedFixedParts || key !== fixedPartsKey) {
      disposeFixedParts();
      cachedFixedParts = createFixedPartMounts({ view, mount, attitude, runtime, loadout, geometryFactory: presentation.geometryFactory });
      fixedPartsKey = key;
    }
    view.fixedParts = cachedFixedParts;
    cachedFixedParts.root.visible = true;
    cachedFixedParts.update();
  };

  view.setPilot = id => {
    if (runtime && view.pilotId === id) return;
    disposeFixedParts();
    equipment?.dispose(); runtime?.dispose(); attitude.clear(); visualMaterials.clear(); animationTime = 0;
    const asset = instantiateFighterPackage(id), entry = fighterForPilot(id);
    equipment = createKestrelEquipment(asset);
    view.equipment = equipment;
    view.pilotId = id; view.fighterId = entry.slug;
    view.label = `${entry.slug}-three-model`;
    const span = Math.max(asset.view.bounds.max[0]-asset.view.bounds.min[0], asset.view.bounds.max[2]-asset.view.bounds.min[2]);
    attitude.scale.setScalar(15.75509262084961 / span);
    const config = {...entry.defaults, ...VISUAL_OVERRIDES[entry.slug], cruise:false, firing:false, altitude:0, scale:1, lightIntensity:0};
    runtime = new ConfigFighter({ scene:attitude, asset, config, globals:{glow:1,particleCount:1} });
    // Find the package's explicit protection shell, not hull accents that also
    // react to shield state. Keep immutable scales and re-evaluate its bindings
    // before each fade so neither opacity nor size can compound across frames.
    const shieldNodeIds = new Set(asset.effects.bindings.filter(binding =>
      binding.target.node && binding.property === 'visible'
      && binding.value?.[0] === 'config' && binding.value?.[1] === 'shield'
    ).map(binding => binding.target.node));
    shieldNodes = [...shieldNodeIds].map(id => {
      const object = asset.nodes.get(id);
      return { object, scale:object.scale.clone() };
    });
    const shellMaterials = new Set();
    for (const { object } of shieldNodes) object.traverse(node => {
      for (const material of node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : []) shellMaterials.add(material);
    });
    shieldMaterials = [...shellMaterials];
    const shieldMaterialIds = new Set([...asset.materials].filter(([, material]) => shellMaterials.has(material)).map(([id]) => id));
    shieldBindings = makeBindings(asset.effects.bindings.filter(binding =>
      shieldNodeIds.has(binding.target.node) || shieldMaterialIds.has(binding.target.material)
    ), asset.nodes, asset.materials);
    // The game supplies shared scene lighting. Zero-intensity demo lamps must
    // also leave the scene, or Three still compiles a light slot for every one.
    for (const light of runtime.lights) light.object.removeFromParent();
    // Player movement and banking come from the game's input. Package motion
    // remains in local aircraft space, including trails and cloth attachments.
    runtime.flight = null;
    runtime.poseAtTime = (_time, position, quaternion) => {position.set(0,0,0);quaternion.identity();};
    runtime.veilKinematics = {
      pose:runtime.poseAtTime,
      socketAt:(_time,socket,out)=>out.copy(socket),
      socketVelocity:(_time,_socket,out)=>out.set(0,0,0),
    };
    runtime.deck.visible = false;
    runtime.quality = 'low';
    runtime.spawn(new THREE.Vector3());
    view.runtime = runtime;
    if (appearance) equipment?.setAppearance(appearance);
    prepareMaterials();
    view.updateAircraft(time);
  };
  view.updateAircraft = (nextTime, options = {}) => {
    if (options.bank !== undefined) pose.bank = THREE.MathUtils.clamp(options.bank,-0.28,0.28);
    if (options.pitch !== undefined) pose.pitch = THREE.MathUtils.clamp(options.pitch,-0.06,0.06);
    if (options.roll !== undefined) pose.roll = Number.isFinite(options.roll) ? THREE.MathUtils.clamp(options.roll,-Math.PI*2,Math.PI*2) : 0;
    if (options.shielded !== undefined) shielded = options.shielded;
    if (options.shieldStrength !== undefined) shieldStrength = Number.isFinite(options.shieldStrength) ? THREE.MathUtils.clamp(options.shieldStrength,0,1) : 1;
    if (options.boost !== undefined) boost = options.boost;
    attitude.rotation.set(pose.pitch,0,pose.bank+pose.roll);
    view.fixedParts?.update();
    if (!runtime) return;
    runtime.config.shield = shielded; runtime.config.boost = boost;
    if (!options.poseOnly) {
      const next = Math.max(0, Number(nextTime) || 0);
      // New pilots start their cloth simulation now, without replaying the
      // previous pilot's entire session; tab wake-ups also have bounded work.
      animationTime += Math.max(0, Math.min(0.05, next - time));
      time = next;
      // Undo the prior frame's parent fade/tint before evaluating local
      // bindings; otherwise phase transparency compounds until the ship fades out.
      for (const material of visualMaterials) {
        if (material.userData.baseOpacity != null) material.opacity = material.userData.baseOpacity;
        if (material.color && material.userData.baseColor) material.color.copy(material.userData.baseColor);
      }
      runtime.sample(animationTime);
      equipment?.update(animationTime, runtime);
      // The display adapter applies parent opacity/tint after these animations.
      for (const material of visualMaterials) {
        material.userData.baseOpacity = material.opacity;
        if (material.color) (material.userData.baseColor ||= new THREE.Color()).copy(material.color);
      }
    }
    // Combat sends the final pose after the normal animation sample. Refresh
    // only this shell here, including pose-only updates and frozen animations.
    for (const update of shieldBindings) update(runtime.context);
    for (const material of shieldMaterials) if (material.uniforms?.uGain) material.uniforms.uGain.value *= shieldStrength;
    for (const { object, scale } of shieldNodes) object.scale.copy(scale).multiplyScalar(.94 + .06 * shieldStrength);
  };
  view._disposeVisuals = () => {disposeFixedParts();equipment?.dispose();runtime?.dispose();equipment=null;runtime=null;view.runtime=null;shieldNodes=[];shieldMaterials=[];shieldBindings=[];};
  view.setPilot(pilotId);
  return view;
}

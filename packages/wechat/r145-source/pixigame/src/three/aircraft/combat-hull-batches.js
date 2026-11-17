import {BufferAttribute, Group, LessEqualDepth, Material, Matrix4, Mesh, NormalBlending, StaticDrawUsage} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {cloneIndexedGeometry} from '../indexed-geometry.js';
import {captureHullSurface, createHullSurfacePalette, hullMaterialIndex, maxHullMaterialSlots} from './combat-hull-palette.js';

const transformedAttributes = new Set(['position', 'normal', 'tangent']);

function canMergeMaterial(material) {
  return material?.isMeshStandardMaterial && material.visible && !material.transparent &&
    material.opacity === 1 && !material.transmission && material.blending === NormalBlending &&
    material.depthTest && material.depthWrite && material.depthFunc === LessEqualDepth &&
    !material.alphaTest && !material.alphaHash && !material.alphaToCoverage && !material.displacementMap &&
    !material.polygonOffset && !material.stencilWrite && !material.wireframe && !material.clippingPlanes?.length &&
    material.onBeforeCompile === Material.prototype.onBeforeCompile;
}

function rememberPose(object) {
  return {
    object, parent: object.parent, order: object.renderOrder, auto: object.matrixAutoUpdate,
    position: object.position.clone(), rotation: object.quaternion.clone(), scale: object.scale.clone(),
    matrix: object.matrix.clone(), matches: false,
  };
}

function matchesPose(pose) {
  const {object, parent, order, auto, position, rotation, scale, matrix} = pose;
  return object.visible && object.matrixWorldAutoUpdate && object.parent === parent &&
    object.renderOrder === order && object.matrixAutoUpdate === auto &&
    (auto ? object.position.equals(position) && object.quaternion.equals(rotation) && object.scale.equals(scale) : object.matrix.equals(matrix));
}

// Batch the ordinary combat pose, keeping the authored model intact for
// mount placement, articulation, and the exhaust depth pass.
export function createCombatHullBatches(solid) {
  const candidates = new Map();
  const collect = (parent, transform) => {
    for (const object of parent.children) {
      if (!object.visible || !object.matrixWorldAutoUpdate) continue;
      if (object.isGroup) {
        if (object.renderOrder !== solid.renderOrder) continue;
        if (object.matrixAutoUpdate) object.updateMatrix();
        collect(object, new Matrix4().multiplyMatrices(transform, object.matrix));
        continue;
      }
      const {geometry, material} = object;
      if (!object.isMesh || object.isInstancedMesh || object.isSkinnedMesh || object.isBatchedMesh ||
          object.children.length || !canMergeMaterial(material) || Object.keys(geometry.morphAttributes).length) continue;
      const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b));
      const count = geometry.index?.count ?? geometry.attributes.position?.count;
      if (!count || geometry.drawRange.start || geometry.drawRange.count < count ||
          (geometry.index && geometry.index.usage !== StaticDrawUsage) ||
          attributes.some(([name, attribute]) => !attribute.isBufferAttribute || attribute.usage !== StaticDrawUsage ||
            (transformedAttributes.has(name) && !(attribute.array instanceof Float32Array)))) continue;
      if (object.matrixAutoUpdate) object.updateMatrix();
      const key = [object.renderOrder, object.layers.mask, object.castShadow, object.receiveShadow, object.frustumCulled];
      for (const [name, attribute] of attributes) key.push(name, attribute.array.constructor.name, attribute.itemSize, attribute.normalized, attribute.gpuType);
      const id = key.join('|');
      if (!candidates.has(id)) candidates.set(id, new Map());
      const layout = candidates.get(id);
      if (!layout.has(material)) layout.set(material, []);
      layout.get(material).push({object, matrix: new Matrix4().multiplyMatrices(transform, object.matrix)});
    }
  };
  collect(solid, new Matrix4());

  const group = new Group(), posesByObject = new Map(), batches = [];
  group.name = 'Combat hull batches';
  group.renderOrder = solid.renderOrder;
  const clusters = [];
  for (const layout of candidates.values()) {
    const compatible = [];
    // Opaque Three draws are sorted by material ID within each render order.
    for (const [material, parts] of [...layout].sort(([a], [b]) => a.id - b.id)) {
      let cluster = compatible.find(batch => batch.materials.size < maxHullMaterialSlots && batch.surface?.matches(material));
      if (!cluster) {
        const surface = parts[0].object.geometry.hasAttribute(hullMaterialIndex) ? null : captureHullSurface(material);
        cluster = {surface, entries: [], materials: new Map()};
        compatible.push(cluster);
      }
      cluster.materials.set(material, cluster.materials.size);
      cluster.entries.push(...parts);
    }
    clusters.push(...compatible);
  }
  for (const {entries, materials, surface} of clusters) {
    if (entries.length < 2) continue;
    const usePalette = materials.size > 1;
    const copies = entries.map(({object, matrix}) => {
      const copy = cloneIndexedGeometry(object.geometry, matrix);
      if (usePalette) {
        const indices = new Uint8Array(copy.attributes.position.count).fill(materials.get(object.material));
        copy.setAttribute(hullMaterialIndex, new BufferAttribute(indices, 1));
      }
      return copy;
    });
    const geometry = mergeGeometries(copies);
    for (const copy of copies) copy.dispose();
    if (!geometry) continue;
    const palette = usePalette ? createHullSurfacePalette(surface, [...materials.keys()]) : null;
    const sample = entries[0].object, mesh = new Mesh(geometry, palette?.material ?? sample.material);
    mesh.name = 'Combat batch/' + sample.material.name;
    mesh.renderOrder = sample.renderOrder;
    mesh.layers.mask = sample.layers.mask;
    mesh.castShadow = sample.castShadow;
    mesh.receiveShadow = sample.receiveShadow;
    mesh.frustumCulled = sample.frustumCulled;
    mesh.userData.triangleCategory = 'model';
    group.add(mesh);
    const poses = new Set();
    const originals = entries.map(({object}) => {
      for (let part = object; part !== solid; part = part.parent) {
        if (!posesByObject.has(part)) posesByObject.set(part, rememberPose(part));
        poses.add(posesByObject.get(part));
      }
      const {geometry} = object;
      const attributes = Object.entries(geometry.attributes).map(([name, attribute]) => [name, attribute, attribute.version]);
      return {object, material: object.material, geometry, attributes, index: geometry.index, indexVersion: geometry.index?.version, count: geometry.drawRange.count};
    });
    batches.push({mesh, palette, originals, poses: [...poses]});
  }
  if (!batches.length) return null;

  const matchesDraw = (entry, mesh) => {
    const {object, material, geometry, attributes, index, indexVersion, count} = entry;
    return object.geometry === geometry && object.material === material && object.children.length === 0 &&
      object.layers.mask === mesh.layers.mask && object.castShadow === mesh.castShadow &&
      object.receiveShadow === mesh.receiveShadow && object.frustumCulled === mesh.frustumCulled &&
      geometry.index === index && index?.version === indexVersion &&
      !geometry.drawRange.start && geometry.drawRange.count === count &&
      attributes.every(([name, attribute, version]) => geometry.attributes[name] === attribute && attribute.version === version);
  };
  return {
    render(draw) {
      if (!solid.visible || solid.renderOrder !== group.renderOrder || group.parent) return draw();
      for (const pose of posesByObject.values()) pose.matches = matchesPose(pose);
      let active = false;
      for (const {mesh, palette, originals, poses} of batches) {
        mesh.visible = poses.every(pose => pose.matches) && originals.every(entry => matchesDraw(entry, mesh)) &&
          (palette ? palette.ready() : canMergeMaterial(mesh.material));
        if (mesh.visible) {
          palette?.update();
          active = true;
          for (const {object} of originals) object.visible = false;
        }
      }
      if (!active) return draw();
      group.layers.mask = solid.layers.mask;
      try {
        solid.add(group);
        return draw();
      } finally {
        group.removeFromParent();
        for (const {mesh, originals} of batches) if (mesh.visible) {
          for (const {object} of originals) object.visible = true;
        }
      }
    },
    dispose() {
      for (const {mesh, palette} of batches) {
        mesh.geometry.dispose();
        palette?.material.dispose();
      }
    },
  };
}

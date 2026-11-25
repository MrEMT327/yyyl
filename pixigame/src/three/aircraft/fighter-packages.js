import { addAircraftDetails } from './aircraft-details.js';
import { DoubleSide } from 'three';
import { refineAircraftMaterials } from './premium-finish.js';
import { softenArmorSeams } from './armor-seams.js';
import catalog from './v34/catalog.json' with { type: 'json' };
import gameLod from './game-lod-catalog.json' with { type: 'json' };
import { loadPackage, applyMaterialPatches } from './v34/aircraft/PackageLoader.js';
import {PILOT_FIGHTERS} from './aircraft-roster.js';
export {PILOT_FIGHTERS} from './aircraft-roster.js';

export const FIGHTER_CATALOG = Object.freeze(catalog);
export function fighterForPilot(pilotId) {
  const slug = PILOT_FIGHTERS[pilotId] || PILOT_FIGHTERS['pilot-01'];
  return catalog.find(entry => entry.slug === slug);
}

const packages = new Map();
export function isFighterPackageReady(pilotId) {
  return Boolean(packages.get(fighterForPilot(pilotId).slug)?.asset);
}

function requestPackage(entry, { read, skipTextures, allowTextureFallback, objectLoader, assetBase, assetBytes, makeAbort }) {
  const cached = packages.get(entry.slug);
  if (cached) return cached;
  const controller = makeAbort?.();
  const record = { slug: entry.slug, owners: 0, persistent: false, controller, asset: null, ready: null };
  packages.set(entry.slug, record);
  const derived = gameLod.entries[entry.slug];
  // A newly imported source cannot silently receive an older geometry LOD.
  const useGameLod = derived?.sourceManifestHash === entry.manifestHash;
  record.ready = loadPackage(useGameLod ? { ...entry, manifestHash: derived.manifestHash } : entry, {
    manifestFile: useGameLod ? 'game-lod-manifest.json' : 'manifest.json',
    skipTextures, allowTextureFallback, objectLoader, assetBytes, signal: controller?.signal,
    read: async (name, _url, signal, expectedHash) => {
      if (read) return read(entry.slug, name, signal);
      const base = assetBase || new URL(import.meta.env.BASE_URL, document.baseURI);
      const url = new URL(`fighters/${entry.slug}/${name}`, base);
      // Content-addressed requests can reuse the browser cache across the
      // lobby and battle iframe without mixing imported package revisions.
      url.searchParams.set('v', expectedHash || entry.manifestHash);
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error(`战机资源加载失败：${entry.name}/${name} (${response.status})`);
      return response.arrayBuffer();
    },
  }).then(asset => {
    if (packages.get(entry.slug) !== record) {
      asset.dispose();
      throw Object.assign(new Error('战机预览已关闭'), {name:'AbortError'});
    }
    record.asset = asset;
    return asset;
  }).catch(error => {
    if (packages.get(entry.slug) === record) packages.delete(entry.slug);
    throw error;
  });
  return record;
}

function releaseOwner(record) {
  if (--record.owners || record.persistent || packages.get(record.slug) !== record) return;
  packages.delete(record.slug);
  if (record.asset) record.asset.dispose();
  else record.controller?.abort();
}

// Browser tools can preload the whole roster and instantiate it much later.
export function loadFighterPackages(options = {}) {
  const entries = options.pilotIds ? [...new Set(options.pilotIds.map(fighterForPilot))] : catalog;
  return Promise.all(entries.map(entry => {
    const record = requestPackage(entry, options);
    record.persistent = true;
    return record.ready;
  }));
}

// Each native preview (and the sortie) holds just its current selection.
// Live instances also own a reference to their shared geometry and textures.
export function createFighterPackageSelection(options) {
  let current;
  function release() {
    if (!current) return;
    const previous = current;
    current = null;
    releaseOwner(previous);
  }
  return { release, load(pilotId, overrides) {
    const entry = fighterForPilot(pilotId);
    if (current?.slug === entry.slug && packages.get(entry.slug) === current) return current.ready;
    release();
    current = requestPackage(entry, { ...options, ...overrides });
    current.owners++;
    return current.ready;
  }};
}

// Hardware and textures remain immutable in the cache. Each preview/combat
// instance owns its animation targets, materials and writable effect buffers.
export function instantiateFighterPackage(pilotId) {
  const entry = fighterForPilot(pilotId), record = packages.get(entry.slug), template = record?.asset;
  if (!template) throw new Error(`战机资源尚未加载：${entry.name}`);
  const nodes = new Map(), materials = new Map(), geometries = new Map();
  const texturesOf = material => [
    ...Object.values(material), ...Object.values(material.uniforms || {}).map(uniform => uniform.value),
  ].filter(value => value?.isTexture);
  const sharedTextures = new Set([...template.materials.values()].flatMap(texturesOf));
  const dynamicNodes = new Set((template.effects.attributeBindings || []).map(binding => binding.node));
  const copyMaterial = material => {
    if (!materials.has(material.uuid)) materials.set(material.uuid, material.clone());
    return materials.get(material.uuid);
  };
  function cloneTree(source, dynamic = false) {
    const copy = source.clone(false);
    // Retain package-local IDs so named engine sockets and animation bindings
    // survive model batching. Three's numeric object IDs remain instance-local.
    copy.uuid = source.uuid;
    nodes.set(source.uuid, copy);
    if (source.material) copy.material = Array.isArray(source.material)
      ? source.material.map(copyMaterial) : copyMaterial(source.material);
    if (source.geometry && (dynamic || dynamicNodes.has(source.uuid))) {
      if (!geometries.has(source.geometry)) geometries.set(source.geometry, source.geometry.clone());
      copy.geometry = geometries.get(source.geometry);
    }
    for (const child of source.children) copy.add(cloneTree(child, dynamic));
    return copy;
  }
  const solid = cloneTree(template.solid), fx = cloneTree(template.fx, true);
  applyMaterialPatches(template.effects.materialPatches, materials);
  for (const patch of template.effects.materialPatches) materials.get(patch.material).userData.nativeBatchExclude = true;
  const cleanSurface = Number(entry.version.split('.')[0]) >= 39;
  solid.userData.cleanAircraftSurface = cleanSurface;
  if (cleanSurface) for (const material of materials.values()) material.userData.cleanAircraftSurface = true;
  // V39 armor includes open sheets (notably the wing's structural airfoil).
  // Their reverse side must remain visible when orbiting below the aircraft
  // or looking across it on the lift. Do not turn jets/glass into two-pass FX
  // or change the immutable package's material/geometry buffers.
  if (cleanSurface) solid.traverse(node => {
    for (const material of [].concat(node.material || [])) {
      if (material.isMeshStandardMaterial && !material.transparent && material.opacity === 1)
        material.side = DoubleSide;
    }
  });
  // V39 authors its own surface treatment. Reapplying legacy service panels,
  // nozzle petals and analytic engraving would undo the clean-hull revision.
  if (!cleanSurface) refineAircraftMaterials({ entry, materials, view:template.view });
  const detailKit=cleanSurface ? null : addAircraftDetails({entry,materials,solid,nodes,view:template.view,effects:template.effects});
  const seamTreatment=softenArmorSeams({entry,solid,materials});
  let disposed = false;
  record.owners++;
  return {
    entry, manifest: template.manifest, view: template.view, effects: template.effects,
    solid, fx, nodes, materials,
    dispose() {
      if (disposed) return;
      disposed = true;
      detailKit?.dispose();
      seamTreatment?.dispose();
      for (const node of nodes.values()) if (node.isInstancedMesh) node.dispose();
      for (const geometry of geometries.values()) geometry.dispose();
      const ownedTextures = new Set([...materials.values()].flatMap(texturesOf).filter(texture => !sharedTextures.has(texture)));
      for (const texture of ownedTextures) texture.dispose();
      for (const material of materials.values()) material.dispose();
      solid.removeFromParent(); fx.removeFromParent(); nodes.clear(); materials.clear();
      releaseOwner(record);
    },
  };
}

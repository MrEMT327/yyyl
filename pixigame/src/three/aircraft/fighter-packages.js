import { addAircraftDetails } from './aircraft-details.js';
import { refineAircraftMaterials } from './premium-finish.js';
import catalog from './v34/catalog.json' with { type: 'json' };
import { loadPackage, applyMaterialPatches } from './v34/aircraft/PackageLoader.js';

export const PILOT_FIGHTERS = Object.freeze({
  'pilot-01': 'kestrel',
  'pilot-02': 'verdant',
  'pilot-03': 'crimson',
  'pilot-04': 'azure',
  'pilot-05': 'wraith',
  'pilot-06': 'scarlet',
  'pilot-07': 'verdure',
  'pilot-08': 'prism',
  'pilot-09': 'bastion',
  'pilot-10': 'auric',
});
export const FIGHTER_CATALOG = Object.freeze(catalog);
export function fighterForPilot(pilotId) {
  const slug = PILOT_FIGHTERS[pilotId] || PILOT_FIGHTERS['pilot-01'];
  return catalog.find(entry => entry.slug === slug);
}

const templates = new Map();
const pending = new Map();
export function isFighterPackageReady(pilotId) {
  return templates.has(fighterForPilot(pilotId).slug);
}
// Old galleries can still request the complete catalog. The game requests only
// the aircraft it is about to display; concurrent requests share one load.
export function loadFighterPackages({ read, skipTextures = false, pilotIds } = {}) {
  const entries = pilotIds ? [...new Set(pilotIds.map(id => fighterForPilot(id)))] : catalog;
  return Promise.all(entries.map(entry => {
    if (templates.has(entry.slug)) return templates.get(entry.slug);
    if (pending.has(entry.slug)) return pending.get(entry.slug);
    const request = loadPackage(entry, {
      skipTextures,
      read: async (name, _url, signal) => {
        if (read) return read(entry.slug, name);
        const base = import.meta.env.BASE_URL;
        const response = await fetch(`${base}fighters/${entry.slug}/${name}`, { signal });
        if (!response.ok) throw new Error(`战机资源加载失败：${entry.name}/${name} (${response.status})`);
        return response.arrayBuffer();
      },
    }).then(asset => { templates.set(entry.slug, asset); return asset; })
      .finally(() => pending.delete(entry.slug));
    pending.set(entry.slug, request);
    return request;
  }));
}

// Hardware and textures remain immutable in the cache. Each preview/combat
// instance owns its animation targets, materials and writable effect buffers.
export function instantiateFighterPackage(pilotId) {
  const entry = fighterForPilot(pilotId), template = templates.get(entry.slug);
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
  refineAircraftMaterials({ entry, materials, view:template.view });
  const detailKit=addAircraftDetails({entry,materials,solid,nodes,view:template.view,effects:template.effects});
  let disposed = false;
  return {
    entry, manifest: template.manifest, view: template.view, effects: template.effects,
    solid, fx, nodes, materials,
    dispose() {
      if (disposed) return;
      disposed = true;
      detailKit.dispose();
      for (const node of nodes.values()) if (node.isInstancedMesh) node.dispose();
      for (const geometry of geometries.values()) geometry.dispose();
      const ownedTextures = new Set([...materials.values()].flatMap(texturesOf).filter(texture => !sharedTextures.has(texture)));
      for (const texture of ownedTextures) texture.dispose();
      for (const material of materials.values()) material.dispose();
      solid.removeFromParent(); fx.removeFromParent(); nodes.clear(); materials.clear();
    },
  };
}

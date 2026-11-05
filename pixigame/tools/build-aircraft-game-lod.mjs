// Offline only: derive game geometry from verified authoring packages. No
// simplifier/WASM ships in the game and original V39 files are never rewritten.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'three/addons/libs/meshopt_simplifier.module.js';
import { hydrateBuffers } from '../src/three/aircraft/v34/aircraft/buffers.js';

const root = new URL('../', import.meta.url);
const catalog = JSON.parse(await fs.readFile(new URL('src/three/aircraft/v34/catalog.json', root)));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const relativeError = .0006; // ~0.36 px at a 600 px full-airframe span.
const targetRatio = .15; // Stop earlier whenever seams/error prevent reduction.
const output = { schema: 1, relativeError, targetRatio, entries: {} };
const checkOnly = process.argv.includes('--check');
async function publish(url, bytes) {
  if (!checkOnly) return fs.writeFile(url, bytes);
  const current = await fs.readFile(url);
  if (sha(current) !== sha(bytes)) throw new Error(`Stale game LOD: ${url.pathname}; run npm run assets:aircraft-lod`);
}
await MeshoptSimplifier.ready;

function compact(geometry, indices) {
  const remap = new Map(), order = [];
  for (const index of indices) if (!remap.has(index)) { remap.set(index, order.length); order.push(index); }
  const IndexArray = order.length > 65535 ? Uint32Array : Uint16Array;
  const data = { index: { type: IndexArray.name, array: IndexArray.from(indices, index => remap.get(index)) }, attributes: {} };
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const array = new attribute.array.constructor(order.length * attribute.itemSize);
    order.forEach((old, next) => array.set(attribute.array.subarray(old * attribute.itemSize, (old + 1) * attribute.itemSize), next * attribute.itemSize));
    data.attributes[name] = { itemSize: attribute.itemSize, type: array.constructor.name, array, normalized: attribute.normalized };
  }
  return data;
}

function pack(documents) {
  const chunks = []; let offset = 0;
  function visit(value) {
    if (ArrayBuffer.isView(value)) {
      const alignment = Math.max(4, value.BYTES_PER_ELEMENT);
      const padding = (alignment - offset % alignment) % alignment;
      if (padding) { chunks.push(Buffer.alloc(padding)); offset += padding; }
      const descriptor = { buffer: 'buffers.bin', type: value.constructor.name, byteOffset: offset, length: value.length };
      const bytes = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
      chunks.push(bytes); offset += bytes.length;
      return descriptor;
    }
    if (Array.isArray(value)) return value.map(visit);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, visit(v)]));
    return value;
  }
  return { documents: documents.map(visit), buffer: Buffer.concat(chunks) };
}

for (const entry of catalog.filter(entry => Number(entry.version.split('.')[0]) >= 39)) {
  const base = new URL(`public/fighters/${entry.slug}/`, root);
  const sourceManifest = await fs.readFile(new URL('manifest.json', base));
  if (sha(sourceManifest) !== entry.manifestHash) throw new Error(`${entry.slug}: source manifest mismatch`);
  const manifest = JSON.parse(sourceManifest), verified = {};
  for (const [name, hash] of Object.entries(manifest.hashes)) {
    verified[name] = await fs.readFile(new URL(name, base));
    if (sha(verified[name]) !== hash) throw new Error(`${entry.slug}/${name}: source checksum mismatch`);
  }
  const structure = JSON.parse(verified[manifest.files.structure]), effects = JSON.parse(verified[manifest.files.effects]);
  const bytes = verified[manifest.files.buffers], buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  hydrateBuffers(structure, buffer); hydrateBuffers(effects, buffer);
  const view = JSON.parse(verified[manifest.files.view]);
  const span = Math.max(...view.bounds.max.map((v, i) => v - view.bounds.min[i]));
  const scales = new Map(), protectedGeometry = new Set();
  const dynamicNodes = new Set((effects.attributeBindings || []).map(binding => binding.node));
  const shaderMaterials = new Set(structure.scene.materials.filter(m => m.type === 'ShaderMaterial' || m.type === 'RawShaderMaterial').map(m => m.uuid));
  function visit(node, parent) {
    const matrix = parent.clone().multiply(new THREE.Matrix4().fromArray(node.matrix));
    if (node.geometry) {
      scales.set(node.geometry, Math.max(scales.get(node.geometry) || 0, matrix.getMaxScaleOnAxis()));
      if (dynamicNodes.has(node.uuid) || node.type !== 'Mesh' || [].concat(node.material).some(id => shaderMaterials.has(id))) protectedGeometry.add(node.geometry);
    }
    for (const child of node.children || []) visit(child, matrix);
  }
  visit(structure.scene.object, new THREE.Matrix4());
  let before = 0, after = 0, changed = 0, maximumError = 0;
  for (const spec of structure.scene.geometries) {
    const source = new THREE.BufferGeometryLoader().parse(spec);
    const count = source.index?.count ?? source.attributes.position.count;
    before += count / 3;
    if (count < 180 || protectedGeometry.has(spec.uuid) || Object.keys(source.morphAttributes).length) { after += count / 3; source.dispose(); continue; }
    const geometry = mergeVertices(source, 1e-6), n = geometry.attributes.position.count;
    const attributes = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) attributes[i * 5 + k] = geometry.attributes.normal?.array[i * 3 + k] ?? 0;
      for (let k = 0; k < 2; k++) attributes[i * 5 + 3 + k] = geometry.attributes.uv?.array[i * 2 + k] ?? 0;
    }
    const scale = scales.get(spec.uuid) || 1;
    const [indices, error] = MeshoptSimplifier.simplifyWithAttributes(geometry.index.array, geometry.attributes.position.array, 3,
      attributes, 5, [.01, .01, .01, .01, .01], null, Math.floor(count * targetRatio / 3) * 3,
      span * relativeError / scale, ['LockBorder', 'ErrorAbsolute']);
    if (!indices.length || error * scale / span > relativeError + 1e-7) throw new Error(`${entry.slug}: invalid simplification`);
    if (indices.length < count) { spec.data = compact(geometry, indices); changed++; }
    after += Math.min(count, indices.length) / 3;
    maximumError = Math.max(maximumError, error * scale / span);
    geometry.dispose(); source.dispose();
  }
  const packed = pack([structure, effects]);
  const files = {
    'game-lod-structure.json': Buffer.from(JSON.stringify(packed.documents[0])),
    'game-lod-effects.json': Buffer.from(JSON.stringify(packed.documents[1])),
    'game-lod-buffers.bin': packed.buffer,
  };
  const gameManifest = { ...manifest,
    files: { ...manifest.files, structure: 'game-lod-structure.json', effects: 'game-lod-effects.json', buffers: 'game-lod-buffers.bin' },
    hashes: { ...manifest.hashes },
    stats: { ...manifest.stats, model: after, total: manifest.stats.total - before + after, submitted: manifest.stats.submitted - before + after },
    gameLod: { sourceManifestHash: entry.manifestHash, relativeError, maximumError, targetRatio, originalTriangles: before, triangles: after, changedGeometries: changed },
  };
  for (const name of [manifest.files.structure, manifest.files.effects, manifest.files.buffers]) delete gameManifest.hashes[name];
  for (const [name, data] of Object.entries(files)) { gameManifest.hashes[name] = sha(data); await publish(new URL(name, base), data); }
  const encoded = Buffer.from(JSON.stringify(gameManifest, null, 2) + '\n');
  await publish(new URL('game-lod-manifest.json', base), encoded);
  output.entries[entry.slug] = { sourceManifestHash: entry.manifestHash, manifestHash: sha(encoded), ...gameManifest.gameLod, originalBufferBytes: bytes.length, bufferBytes: packed.buffer.length };
  console.log(`${entry.slug}: ${before} -> ${after} triangles; ${bytes.length} -> ${packed.buffer.length} buffer bytes`);
}
await publish(new URL('src/three/aircraft/game-lod-catalog.json', root), JSON.stringify(output, null, 2) + '\n');

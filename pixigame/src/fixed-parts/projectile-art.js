import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FIXED_WEAPON_PROFILES, ORIGINAL_VIEW_HEIGHT } from './weapon-profiles.js';
import { ZBBY_ARSENAL } from './zbby-arsenal.js';
import { PROJECTILE_DISPLAY_SCALE } from './projectile-style.js';
import { createProjectileMaterial } from './projectile-material.js';
import { createHostileProjectileParts, HOSTILE_PROJECTILE_COLOR, HOSTILE_PROJECTILE_HALF_SIZE, HOSTILE_PROJECTILE_RIM } from './hostile-projectile-material.js';
import { loadCommonWeaponModels } from '../three/common-weapon-models.js';

const templates = new Map();
const modelBounds = new Map();
let loading;
export const projectileAssets = { ready: false, error: null, source: 'Blender / GLB', models: 0 };
export function loadFixedProjectileArt() {
  if (loading) return loading;
  projectileAssets.error = null;
  const base = import.meta.env?.BASE_URL || '/';
  const loader = new GLTFLoader();
  loading = Promise.all(['twin', 'rail', 'missile', 'hostile', 'plasma', 'siege', 'blade', 'drone',...Object.keys(ZBBY_ARSENAL).filter(id=>!ZBBY_ARSENAL[id].beam)].map(async kind => {
    if (kind === 'hostile') return [kind, createHostileProjectileParts()];
    const gltf = await loader.loadAsync(`${base}assets/ordnance/${kind}.glb`);
    const parts = [];
    gltf.scene.updateMatrixWorld(true);
    const axis = new T.Matrix4().makeRotationX(Math.PI / 2);
    gltf.scene.traverse(node => {
      if (!node.isMesh) return;
      const geometry = node.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(axis, node.matrixWorld));
      const material = createProjectileMaterial(node.material);
      const glowing = material.emissiveIntensity > 1;
      parts.push({ geometry, material, glowing });
    });
    // Install the set only after every asset succeeds, including retries.
    return [kind, parts];
  })).then(async entries => {
    await loadCommonWeaponModels();
    for (const [kind, parts] of entries) {
      templates.set(kind, parts);
      // Use actual mesh vertices in the collision plane, including rotated parts.
      let halfWidth = 0, minY = Infinity, maxY = -Infinity;
      for (const part of parts) {
        const positions = part.geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const x = positions.getX(i), y = positions.getY(i);
          halfWidth = Math.max(halfWidth, Math.abs(x));
          minY = Math.min(minY,y); maxY = Math.max(maxY,y);
        }
      }
      modelBounds.set(kind, {halfWidth,minY,maxY});
    }
    projectileAssets.ready = true;
    projectileAssets.models = templates.size;
  }).catch(error => {
    projectileAssets.error = String(error);
    loading = null;
    throw error;
  });
  return loading;
}

export function attachFixedProjectileArt(b, shot, height) {
  const kind = shot.missile ? 'missile' : shot.rail ? 'rail' : 'twin';
  const profile = FIXED_WEAPON_PROFILES[kind];
  const worldScale = height / ORIGINAL_VIEW_HEIGHT;
  const width = shot.radius / (profile.radius * worldScale);
  b.view.clear();
  b.view.scale.set(1);
  b.view.tint = 0xffffff;
  b.view.bloom = false;
  // Per shot, never per pooled bullet: old trails finish after pool reuse.
  b.artModel = {
    kind, owner: b, scaleX: width, scaleY: 1, fitCollision: true,
    color: b.fixedGuided ? 0xb7a3ff : kind === 'rail' ? 0x8ccfff : 0xffba72,
    points: [], smokeAt: 0,
  };
}

// Rendering and root-projectile collision share the same fitted mesh bounds.
export function syncFixedProjectileShape(b) {
  const art = b.artModel, bounds = modelBounds.get(art?.kind);
  if (!art?.fitCollision || !bounds) return;
  const sx = art.scaleX * 1.1 * PROJECTILE_DISPLAY_SCALE, sy = art.scaleY * 1.1 * PROJECTILE_DISPLAY_SCALE;
  const radius = Math.min(bounds.halfWidth*sx, (bounds.maxY-bounds.minY)*sy*.5);
  b.fixedShape = {radius,front:Math.max(0,-bounds.minY*sy-radius),back:Math.max(0,bounds.maxY*sy-radius)};
  b.fixedShapeBound = Math.max(b.fixedShape.front,b.fixedShape.back) + radius;
}

export function attachHostileProjectileArt(b) {
  b.view.clear();
  b.artModel = { kind: 'hostile', owner: b, scaleX: 1, scaleY: 1, color: HOSTILE_PROJECTILE_COLOR, points: [], smokeAt: 0 };
}

export function detachProjectileArt(b) {
  if (b.artModel) b.artModel.owner = null;
  b.artModel = null;
}

// One instance batch per GLB material; only emissive inserts enter bloom.
export class OrdnanceInstances {
  constructor(root, capacity = 1024) {
    this.root = root;
    this.capacity = capacity;
    this.batches = new Map();
    this.matrix = new T.Matrix4();
    this.position = new T.Vector3();
    this.scale = new T.Vector3();
    this.rotation = new T.Quaternion();
    this.axis = new T.Vector3(0, 0, 1);
    this.color = new T.Color();
    this.count = 0;
  }
  begin() {
    this.count = 0;
    for (const meshes of this.batches.values()) for (const mesh of meshes) mesh.count = 0;
  }
  ensure(kind) {
    if (!this.batches.has(kind) && projectileAssets.ready) {
      const parts = templates.get(kind);
      if (parts) {
        this.batches.set(kind, parts.map(part => {
          const mesh = new T.InstancedMesh(part.geometry, part.material, this.capacity);
          mesh.name = `Blender ${kind}: ${part.material.name}`;
          mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
          mesh.frustumCulled = false;
          mesh.count = 0;
          mesh.visible = false;
          mesh.userData.bloom = part.glowing;
          if (part.glowing || kind === 'hostile') {
            mesh.instanceColor = new T.InstancedBufferAttribute(
              new Float32Array(this.capacity * 3).fill(1), 3,
            ).setUsage(T.DynamicDrawUsage);
          }
          this.root.add(mesh);
          return mesh;
        }));
      }
    }
  }
  add(b) {
    if(b.artModel)this.ensure(b.artModel.kind);
    const art = b.artModel, meshes = this.batches.get(art?.kind);
    if (!meshes || meshes[0].count >= this.capacity) return;
    const index = meshes[0].count;
    const hostile = art.kind === 'hostile';
    const scale = hostile ? b.radius / (HOSTILE_PROJECTILE_HALF_SIZE * HOSTILE_PROJECTILE_RIM) : 1.1*PROJECTILE_DISPLAY_SCALE;
    // Match the existing projectile model; damage-only upgrades do not resize it.
    if (art.fitCollision) syncFixedProjectileShape(b);
    this.position.set(b.x, b.y, 2);
    this.rotation.setFromAxisAngle(this.axis, art.kind === 'hostile' ? Math.atan2(b.vy,b.vx)-Math.PI/2 : (art.rotation ?? Math.atan2(b.vx, -b.vy)));
    this.scale.set(art.scaleX * scale, art.scaleY * scale, art.scaleX * scale);
    this.matrix.compose(this.position, this.rotation, this.scale);
    this.color.set(art.color ?? 0xffffff);
    for (const mesh of meshes) {
      mesh.setMatrixAt(index, this.matrix);
      if (mesh.instanceColor) mesh.setColorAt(index, this.color);
      mesh.count++;
    }
    this.count++;
  }
  finish() {
    for (const meshes of this.batches.values()) for (const mesh of meshes) {
      mesh.visible = mesh.count > 0;
      if (!mesh.visible) continue;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0,mesh.count*16);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0,mesh.count*3);
        mesh.instanceColor.needsUpdate = true;
      }
    }
  }
  dispose() {
    for (const meshes of this.batches.values()) for (const mesh of meshes) {
      mesh.removeFromParent(); mesh.dispose();
    }
    this.batches.clear(); this.count = 0;
  }
}

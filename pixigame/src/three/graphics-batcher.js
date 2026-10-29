import * as THREE from 'three';

// Merge adjacent compatible flat Graphics without moving them across another
// visual. Keep vertex order, blend mode and bloom layer boundaries intact.
export class GraphicsBatcher {
  constructor() {
    this.layers = new Map();
    this.hidden = [];
    this.matrix = new THREE.Matrix4();
    this.stats = { sources: 0, batches: 0, savedDraws: 0 };
  }
  restore() {
    for (const mesh of this.hidden) mesh.visible = true;
    this.hidden.length = 0;
    for (const batches of this.layers.values()) for (const batch of batches) batch.visible = false;
  }
  candidate(node) {
    if (!node.isFlatGraphics || node.children.length || node._meshes.length !== 1) return null;
    const mesh = node._meshes[0], mat = mesh.material, geo = mesh.geometry;
    if (!mesh.visible || !geo.drawRange.count || geo.index || !geo.attributes.color
      || !mat.isMeshBasicMaterial || !mat.vertexColors || mat.map || mat.depthTest || mat.depthWrite
      || mat.userData.colorTransform || mat.clippingPlanes?.length || mat.alphaTest
      || mat.side !== THREE.DoubleSide || !mat.forceSinglePass || !mat.transparent
      || ![THREE.NormalBlending, THREE.AdditiveBlending].includes(mat.blending)) return null;
    return { node, mesh, key: `${mat.blending}:${mesh.layers.mask}` };
  }
  update(layers, bloomEnabled = true) {
    this.stats = { sources: 0, batches: 0, savedDraws: 0 };
    for (const layer of layers) {
      if (!layer.visible || !layer.renderable) continue;
      let batches = this.layers.get(layer);
      if (!batches) this.layers.set(layer, batches = []);
      let used = 0, group = [], key;
      const flush = () => {
        if (group.length > 1) {
          let batch = batches[used];
          if (!batch) {
            batch = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
              vertexColors: true, transparent: true, toneMapped: false,
              depthTest: false, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true,
            }));
            batch.frustumCulled = false;
            batch.userData.graphicsBatch = true;
            layer.object3D.add(batch);
            batches[used] = batch;
          }
          used++;
          this.write(batch, group);
          this.stats.sources += group.length;
          this.stats.batches++;
          this.stats.savedDraws += (group.length - 1) * ((bloomEnabled && (group[0].mesh.layers.mask & 2)) ? 2 : 1);
        }
        group = [];
      };
      const children = layer.sortableChildren ? [...layer.children].sort((a,b) => a.zIndex-b.zIndex) : layer.children;
      for (const node of children) {
        if (!node.object3D.visible) continue;
        const candidate = this.candidate(node);
        if (!candidate) { flush(); key = null; continue; }
        if (candidate.key !== key) { flush(); key = candidate.key; }
        group.push(candidate);
      }
      flush();
      // Retain idle capacity for fluctuating particle counts; release on destroy.
      for (let i = used; i < batches.length; i++) batches[i].visible = false;
    }
  }
  write(batch, group) {
    const count = group.reduce((n, {mesh}) => n + mesh.geometry.drawRange.count, 0);
    let geo = batch.geometry;
    if (count > (geo.attributes.position?.count || 0)) {
      geo.dispose();
      geo = batch.geometry = new THREE.BufferGeometry();
      const capacity = Math.max(128, 2 ** Math.ceil(Math.log2(count)));
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity*3),3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage));
    }
    const positions = geo.attributes.position.array, colors = geo.attributes.color.array;
    let offset = 0;
    for (const {node,mesh} of group) {
      if (mesh.matrixAutoUpdate) mesh.updateMatrix();
      const e = this.matrix.copy(node.object3D.matrix).multiply(mesh.matrix).elements;
      const source = mesh.geometry, p = source.attributes.position.array, c = source.attributes.color.array;
      const mat = mesh.material, color = mat.color;
      for (let i = source.drawRange.start; i < source.drawRange.start + source.drawRange.count; i++,offset++) {
        const x=p[i*3],y=p[i*3+1],z=p[i*3+2];
        positions[offset*3] = e[0]*x+e[4]*y+e[8]*z+e[12];
        positions[offset*3+1] = e[1]*x+e[5]*y+e[9]*z+e[13];
        positions[offset*3+2] = e[2]*x+e[6]*y+e[10]*z+e[14];
        colors[offset*4] = c[i*4]*color.r;
        colors[offset*4+1] = c[i*4+1]*color.g;
        colors[offset*4+2] = c[i*4+2]*color.b;
        colors[offset*4+3] = c[i*4+3]*mat.opacity;
      }
      mesh.visible = false;
      this.hidden.push(mesh);
    }
    for (const name of ['position','color']) {
      const attribute = geo.attributes[name];
      attribute.clearUpdateRanges();attribute.addUpdateRange(0,count*attribute.itemSize);attribute.needsUpdate = true;
    }
    geo.setDrawRange(0,count);
    batch.renderOrder = group[0].mesh.renderOrder;
    batch.layers.mask = group[0].mesh.layers.mask;
    batch.material.blending = group[0].mesh.material.blending;
    batch.visible = true;
  }
  destroy() {
    this.restore();
    for (const batches of this.layers.values()) for (const batch of batches) {
      batch.removeFromParent();batch.geometry.dispose();batch.material.dispose();
    }
    this.layers.clear();
  }
}

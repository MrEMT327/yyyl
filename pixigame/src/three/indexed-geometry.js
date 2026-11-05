import { BufferAttribute } from 'three';

// Keep shared vertices when baking a rigid transform for a batch. Expanding
// every triangle first multiplies V39 hull memory and vertex shader work.
// Own both buffers so mirrored winding never mutates the package cache.
export function cloneIndexedGeometry(source, matrix, triangles = true) {
  const geometry = source.clone();
  if (!geometry.index) {
    const count = geometry.attributes.position.count;
    const IndexArray = count > 65535 ? Uint32Array : Uint16Array;
    const indices = new IndexArray(count);
    for (let i = 0; i < count; i++) indices[i] = i;
    geometry.setIndex(new BufferAttribute(indices, 1));
  }
  geometry.applyMatrix4(matrix);
  if (triangles && matrix.determinant() < 0) {
    const indices = geometry.index.array;
    for (let i = 0; i < indices.length; i += 3) {
      const second = indices[i + 1];
      indices[i + 1] = indices[i + 2];
      indices[i + 2] = second;
    }
  }
  return geometry;
}

// Lossless temporal XOR plus byte planes improves gzip compression of float32
// mesh caches. Decoding restores the original bits, including integer fields.
export function decodePortraitFrames(buffer, manifest) {
  const length = manifest.frameCount * manifest.frameStrideBytes;
  if (buffer.byteLength !== length) throw new Error('立绘网格缓存长度不符');
  if (!manifest.framesEncoding) return buffer;
  if (manifest.framesEncoding !== 'xor32-byteplanes-v1'
      || manifest.frameStrideBytes % 4 !== 0) throw new Error('立绘缓存编码不支持');
  const source = new Uint8Array(buffer), output = new Uint8Array(length);
  const words = length / 4;
  for (let plane = 0; plane < 4; plane++) {
    for (let index = 0; index < words; index++) output[index * 4 + plane] = source[plane * words + index];
  }
  // Data is defined as little endian, independently of the host architecture.
  const view = new DataView(output.buffer), stride = manifest.frameStrideBytes;
  for (let offset = stride; offset < length; offset += 4) {
    view.setUint32(offset, view.getUint32(offset, true) ^ view.getUint32(offset - stride, true), true);
  }
  return output.buffer;
}

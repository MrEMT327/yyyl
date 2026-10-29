const TYPES={Float32Array,Float64Array,Int32Array,Int16Array,Int8Array,Uint32Array,Uint16Array,Uint8Array,Uint8ClampedArray};
export function hydrateBuffers(value,buffer){
 if(Array.isArray(value)){for(let i=0;i<value.length;i++)value[i]=hydrateBuffers(value[i],buffer);return value;}
 if(value&&typeof value==='object'){
  if(value.buffer==='buffers.bin'){
   const ctor=TYPES[value.type],off=value.byteOffset,n=value.length;
   if(!ctor||!Number.isInteger(off)||!Number.isInteger(n)||off<0||n<0||off%ctor.BYTES_PER_ELEMENT||off+n*ctor.BYTES_PER_ELEMENT>buffer.byteLength)throw new Error('顶点缓冲区范围非法');
   return new ctor(buffer,off,n);
  }
  for(const k of Object.keys(value))value[k]=hydrateBuffers(value[k],buffer);
 }
 return value;
}

// A reversible storage transform. No float precision, vertices, parameters or
// keyframes are discarded. Little-endian arithmetic is explicit on every host.
export const MOC_PACK_ENCODING='cmoc-f32-gzip-v1';
export const MOC_PACK_HEADER_BYTES=20;
const MAX_FLOAT32=3.4028234663852886e38;
const crcTable=new Uint32Array(256);
for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0;}
export function mocCrc32(bytes){let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
const asBytes=buffer=>buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);

function prediction(view,index,order,stride,scratch){
  if(index<stride*order)return 0;
  const a=view.getFloat32((index-stride)*4,true),b=view.getFloat32((index-stride*2)*4,true);
  const value=order===2?2*a-b:3*a-3*b+view.getFloat32((index-stride*3)*4,true);
  if(!Number.isFinite(value)||Math.abs(value)>MAX_FLOAT32)return 0;
  scratch.setFloat32(0,value,true);return scratch.getUint32(0,true);
}

export function encodeMocPlanes(buffer,{order=3,zigzag=true,blockWords=262144}={}){
  const input=asBytes(buffer),length=input.byteLength;
  if(!length||length%4||![2,3].includes(order)||!Number.isInteger(blockWords)||blockWords<1||blockWords>1048576)throw new Error('Invalid MOC pack configuration');
  const view=new DataView(input.buffer,input.byteOffset,length),scratch=new DataView(new ArrayBuffer(4));
  const output=new Uint8Array(length),words=length/4,stride=2;
  for(let begin=0;begin<words;begin+=blockWords){
    const count=Math.min(blockWords,words-begin),offset=begin*4;
    for(let j=0;j<count;j++){
      const i=begin+j,predicted=prediction(view,i,order,stride,scratch);
      const residual=(view.getUint32(i*4,true)-predicted)|0,value=zigzag?((residual<<1)^(residual>>31))>>>0:residual>>>0;
      output[offset+j]=value;output[offset+count+j]=value>>>8;output[offset+count*2+j]=value>>>16;output[offset+count*3+j]=value>>>24;
    }
  }
  const header=new Uint8Array(MOC_PACK_HEADER_BYTES),meta=new DataView(header.buffer);
  header.set([67,77,79,67,1,order,Number(zigzag),stride]);
  meta.setUint32(8,length,true);meta.setUint32(12,blockWords,true);meta.setUint32(16,mocCrc32(input),true);
  return {header,planes:output};
}

export function readMocPackHeader(buffer){
  const bytes=asBytes(buffer);
  if(bytes.byteLength<MOC_PACK_HEADER_BYTES||bytes[0]!==67||bytes[1]!==77||bytes[2]!==79||bytes[3]!==67||bytes[4]!==1)throw new Error('Unsupported packed MOC header');
  const meta=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),length=meta.getUint32(8,true),blockWords=meta.getUint32(12,true);
  if(![2,3].includes(bytes[5])||bytes[6]>1||bytes[7]!==2||!length||length%4||length>256*1024*1024||!blockWords||blockWords>1048576)throw new Error('Invalid packed MOC metadata');
  return {length,blockWords,order:bytes[5],zigzag:!!bytes[6],stride:bytes[7],crc32:meta.getUint32(16,true)};
}

// Streaming reconstruction needs just one 1 MB plane block in addition to the
// original model buffer. It never accumulates another full decompressed MOC.
export function createMocPlaneDecoder(header){
  const meta=readMocPackHeader(header),output=new Uint8Array(meta.length),view=new DataView(output.buffer);
  const block=new Uint8Array(Math.min(meta.blockWords*4,meta.length)),scratch=new DataView(new ArrayBuffer(4));
  let inputBytes=0,buffered=0,wordOffset=0,finished=false;
  function flush(){
    const count=Math.min(meta.blockWords,meta.length/4-wordOffset);
    for(let j=0;j<count;j++){
      const encoded=(block[j]|block[count+j]<<8|block[count*2+j]<<16|block[count*3+j]<<24)>>>0;
      const residual=meta.zigzag?(encoded>>>1)^-(encoded&1):encoded;
      const i=wordOffset+j,predicted=prediction(view,i,meta.order,meta.stride,scratch);
      view.setUint32(i*4,(predicted+residual)>>>0,true);
    }
    wordOffset+=count;buffered=0;
  }
  return {
    write(chunk){
      if(finished)throw new Error('Packed MOC decoder already finished');
      const bytes=asBytes(chunk);
      if(inputBytes+bytes.length>meta.length)throw new Error('Packed MOC payload exceeds declared length');
      inputBytes+=bytes.length;
      for(let offset=0;offset<bytes.length;){
        const needed=Math.min(meta.blockWords*4,meta.length-wordOffset*4),count=Math.min(needed-buffered,bytes.length-offset);
        block.set(bytes.subarray(offset,offset+count),buffered);buffered+=count;offset+=count;
        if(buffered===needed)flush();
      }
    },
    finish(){
      if(finished||inputBytes!==meta.length||buffered)throw new Error('Packed MOC payload length mismatch');
      finished=true;
      if(mocCrc32(output)!==meta.crc32)throw new Error('Packed MOC checksum mismatch');
      return output.buffer;
    },
  };
}

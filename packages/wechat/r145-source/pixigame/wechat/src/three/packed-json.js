import {toByteArray} from 'base64-js';
import {buf2string} from 'pako/lib/utils/strings.js';
import inflateCodec from 'pako/lib/inflate.js';

export function inflateJSON(packed){
  return packed?JSON.parse(buf2string(inflateCodec.inflate(toByteArray(packed)))):undefined;
}

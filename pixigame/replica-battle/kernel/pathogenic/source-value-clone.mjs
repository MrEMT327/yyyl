// Scene packs contain serialized arrays/plain objects. Avoid the native
// structured-clone bridge for every numeric animation key and JSON node.
// Keep each result owned, including aliases, cycles and sparse arrays.
export function cloneSourceValue(value, seen) {
  if(value===null||typeof value!=='object') {
    return typeof value==='function'||typeof value==='symbol'?structuredClone(value):value;
  }
  seen ||= new Map();
  if(seen.has(value))return seen.get(value);
  const array=Array.isArray(value),proto=Object.getPrototypeOf(value);
  if(!array&&proto!==Object.prototype&&proto!==null) {
    const result=structuredClone(value);seen.set(value,result);return result;
  }
  const result=array?new Array(value.length):{};seen.set(value,result);
  for(const key of Object.keys(value)) {
    // Define an own data property, preserving a serialized '__proto__' key.
    const copy=cloneSourceValue(value[key],seen);
    if(key==='__proto__')Object.defineProperty(result,key,{value:copy,enumerable:true,writable:true,configurable:true});
    else result[key]=copy;
  }
  return result;
}

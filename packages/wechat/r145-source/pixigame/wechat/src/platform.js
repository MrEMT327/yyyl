// Shared game state uses plain records and arrays with optional fields.
// Preserve undefined and primitive values without a JSON round trip.
export function cloneGameData(value, seen = new WeakMap()) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  const clone = Array.isArray(value) ? new Array(value.length) : {};
  seen.set(value, clone);
  for (const key of Object.keys(value)) {
    Object.defineProperty(clone, key, {
      value: cloneGameData(value[key], seen), enumerable: true, configurable: true, writable: true,
    });
  }
  return clone;
}

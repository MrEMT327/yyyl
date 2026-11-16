// Cached promises deduplicate pending decodes. Completed decoded surfaces have
// a byte/count budget; eviction never mutates an image still owned by the UI.
export function createSurfaceCache({ maxBytes = 64 * 1024 * 1024, maxEntries = 128 } = {}) {
  const entries = new Map(); let bytes = 0;
  const remove = (key, entry) => { if (entries.get(key) === entry) { entries.delete(key); bytes -= entry.bytes; } };
  const touch = (key, entry) => { entries.delete(key); entries.set(key,entry); };
  function trim() {
    for (const [key, entry] of entries) {
      if (bytes <= maxBytes && entries.size <= maxEntries) break;
      if (entry.ready) remove(key, entry);
    }
  }
  return {
    peek(key) {
      const entry=entries.get(key);
      if(entry?.ready){touch(key,entry);return entry.surface;}
    },
    get(key, load) {
      const existing = entries.get(key);
      if (existing) { touch(key,existing); return existing.promise; }
      const entry = { promise: null, bytes: 0, ready: false };
      entry.promise = Promise.resolve().then(load).then(surface => {
        if (entries.get(key) === entry) {
          entry.ready = true;
          entry.surface = surface;
          entry.bytes = Math.max(0, Number(surface.width) || 0) * Math.max(0, Number(surface.height) || 0) * 4;
          bytes += entry.bytes; trim();
        }
        return surface;
      }, error => { remove(key, entry); throw error; });
      entries.set(key, entry); trim();
      return entry.promise;
    },
    clear() { entries.clear(); bytes = 0; },
    get stats() { return { entries: entries.size, bytes, pending: [...entries.values()].filter(entry => !entry.ready).length }; },
  };
}

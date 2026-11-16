function freezeData(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return;
  Object.freeze(value);
  if (Array.isArray(value)) {
    for (const child of value) freezeData(child);
    return;
  }
  for (const key of Object.keys(value)) freezeData(value[key]);
}

// The lobby and sorties only share these immutable versioned inputs.
export function createSharedLoadoutReader(resources) {
  const names = ['loadout-catalog', 'loadout-runtime', 'player-appearances'];
  const pathFor = name => `/replica-battle/data/${name}.json`;
  if (!names.every(name => resources.isVersionedBattleData(pathFor(name)))) return null;
  const requests = new Map();
  function read(name) {
    if (!names.includes(name)) throw new Error('未知的装备资料文件');
    let request = requests.get(name);
    if (!request) {
      request = resources.readJSON(pathFor(name)).then(data => {
        freezeData(data);
        return data;
      }).catch(error => {
        if (requests.get(name) === request) requests.delete(name);
        throw error;
      });
      requests.set(name, request);
    }
    return request;
  }
  return { read, clear: () => requests.clear() };
}

// Retain only the most recent chapter in this host's asset version.
export function createBattleDataCache() {
  let cached, generation = 0;
  function clear() {
    cached = undefined;
    generation++;
  }
  return {
    clear,
    async load(key, signal, prepare) {
      if (signal.aborted) throw signal.reason ?? Object.assign(new Error('Battle closed'), { name: 'AbortError' });
      if (cached?.key === key) return cached.data;
      clear();
      const ticket = generation;
      const data = await prepare();
      if (signal.aborted) throw signal.reason ?? Object.assign(new Error('Battle closed'), { name: 'AbortError' });
      // A closed frame, a chapter change or a memory warning can retire a
      // request while its inputs are still arriving. It cannot seed the cache.
      if (ticket === generation) {
        freezeData(data);
        cached = { key, data };
      }
      return data;
    },
  };
}

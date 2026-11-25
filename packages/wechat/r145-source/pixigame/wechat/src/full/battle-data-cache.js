function freezeBatch(pending, outOfTime) {
  let visited = 0;
  while (pending.length) {
    const value = pending.pop();
    if (!value || typeof value !== 'object' || Object.isFrozen(value)) continue;
    Object.freeze(value);
    for (const child of Array.isArray(value) ? value : Object.values(value)) {
      if (child && typeof child === 'object') pending.push(child);
    }
    if (++visited % 128 === 0 && outOfTime?.()) return;
  }
}

function freezeData(value) {
  freezeBatch([value]);
}

function checkActive(signal) {
  if (signal.aborted) throw signal.reason ?? Object.assign(new Error('Battle closed'), { name: 'AbortError' });
}

async function freezeForCache(data, signal, loadingFrame, now) {
  const pending = [data];
  while (pending.length) {
    await loadingFrame();
    checkActive(signal);
    const deadline = now() + 8;
    freezeBatch(pending, () => now() >= deadline);
  }
}

// The lobby and sorties only share these immutable versioned inputs.
export function createSharedLoadoutReader(resources) {
  const names = ['loadout-catalog', 'loadout-runtime', 'player-appearances'];
  const removedAppearance = resources.releaseAssets ? Object.freeze({ planes: Object.freeze({}), pilots: Object.freeze({}) }) : null;
  const pathFor = name => `/replica-battle/data/${name}.json`;
  if (!names.every(name => (removedAppearance && name === 'player-appearances') || resources.isVersionedBattleData(pathFor(name)))) return null;
  const requests = new Map();
  function read(name) {
    if (!names.includes(name)) throw new Error('未知的装备资料文件');
    if (name === 'player-appearances' && removedAppearance) return Promise.resolve(removedAppearance);
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
    async load(key, signal, prepare, { loadingFrame, now = () => performance.now() } = {}) {
      checkActive(signal);
      if (cached?.key === key) return cached.data;
      clear();
      const ticket = generation;
      const data = await prepare();
      checkActive(signal);
      // A closed frame, a chapter change or a memory warning can retire a
      // request while its inputs are still arriving. It cannot seed the cache.
      if (ticket === generation) {
        if (loadingFrame) await freezeForCache(data, signal, loadingFrame, now);
        else freezeData(data);
        if (ticket === generation) cached = { key, data };
      }
      return data;
    },
  };
}

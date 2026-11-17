// Retain one object across the lobby and its battle scopes. Shared entries are
// parsed once; optional partitions are added when their feature is first used.
export function createStartupData({ loadPackage, readJSON, splitBattleData = false }) {
  const data = {};
  const partitions = new Map();
  let lobbyReady;
  function loadLobby() {
    return lobbyReady ||= Promise.resolve().then(() => loadPackage('shared-data'))
      .then(() => readJSON('shared-data/runtime-data.json.br'))
      .then(values => { Object.assign(data, values); return data; })
      .catch(error => { lobbyReady = null; throw error; });
  }
  function loadPartition(name) {
    const pending = partitions.get(name);
    if (pending) return pending;
    const task = Promise.all([
      loadLobby(),
      Promise.resolve().then(() => loadPackage(name))
        .then(() => readJSON(`${name}/runtime-data.json.br`)),
    ]).then(([, values]) => {
      for (const key of Object.keys(values)) {
        if (Object.hasOwn(data, key)) throw new Error(`重复的运行数据：${key}`);
      }
      Object.assign(data, values);
      return data;
    }).catch(error => { partitions.delete(name); throw error; });
    partitions.set(name, task);
    return task;
  }
  return {
    data, loadLobby,
    loadBattle: () => splitBattleData ? loadPartition('battle-data') : loadLobby(),
    loadPortrait: () => loadPartition('portrait-data'),
  };
}

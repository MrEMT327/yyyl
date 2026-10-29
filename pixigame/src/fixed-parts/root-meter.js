// Local connector resources count logical owners, never physical barrels,
// beam ticks or individual drones. Attack adapters retain their own hit validity.
export function createRootHitMeter(runId, connectors) {
  const state = Object.fromEntries(connectors.map(c => [c.id, {
    value: 0, capacity: 8, cooldown: .4, bonus: .35, discharges: 0, rhythm: false, heavy: false, retained: {}, lastHit: {}, active: c.active,
  }]));
  const credited = new Map();
  let disposed = false;
  return {
    state,
    configure(nodes) {
      for(const c of connectors) {
        const selected=nodes[c.id]||[],has=k=>selected.includes(`FP-C02-${k}`),charge=state[c.id];
        charge.capacity=(has('B1')?12:has('A1')?5:8)-(has('S')?1:0);charge.value=Math.min(charge.value,charge.capacity);
        charge.cooldown=has('S')?.32:.4;charge.bonus=has('B1')?.75:has('A1')?.25:.35;
        charge.rhythm=has('A2');charge.heavy=has('B2');
      }
    },
    credit(source, time) {
      if (disposed || source?.runId !== runId || source.kind !== 'root' || !source.weaponId || !source.groupId) return;
      for (const [key, at] of credited) if (time - at > 2) credited.delete(key);
      // Continuous carriers and a drone mother rack share one sampling group.
      // weaponId is always the logical weapon/mother rack, never the child ID.
      const period = source.carrier === 'continuous' ? .4 : source.carrier === 'drone' ? .5 : 0;
      const group = period ? `window:${Math.floor((time + 1e-9) / period)}` : source.groupId;
      for (const c of connectors) {
        if (!c.active || !c.beneficiaries.includes(source.weaponId)) continue;
        const charge = state[c.id], key = `${c.id}/${source.weaponId}/${group}`;
        if (credited.has(key) || time - (charge.lastHit[source.weaponId] ?? -Infinity) < charge.cooldown - 1e-9) continue;
        credited.set(key, time); charge.lastHit[source.weaponId] = time;
        charge.value = Math.min(charge.capacity, charge.value + 1);
      }
    },
    consume(weaponId) {
      if (disposed) return 0;
      let count = 0;
      for (const c of connectors) if (c.active && c.beneficiaries.includes(weaponId)) {
        const charge = state[c.id];
        if (charge.value >= charge.capacity) { charge.value = 0; count++; }
      }
      return count;
    },
    release(weaponId) {
      let bonus=0,pulses=0;
      if(disposed)return {bonus,pulses};
      for(const c of connectors)if(c.active&&c.beneficiaries.includes(weaponId)){
        const charge=state[c.id];bonus+=charge.retained[weaponId]||0;delete charge.retained[weaponId];
        if(charge.value>=charge.capacity){charge.value=0;charge.discharges++;pulses++;
          bonus+=charge.rhythm&&charge.discharges%3===0?.45:charge.bonus;
          if(charge.heavy)charge.retained[weaponId]=.25;
        }
      }
      return {bonus,pulses};
    },
    dispose() {
      disposed = true; credited.clear();
      for (const charge of Object.values(state)) { charge.value = 0; charge.lastHit = {}; charge.retained={}; }
    },
  };
}

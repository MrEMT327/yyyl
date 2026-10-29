// Simulation-time limits for expendable decoration only. No projectile,
// warning, damage field, death sequence or reward passes through this gate.
const RULES = {
  impact: {total:16, local:2, cell:88},
  explosion: {total:6, local:1, cell:100},
  ambient: {total:3, local:1, cell:110},
  player: {total:2, local:2, cell:100},
  muzzle: {total:24, local:6, cell:60},
  smoke: {total:32, local:6, cell:80},
  core: {total:8, local:1, cell:100},
};

export function createCosmeticBudget() {
  let window = -1;
  const totals = new Map(), cells = new Map();
  return {
    allow(kind, x, y, time) {
      const next = Math.floor(Math.max(0, Number(time) || 0) / .1);
      if (next !== window) { window = next; totals.clear(); cells.clear(); }
      const rule = RULES[kind];
      if (!rule || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      const total = totals.get(kind) || 0;
      const key = `${kind}:${Math.floor(x/rule.cell)},${Math.floor(y/rule.cell)}`;
      const local = cells.get(key) || 0;
      if (total >= rule.total || local >= rule.local) return false;
      totals.set(kind, total + 1); cells.set(key, local + 1);
      return true;
    },
    clear() { window = -1; totals.clear(); cells.clear(); },
  };
}

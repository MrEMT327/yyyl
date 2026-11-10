// Compact card labels only; combat calculations and attribute details stay exact.
export function compactCombatStat(value) {
  if (!Number.isFinite(value)) return '—';
  const whole = Math.max(0, Math.floor(value));
  return whole >= 1000 ? `${Math.floor(whole / 1000)}k` : String(whole);
}

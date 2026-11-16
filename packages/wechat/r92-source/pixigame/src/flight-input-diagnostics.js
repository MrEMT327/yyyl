// Temporary, bounded local diagnostics for the reported post-upgrade drag lock.
// No account/save data is recorded, and nothing is sent over the network.
const counts = new Map();
let total = 0;
export function traceFlightInput(stage, data = {}) {
  if (total >= 240) return;
  const key = `${stage}:${data.pointerId ?? ''}:${data.state ?? ''}:${data.reason ?? ''}`;
  const count = counts.get(key) || 0;
  if (count >= (stage.includes('move') ? 2 : 6)) return;
  counts.set(key, count + 1);
  total++;
  console.info('[flight-input]', JSON.stringify({ stage, ...data }));
}

// Keep the six-slot presentation. Elite rewards guarantee a next-stage
// evolution; only a fully evolved loadout falls back to numeric tuning.
const WHEEL_SLOTS = 6;

function pick(pool, random) {
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export function planBattleSupply(growth, random = Math.random) {
  if (growth.state.ended || growth.state.offer) return null;
  const all = growth.candidates({supply:true});
  const evolutions = all.filter(card => card.key.startsWith('evolve-'));
  const candidates = evolutions.length ? evolutions : all;
  if (!candidates.length) return null;
  const slots = [];
  while (slots.length < WHEEL_SLOTS) {
    const unused = candidates.filter(card => !slots.some(slot => slot.id === card.id && slot.ownerId === card.ownerId));
    slots.push(pick(unused.length ? unused : candidates, random));
  }
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const winnerIndex = Math.min(WHEEL_SLOTS - 1, Math.floor(random() * WHEEL_SLOTS));
  return { slots, winnerIndex, reward: slots[winnerIndex], evolutionExhausted: !evolutions.length };
}

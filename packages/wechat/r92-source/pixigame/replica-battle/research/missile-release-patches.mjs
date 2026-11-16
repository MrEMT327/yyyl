import missile from './missile-airdrop-patches.mjs';
import death from './death-explosion-patches.mjs';
const entries = new Map();
for (const entry of [...missile, ...death]) {
  const previous = entries.get(entry.path);
  if (previous) {
    previous.reason += ' ' + entry.reason;
    previous.replacements.push(...entry.replacements);
  } else entries.set(entry.path, { ...entry, replacements: [...entry.replacements] });
}
export default [...entries.values()];

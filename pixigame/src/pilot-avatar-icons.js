// One head-only icon per playable pilot, shared by the lobby and game views.
const base = import.meta.env?.BASE_URL ?? '/';
const ids = new Set(Array.from({ length: 10 }, (_, i) => `pilot-${String(i + 1).padStart(2, '0')}`));

export function pilotAvatarIcon(id) {
  return ids.has(id) ? `${base}art/pilot-head-icons-v1/${id}.png` : null;
}

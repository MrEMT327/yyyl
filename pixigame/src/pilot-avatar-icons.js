// One head-only icon per playable pilot, shared by the lobby and game views.
const base = import.meta.env?.BASE_URL ?? '/';
const ids = new Set(Array.from({ length: 10 }, (_, i) => `pilot-${String(i + 1).padStart(2, '0')}`));

// Compact UI portraits use prefiltered PNGs; full-size art keeps pilotAvatarIcon.
export function compactPilotAvatar(url) {
  const match = typeof url === 'string' && url.match(/^(.*\/pilot-head-icons-v1\/)(pilot-\d{2})\.png$/);
  if (!match || !ids.has(match[2])) return { src: url, srcset: '' };
  const thumbnail = `${match[1]}thumbnails/${match[2]}`;
  return {
    src: `${thumbnail}-320.png`,
    srcset: [80, 160, 320, 640].map(size => `${thumbnail}-${size}.png ${size}w`).join(', '),
  };
}

// Battle renders in /replica-battle/, while these assets belong to the host
// root (or its deployment subdirectory). Resolve before crossing that boundary.
export function pilotAvatarUrl(pilot, assetBase) {
  const source = pilot?.avatar || compactPilotAvatar(pilotAvatarIcon(pilot?.id)).src || pilot?.image;
  return source ? new URL(source, assetBase).href : undefined;
}

export function pilotAvatarIcon(id) {
  return ids.has(id) ? `${base}art/pilot-head-icons-v1/${id}.png` : null;
}

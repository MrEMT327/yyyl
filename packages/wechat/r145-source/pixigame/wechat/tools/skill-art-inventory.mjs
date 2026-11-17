import { SKILL_ICON_ASSETS, requireSkillIconUrl } from '../../src/replica/skill-icon-registry.js';
import { NATIVE_FLEET_SKILL_ASSETS, nativeFleetSkillIconArt } from '../../src/replica/native-fleet-skill-art.js';
import { SKILL_BACKGROUND_ELEMENTS, skillElementBackgroundArt } from '../../src/replica/skill-element-background-art.js';

// These paths are assembled from registry rows at runtime. Observed requests
// and a scan for complete string literals cannot prove their full coverage.
export function skillArtInventory() {
  const paths = new Map();
  function add(url, kind, id) {
    if (!url) throw new Error(`Missing registered skill artwork: ${kind}/${id}`);
    const path = decodeURIComponent(new URL(url, 'https://build.invalid/').pathname).replace(/^\/+/, '');
    if (!/^art\/[a-z\d-]+\/[a-z\d-]+\.webp$/i.test(path)) throw new Error(`Invalid skill artwork path: ${path}`);
    const previous = paths.get(path);
    if (previous && previous.kind !== kind) throw new Error(`Ambiguous skill artwork: ${path}`);
    paths.set(path, { path, kind, id: String(id) });
  }
  for (const row of SKILL_ICON_ASSETS) add(requireSkillIconUrl(row.key), 'skill', row.key);
  for (const row of NATIVE_FLEET_SKILL_ASSETS) add(nativeFleetSkillIconArt(row.key), 'fleet', row.key);
  for (const element of SKILL_BACKGROUND_ELEMENTS) add(skillElementBackgroundArt(element), 'background', element);
  return [...paths.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function assertSkillArtCoverage({ localFiles = {}, cdnKeys = [], assetTransfers = {} } = {}) {
  const deployed = new Set(cdnKeys), required = skillArtInventory();
  const missing = required.filter(({ path }) => !localFiles[path] && !deployed.has(assetTransfers[path]?.path || path));
  if (missing.length) throw new Error(`Skill artwork omitted from deployment (${missing.length}):\n${missing.map(row => row.path).join('\n')}`);
  return required;
}

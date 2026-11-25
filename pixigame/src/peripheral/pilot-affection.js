export const PILOT_AFFECTION_VISIBLE = false;
export const PILOT_AFFECTION_MAX = 100;
export const PILOT_AFFECTION_VICTORY = 5;
export const PILOT_AFFECTION_DEFEAT = 2;
export const PILOT_AFFECTION_MIN_WAVE = 5;

const videos = new Map([['pilot-01', 'art/pilot-affection-v1/pilot-01.mp4']]);
const affectionActions = new Set(['pilotAffection', 'browseAffectionPilot', 'playAffectionVideo', 'developerAffectionMax']);

export function isHiddenPilotAffectionAction(action) {
  return !PILOT_AFFECTION_VISIBLE && affectionActions.has(action);
}

export function pilotAffectionVideo(pilotId) {
  return videos.get(pilotId);
}

export function pilotAffectionPoints(value) {
  return Number.isSafeInteger(value) ? Math.max(0, Math.min(PILOT_AFFECTION_MAX, value)) : 0;
}

export function planPilotAffection(points, result) {
  if (result.trial || result.abandoned || result.endReason === 'quit') return null;
  const clearedEnough = result.wave > PILOT_AFFECTION_MIN_WAVE
    || (result.wave === PILOT_AFFECTION_MIN_WAVE && result.completedWave === PILOT_AFFECTION_MIN_WAVE);
  const gain = result.won ? PILOT_AFFECTION_VICTORY : clearedEnough ? PILOT_AFFECTION_DEFEAT : 0;
  const before = pilotAffectionPoints(points);
  const after = Math.min(PILOT_AFFECTION_MAX, before + gain);
  if (after === before) return null;
  return {
    pilotId: result.pilotId, gained: after - before, points: after,
    videoUnlocked: after === PILOT_AFFECTION_MAX && Boolean(pilotAffectionVideo(result.pilotId)),
  };
}

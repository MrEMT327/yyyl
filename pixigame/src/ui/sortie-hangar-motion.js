export const HANGAR_RISE_SECONDS = 3.2;
export const HANGAR_VISUAL_TIMEOUT_MS = 5500;
export const HANGAR_TURN_SECONDS = 12;
const smooth = value => { const t=Math.max(0,Math.min(1,value)); return t*t*(3-2*t); };

// Presentation time is independent of battle time and resource progress.
export function hangarPose(seconds, reducedMotion=false) {
  const time=reducedMotion?HANGAR_RISE_SECONDS:Math.max(0,Number(seconds)||0);
  const lift=smooth(time/HANGAR_RISE_SECONDS);
  return {
    x:0,y:5.2*lift,
    yaw:reducedMotion?0:time*Math.PI*2/HANGAR_TURN_SECONDS,
    z:0,lift,
    phase:time<HANGAR_RISE_SECONDS?'elevator':'ready',
    complete:time>=HANGAR_RISE_SECONDS,
  };
}

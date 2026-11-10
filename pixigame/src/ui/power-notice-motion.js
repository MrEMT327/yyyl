// CombatTipNodeRun, from the supplied reference APK. Coordinates use 1080 units.
export const POWER_NOTICE_DURATION = 2500;
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t*t*(3-2*t); };
const between = (time, start, end, from, to) => from+(to-from)*smooth((time-start)/(end-start));
export function powerNoticePose(seconds) {
  const scale = seconds < .25 ? between(seconds,0,.25,0,1.2)
    : seconds < 1/3 ? between(seconds,.25,1/3,1.2,1)
    : seconds < 2.25 ? 1 : seconds < 7/3 ? between(seconds,2.25,7/3,1,1.1)
    : between(seconds,7/3,2.5,1.1,0);
  const pulse = seconds < 13/12 ? 1 : seconds < 1.25 ? between(seconds,13/12,1.25,1,1.4)
    : between(seconds,1.25,17/12,1.4,1);
  return { scale, rise:80*smooth(seconds/.25), pulse };
}
export function powerNoticeFrames(width) {
  return Array.from({length:151},(_,i)=>{
    const {scale,rise}=powerNoticePose(i/60);
    // Keep the centring translation ahead of scale so the overshoot cannot
    // drag the panel sideways around a percentage transform origin.
    return {offset:i/150,transform:`translate(-50%, calc(-50% - ${rise*width/1080}px)) scale(${scale})`};
  });
}
export function powerNoticeCount(before,after,elapsed) {
  return Math.round(before+(after-before)*smooth((elapsed-1250/3)/(2000/3)));
}

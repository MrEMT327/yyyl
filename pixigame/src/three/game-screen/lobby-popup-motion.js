// Popup time is measured from its first visible frame, after artwork staging.
const opening = {
  large: {duration: 1 / 3, start: .5, peak: 1.1},
  small: {duration: 13 / 60, start: .9, peak: 1.03},
};
const closeDuration = .12;
const smooth = t => t * t * (3 - 2 * t);
const mix = (a, b, t) => a + (b - a) * t;

export function createLobbyPopupMotion() {
  let visible = new Map(), top = null, track = null;
  let pose = null;
  function sync(panels, scope, now, reduced) {
    const next = panels.get(scope);
    if (next && !visible.has(scope) && !reduced) {
      track = {start: now, curve: opening[next.style]};
    } else if (top?.scope !== next?.scope) {
      track = null;
    }
    top = next;
    visible = panels;
    if (!track) pose = null;
  }
  function dismiss(command, now) {
    if (!top) return false;
    if (!track?.command) {
      track = {start: now, scale: pose?.scale ?? 1, shade: pose?.shade ?? 1, command};
    }
    return true;
  }
  function sample(now) {
    if (!track || !top) {pose = null; return null;}
    const t = Math.min(1, Math.max(0, (now - track.start) / (track.command ? closeDuration : track.curve.duration)));
    let scale, shade, completed;
    if (track.command) {
      scale = mix(track.scale, Math.min(track.scale, .82), smooth(t));
      shade = track.shade * (1 - smooth(t));
      if (t === 1) completed = track.command;
    } else {
      const {start, peak} = track.curve;
      scale = t < .6 ? mix(start, peak, smooth(t / .6)) : mix(peak, 1, smooth((t - .6) / .4));
      shade = mix(.625, 1, smooth(t));
    }
    pose = {scope: top.scope, cx: top.cx, cy: top.cy, scale, shade, completed};
    if (t === 1) {
      track = null;
      if (!completed) pose = null;
    }
    return pose;
  }
  return {sync, dismiss, sample, get pose(){return pose;}, get moving(){return Boolean(track);},
    get closing(){return Boolean(track?.command);}};
}

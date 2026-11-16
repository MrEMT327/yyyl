// Presentation only: classify the health actually lost, after mitigation.
// Ratios keep a late-game small hit from looking like a near-fatal impact.
const HIT_FEEDBACK = Object.freeze({
  light: Object.freeze({ shake: 1.8, flash: 0, impact: .5, particles: 6, speed: 90, color: 0xffb29e, vibration: 15 }),
  medium: Object.freeze({ shake: 4, flash: .035, impact: .8, particles: 10, speed: 130, color: 0xff9a82, vibration: 30 }),
  heavy: Object.freeze({ shake: 8, flash: .09, impact: 1.2, particles: 16, speed: 170, color: 0xffbc80, vibration: 50 }),
});

export function playerDamageFeedback(healthLost, maxHp, reducedMotion = false) {
  const ratio = Math.max(0, Number(healthLost) || 0) / Math.max(1, Number(maxHp) || 1);
  const severity = ratio < .08 ? 'light' : ratio < .18 ? 'medium' : 'heavy';
  const profile = HIT_FEEDBACK[severity];
  return reducedMotion
    ? { ...profile, severity, shake: 0, flash: 0, impact: profile.impact * .6,
      particles: Math.ceil(profile.particles / 2), speed: profile.speed * .6, vibration: 0 }
    : { ...profile, severity };
}

export function shouldShowLowHealthWarning(before, after, maxHp, elapsed, lastWarningAt = -Infinity) {
  const max = Math.max(1, Number(maxHp) || 1);
  if (!(after > 0) || after / max > .25) return false;
  const since = elapsed - lastWarningAt;
  const enteredLow = before / max > .25;
  const enteredCritical = before / max > .1 && after / max <= .1;
  // Crossing a threshold is meaningful, but tiny heals around it must not
  // retrigger every hit. A sustained low-health reminder is less frequent.
  return since >= 8 || ((enteredLow || enteredCritical) && since >= 3);
}

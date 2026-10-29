/** Static translation of CharacterView.PlayMoveDeflectionAnim / ApplyMoveDeflectionAnim.
 * Native evidence: research/player-animation.arm64.txt, 0x74b4214 and 0x74b5008.
 * Animation names are counterintuitive: *_running is the transition, left/right is the held loop.
 */
export type DeflectionAnimation = 'normal' | 'left' | 'right' | 'left_running' | 'right_running';
export interface DeflectionTrack {
  animation: string;
  /** Spine TrackEntry.getAnimationTime(), before reverse sampling. */
  animationTime: number;
  duration: number;
  reverse: boolean;
}
export interface DeflectionEntry {
  animation: DeflectionAnimation;
  loop: boolean;
  timeScale: number;
  reverse: boolean;
  trackTime: number;
  /** Match original SetAnimationLast alongside trackTime on the first entry. */
  animationLast: number;
}
export interface DeflectionPlan {
  delay: number;
  entries: DeflectionEntry[];
}
export interface PlayerDeflectionState {
  lastDirection: -1 | 0 | 1;
  pending: DeflectionPlan | null;
}
export interface DeflectionMotion {
  x: number;
  z: number;
  /** Drag controller's remaining world-space X to target (currentX-targetX),
   * NOT velocity or frame displacement. Only its absolute value is inspected. */
  rawX?: number;
}

export function createPlayerDeflection(): PlayerDeflectionState {
  return { lastDirection: 0, pending: null };
}

/** null means the original early-return branch: vertical or too-small lateral motion
 * keeps the existing bank. A genuinely zero vector requests return to normal. */
export function playerDeflectionDirection(motion: DeflectionMotion): -1 | 0 | 1 | null {
  const squared = motion.x * motion.x + motion.z * motion.z;
  if (squared < 9.999999439624929e-11) return 0;
  if (Math.abs(motion.rawX ?? motion.x) <= 0.4000000059604645) return null;
  const cosine = motion.x / Math.sqrt(squared);
  // Original Vector2.Angle(dir, Vector2.right) is strictly <60 or >120 degrees.
  if (cosine > .5) return 1;
  if (cosine < -.5) return -1;
  return null;
}

function planDeflection(previous: -1 | 0 | 1, next: -1 | 0 | 1, track: DeflectionTrack): DeflectionPlan | null {
  const movingLeft = previous > next;
  const hold: DeflectionAnimation = movingLeft ? 'left' : 'right';
  const transition: DeflectionAnimation = movingLeft ? 'left_running' : 'right_running';
  const otherHold: DeflectionAnimation = movingLeft ? 'right' : 'left';
  const otherTransition: DeflectionAnimation = movingLeft ? 'right_running' : 'left_running';
  let animations: DeflectionAnimation[] = [], reverseFirst = false, keepTime = false;
  if (track.animation === otherHold || track.animation === otherTransition) {
    animations = next === 0 ? [otherTransition, 'normal'] : [otherTransition, transition, hold];
    reverseFirst = true;
    keepTime = track.animation === otherTransition;
  } else if (track.animation === 'normal') {
    animations = next === 0 ? ['normal'] : [transition, hold];
  } else if (track.animation === transition) {
    animations = next === 0 ? [transition, otherHold] : [transition, hold];
    reverseFirst = next === 0;
    keepTime = true;
  }
  if (!animations.length) return null;
  const returning = animations[animations.length - 1] === 'normal';
  const speed = returning ? 2.5 : 1.5;
  const time = Math.max(0, Math.min(track.duration, track.animationTime));
  const firstTime = keepTime && track.animation === animations[0]
    ? reverseFirst !== track.reverse ? track.duration - time : time
    : 0;
  return {
    delay: returning ? 0.15000000596046448 : 0,
    entries: animations.map((animation, index) => ({
      animation,
      loop: index === animations.length - 1,
      // Original first entry always receives plan.TimeScale; queued final loop gets 1.
      timeScale: index === 0 || index < animations.length - 1 ? speed : 1,
      reverse: index === 0 && reverseFirst,
      trackTime: index === 0 ? firstTime : 0,
      animationLast: index === 0 ? firstTime : 0,
    })),
  };
}

/** Pure per-frame update. Feed only elapsed simulation time (zero while paused).
 * Apply the returned entries once: state.setAnimation(0, first...), then
 * state.addAnimation(0, subsequent..., delay=0). Set first reverse, trackTime,
 * animationLast and timeScale, and queued timeScale. Leave Spine's authored mix intact.
 * One plan should be applied to both L1/L2 skeletons, as in the original wrapper.
 */
export function updatePlayerDeflection(
  previous: PlayerDeflectionState,
  motion: DeflectionMotion,
  track: DeflectionTrack,
  deltaSeconds: number,
): { state: PlayerDeflectionState; entries: DeflectionEntry[] | null } {
  let lastDirection = previous.lastDirection;
  let pending = previous.pending;
  const direction = playerDeflectionDirection(motion);
  if (direction !== null && direction !== lastDirection) {
    const plan = planDeflection(lastDirection, direction, track);
    if (plan) pending = plan;
    lastDirection = direction;
  }
  if (!pending) return { state: { lastDirection, pending }, entries: null };
  const delay = pending.delay - Math.max(0, deltaSeconds);
  if (delay > 0) return { state: { lastDirection, pending: { ...pending, delay } }, entries: null };
  return { state: { lastDirection, pending: null }, entries: pending.entries };
}

export function isDodgeTutorialRunEligible({
  stageIndex = -1,
  difficultyId = '',
  prompted = false,
} = {}) {
  return !prompted && Number(stageIndex) === 0 && difficultyId === 'easy';
}

// The tutorial UI is shared, but the active pointer belongs to its platform.
// Browser events must keep their numeric id and CSS/client coordinates.
export function resumeDodgeTutorialPointer(bridge, origin, current, nativeEvent) {
  if (bridge.platformKind === 'wechat') {
    bridge.beginWechatRelativeDrag?.(origin.x, origin.y, current.x, current.y);
  } else if (nativeEvent?.pointerType === 'touch') {
    // Re-anchor at the current finger/ship positions, not the demo ship.
    bridge.beginBrowserRelativeDrag?.(nativeEvent);
  }
}

export function shouldTriggerDodgeTutorial({
  completed = false,
  state = 'playing',
  playerInvincible = 0,
  bullet,
  player,
  collisionRadius,
  minLeadTime = 0.05,
  maxLeadTime = 0.42,
  warningPadding = 12,
} = {}) {
  if (completed || state !== 'playing' || playerInvincible > 0) return false;
  if (!bullet || !player) return false;

  const velocityX = Number(bullet.vx) || 0;
  const velocityY = Number(bullet.vy) || 0;
  const speedSq = velocityX * velocityX + velocityY * velocityY;
  if (speedSq < 3600) return false;

  const offsetX = Number(player.x) - Number(bullet.x);
  const offsetY = Number(player.y) - Number(bullet.y);
  const timeToClosest = (offsetX * velocityX + offsetY * velocityY) / speedSq;
  if (timeToClosest < minLeadTime || timeToClosest > maxLeadTime) return false;

  const hitRadius = Math.max(1, Number(collisionRadius) || 1);
  const currentDistanceSq = offsetX * offsetX + offsetY * offsetY;
  if (currentDistanceSq <= hitRadius * hitRadius) return false;

  const closestOffsetX = Number(bullet.x) + velocityX * timeToClosest - Number(player.x);
  const closestOffsetY = Number(bullet.y) + velocityY * timeToClosest - Number(player.y);
  const warningRadius = hitRadius + Math.max(0, Number(warningPadding) || 0);
  return closestOffsetX * closestOffsetX + closestOffsetY * closestOffsetY
    <= warningRadius * warningRadius;
}

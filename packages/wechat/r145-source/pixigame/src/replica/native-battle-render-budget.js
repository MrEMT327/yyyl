const fittedWidth = ({width, height}) => Math.min(width, height * 540 / 960);
const usesPhoneBudget = viewport => fittedWidth(viewport) * viewport.pixelRatio <= 900;

export function nativeBattleBufferSize(viewport, width, height) {
  // The native canvas is stretched to the same logical viewport by the host.
  // Keep the aspect exact so a single camera zoom preserves source coordinates.
  return viewport && usesPhoneBudget(viewport) ? {width: width * .8, height: height * .8} : {width, height};
}

export function createNativeBattleRenderBudget(viewport, worldWidth) {
  const viewWidth = fittedWidth(viewport);
  const phone = usesPhoneBudget(viewport);
  const aircraftTextureSize = phone ? 192 : 256;
  // Size the cross-context terrain upload near the phone viewport's CSS
  // width. Round to whole 9:16 pixels and bound the terrain resolution.
  const terrainWidth = phone ? Math.min(450, Math.max(360, Math.ceil(viewWidth * .9 / 9) * 9)) : 540;
  const terrainHeight = terrainWidth * 16 / 9;
  const terrainRate = phone ? 20 : 30;
  const cameraPixels = 540 / worldWidth;
  let previousTerrain, pendingTerrain;
  let frameSeconds = 1 / 60;
  let deferredRender;

  function planTerrain(time, run, weather, x, z) {
    pendingTerrain = undefined;
    const tick = Math.floor(time * terrainRate + 0.001);
    const fastTick = Math.floor(time * 30 + 0.001);
    const previous = previousTerrain;
    const sameScene = previous && previous.run === run && previous.weather === weather && time >= previous.time;
    const moved = sameScene ? Math.hypot(x - previous.x, z - previous.z) * cameraPixels : Infinity;
    const urgent = moved >= 24;
    // Coast scrolling runs at 20 Hz on phones. Camera motion can use 30 Hz.
    if (!urgent && (fastTick === previous.fastTick || (tick === previous.tick && moved < 6))) return null;
    pendingTerrain = { time, tick, fastTick, run, weather, x, z };
    return urgent ? 'immediate' : 'regular';
  }

  function commitTerrain() {
    if (pendingTerrain) previousTerrain = pendingTerrain;
    pendingTerrain = undefined;
  }

  return {
    aircraftTextureSize, terrainWidth, terrainHeight,
    compactAircraftEffects: phone,
    combatBloomLevels: phone ? 1 : undefined,
    shouldDrawAircraft(elapsed, terrainDue, moving) {
      if (!phone) return elapsed >= (moving ? 1/60 : 1/30) - 1e-6;
      // Flight position updates on every display frame. The nearly steady
      // idle hull can reuse its pixels longer than a banking or rolling hull.
      const rate = moving ? (terrainDue ? 20 : 30) : (terrainDue ? 12 : 15);
      return elapsed >= 1 / rate - .001;
    },
    planTerrain, commitTerrain,
    shouldDrawTerrain(time, run, weather, x, z) {
      const priority = planTerrain(time, run, weather, x, z);
      commitTerrain();
      return Boolean(priority);
    },
    deferOverlappingRender(displaySeconds, aircraftCanWait, terrainCanWait, aircraftHasPriority = false) {
      if (!phone) return null;
      if (!Number.isFinite(displaySeconds) || displaySeconds <= 0 || displaySeconds >= .25) {
        frameSeconds = 1 / 60;
        deferredRender = null;
        return null;
      }
      frameSeconds += (Math.min(displaySeconds, .1) - frameSeconds) * .18;
      if (frameSeconds <= 1 / 56 || !terrainCanWait) {
        deferredRender = null;
        return null;
      }
      if (aircraftHasPriority) {
        // Give the new pose the frame, then release a deferred terrain update.
        deferredRender = deferredRender === 'terrain' ? null : 'terrain';
        return deferredRender;
      }
      if (!aircraftCanWait) {
        deferredRender = null;
        return null;
      }
      // Keep the last completed texture while the other renderer has this frame.
      // Alternate when sustained cadence falls below the battle frame target.
      deferredRender = deferredRender === 'terrain' ? 'aircraft' : 'terrain';
      return deferredRender;
    },
    reset() {
      previousTerrain = pendingTerrain = undefined;
      frameSeconds = 1 / 60;
      deferredRender = null;
    },
  };
}

export function createNativeBattleRenderBudget({width, height, pixelRatio}, worldWidth) {
  const screenWidth = Math.min(width, height * 540 / 960) * pixelRatio;
  const phone = screenWidth <= 900;
  const aircraftTextureSize = phone ? 192 : 256;
  // Scenery is uploaded between graphics contexts. Use a smaller 9:16 image
  // on phones while keeping the Phaser battle and aircraft sizes independent.
  const terrainWidth = phone ? 450 : 540;
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
    combatBloomLevels: phone ? 2 : undefined,
    shouldDrawAircraft(elapsed, terrainDue, moving) {
      if (!phone) return elapsed >= (moving ? 1/60 : 1/30) - 1e-6;
      // Position and input update on each display frame. Let regular aircraft
      // texture updates fall between terrain uploads, with a 50 ms deadline.
      return elapsed >= (terrainDue ? 1/20 : 1/30) - .001;
    },
    planTerrain, commitTerrain,
    shouldDrawTerrain(time, run, weather, x, z) {
      const priority = planTerrain(time, run, weather, x, z);
      commitTerrain();
      return Boolean(priority);
    },
    deferOverlappingRender(displaySeconds, aircraftCanWait, terrainCanWait) {
      if (!phone) return null;
      if (!Number.isFinite(displaySeconds) || displaySeconds <= 0 || displaySeconds >= .25) {
        frameSeconds = 1 / 60;
        deferredRender = null;
        return null;
      }
      frameSeconds += (Math.min(displaySeconds, .1) - frameSeconds) * .18;
      if (frameSeconds < 1 / 28 || !aircraftCanWait || !terrainCanWait) {
        deferredRender = null;
        return null;
      }
      // Keep the last completed texture while the other renderer has this frame.
      // Alternate only on sustained contention, and honor immediate updates.
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

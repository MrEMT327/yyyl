export function createNativeBattleRenderBudget({width, height, pixelRatio}, worldWidth, {adaptive=false,onPressureChange,onSustainedLoadChange,phoneTerrainWidth=450}={}) {
  const screenWidth = Math.min(width, height * 540 / 960) * pixelRatio;
  const phone = screenWidth <= 900;
  const aircraftTextureSize = phone ? 192 : 256;
  // Scenery is uploaded between graphics contexts. Use a smaller 9:16 image
  // on phones while keeping the Phaser battle and aircraft sizes independent.
  const terrainWidth = phone ? phoneTerrainWidth : 540;
  const terrainHeight = terrainWidth * 16 / 9;
  const terrainRate = phone ? 20 : 30;
  const cameraPixels = 540 / worldWidth;
  let previousTerrain, pendingTerrain;
  let frameSeconds = 1 / 60;
  let deferredRender;
  let underLoad=false,displayAverage=1/60,evidence=0;
  let sustainedLoad=false,sustainedEvidence=0;

  function setPressure(next){
    if(underLoad===next)return;
    underLoad=next;evidence=0;
    onPressureChange?.(next);
  }
  function setSustainedLoad(next){
    if(sustainedLoad===next)return;
    sustainedLoad=next;sustainedEvidence=0;
    onSustainedLoadChange?.(next);
  }
  function observeFrame(seconds){
    if(!adaptive||!phone)return;
    if(!(seconds>0)||seconds>=.5){
      displayAverage=1/60;evidence=sustainedEvidence=0;
      setPressure(false);setSustainedLoad(false);return;
    }
    // Measure wall time. Slow-motion gameplay and a single stall must not change quality.
    const sample=Math.min(seconds,.1);
    displayAverage+=(sample-displayAverage)*.12;
    const qualifies=underLoad?displayAverage<1/55:displayAverage>1/50;
    evidence=qualifies?evidence+sample:Math.max(0,evidence-sample*2);
    if(evidence>=(underLoad?4:1.5))setPressure(!underLoad);
    // Hold the lower redraw rates until frame delivery has recovered for a while.
    const qualifiesForSustained=sustainedLoad?displayAverage<1/52:displayAverage>1/46;
    sustainedEvidence=qualifiesForSustained?sustainedEvidence+sample:Math.max(0,sustainedEvidence-sample*2);
    if(sustainedEvidence>=(sustainedLoad?5:2.5))setSustainedLoad(!sustainedLoad);
  }

  const tickAt = (time, rate) => Math.floor(time * rate + 0.001);
  function planTerrain(time, run, weather, x, z) {
    pendingTerrain = undefined;
    const refreshRate = sustainedLoad ? 16 : terrainRate;
    const cameraRate = sustainedLoad ? 24 : 30;
    const previous = previousTerrain;
    const sameScene = previous && previous.run === run && previous.weather === weather && time >= previous.time;
    const moved = sameScene ? Math.hypot(x - previous.x, z - previous.z) * cameraPixels : Infinity;
    const urgent = moved >= 24;
    // Bucket both samples with the current rate so switching rates cannot force a redraw.
    if (!urgent && (tickAt(time,cameraRate)===tickAt(previous.time,cameraRate) ||
      (moved<6 && tickAt(time,refreshRate)===tickAt(previous.time,refreshRate)))) return null;
    pendingTerrain = { time, run, weather, x, z };
    return urgent ? 'immediate' : 'regular';
  }

  function commitTerrain() {
    if (pendingTerrain) previousTerrain = pendingTerrain;
    pendingTerrain = undefined;
  }

  return {
    aircraftTextureSize, terrainWidth, terrainHeight,
    observeFrame,get underLoad(){return underLoad;},get sustainedLoad(){return sustainedLoad;},
    combatBloomLevels: phone ? 2 : undefined,
    shouldDrawAircraft(elapsed, terrainDue, moving, steadyPose=false, rolling=false) {
      if (!phone) return elapsed >= (moving ? 1/60 : 1/30) - 1e-6;
      if (sustainedLoad) return elapsed >= 1/(rolling ? 24 : steadyPose && !moving ? 15 : 16) - 1e-6;
      if (underLoad && steadyPose) return elapsed >= (moving ? 1/20 : 1/15) - .001;
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
      evidence=sustainedEvidence=0;displayAverage=1/60;setPressure(false);setSustainedLoad(false);
    },
  };
}

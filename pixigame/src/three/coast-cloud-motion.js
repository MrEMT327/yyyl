// Presentation-only cloud profiles copied from chapter 1 s_map0017_2,
// native layers 2 and 5. They never modify simulation map data or progression.
export const COAST_CLOUD_MOTION = Object.freeze({
  far:Object.freeze({chapter:1,layer:2,moveSpeed:2,mulSpeed:1,verticalDistance:-300,moveScale:.5,loopLength:200,denominator:100}),
  near:Object.freeze({chapter:1,layer:5,moveSpeed:12,mulSpeed:1,verticalDistance:-30,moveScale:-5,loopLength:200,denominator:100}),
});

// The fixed overhead camera still needs the source camera compensation.
// Derive it from the current camera, so pause, seeking and a new run carry no
// stale integration state. Float steps follow NativeMapCameraOffsets.update.
export function sampleCoastCloudMotion(profile, elapsed, camera, unitsPerWorld) {
  const distance = Math.abs(Math.fround(profile.verticalDistance));
  const factor = Math.fround(distance / Math.fround(Math.fround(profile.denominator) + distance));
  const offset = value => Math.fround(0 + Math.fround(Math.fround(Math.fround(value) * factor) * Math.fround(profile.moveScale)));
  return {
    // Optional authored drift keeps the city cloud/ground speed gap coherent.
    // With no drift, the original native cloud profile is unchanged.
    moduleTravel:(elapsed * profile.moveSpeed * profile.mulSpeed + elapsed * (profile.groundDrift ?? 0) - offset(camera.z) + camera.z) * unitsPerWorld,
    moduleLoopLength:profile.loopLength,
    moduleUnitsPerWorld:unitsPerWorld,
    lateralOffset:(offset(camera.x) - camera.x) * unitsPerWorld,
  };
}

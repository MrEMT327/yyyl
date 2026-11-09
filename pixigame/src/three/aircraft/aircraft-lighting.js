import { ACESFilmicToneMapping, DirectionalLight, HemisphereLight } from 'three';

// Approved equipment-screen illustration: broad cool light, restrained metal
// reflections and a readable dark canopy. Cameras stay specific to each view.
export const AIRCRAFT_RENDER_STYLE = Object.freeze({ exposure: 1.08, environmentIntensity: .6 });

export function createAircraftLighting(scene) {
  scene.environmentIntensity = AIRCRAFT_RENDER_STYLE.environmentIntensity;
  const hemisphere = new HemisphereLight('#e7f6ff', '#566a88', 1.05);
  scene.add(hemisphere);
  const lights = [
    ['#ffffff', 2.7, [-10, 22, -12]],
    ['#96d8ff', 1.15, [14, 7, -3]],
    ['#b5c9dd', 1.9, [3, 12, 16]],
  ].map(([color, intensity, position]) => {
    const light = new DirectionalLight(color, intensity);
    light.position.set(...position); scene.add(light); return light;
  });
  return { hemisphere, lights };
}

// Only combat opts into this rig. Equipment and other views retain the exact
// approved studio settings; day restores those settings after a night run.
export function updateAircraftNightLighting(rig,enabled) {
  const night=Boolean(enabled);if(rig.night===night)return;rig.night=night;
  rig.hemisphere.color.set(night?'#b6d1ff':'#e7f6ff');
  rig.hemisphere.groundColor.set(night?'#253b60':'#566a88');
  rig.hemisphere.intensity=night?.68:1.05;
  const colors=night?['#c8dcff','#9dd3ff','#728bb8']:['#ffffff','#96d8ff','#b5c9dd'];
  const powers=night?[1.25,2.1,.75]:[2.7,1.15,1.9];
  rig.lights.forEach((light,i)=>{light.color.set(colors[i]);light.intensity=powers[i];});
}

// Battle terrain and HUD share renderers with aircraft. Restore their settings
// after the aircraft pass rather than changing the whole scene's appearance.
export function renderWithAircraftStyle(renderer, draw) {
  const toneMapping = renderer.toneMapping, exposure = renderer.toneMappingExposure;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = AIRCRAFT_RENDER_STYLE.exposure;
  try { return draw(); }
  finally { renderer.toneMapping = toneMapping; renderer.toneMappingExposure = exposure; }
}

import { Vector3 } from 'three';

export function setShowroomCameraPreset(camera, controls, preset) {
  // Drain drag inertia before placing the camera, including a preset clicked
  // immediately after releasing a drag. Otherwise damping rotates the preset.
  const damping = controls.enableDamping;
  controls.enableDamping = false;
  controls.update();
  if (preset === 'top') {
    const distance = camera.position.distanceTo(controls.target);
    // Aircraft nose is local -Z. Looking down from +Y with a small +Z offset
    // places -Z at the top of the screen and preserves the current zoom.
    const polar = Math.max(.001, controls.minPolarAngle);
    camera.position.copy(controls.target).add(new Vector3(0, Math.cos(polar) * distance, Math.sin(polar) * distance));
  } else {
    controls.target.set(0, .15, -.4);
    camera.position.set(10.5, 13.5, -19);
  }
  controls.update();
  controls.enableDamping = damping;
}

import * as T from "three";
export const BATTLE_VIEW = Object.freeze({
  width: 600,
  height: 1300,
  tilt: 0.65,
  fov: 28,
});
// Weak perspective, not a chase camera. Preserve physical model proportions.
export function createBattleCamera() {
  const { width, height, tilt, fov } = BATTLE_VIEW;
  const distance = height / 2 / Math.tan(T.MathUtils.degToRad(fov / 2));
  const camera = new T.PerspectiveCamera(fov, width / height, 10, 10000);
  camera.position.set(
    width / 2,
    Math.cos(tilt) * distance,
    height / 2 + Math.sin(tilt) * distance,
  );
  camera.up.set(0, 0, -1);
  camera.lookAt(width / 2, 0, height / 2);
  camera.updateMatrixWorld();
  return camera;
}
export function battleToScreen(camera, x, y, altitude = 0) {
  const p = new T.Vector3(x, altitude, y).project(camera);
  return { x: (p.x + 1) * 300, y: (1 - p.y) * 650 };
}
export function screenToBattle(camera, x, y) {
  const ray = new T.Raycaster();
  ray.setFromCamera(new T.Vector2(x / 300 - 1, 1 - y / 650), camera);
  const p = ray.ray.intersectPlane(
    new T.Plane(new T.Vector3(0, 1, 0), 0),
    new T.Vector3(),
  );
  return p ? { x: p.x, y: p.z } : { x: 300, y: 650 };
}

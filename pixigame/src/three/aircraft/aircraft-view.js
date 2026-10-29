import * as T from "three";
import { Container } from "../display.js";
import { Airframe } from "./Airframe.js";
import { jetMaterial, shieldMaterial } from "./FlightMaterials.js";

export function flightRollAngle(remaining,direction=1){
  if(!(remaining>0))return 0;
  const t=T.MathUtils.clamp(1-remaining/.72,0,1);
  return (t*t*(3-2*t))*Math.PI*2*(direction<0?-1:1);
}

// Native shader meshes also participate in rectangular UI scroll clipping.
function clipShader(material) {
  material.clipping = true;
  material.vertexShader =
    "#include <clipping_planes_pars_vertex>\n" +
    material.vertexShader.replace(
      "void main(){",
      "void main(){\nvec4 mvPosition=modelViewMatrix*vec4(position,1.);\n#include <clipping_planes_vertex>\n",
    );
  material.fragmentShader =
    "#include <clipping_planes_pars_fragment>\n" +
    material.fragmentShader.replace(
      "void main(){",
      "void main(){\n#include <clipping_planes_fragment>\n",
    );
  return material;
}

// Immutable hardware is shared across hangar previews and the combat instance.
let template;
function hardware() {
  if (!template) {
    template = new T.Group();
    new Airframe(template);
  }
  return template.clone(true);
}
export function createKestrelView({ size = 22, color = 0x42caff, presentationTilt = 0 } = {}) {
  const view = new Container({ label: "kestrel-three-model" });
  view._bounds = {
    x: -8 * size,
    y: -8 * size,
    width: 16 * size,
    height: 16 * size,
  };
  const mount = new T.Group();
  mount.rotation.x = Math.PI / 2;
  mount.scale.set(size, size, -size);
  const body = hardware();
  // Each instance owns its materials, while keeping immutable geometry shared.
  body.traverse((n) => {
    if (n.material) {
      n.material = n.material.clone();
      n.material.transparent = true;
      n.material.userData.hullBase = n.material.color?.clone();
    }
  });
  mount.add(body);
  view.object3D.add(mount);
  const jets = [];
  for (const x of [-2.45, 2.45]) {
    const g = new T.BoxGeometry(2.6, 2.6, 1).translate(0, 0, 0.5);
    const m = clipShader(jetMaterial());
    m.uniforms.uColor.value.set(color);
    m.uniforms.uSteps.value = 16;
    const jet = new T.Mesh(g, m);
    jet.position.set(x, -0.12, 4.65);
    jet.scale.set(0.7, 0.7, 5);
    body.add(jet);
    jets.push(jet);
    const inverse = new T.Matrix4();
    jet.onBeforeRender = (_renderer, _scene, camera) => {
      inverse.copy(jet.matrixWorld).invert();
      camera.getWorldPosition(m.uniforms.uEye.value).applyMatrix4(inverse);
      camera
        .getWorldDirection(m.uniforms.uRayDir.value)
        .transformDirection(inverse);
      m.uniforms.uOrthographic.value = camera.isOrthographicCamera ? 1 : 0;
    };
  }
  const shield = new T.Mesh(
    new T.SphereGeometry(1, 24, 12),
    clipShader(shieldMaterial()),
  );
  shield.material.uniforms.uGain.value = 0.7;
  shield.material.uniforms.uColor.value.set(color);
  shield.scale.set(9.2, 2.7, 8.8);
  shield.visible = false;
  mount.add(shield);
  const pose = { bank: 0, pitch: 0, roll: 0 };
  view.flightPose = pose;
  view.updateAircraft = (
    time,
    { bank, pitch, roll, boost = false, shielded = false, shieldStrength = 1, hullColor } = {},
  ) => {
    if (bank !== undefined) pose.bank = T.MathUtils.clamp(bank, -0.28, 0.28);
    if (pitch !== undefined) pose.pitch = T.MathUtils.clamp(pitch, -0.06, 0.06);
    if (roll !== undefined) pose.roll = Number.isFinite(roll)?T.MathUtils.clamp(roll,-Math.PI*2,Math.PI*2):0;
    // Battle attitude is neutral at rest. Only the shared world camera tilts
    // the view; presentationTilt is reserved for isolated hangar previews.
    body.rotation.y = 0;
    body.rotation.z = pose.bank + pose.roll;
    body.rotation.x = -presentationTilt + pose.pitch;
    shield.visible = shielded;
    const protection = Number.isFinite(shieldStrength) ? T.MathUtils.clamp(shieldStrength,0,1) : 1;
    shield.material.uniforms.uGain.value = .7 * protection;
    shield.scale.set(9.2, 2.7, 8.8).multiplyScalar(.94 + .06 * protection);
    shield.rotation.y = time * 0.13;
    shield.material.uniforms.uTime.value = time;
    jets.forEach((j, i) => {
      j.scale.z = 5 * (boost ? 1.6 : 1) * (1 + Math.sin(time * 31 + i) * 0.08);
      j.material.uniforms.uTime.value = time;
      j.material.uniforms.uThrottle.value = boost ? 1 : 0;
    });
    if (hullColor != null && view._hullColor !== hullColor) {
      view._hullColor = hullColor;
      body.traverse((n) => {
        if (n.material?.isMeshStandardMaterial) {
          n.material.color
            .copy(n.material.userData.hullBase)
            .lerp(new T.Color(hullColor), 0.06);
          n.material.userData.baseColor = n.material.color.clone();
        }
      });
    }
  };
  view._disposeVisuals = () => {
    body.traverse((n) => n.material?.dispose());
    for (const j of jets) j.geometry.dispose();
    shield.geometry.dispose();
    shield.material.dispose();
  };
  view.updateAircraft(0);
  return view;
}

export { createEnemyModel } from './enemy-airframe.js';

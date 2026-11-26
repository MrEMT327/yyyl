import {Vector4} from 'three';
import {Sprite} from '../three/display.js';

const warningUniforms = 'uniform vec4 warningLights;\nuniform vec4 warningPose;\nuniform float warningBoss;\n';
const warningFragment = `
#ifdef USE_MAP
  vec2 warningUv = vec2(vMapUv.x, 1. - vMapUv.y);
  float wingDistance = min(warningUv.x, 1. - warningUv.x);
  // Stretch the authored rails across the far ends without stretching the plaque.
  float wingInset = .052 * (1. - smoothstep(.012, .195, wingDistance));
  vec2 warningSampleUv = vMapUv + vec2(warningUv.x < .5 ? wingInset : -wingInset, 0.);
  vec4 warningArt = texture2D(map, warningSampleUv);
  float peak = max(warningArt.r, max(warningArt.g, warningArt.b));
  float chroma = peak - min(warningArt.r, min(warningArt.g, warningArt.b));

  // The plate keeps its body. The wings key out their dark backing and feather
  // only at the last few percent of the screen so the red stripes reach the edge.
  float plaque = smoothstep(.176, .208, wingDistance);
  float softEdge = smoothstep(.002, .048, wingDistance);
  float wingReach = mix(-.041, .255, warningPose.y);
  float wingMask = 1. - smoothstep(wingReach - .019, wingReach + .021, wingDistance);
  float rails = smoothstep(.012, .114, chroma) * wingMask;
  float plate = max(smoothstep(.004, .031, chroma), smoothstep(.028, .111, peak));
  // Key the neutral PNG matte at the silhouette, but keep dark red behind the
  // lettering opaque. Otherwise changes in the scenery show through the plaque.
  float backing = smoothstep(.20, .25, wingDistance) * smoothstep(.20, .33, warningUv.y)
    * (1. - smoothstep(.76, .88, warningUv.y));
  plate = max(plate, backing * smoothstep(.0025, .011, warningArt.r - warningArt.g));
  float artAlpha = warningArt.a * softEdge * mix(rails, plate * warningPose.x, plaque);

  float warningGlow = 0.;
  if (warningLights.y > 0.) {
    float laneTop = mix(.44, .28, warningBoss);
    float laneHeight = mix(.23, .15, warningBoss);
    float lane = (warningUv.y - laneTop) / laneHeight;
    float track = (1. - plaque) * smoothstep(0., .12, lane) * (1. - smoothstep(.86, 1., lane));
    float scanX = mix(-.043, .259, warningLights.x);
    float dist = abs(wingDistance - scanX + (.5 - lane) * .04);
    float core = 1. - smoothstep(.006, .025, dist);
    float halo = 1. - smoothstep(.016, .057, dist);
    warningGlow = warningLights.y * track * (.92 * core + .43 * halo);
  }
  if (warningLights.z >= 0.) {
    vec2 fromCenter = warningUv - vec2(.5, .55);
    float side = abs(fromCenter.x);
    float upper = mix(.313, .228, smoothstep(.151, .170, side));
    float lower = mix(.870, .801, smoothstep(.169, .187, side));
    float horizontal = 1. - smoothstep(.009, .042, min(abs(warningUv.y - upper), abs(warningUv.y - lower)));
    float diagonal = 1. - smoothstep(.006, .031, abs(side - mix(.305, .247, smoothstep(.285, .8, warningUv.y))));
    float edge = smoothstep(.093, .43, chroma) * max(horizontal, diagonal) * step(.175, wingDistance);
    float angle = atan(fromCenter.y * .57, fromCenter.x) / 6.2831853;
    float distanceOnRim = abs(fract(angle + .25 - warningLights.z + .5) - .5);
    float glint = 1. - smoothstep(.025, .13, distanceOnRim);
    float ends = smoothstep(0., .10, warningLights.z) * (1. - smoothstep(.9, 1., warningLights.z));
    warningGlow = max(warningGlow, edge * glint * ends * 1.17);
  }
  if (warningLights.w > 0.) {
    float bottom = 1. - smoothstep(.011, .034, abs(warningUv.y - .856));
    float middle = 1. - smoothstep(.1, .185, abs(warningUv.x - .5));
    warningGlow = max(warningGlow, warningLights.w * bottom * middle);
  }
  vec3 tint = mix(vec3(1., .62, .40), vec3(1., .78, .48), warningBoss);
  // Tighten the sampled white glyph edges without sharpening the authored glow.
  float titleBand = smoothstep(.335, .355, wingDistance) * smoothstep(.36, .405, warningUv.y)
    * (1. - smoothstep(.735, .78, warningUv.y));
  float ink = min(warningArt.g, warningArt.b);
  float edgeContrast = (smoothstep(.065, .85, ink) - ink) * smoothstep(.03, .13, ink);
  vec3 face = clamp(warningArt.rgb + .72 * titleBand * edgeContrast, 0., 1.);
  vec3 litArt = face + (1. - face) * tint * clamp(warningGlow, 0., 1.);
  vec2 shadeDistance = (warningUv - vec2(.5, .53)) / vec2(.44, .49);
  float shade = warningPose.z * (1. - smoothstep(.18, 1., dot(shadeDistance, shadeDistance)));
  float shadeBehindArt = shade * (1. - artAlpha);
  float cover = artAlpha + shadeBehindArt;
  vec3 premultiplied = litArt * artAlpha + vec3(.010, .003, .006) * shadeBehindArt;

  // The Boss artwork collapses into a narrow, soft light as its real HUD takes over.
  float exitLight = warningPose.w * (1. - smoothstep(.024, .106, abs(warningUv.y - .55)))
    * (1. - smoothstep(.10, .44, abs(warningUv.x - .5)));
  premultiplied = mix(premultiplied, vec3(1., .62, .30), exitLight);
  cover = mix(cover, 1., exitLight);
  diffuseColor.rgb *= premultiplied / max(cover, .00001);
  diffuseColor.a *= cover;
#endif
`;

export class EncounterWarningSprite extends Sprite {
  constructor() {
    super();
    this.lights = { value: new Vector4() };
    this.pose = { value: new Vector4() };
    this.boss = { value: 0 };
  }

  setWarningFrame(frame) {
    this.lights.value.set(frame.sweep, frame.sweepAlpha, frame.rim, frame.edgeAlpha);
    this.pose.value.set(frame.plate, frame.wings, frame.shade, frame.exitLight);
    this.boss.value = frame.type === 2 ? 1 : 0;
  }

  _prepare() {
    const previous = this._mesh?.material;
    super._prepare();
    const material = this._mesh.material;
    if (material === previous) return;
    // Alpha-tested sprites stay out of the flat HUD batch so this material is preserved.
    material.alphaTest = .002;
    material.onBeforeCompile = shader => {
      shader.uniforms.warningLights = this.lights;
      shader.uniforms.warningPose = this.pose;
      shader.uniforms.warningBoss = this.boss;
      shader.fragmentShader = warningUniforms + shader.fragmentShader.replace(
        '#include <map_fragment>', warningFragment,
      );
    };
  }
}

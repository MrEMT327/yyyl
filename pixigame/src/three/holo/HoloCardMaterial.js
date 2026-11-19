import * as THREE from 'three';
// Adapted from the user's E:/_games/镭射卡 project. Render-target artwork is
// already linear; preserve its colour space when using live combat as card art.

const PRESETS = {
  'Soft Foil': { foilStrength: 0.68, rainbowFrequency: 4.8, viewShift: 1.35, warp: 0.12, sparkleAmount: 0.34, sparkleDensity: 108, sparkleSize: 0.13, motionBoost: 0.42, foilRoughness: 0.18, foilMetalness: 0.46, iridescence: 0.56 },
  'Rainbow Rare': { foilStrength: 1.05, rainbowFrequency: 7.8, viewShift: 2.05, warp: 0.21, sparkleAmount: 0.58, sparkleDensity: 135, sparkleSize: 0.108, motionBoost: 0.78, foilRoughness: 0.13, foilMetalness: 0.62, iridescence: 0.78 },
  'Prism': { foilStrength: 1.18, rainbowFrequency: 10.8, viewShift: 2.55, warp: 0.28, sparkleAmount: 0.64, sparkleDensity: 154, sparkleSize: 0.094, motionBoost: 0.88, foilRoughness: 0.11, foilMetalness: 0.72, iridescence: 0.86 },
  'Cosmos': { foilStrength: 0.92, rainbowFrequency: 6.1, viewShift: 2.25, warp: 0.38, sparkleAmount: 0.82, sparkleDensity: 182, sparkleSize: 0.079, motionBoost: 0.94, foilRoughness: 0.16, foilMetalness: 0.58, iridescence: 0.70 },
  'Dark Holo': { foilStrength: 0.78, rainbowFrequency: 8.9, viewShift: 2.7, warp: 0.24, sparkleAmount: 0.48, sparkleDensity: 148, sparkleSize: 0.086, motionBoost: 0.68, foilRoughness: 0.15, foilMetalness: 0.76, iridescence: 0.60 }
};

export { PRESETS };

export function createHoloCardMaterial({ map, foilMask, side = THREE.FrontSide }) {
  if (!map.isRenderTargetTexture) map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;
  foilMask.colorSpace = THREE.NoColorSpace;
  foilMask.anisotropy = 4;

  const uniforms = {
    uFoilMask: { value: foilMask },
    uFoilStrength: { value: PRESETS['Rainbow Rare'].foilStrength },
    uRainbowFrequency: { value: PRESETS['Rainbow Rare'].rainbowFrequency },
    uViewShift: { value: PRESETS['Rainbow Rare'].viewShift },
    uWarp: { value: PRESETS['Rainbow Rare'].warp },
    uSparkleAmount: { value: PRESETS['Rainbow Rare'].sparkleAmount },
    uSparkleDensity: { value: PRESETS['Rainbow Rare'].sparkleDensity },
    uSparkleSize: { value: PRESETS['Rainbow Rare'].sparkleSize },
    uMotionBoost: { value: 0.0 },
    uMotionGain: { value: PRESETS['Rainbow Rare'].motionBoost },
    uFoilRoughness: { value: PRESETS['Rainbow Rare'].foilRoughness },
    uFoilMetalness: { value: PRESETS['Rainbow Rare'].foilMetalness },
    uCardRight: { value: new THREE.Vector3(1, 0, 0) },
    uCardUp: { value: new THREE.Vector3(0, 1, 0) },
    uTime: { value: 0 }
  };

  const material = new THREE.MeshPhysicalMaterial({
    map,
    side,
    roughness: 0.35,
    metalness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.07,
    iridescence: PRESETS['Rainbow Rare'].iridescence,
    iridescenceIOR: 1.38,
    iridescenceThicknessRange: [120, 520],
    iridescenceMap: foilMask,
    envMapIntensity: 1.25,
    transparent: false
  });

  material.userData.holoUniforms = uniforms;
  material.customProgramCacheKey = () => 'thunder-holo-upgrade-v1';

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    material.userData.shader = shader;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vHoloWorldPos;\nvarying vec3 vHoloWorldNormal;`
      )
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>\nvec4 holoWorldPos = modelMatrix * vec4( transformed, 1.0 );\nvHoloWorldPos = holoWorldPos.xyz;\nvHoloWorldNormal = normalize( mat3( modelMatrix ) * objectNormal );`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform sampler2D uFoilMask;
        uniform float uFoilStrength;
        uniform float uRainbowFrequency;
        uniform float uViewShift;
        uniform float uWarp;
        uniform float uSparkleAmount;
        uniform float uSparkleDensity;
        uniform float uSparkleSize;
        uniform float uMotionBoost;
        uniform float uMotionGain;
        uniform float uFoilRoughness;
        uniform float uFoilMetalness;
        uniform vec3 uCardRight;
        uniform vec3 uCardUp;
        uniform float uTime;
        varying vec3 vHoloWorldPos;
        varying vec3 vHoloWorldNormal;

        float holoHash21(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }

        vec2 holoHash22(vec2 p) {
          float n = holoHash21(p);
          return fract(vec2(n, n * 1.713 + .137) * vec2(17.17, 29.73));
        }

        vec3 holoSpectrum(float phase) {
          return .5 + .5 * cos(6.2831853 * (phase + vec3(0.0, .333333, .666667)));
        }

        float sdEquilateralTriangle(vec2 p, float r) {
          const float k = 1.7320508;
          p.x = abs(p.x) - r;
          p.y = p.y + r / k;
          if (p.x + k * p.y > 0.0) p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
          p.x -= clamp(p.x, -2.0 * r, 0.0);
          return -length(p) * sign(p.y);
        }`
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float holoMask = texture2D(uFoilMask, vMapUv).r;
        holoMask = smoothstep(.06, .74, holoMask);

        vec3 holoN = normalize(vHoloWorldNormal);
        vec3 holoV = normalize(cameraPosition - vHoloWorldPos);
        vec3 holoR = reflect(-holoV, holoN);
        vec2 holoTilt = vec2(dot(holoR, normalize(uCardRight)), dot(holoR, normalize(uCardUp)));

        float holoWarp = sin(vMapUv.y * 31.0 + vMapUv.x * 13.0) * uWarp * .20;
        holoWarp += sin(vMapUv.x * 71.0 - vMapUv.y * 17.0) * uWarp * .06;

        vec2 holoDirA = normalize(vec2(.82, .57));
        vec2 holoDirB = normalize(vec2(-.48, .88));
        float holoPhaseA = dot(vMapUv * vec2(1.0, 1.21), holoDirA) * uRainbowFrequency;
        holoPhaseA += dot(holoTilt, holoDirA) * uViewShift + holoWarp;
        float holoPhaseB = dot(vMapUv * vec2(1.12, .92), holoDirB) * (uRainbowFrequency * .58);
        holoPhaseB += dot(holoTilt, holoDirB) * (uViewShift * 1.18) - holoWarp * .7;

        vec3 holoRainbowA = holoSpectrum(holoPhaseA);
        vec3 holoRainbowB = holoSpectrum(holoPhaseB + .16);
        float holoLineA = .5 + .5 * sin((vMapUv.x * .72 + vMapUv.y) * uRainbowFrequency * 19.0 + dot(holoTilt, vec2(11.0, -7.0)));
        holoLineA = smoothstep(.56, .96, holoLineA) * .36;
        float holoLineB = .5 + .5 * sin((vMapUv.x * 1.24 - vMapUv.y * .46) * uRainbowFrequency * 14.0 + dot(holoTilt, vec2(-8.0, 9.0)));
        holoLineB = smoothstep(.70, .98, holoLineB) * .18;

        float sweep = exp(-pow((dot(vMapUv - .5, normalize(vec2(.74, .68))) + dot(holoTilt, vec2(.38, -.23))) * 4.2, 2.0));
        vec3 holoFoil = mix(holoRainbowA, holoRainbowB, .35 + holoLineB) * (1.0 + holoLineA + sweep * 1.1);

        vec2 holoGrid = vMapUv * uSparkleDensity;
        vec2 holoCell = floor(holoGrid);
        vec2 holoLocal = fract(holoGrid) - .5;
        vec2 holoJitter = (holoHash22(holoCell) - .5) * .66;
        float holoRnd = holoHash21(holoCell + 19.17);
        float holoAng = holoRnd * 6.2831853;
        mat2 holoRot = mat2(cos(holoAng), -sin(holoAng), sin(holoAng), cos(holoAng));
        vec2 holoTri = holoRot * (holoLocal - holoJitter);
        float holoTriSize = uSparkleSize * mix(.74, 1.38, holoHash21(holoCell + 3.91));
        float holoSD = sdEquilateralTriangle(holoTri, holoTriSize);
        float holoAA = fwidth(holoSD) + .0015;
        float holoTriMask = 1.0 - smoothstep(0.0, holoAA * 2.2, holoSD);
        float holoTriHalo = exp(-max(holoSD, 0.0) * 42.0) * .22;

        vec2 holoMicroDir = vec2(cos(holoAng), sin(holoAng));
        float holoGlintWave = .5 + .5 * sin(dot(holoTilt, holoMicroDir) * 37.0 + holoRnd * 21.0 + uTime * .05);
        float holoGlint = pow(holoGlintWave, 15.0);
        float holoSpark = (holoTriMask + holoTriHalo) * holoGlint * (uSparkleAmount + uMotionBoost * uMotionGain) * 1.18 * step(.84, holoRnd);

        float holoFresnel = pow(1.0 - clamp(dot(holoN, holoV), 0.0, 1.0), 2.3);
        float holoMix = clamp(holoMask * uFoilStrength, 0.0, 1.4);
        vec3 holoTintedBase = diffuseColor.rgb * (0.76 + holoFoil * .58);
        holoTintedBase += holoFoil * (.12 + holoFresnel * .28 + sweep * .34);
        holoTintedBase += holoSpark * vec3(1.95, 1.92, 2.08);
        diffuseColor.rgb = mix(diffuseColor.rgb, holoTintedBase, holoMix);
        `
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, uFoilRoughness, holoMask);`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, uFoilMetalness, holoMask);`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>\ntotalEmissiveRadiance += holoMask * (holoSpark * vec3(.78, .88, 1.0) + sweep * .16 * vec3(.22, .35, .8));`
      )
      .replace(
        '#include <opaque_fragment>',
        // Preserve printed ink in the game's UI studio. Reflection belongs
        // primarily to the foil, not the small type or navy background.
        `outgoingLight = mix(diffuseColor.rgb, outgoingLight, .015 + holoMask * .16);\n#include <opaque_fragment>`
      );
  };

  material.needsUpdate = true;
  return material;
}

export function applyPreset(material, presetName) {
  const p = PRESETS[presetName] ?? PRESETS['Rainbow Rare'];
  const u = material.userData.holoUniforms;
  u.uFoilStrength.value = p.foilStrength;
  u.uRainbowFrequency.value = p.rainbowFrequency;
  u.uViewShift.value = p.viewShift;
  u.uWarp.value = p.warp;
  u.uSparkleAmount.value = p.sparkleAmount;
  u.uSparkleDensity.value = p.sparkleDensity;
  u.uSparkleSize.value = p.sparkleSize;
  u.uMotionGain.value = p.motionBoost;
  u.uFoilRoughness.value = p.foilRoughness;
  u.uFoilMetalness.value = p.foilMetalness;
  material.iridescence = p.iridescence;
}

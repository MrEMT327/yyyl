import * as T from 'three';

export const HOSTILE_PROJECTILE_COLOR = 0xff263e;
export const HOSTILE_PROJECTILE_HALF_SIZE = 16;
// The red rim is the damaging body; the dark outline and faint halo are cosmetic.
export const HOSTILE_PROJECTILE_RIM = .56;

// Red hostile orb with a dark outline and a pale red core.
export function createHostileProjectileParts() {
  const material = new T.ShaderMaterial({
    name: 'Hostile / red bolt',
    transparent: true, depthWrite: false, depthTest: false, side: T.DoubleSide,
    toneMapped: false,
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vShotColor;
      void main() {
        vUv = uv;
        vShotColor = vec3(1., .0194, .0482);
        #ifdef USE_INSTANCING_COLOR
          vShotColor = instanceColor;
        #endif
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        gl_Position = projectionMatrix * modelViewMatrix * p;
      }`,
    fragmentShader: `
      varying vec2 vUv;
      varying vec3 vShotColor;
      void main() {
        vec2 p = (vUv - .5) * 2.;
        float r = length(p);
        float aa = max(fwidth(r), .008);
        float body = 1. - smoothstep(.69-aa, .69+aa, r);
        // Slightly faceted hot core, rather than a specular dot on a red bead.
        float theta = atan(p.y, p.x);
        float coreRadius = .28 + .02*cos(theta*6.) + .01*sin(theta*9.);
        float core = 1. - smoothstep(coreRadius-aa, coreRadius+.085, r);
        float hotRim = 1. - smoothstep(${HOSTILE_PROJECTILE_RIM}-.02-aa, ${HOSTILE_PROJECTILE_RIM}+.02+aa, r);
        // Keep a colored middle and opaque dark outline on both pale rock and
        // dark water. The readable core is not dependent on additive bloom.
        vec3 shellColor = vShotColor;
        vec3 color = mix(vec3(.012,.022,.04), shellColor, hotRim);
        color = mix(color, vec3(1.,.72,.76), core);
        float halo = .16*exp(-r*r*4.8);
        float alpha = max(body,halo)*(1.-smoothstep(.84,1.,r));
        if(alpha<.005)discard;
        gl_FragColor = vec4(mix(vShotColor,color,body),alpha);
        #include <colorspace_fragment>
      }`,
  });
  return [{ geometry: new T.PlaneGeometry(HOSTILE_PROJECTILE_HALF_SIZE * 2, HOSTILE_PROJECTILE_HALF_SIZE * 2), material, glowing: false }];
}

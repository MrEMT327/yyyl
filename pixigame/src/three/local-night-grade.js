import {BATTLE_WEATHERS} from '../replica/battle-weather.js';

// Apply the same night tint inside the world pass. Emission can then
// be added after grading, while later cloud draws still occlude it normally.
const tint=BATTLE_WEATHERS.find(p=>p.id==='night').groundTint;
const channels=[16,8,0].map(shift=>((tint>>shift)&255)/255);
export function gradeLocalNightMaterial(material,night){
  if(material.userData.localNightGrade)return;
  material.userData.localNightGrade=true;
  const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.localWorldNight=night;shader.uniforms.localWorldNightTint={value:channels};
    shader.fragmentShader='uniform float localWorldNight;uniform vec3 localWorldNightTint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',
      '#include <colorspace_fragment>\ngl_FragColor.rgb*=mix(vec3(1.),localWorldNightTint,localWorldNight);');
  };
  material.customProgramCacheKey=function(){return cacheKey.call(this)+'-local-night-v1';};
}

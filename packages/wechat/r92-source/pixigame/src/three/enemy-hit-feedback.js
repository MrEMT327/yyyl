import * as T from 'three';

const continuous=new Set(['beam','freeze','toxin','orb','pyro','lightmine','ember']);
const heavyWeapons=new Set(['rail','rocket','grenade','mine','gravity','blades']);
const colors={freeze:0x9fe6ff,toxin:0x9dda66,pyro:0xffa75e,ember:0xffa75e,lightmine:0xe5f4ff,beam:0xa7e5ff,orb:0xb6ddff,lightning:0xc6c6ff};
export function hitFeedbackProfile(mechanic,heavy=false,reduced=false){
  const sustained=continuous.has(mechanic),strong=heavyWeapons.has(mechanic)||!mechanic&&heavy;
  return {kind:sustained?'continuous':strong?'heavy':'normal',color:colors[mechanic]||0xffdeb0,
    duration:sustained?.08:strong?.1:.065,cooldown:sustained?.4:strong?.25:.15,
    strength:reduced||sustained?0:strong?.035:.015,gain:reduced?.08:sustained?.14:strong?.65:.4};
}

export function hitFeedbackPriority(profile){
  return profile?.kind==='heavy'?2:profile?.kind==='normal'?1:0;
}
export function canOverrideHitFeedback(current,incoming){
  return incoming?.kind==='heavy'&&hitFeedbackPriority(incoming)>hitFeedbackPriority(current);
}

// A small contact patch for atlas enemies, without erasing the whole sprite.
// Uses the same mesh and texture; no extra overlay or draw call.
export function createSpriteHitFeedback(material,radius){
  const uniforms={spriteHitCenter:{value:new T.Vector2()},spriteHitRadius:{value:radius*.75},
    spriteHitGain:{value:0},spriteHitColor:{value:new T.Color()}};
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='varying vec2 vSpriteHitPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvSpriteHitPosition=position.xy;');
    shader.fragmentShader='varying vec2 vSpriteHitPosition;\nuniform vec2 spriteHitCenter;\nuniform float spriteHitRadius,spriteHitGain;\nuniform vec3 spriteHitColor;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nfloat hitPatch=1.-smoothstep(0.,1.,distance(vSpriteHitPosition,spriteHitCenter)/max(.001,spriteHitRadius));\ndiffuseColor.rgb=mix(diffuseColor.rgb,spriteHitColor,hitPatch*spriteHitGain);');
  };
  material.customProgramCacheKey=()=> 'enemy-atlas-contact-v1';
  let clock=0,next=-Infinity,pulse=null,lastProfile=null;
  return {
    trigger(profile,angle=0){
      if(clock<next&&!canOverrideHitFeedback(lastProfile,profile))return false;
      lastProfile=profile;
      pulse={...profile,at:clock};next=clock+Math.max(profile.cooldown,profile.duration);
      uniforms.spriteHitCenter.value.set(Math.cos(angle)*radius*.3,Math.sin(angle)*radius*.3);
      uniforms.spriteHitColor.value.set(profile.color);return true;
    },
    update(time){
      clock=time;
      const progress=pulse?Math.max(0,(clock-pulse.at)/pulse.duration):1;
      uniforms.spriteHitGain.value=progress>=1?0:pulse.gain*(1-progress)**1.5;
      if(progress>=1)pulse=null;
    },
  };
}

// One set of uniforms per aircraft; no extra meshes, lights or draw calls.
// Add light only near the contact patch, preserving the original PBR color.
export function createEnemyHitFeedback(materials,body,mount){
  const box=new T.Box3().setFromObject(body),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  const local=new T.Vector3(),scale=new T.Vector3(),uniforms={
    enemyHitCenter:{value:new T.Vector3()},enemyHitRadius:{value:1},enemyHitGain:{value:0},enemyHitColor:{value:new T.Color()},
  };
  const syncWorld=()=>{
    if(uniforms.enemyHitGain.value<=0)return;
    mount.updateWorldMatrix(true,false);uniforms.enemyHitCenter.value.copy(local);mount.localToWorld(uniforms.enemyHitCenter.value);
    mount.getWorldScale(scale);uniforms.enemyHitRadius.value=Math.max(size.x,size.z)*.36*Math.max(Math.abs(scale.x),Math.abs(scale.z));
  };
  const armor=['shell','paint','edge','gun','dark'];
  for(const key of armor){
    const mat=materials[key];if(!mat)continue;
    mat.userData.nativeHitFeedback={uniforms,syncWorld};
    mat.onBeforeRender=syncWorld;
    mat.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,uniforms);
      shader.vertexShader='varying vec3 vEnemyHitPosition;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvEnemyHitPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
      shader.fragmentShader='varying vec3 vEnemyHitPosition;\nuniform vec3 enemyHitCenter,enemyHitColor;\nuniform float enemyHitRadius,enemyHitGain;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\nfloat hitPatch=1.0-smoothstep(0.12,1.0,length(vEnemyHitPosition-enemyHitCenter)/max(0.001,enemyHitRadius));\ntotalEmissiveRadiance+=enemyHitColor*enemyHitGain*hitPatch;');
    };
    mat.customProgramCacheKey=()=> 'enemy-contact-light-v1';
  }
  let clock=0,pulse=null,next=-Infinity,lastProfile=null;
  return {
    trigger(profile,angle=0){
      if(clock<next&&!canOverrideHitFeedback(lastProfile,profile))return false;
      lastProfile=profile;
      pulse={...profile,at:clock};next=clock+profile.cooldown;
      // Contact direction is visual only; collision centers stay untouched.
      local.set(center.x+Math.sin(angle)*size.x*.24,box.max.y-size.y*.2,center.z+Math.cos(angle)*size.z*.26);
      uniforms.enemyHitColor.value.set(profile.color);return true;
    },
    update(time){
      clock=Number.isFinite(time)?time:clock;
      if(!pulse)return;
      const t=Math.max(0,(clock-pulse.at)/pulse.duration);
      uniforms.enemyHitGain.value=t>=1?0:pulse.gain*(1-t)**1.5;
      if(t>=1){pulse=null;return;}
      syncWorld();
    },
    snapshot(){return {kind:pulse?.kind||null,gain:uniforms.enemyHitGain.value,position:uniforms.enemyHitCenter.value.toArray()};},
  };
}

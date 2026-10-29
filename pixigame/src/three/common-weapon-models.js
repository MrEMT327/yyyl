import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {grenadeHop, moltenSquash} from './common-weapon-motion.js';
import {loadDroneSpriteAssets} from './drone-sprite-models.js';

export const COMMON_MODEL_IDS=['cannon','rail','rocket','scatter','sidegun','grenade','mine','mine_core','lightmine','pyro','ember','orb','shield','blade','tail','drone','mother','ice'];
export const commonModelAssets={ready:false,models:0,source:'Blender 5.2 / GLB',error:null};
const templates=new Map();let loading;
export function loadCommonWeaponModels(){
  if(loading)return loading;
  const loader=new GLTFLoader(),axis=new T.Matrix4().makeRotationX(Math.PI/2);
  loading=Promise.all([Promise.all(COMMON_MODEL_IDS.map(async id=>{
    const gltf=await loader.loadAsync(`${import.meta.env?.BASE_URL||'/'}assets/common-weapons/${id}.glb`),parts=[];
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(node=>{if(node.isMesh)parts.push({
      geometry:node.geometry.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(axis,node.matrixWorld)),
      material:node.material,role:node.userData.role||'body',tier:node.userData.tier||0,
    });});return [id,parts];
  })),loadDroneSpriteAssets()]).then(([entries])=>{for(const [id,parts] of entries)templates.set(id,parts);Object.assign(commonModelAssets,{ready:true,models:entries.length,error:null});})
    .catch(error=>{loading=null;commonModelAssets.error=String(error);throw error;});
  return loading;
}

// The actual exported solids retain PBR lighting. GPU material states animate
// the molten core, transparent shell, fuse and durability without outline art.
function materialFor(part,id){
  const role=part.role,emitter=part.material.emissiveIntensity>1,mineLight=part.material.name.includes('mine identity light');
  const metal=!emitter&&!['orb','shield','molten','basalt','lens','reflected'].includes(role);
  const m=role==='lens'?new T.MeshPhysicalMaterial({color:0x7463be,metalness:0,roughness:.045,transmission:.92,ior:1.14,thickness:16,transparent:true,opacity:.38,depthWrite:false}):part.material.clone();
  // Bright inserts sit inside shaded manufactured surfaces, so stronger bloom
  // never replaces the actual projectile, drone or blade silhouette.
  if(metal){m.roughness=Math.max(.16,m.roughness*.76);m.metalness=Math.max(.48,m.metalness);m.envMapIntensity=1.3;}
  if(emitter)m.emissiveIntensity*=1.3;
  if(id==='drone'||id==='mother')m.emissiveIntensity*=.25;
  if(role==='molten')m.emissiveIntensity=2.65;
  const moltenBody=(id==='pyro'||id==='ember')&&role==='molten';
  if(moltenBody){m.color.set(0x542317);m.emissive.set(0xff5b0b);m.emissiveIntensity=.9;m.metalness=0;m.roughness=.85;}
  if(id==='lightmine'){
    m.color.set(emitter?0x8572cd:part.material.name.toLowerCase().includes('silver')?0x63758a:0x202d41);
    m.emissive.set(emitter?0x8062db:0x000000);m.emissiveIntensity=emitter?.5:0;
    m.metalness=.25;m.roughness=.68;m.envMapIntensity=.35;
  }
  if(id==='grenade'){
    m.color.set(emitter?0xffaf38:part.material.name.includes('identity')?0x34414b:part.material.name.includes('dark')?0xb47727:0x647681);
    m.emissive.set(emitter?0xff8418:0x000000);m.emissiveIntensity=emitter?.45:0;
    m.metalness=.3;m.roughness=.7;m.envMapIntensity=.4;
  }
  if(role==='basalt'){m.metalness=.14;m.roughness=.76;}
  if(role==='reflected'){m.color.set(0xffffff);m.emissive.set(0xffffff);m.emissiveIntensity=.8;}
  if(role==='orb'||role==='shield'){m.transparent=true;m.opacity=role==='orb'?.32:.24;m.depthWrite=false;m.side=T.FrontSide;m.metalness=.08;m.roughness=.1;}
  m.onBeforeCompile=shader=>{
    shader.vertexShader=`attribute vec4 weaponState;attribute vec4 weaponMotion;varying vec4 wState;varying vec4 wMotion;varying vec3 wLocal;varying vec3 wTint;\n`+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      wState=weaponState;wMotion=weaponMotion;wLocal=position;
      wTint=vec3(1.);
      #ifdef USE_INSTANCING_COLOR
      wTint=instanceColor;
      #endif
      ${role==='basalt'?'transformed*=1.+weaponState.z*.008;':''}
      ${moltenBody?'transformed*=1.+.065*sin(position.x*.13+position.y*.11)*sin(position.z*.16);':''}
      ${role==='wing'?'transformed.x*=mix(.25,1.,smoothstep(0.,.25,weaponMotion.y));':''}
      ${role==='fuse'?'float ca=cos(weaponMotion.x*7.),sa=sin(weaponMotion.x*7.);transformed.xy=mat2(ca,-sa,sa,ca)*transformed.xy;':''}`);
    shader.fragmentShader=`varying vec4 wState;varying vec4 wMotion;varying vec3 wLocal;varying vec3 wTint;\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float weaponQuality=clamp(wState.x/5.,0.,1.);
      diffuseColor.a*=wMotion.w;
      diffuseColor.rgb*=mix(.65,1.,wMotion.w);
      ${moltenBody?`vec3 rock=normalize(wLocal);
        float plates=sin(rock.x*7.+sin(rock.z*4.))*sin(rock.y*6.-rock.z*3.);
        float seam=1.-smoothstep(.07,.2,abs(plates));
        float surge=.78+.22*sin(wMotion.x*2.+rock.y*4.);
        diffuseColor.rgb=mix(vec3(.085,.042,.027),vec3(.85,.14,.012),seam*.85);
        diffuseColor.rgb*=.8+.2*sin(rock.z*8.+rock.x*4.);`:''}
      ${role==='durability'?'if((atan(wLocal.x,-wLocal.y)+1.2)/2.4*21.>wState.w)discard;':''}
      ${role==='shield'?`float shieldRadius=length(wLocal.xy);
        float shieldSweep=pow(.5+.5*sin(shieldRadius*.64-wMotion.x*5.),12.);
        float shieldEdge=smoothstep(20.,24.,shieldRadius);
        diffuseColor.a=clamp(.13+shieldEdge*.28+shieldSweep*(.23+weaponQuality*.1),0.,.68)*wMotion.w;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.58,.82,1.),shieldSweep*.36);`:''}
      ${role==='basalt'?`diffuseColor.rgb*=.48+.08*sin(wLocal.x*.43+wLocal.y*.57);
        float fissure=abs(dot(normalize(wLocal),normalize(vec3(.4,1.,.35))));
        if(wState.x>=1.&&fissure<.011+wState.z*.0035)discard;`:''}
      ${role==='orb'?`float fres=pow(1.-abs(dot(normalize(vNormal),normalize(vViewPosition))),2.2);
        float orbitDistance=dot(normalize(wLocal),normalize(vec3(sin(wMotion.x*.4),cos(wMotion.x*.4),.45)));
        float orbit=exp(-orbitDistance*orbitDistance*700.);
        float orbitHalo=exp(-orbitDistance*orbitDistance*80.);
        float core=pow(abs(normalize(wLocal).z),24.)*(.07+min(wState.x,1.)*.1);
        diffuseColor.a=clamp(.1+fres*(.42+weaponQuality*.12)+orbit*.62+orbitHalo*.08+core,0.,.88)*wMotion.w;
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.67,.79,1.),clamp(orbit*.86+core,0.,.9));`:''}`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float weaponRim=pow(1.-abs(dot(normalize(normal),normalize(vViewPosition))),2.5);
      ${metal?'totalEmissiveRadiance+=diffuseColor.rgb*(.045+weaponRim*(.24+weaponQuality*.15));':''}
      ${emitter&&role!=='molten'?'totalEmissiveRadiance*=(1.08+weaponQuality*.7)*(.92+.08*sin(wMotion.x*8.+wLocal.y*.22));':''}
      ${role==='molten'?`float moltenFlow=.5+.5*sin(wLocal.y*.58+wLocal.x*.31+sin(wLocal.z*.37-wMotion.x*1.8)+wMotion.x*3.2);
        totalEmissiveRadiance*=mix(vec3(.82,.24,.035),vec3(1.,.73,.32),moltenFlow)*(.95+weaponQuality*.45+wState.z*.075);`:''}
      ${moltenBody?'totalEmissiveRadiance=vec3(1.,.19,.012)*seam*surge*.95;':''}
      ${role==='basalt'?'totalEmissiveRadiance+=vec3(.19,.025,.004)*pow(max(0.,1.-fissure*18.),3.)*(.55+weaponQuality*.3);':''}
      ${role==='reflected'?'totalEmissiveRadiance*=wTint;':''}
      ${mineLight?'totalEmissiveRadiance*=1.+.32*pow(.5+.5*sin(wMotion.x*9.),4.);':''}
      ${role==='fuse'?'totalEmissiveRadiance*=1.05+.32*pow(.5+.5*sin(wMotion.x*20.),3.);':''}
      ${role==='orb'?'totalEmissiveRadiance+=diffuseColor.rgb*(orbit*(2.1+weaponQuality*.8)+orbitHalo*.2+fres*(.55+weaponQuality*.28));':''}
      ${role==='shield'?'totalEmissiveRadiance*=.38+shieldSweep*.72+shieldEdge*.62;':''}
      ${role==='lens'?'totalEmissiveRadiance+=vec3(.22,.12,.52)*weaponRim*(.65+weaponQuality*.4);':''}
      ${role==='ice'?'totalEmissiveRadiance*=.75+weaponRim*.55;':''}`);
  };
  m.customProgramCacheKey=()=>`common-solid-v3-${id}-${role}-${emitter}-${mineLight}-${metal}`;
  return m;
}
export class CommonWeaponModels{
  constructor(root,capacity=512){this.root=root;this.capacity=capacity;this.batches=new Map();this.matrix=new T.Matrix4();this.position=new T.Vector3();this.scale=new T.Vector3();this.quaternion=new T.Quaternion();this.axis=new T.Vector3(0,0,1);this.count=0;}
  begin(time){
    this.time=time;this.count=0;
    for(const meshes of this.batches.values())for(const mesh of meshes)mesh.count=0;
  }
  ensure(id){
    if(this.batches.has(id)||!commonModelAssets.ready)return;
    const parts=id==='gravity_lens'?templates.get('orb').map(part=>({...part,role:'lens'}))
      :id==='reflected'?templates.get('cannon').map(part=>({...part,role:'reflected'})):templates.get(id);
    if(parts){
      this.batches.set(id,parts.filter(part=>!(['pyro','ember'].includes(id)&&part.role==='basalt')).map(part=>{
        const geometry=part.geometry.clone();for(const key of ['weaponState','weaponMotion'])geometry.setAttribute(key,new T.InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(T.DynamicDrawUsage));
        const mesh=new T.InstancedMesh(geometry,materialFor(part,id),this.capacity);mesh.name=`Common Blender ${id} / ${part.role}`;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
        // Basalt must also occlude the inner molten sphere in the bloom pass.
        mesh.userData.bloom=!['drone','mother','grenade','lightmine','pyro','ember'].includes(id)&&(part.role==='basalt'||part.material.emissiveIntensity>1&&part.role!=='shield');mesh.userData.role=part.role;mesh.userData.tier=part.tier;mesh.visible=false;mesh.count=0;this.root.add(mesh);return mesh;
      }));
    }
  }
  add(id,v,scale=1,angle=v.angle||0){
    this.ensure(id);
    const meshes=this.batches.get(id);if(!meshes)return;
    this.position.set(v.x,v.y,8);this.quaternion.setFromAxisAngle(this.axis,angle);this.scale.set(scale,scale,scale);this.matrix.compose(this.position,this.quaternion,this.scale);
    if(id==='grenade'||id==='pyro'||id==='ember'){
      const age=v.age||0,grenade=id==='grenade',squash=grenade?0:moltenSquash(age);
      this.quaternion.setFromEuler(new T.Euler(grenade?age*8:age*.8,grenade?age*3:age*.55,angle));
      this.scale.set(scale*(1+squash*.12),scale*(1-squash*.16),scale);
      this.position.z+=grenade?grenadeHop(age)*3:0;
      this.matrix.compose(this.position,this.quaternion,this.scale);
    }
    let added=false;for(const mesh of meshes){
      const {role,tier}=mesh.userData;if(tier>(v.rank||0)||role==='generation2'&&(v.generation||0)<2||role.startsWith('charge')&&Number(role.slice(6))>(v.contacts||0)||v.shape==='assembly'&&(v.age||0)<.12&&role!=='wing')continue;
      const i=mesh.count;if(i>=this.capacity)continue;mesh.setMatrixAt(i,this.matrix);
      if(id==='reflected'){const tint=new T.Color(0xe96571).lerp(new T.Color(v.color),Math.min(1,(v.age||0)/.12));mesh.setColorAt(i,tint);}
      mesh.geometry.attributes.weaponState.setXYZW(i,v.rank||0,v.contacts||0,Math.min(5,v.bounces||0),v.durability??21);
      mesh.geometry.attributes.weaponMotion.setXYZW(i,this.time,v.age??1,v.generation||0,(v.alpha??1)*(v.darker?.72:1));mesh.count++;added=true;
    }if(added)this.count++;
  }
  finish(){for(const meshes of this.batches.values())for(const mesh of meshes){mesh.visible=mesh.count>0;if(!mesh.visible)continue;mesh.instanceMatrix.clearUpdateRanges();mesh.instanceMatrix.addUpdateRange(0,mesh.count*16);mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor){mesh.instanceColor.clearUpdateRanges();mesh.instanceColor.addUpdateRange(0,mesh.count*3);mesh.instanceColor.needsUpdate=true;}for(const key of ['weaponState','weaponMotion']){const a=mesh.geometry.attributes[key];a.clearUpdateRanges();a.addUpdateRange(0,mesh.count*4);a.needsUpdate=true;}}}
  dispose(){for(const meshes of this.batches.values())for(const mesh of meshes){mesh.removeFromParent();mesh.dispose();mesh.geometry.dispose();mesh.material.dispose();}this.batches.clear();}
}

import * as T from 'three';
import {installLavaRiverFlow,syncLavaRiverFlow} from './lava-river-material.js';
import {createCityGroundMaterial,syncCityGroundNeighbors} from './city-ground-material.js';
import {rainRippleShader} from './rain-ripple-shader.js';
import {desertNightLighting} from './desert-night-lighting.js';
import {forestNightLighting} from './forest-night-lighting.js';
import {forestCanopyGroundShader,forestCanopyMask} from './forest-canopy-material.js';

const wrap=(value,period)=>(value%period+period)%period;
const vertex='varying vec2 localUv;void main(){localUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const fragment=`varying vec2 localUv;
uniform sampler2D artwork;uniform vec2 repeats;uniform float scroll;uniform float time;
uniform float rainAmount;uniform float travel;
${rainRippleShader}
${forestCanopyGroundShader}
vec2 mirrored(vec2 p){return abs(fract(p*.5)*2.-1.);}
void main(){
  vec2 uv=localUv*repeats+vec2(0.,scroll);
  #if FOREST_CANOPY == 1
  vec3 color=sampleForestCanopy(uv);
  #else
  vec3 color=texture2D(artwork,mirrored(uv)).rgb;
  #endif
  #if WATER_SURFACE == 1
  color=applyRainRipples(color,localUv*vec2(1800.,3000.)+vec2(0.,travel),time,rainAmount);
  #endif
  gl_FragColor=vec4(color,1.);
  #include <colorspace_fragment>
}`;

/** One ground clock owns the background and all attached scenery. Each asset
 * is a compact transparent sprite, never a slice of a long painted map. */
export function createModularThemeLayer(definition,renderOrder,rain={value:0},night={value:0}){
  const mesh=new T.Group();mesh.name=`chapter-${definition.id}-layer`;
  const geometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),materials=new Map();
  const groundMaterial=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:fragment,
    defines:{WATER_SURFACE:definition.waterSurface?1:0,FOREST_CANOPY:definition.forestCanopy?1:0},toneMapped:false,depthWrite:true,
    uniforms:{artwork:{value:null},repeats:{value:new T.Vector2()},scroll:{value:0},
      time:{value:0},rainAmount:rain,travel:{value:0}}});
  materials.set('ground',groundMaterial);
  const ground=new T.Mesh(geometry,groundMaterial);ground.renderOrder=renderOrder;
  ground.position.y=definition.depth;mesh.add(ground);
  const instances=[];
  // Clear the canopy before placing its matching landmark. Both copies share
  // the same authored footprint and absolute scroll, including at loop wrap.
  const sceneryRows=definition.placements.flatMap(row=>row.clearingAsset?[
    {...row,id:row.id+'-clearing',asset:row.clearingAsset,kind:'clearing',order:1},row
  ]:[row]);
  for(const row of sceneryRows){
    const grade=definition.materialGrades?.[row.asset];
    const litEntrance=row.asset==='pyramid'&&definition.sceneId?.startsWith('campaign-desert-');
    const forestLight=definition.sceneId?.startsWith('campaign-forest-')&&['b','landmark','clearing-b','clearing-landmark'].includes(row.asset);
    const canopySprite=definition.forestCanopy===true;
    const materialKey=row.groundBlend?`city-ground:${row.id}`:row.asset;
    if(row.groundBlend)materials.set(materialKey,createCityGroundMaterial(row,definition.spriteTint??0xcad5df));
    if(!materials.has(materialKey))materials.set(materialKey,new T.MeshBasicMaterial({
      transparent:true,depthWrite:false,toneMapped:false,alphaTest:.025,opacity:row.opacity??1,
      color:grade?0xffffff:(definition.spriteTint??0xcad5df)}));
    if(row.feather||grade||litEntrance||forestLight||canopySprite){
      const material=materials.get(materialKey);
      material.onBeforeCompile=shader=>{
        let correction=litEntrance?desertNightLighting(shader,night,groundMaterial.uniforms.time):
          forestLight?forestNightLighting(shader,night,groundMaterial.uniforms.time,row.asset):'';
        if(canopySprite)correction+=forestCanopyMask(shader,row.asset);
        if(grade){
          shader.uniforms.terrainGain={value:new T.Vector3(...grade.gain)};
          shader.uniforms.terrainOffset={value:new T.Vector3(...grade.offset)};
          shader.fragmentShader='uniform vec3 terrainGain;uniform vec3 terrainOffset;\n'+shader.fragmentShader;
          correction+='diffuseColor.rgb=clamp(diffuseColor.rgb*terrainGain+terrainOffset,0.,1.);';
        }
        if(row.feather)correction+=
          'diffuseColor.a*=smoothstep(0.,'+row.feather.toFixed(4)+',vMapUv.y)*smoothstep(0.,'+row.feather.toFixed(4)+',1.-vMapUv.y);'+
          (row.featherAxis==='both'?'diffuseColor.a*=smoothstep(0.,'+row.feather.toFixed(4)+',vMapUv.x)*smoothstep(0.,'+row.feather.toFixed(4)+',1.-vMapUv.x);':'');
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+correction);
      };
      material.customProgramCacheKey=()=> 'terrain-join-'+row.feather+'-'+row.featherAxis+'-grade-'+!!grade+'-entrance-'+!!litEntrance+'-forest-'+(forestLight?row.asset:'none')+'-canopy-'+(canopySprite?row.asset:'none')+'-clearing-v2-'+!!row.clearingAsset;
    }
    if(row.asset==='river'&&definition.sceneId==='campaign-volcano-3-modules-v2')installLavaRiverFlow(materials.get(materialKey));
    // Explicit neighboring copies avoid a pop when a tall object crosses wrap.
    for(const copy of [-1,0,1]){
      const sprite=new T.Mesh(geometry,materials.get(materialKey));
      sprite.name=`${definition.id}-${row.id}-${copy}`;sprite.renderOrder=renderOrder+(row.order??1);
      sprite.position.y=definition.depth+(row.order??1)*.1;
      sprite.rotation.y=row.angle??0;mesh.add(sprite);
      instances.push({row,copy,sprite});
    }
  }
  const roadMarks=[];
  if(definition.roadMarkings){
    const material=new T.MeshBasicMaterial({color:0xd5d2c4,transparent:true,opacity:.25,depthWrite:false,toneMapped:false});
    materials.set('road-markings',material);
    for(let i=0;i<36;i++)for(const copy of[-1,0,1]){
      const dash=new T.Mesh(geometry,material);dash.position.y=definition.depth+.02;dash.renderOrder=renderOrder+.5;
      mesh.add(dash);roadMarks.push({i,copy,dash});
    }
  }
  return {definition,mesh,geometry,materials,ground,instances,roadMarks};
}

export function syncModularThemeLayer(record,textures,sceneId,elapsed,motion={}){
  const {definition,mesh,materials,ground,instances,roadMarks}=record;
  const units=motion.moduleUnitsPerWorld??24,period=definition.loopUnits*units;
  const travel=motion.moduleTravel??elapsed*definition.nativeSpeed*units;
  const wrapped=((travel%period)+period)%period,tile=definition.tileUnits*units;
  const lateral=Math.max(-12,Math.min(12,motion.lateralOffset??0));
  mesh.position.set(300+lateral,0,wrapped);
  for(const [key,material] of materials){
    if(key==='road-markings')continue;
    const textureKey=material.userData.cityGround?.source??key;
    const texture=textures.get(`${sceneId}/${textureKey}`)??null;
    if(key==='ground')material.uniforms.artwork.value=texture;
    else if(material.map!==texture){material.map=texture;material.needsUpdate=true;}
    syncCityGroundNeighbors(material,textures,sceneId);syncLavaRiverFlow(material,elapsed);
  }
  ground.position.z=650-wrapped;ground.scale.set(1800,1,3000);
  const u=ground.material.uniforms;ground.visible=!!u.artwork.value;
  // Space opts into a distant base clock; existing terrain keeps its exact
  // phase. Wrap the absolute base travel independently of the asteroid loop.
  const groundTravel=definition.backgroundTravelScale===undefined?wrapped:wrap(travel*definition.backgroundTravelScale,tile*2);
  u.scroll.value=groundTravel/tile;u.repeats.value.set(1800/tile,3000/tile);
  u.time.value=elapsed;u.travel.value=travel;
  for(const {i,copy,dash} of roadMarks){
    dash.position.x=0;dash.position.z=650-i*6*units+copy*period;dash.scale.set(.12*units,1,2*units);
    const z=dash.position.z+wrapped;dash.visible=z>=-100&&z<=1400;
  }
  for(const {row,copy,sprite} of instances){
    const texture=sprite.material.map;
    const width=row.width*units,height=row.height?row.height*units:width*(texture?texture.image.height/texture.image.width:1);
    sprite.position.x=row.x*units;
    sprite.position.z=650-row.z*units+copy*period;
    if(row.travelScale!==undefined)sprite.position.z+=wrap(travel*row.travelScale,period)-wrapped;
    sprite.scale.set(width,1,height);
    // Mirroring is deliberately absent: sunlight and attached facilities keep
    // their authored orientation in every layout.
    const center=sprite.position.z+wrapped;
    const halfExtent=(Math.abs(Math.cos(sprite.rotation.y))*height+Math.abs(Math.sin(sprite.rotation.y))*width)/2;
    sprite.visible=!!texture&&center+halfExtent>=-100&&center-halfExtent<=1400;
  }
  const visible=instances.filter(item=>item.sprite.visible);
  Object.assign(mesh.userData.terrain||={}, {
    id:definition.id,role:'terrain',name:definition.name,depth:definition.depth,
    speed:definition.nativeSpeed,scroll:travel,x:mesh.position.x,
    source:`${sceneId}/modular-terrain`,status:[...materials].every(([key,m])=>key==='road-markings'||(key==='ground'?m.uniforms.artwork.value:m.map))?'ready':'loading',
    moduleCount:instances.length/3,visibleModules:visible.length,period,
    modules:visible.map(({row,sprite})=>({id:row.id,source:row.asset,kind:row.kind??'landmark',from:row.from,to:row.to,
      x:mesh.position.x+sprite.position.x,z:wrapped+sprite.position.z,
      width:sprite.scale.x,height:sprite.scale.z})),
  });
}

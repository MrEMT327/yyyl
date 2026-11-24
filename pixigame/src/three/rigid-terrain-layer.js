import * as T from 'three';
import {rainRippleShader} from './rain-ripple-shader.js';
import {nightWaterShader} from './night-water-shader.js';
import {MODULAR_ASSETS,MODULAR_ISLANDS,MODULAR_WATER_PROPS,MODULAR_SEABED_FIELDS,MODULAR_TERRAIN_SETTINGS as SETTINGS} from './stage1-modular-layout.js';

const vertex='varying vec2 localUv;void main(){localUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const seaFragment=`varying vec2 localUv;uniform sampler2D artwork;uniform float time;
uniform float scroll;uniform vec2 repeats;uniform float rainAmount;uniform float rainTravel;
${rainRippleShader}
${nightWaterShader}
vec2 mirrored(vec2 p){return abs(fract(p*.5)*2.-1.);}
void main(){
  vec2 uv=localUv*repeats+vec2(0.,scroll);
  // Mirrored repetition joins the authored ocean without a hard tile edge.
  // Only color varies with time; the texture coordinate remains ground-locked.
  vec3 a=texture2D(artwork,mirrored(uv)).rgb;
  vec3 b=texture2D(artwork,mirrored(uv*.5+vec2(.31,.17))).rgb;
  vec3 c=mix(a,b,.34);
  float flow=sin(uv.x*3.141593+uv.y*6.283185-time*.18);
  float sheen=smoothstep(.78,.98,sin(uv.y*12.566371+sin(uv.x*6.283185)-time*.38));
  c*=1.+flow*.015;c=mix(c,vec3(.025,.12,.28),sheen*.012);
  c=applyRainRipples(c,localUv*vec2(1800.,3000.)+vec2(0.,rainTravel),time,rainAmount);
  gl_FragColor=vec4(c,1.);
  #include <colorspace_fragment>
}`;
const lightFragment=`varying vec2 localUv;uniform float time;uniform float phase;uniform float radar;
void main(){
  vec2 p=(localUv-.5)*2.;float r=length(p);float pulse=.72+.28*sin(time*1.6+phase);
  float glow=pow(max(0.,1.-r),3.)*pulse;
  float angle=atan(p.y,p.x);float sweep=pow(max(0.,cos(angle-time*.65-phase)),18.)*(1.-smoothstep(.7,1.,r));
  gl_FragColor=vec4(.25,.78,1.,mix(glow*.45,sweep*.15,radar));
  #include <colorspace_fragment>
}`;

export function rigidTerrainPose(elapsed,motion={}){
  const units=motion.moduleUnitsPerWorld??24,period=SETTINGS.loopUnits*units;
  const travel=(motion.moduleTravel??elapsed*SETTINGS.nativeSpeed*units)*SETTINGS.motionScale;
  return {units,period,travel,wrapped:((travel%period)+period)%period,
    lateral:Math.max(-12,Math.min(12,motion.lateralOffset??0)),tile:SETTINGS.waterTileUnits*units};
}

export function createRigidTerrainLayer(definition,renderOrder,rain={value:0},night={value:0},nightResolution={value:new T.Vector2(540,960)}){
  const mesh=new T.Group();mesh.name=`chapter-${definition.id}-layer`;
  const geometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),materials=new Map();
  const seaMaterial=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:seaFragment,toneMapped:false,
    uniforms:{artwork:{value:null},time:{value:0},nightAmount:night,nightResolution,rainAmount:rain,rainTravel:{value:0},scroll:{value:0},repeats:{value:new T.Vector2()}},depthWrite:true});
  materials.set('ground',seaMaterial);
  const sea=new T.Mesh(geometry,seaMaterial);sea.renderOrder=renderOrder;sea.position.y=definition.depth;
  sea.scale.set(1800,1,3000);mesh.add(sea);
  function sprite(asset,order){
    if(!materials.has(asset)){
      const kind=MODULAR_ASSETS[asset].kind;
      const material=new T.MeshBasicMaterial({transparent:true,depthWrite:false,toneMapped:false,
        opacity:kind==='submerged'?.18:1,alphaTest:.025,
        color:kind==='submerged'?0x9dbee0:kind==='land'?0xa5b8d1:0x87abc5});
      material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
        'diffuseColor.a=min(diffuseColor.a*(255.0/245.0),1.0);\n#include <alphatest_fragment>');};
      material.customProgramCacheKey=()=> 'rigid-coast-opaque-core-v1';materials.set(asset,material);
    }
    const s=new T.Mesh(geometry,materials.get(asset));s.renderOrder=order;s.userData.asset=asset;return s;
  }
  const islands=definition.islands??MODULAR_ISLANDS;
  const clusters=[],waterProps=[],seabedFields=[];
  for(const copy of [-1,0,1]){
    for(const [index,row] of islands.entries()){
      const parent=new T.Group();parent.name=`island-${row.id}-${copy}`;
      const island=sprite(row.asset,renderOrder+2);island.position.y=definition.depth+.1;parent.add(island);
      const parts=(row.parts??[]).map(part=>{
        const submerged=MODULAR_ASSETS[part.asset].kind==='submerged';
        const s=sprite(part.asset,renderOrder+(submerged?1:2));s.position.y=definition.depth+(submerged?.04:.11);
        parent.add(s);return {part,sprite:s};
      });
      const sites=row.sites.map((site,si)=>{
        const s=sprite(site.asset,renderOrder+2);s.position.y=definition.depth+.2;parent.add(s);
        let light;
        if(site.effect){
          const mat=new T.ShaderMaterial({vertexShader:vertex,fragmentShader:lightFragment,transparent:true,depthWrite:false,toneMapped:false,
            uniforms:{time:{value:0},phase:{value:index+si},radar:{value:site.effect==='radar'?1:0}}});
          materials.set(`effect-${copy}-${index}-${si}`,mat);light=new T.Mesh(geometry,mat);
          light.renderOrder=renderOrder+3;light.position.y=definition.depth+.3;parent.add(light);
        }
        return {site,sprite:s,light};
      });
      mesh.add(parent);clusters.push({row,copy,parent,island,sites,parts});
    }
    for(const row of MODULAR_WATER_PROPS){
      const host=clusters.find(c=>c.copy===copy&&c.row.id===row.host);
      const s=sprite(row.asset,renderOrder+2);host.parent.add(s);
      waterProps.push({row,copy,sprite:s,host});
    }
    for(const row of MODULAR_SEABED_FIELDS){
      const s=sprite('seabed',renderOrder+1);s.position.y=definition.depth+.03;mesh.add(s);seabedFields.push({row,copy,sprite:s});
    }
  }
  return {definition,mesh,geometry,materials,sea,islands,clusters,waterProps,seabedFields};
}

function commitLocalMatrix(node){
  node.updateMatrix();node.matrixAutoUpdate=false;
}

// Island assemblies keep their local transforms until the world scale changes.
function layoutRigidTerrain(record,{units,period,tile}){
  const {definition,sea,clusters,waterProps,seabedFields}=record;
  sea.material.uniforms.repeats.value.set(1800/tile,3000/tile);
  for(const {row,parent,island,sites,parts,copy} of clusters){
    const asset=MODULAR_ASSETS[row.asset],w=row.width*units,h=w*asset.height/asset.width;
    parent.position.set(row.x*units,0,650-row.z*units+copy*period);
    island.scale.set(w,1,h);commitLocalMatrix(parent);commitLocalMatrix(island);
    for(const {part,sprite} of parts){
      const art=MODULAR_ASSETS[part.asset],width=part.width*units;
      sprite.position.x=part.x*w;sprite.position.z=part.z*h;sprite.scale.set(width,1,width*art.height/art.width);
      commitLocalMatrix(sprite);
    }
    for(const {site,sprite,light} of sites){
      const art=MODULAR_ASSETS[site.asset],width=site.width*units,height=width*art.height/art.width;
      sprite.position.x=site.x*w;sprite.position.z=site.z*w;sprite.scale.set(width,1,height);sprite.rotation.y=site.rotation??0;
      commitLocalMatrix(sprite);
      if(light){
        light.position.x=sprite.position.x;light.position.z=sprite.position.z-height*.12;
        const size=width*(site.effect==='radar'?.8:.24);light.scale.set(size,1,size);commitLocalMatrix(light);
      }
    }
  }
  for(const {row,sprite,host} of waterProps){
    const art=MODULAR_ASSETS[row.asset],w=row.width*units;
    sprite.position.set(row.x*host.island.scale.x,definition.depth+.15,row.z*host.island.scale.z);
    sprite.scale.set(w,1,w*art.height/art.width);sprite.rotation.y=row.rotation??0;commitLocalMatrix(sprite);
  }
  for(const {row,copy,sprite} of seabedFields){
    const width=row.width*units;
    sprite.position.x=row.x*units;sprite.position.z=650-row.z*units+copy*period;sprite.scale.set(width,1,width);
    commitLocalMatrix(sprite);
  }
  record.layoutUnits=units;
}

export function syncRigidTerrainLayer(record,textures,sceneId,elapsed,motion={}){
  const {definition,mesh,materials,sea,islands,clusters,waterProps,seabedFields}=record,p=rigidTerrainPose(elapsed,motion);
  if(record.layoutUnits!==p.units)layoutRigidTerrain(record,p);
  mesh.position.set(300+p.lateral,0,p.wrapped);
  for(const [key,mat] of materials){
    if(key.startsWith('effect-')){mat.uniforms.time.value=elapsed;continue;}
    const tex=textures.get(sceneId+'/'+key)??null;
    if(key==='ground')mat.uniforms.artwork.value=tex;
    else if(mat.map!==tex){mat.map=tex;mat.needsUpdate=true;}
  }
  // Counter the parent's movement so the sea covers the screen while its UVs scroll.
  sea.position.z=650-p.wrapped;sea.visible=!!materials.get('ground').uniforms.artwork.value;
  const u=sea.material.uniforms;u.scroll.value=p.wrapped/p.tile;u.time.value=elapsed;u.rainTravel.value=p.travel;
  let visible=0,visibleSites=0;
  for(const {parent,island,sites} of clusters){
    const worldZ=parent.position.z+p.wrapped,halfHeight=island.scale.z/2;
    parent.visible=!!island.material.map&&worldZ+halfHeight>=-100&&worldZ-halfHeight<=1400;
    if(parent.visible){visible++;visibleSites+=sites.length;}
  }
  for(const {sprite} of waterProps)sprite.visible=!!sprite.material.map;
  for(const {sprite} of seabedFields){
    const z=sprite.position.z+p.wrapped,halfWidth=sprite.scale.x/2;
    sprite.visible=!!sprite.material.map&&z+halfWidth>=-100&&z-halfWidth<=1400;
  }
  Object.assign(mesh.userData.terrain||={}, {id:definition.id,role:'terrain',name:definition.name,depth:definition.depth,
    speed:SETTINGS.nativeSpeed*SETTINGS.motionScale,nativeSpeed:SETTINGS.nativeSpeed,scroll:p.travel,x:mesh.position.x,source:`${sceneId}/rigid-surface`,
    status:[...materials.entries()].filter(([key])=>!key.startsWith('effect-')).every(([key,m])=>key==='ground'?m.uniforms.artwork.value:m.map)?'ready':'loading',
    islandVariants:new Set(islands.map(row=>row.asset)).size,islandInstances:islands.length,
    visibleIslands:visible,visibleSites,period:p.period,waterTile:p.tile,opening:null,
    visibleSeabed:seabedFields.filter(s=>s.sprite.visible).length,
    modules:clusters.filter(c=>c.parent.visible).map(c=>({id:c.row.id,source:c.row.asset,x:mesh.position.x+c.parent.position.x,z:p.wrapped+c.parent.position.z,width:c.island.scale.x,height:c.island.scale.z})),
  });
}

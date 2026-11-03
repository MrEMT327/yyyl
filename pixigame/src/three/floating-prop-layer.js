import * as T from 'three';
import {STAGE1_FLOAT_SPRITES} from './stage1-floating-props.js';

const wakeFragment=`varying vec2 waterUv;uniform float time;uniform float phase;
void main(){
  vec2 p=(waterUv-.5)*2.;float radius=length(p);
  float ringRadius=.68+.09*sin(time*1.15+phase);
  float line=1.-smoothstep(.018,.065,abs(radius-ringRadius));
  float broken=.35+.65*smoothstep(-.5,.6,sin(atan(p.y,p.x)*3.+phase));
  float ring=line*broken*.25;
  float contact=(1.-smoothstep(.3,.64,radius))*.09;
  gl_FragColor=vec4(mix(vec3(.01,.08,.12),vec3(.38,.68,.72),step(.002,ring)),max(contact,ring));
  #include <colorspace_fragment>
}`;

export function createFloatingPropLayer(definition,renderOrder){
  const mesh=new T.Group();mesh.name=`chapter-${definition.id}-layer`;
  const geometry=new T.PlaneGeometry(1,1).rotateX(-Math.PI/2),materials=new Map();
  const modules=definition.modules.map(([source,x,z,width,angle=0],index)=>{
    if(!materials.has(source))materials.set(source,new T.MeshBasicMaterial({
      transparent:true,opacity:1,depthWrite:false,toneMapped:false,alphaTest:.04,color:0xd4e2e7,
    }));
    const sprite=new T.Mesh(geometry,materials.get(source));sprite.renderOrder=renderOrder+1;
    sprite.position.y=definition.depth;
    const wakeMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,toneMapped:false,
      uniforms:{time:{value:0},phase:{value:index*2.399}},
      vertexShader:'varying vec2 waterUv;void main(){waterUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:wakeFragment,
    });
    materials.set(`wake-${index}`,wakeMaterial);
    const wake=new T.Mesh(geometry,wakeMaterial);wake.renderOrder=renderOrder;wake.position.y=definition.depth-.1;
    mesh.add(wake,sprite);
    return {source,x,z,width,angle,sprite,wake,phase:index*2.399};
  });
  return {definition,mesh,geometry,materials,modules};
}

export function syncFloatingPropLayer(record,textures,sceneId,elapsed,motion={}){
  const {definition,mesh,modules}=record,units=motion.moduleUnitsPerWorld??24;
  const period=definition.moduleLoopLength*units;
  const travel=motion.moduleTravel??elapsed*definition.nativeSpeed*units;
  mesh.position.x=300+Math.max(-12,Math.min(12,motion.lateralOffset??0));
  let visibleModules=0;
  for(const m of modules){
    const texture=textures.get(`${sceneId}/${m.source}`)??null;
    if(m.sprite.material.map!==texture){m.sprite.material.map=texture;m.sprite.material.needsUpdate=true;}
    const asset=STAGE1_FLOAT_SPRITES[m.source],w=m.width*units*1.3,h=w*asset.height/asset.width;
    const centerZ=650+(((-m.z*units+travel+period/2)%period+period)%period)-period/2;
    const x=m.x*units+Math.sin(elapsed*.22+m.phase)*3;
    const z=centerZ+Math.sin(elapsed*1.1+m.phase)*1.4;
    m.sprite.position.set(x,definition.depth,z);m.wake.position.set(x,definition.depth-.1,z+h*asset.contactOffset);
    m.sprite.scale.set(w,1,h);m.wake.scale.set(w*asset.wakeWidth,1,h*asset.wakeLength);
    m.sprite.rotation.y=m.angle+Math.sin(elapsed*.8+m.phase)*.045;
    m.wake.rotation.y=m.sprite.rotation.y;m.wake.material.uniforms.time.value=elapsed;
    m.sprite.visible=m.wake.visible=!!texture&&centerZ+h>=-100&&centerZ-h<=1400;
    if(m.sprite.visible)visibleModules++;
  }
  Object.assign(mesh.userData.terrain||={}, {id:definition.id,role:definition.role,name:definition.name,
    depth:definition.depth,speed:definition.nativeSpeed,scroll:travel,x:mesh.position.x,
    source:`${sceneId}/floating-props`,status:modules.every(m=>m.sprite.material.map)?'ready':'loading',
    moduleCount:modules.length,visibleModules,
  });
}

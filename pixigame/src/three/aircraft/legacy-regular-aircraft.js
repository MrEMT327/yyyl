// Ordinary aircraft restored from commit 1962111; intentionally isolated from elite/Boss builders.
import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Enemy hardware uses the same layered, bevelled construction as the fighters.
// Coordinates are aircraft-local: +Y is the deck, +Z points toward the player.
const silhouettes = {
  scout: [[0,31],[-9,13],[-31,-9],[-35,-24],[-13,-17],[0,-24],[13,-17],[35,-24],[31,-9],[9,13]],
  dart: [[0,37],[-8,17],[-22,-9],[-25,-28],[-10,-19],[0,-28],[10,-19],[25,-28],[22,-9],[8,17]],
  heavy: [[0,30],[-15,25],[-19,17],[-37,14],[-37,-22],[-25,-31],[-12,-24],[12,-24],[25,-31],[37,-22],[37,14],[19,17],[15,25]],
  turret: [[0,27],[-12,17],[-27,10],[-29,-16],[-17,-26],[17,-26],[29,-16],[27,10],[12,17]],
  relay: [[0,29],[-11,17],[-29,8],[-29,-10],[-13,-23],[0,-29],[13,-23],[29,-10],[29,8],[11,17]],
};

function plate(points, y, depth, bevel = .5) {
  const shape = new T.Shape();
  points.forEach(([x,z], i) => i ? shape.lineTo(x,-z) : shape.moveTo(x,-z));
  shape.closePath();
  return new T.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 1, steps: 1, curveSegments: 1,
  }).rotateX(-Math.PI/2).translate(0,y,0);
}

// Authored cross sections give the nose, canopy and nacelles a tapered volume.
function hull(sections) {
  const rings = sections.map(([z,w,h,y]) => [
    [0,y+h,z],[w*.72,y+h*.62,z],[w,y,z],[w*.7,y-h*.55,z],
    [0,y-h*.7,z],[-w*.7,y-h*.55,z],[-w,y,z],[-w*.72,y+h*.62,z],
  ]);
  const vertices = [], tri = (a,b,c) => vertices.push(...a,...b,...c);
  for (let i=0;i<rings.length-1;i++) for (let j=0;j<8;j++) {
    const k=(j+1)%8;
    tri(rings[i][j],rings[i+1][j],rings[i][k]);
    tri(rings[i][k],rings[i+1][j],rings[i+1][k]);
  }
  for(let j=1;j<7;j++) {
    tri(rings[0][0],rings[0][j],rings[0][j+1]);
    tri(rings.at(-1)[0],rings.at(-1)[j+1],rings.at(-1)[j]);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.computeVertexNormals();
  return geometry;
}

function material(color, metalness=.55, roughness=.38) {
  return new T.MeshStandardMaterial({color,metalness,roughness,transparent:true});
}

function palette(kind,boss,config) {
  const paint = new T.Color(config.color ?? (kind==='heavy' ? 0x64798b : 0xab5059));
  const accent = config.accent ?? (boss ? 0xffa657 : 0xff6552);
  const materials = {
    shell: material(boss ? 0x536477 : 0x84929c),
    edge: material(0xc3ccd0,.62,.31),
    dark: material(0x14222e,.62,.44),
    gun: material(0x405160,.8,.3),
    paint: material(paint.lerp(new T.Color(0x293642),boss ? .57 : .22)),
    gold: material(boss ? 0xb39a6d : 0xbc9773,.68,.34),
    glass: material(0x102c3e,.7,.16),
    light: material(0x431a14,.18,.35),
  };
  materials.light.emissive.set(accent);
  materials.light.emissiveIntensity = 1.65;
  return materials;
}

function builder(materials) {
  const add = (parent,geo,name,position=[0,0,0]) => {
    const mesh=new T.Mesh(geo,materials[name]);
    mesh.position.fromArray(position);mesh.castShadow=name!=='light';
    mesh.receiveShadow=true;mesh.userData.bloom=name==='light';parent.add(mesh);
    return mesh;
  };
  const box = (parent,size,position,name) => add(parent,new T.BoxGeometry(...size),name,position);
  const panel = (parent,points,y,depth,name,bevel=.5) => add(parent,plate(points,y,depth,bevel),name);
  const ring = (parent,r,t,position,name,deck=false) => {
    const geo=new T.TorusGeometry(r,t,4,24);
    if(deck)geo.rotateX(-Math.PI/2);
    return add(parent,geo,name,position);
  };
  const cylinder = (parent,r,len,position,name,deck=false) => {
    const geo=new T.CylinderGeometry(r,r,len,12);
    if(!deck)geo.rotateX(Math.PI/2);
    return add(parent,geo,name,position);
  };
  const vents = (parent,x,y,z,width,count=4,spacing=2.1) => {
    box(parent,[width+1.1,.6,count*spacing+1],[x,y-.1,z+(count-1)*spacing/2],'dark');
    for(let i=0;i<count;i++)box(parent,[width,.65,.65],[x,y+.3,z+i*spacing],'gun');
  };
  const engine = (parent,x,y,z,r) => {
    cylinder(parent,r,4,[x,y,z],'gun');
    cylinder(parent,r*.78,4.5,[x,y,z-.8],'dark');
    ring(parent,r*.86,.5,[x,y,z-2.4],'edge');
    ring(parent,r*.6,.45,[x,y,z-2.6],'light');
    // Short, nozzle-bound plasma tapers remain legible at actual combat size.
    const jet=new T.ConeGeometry(r*.48,r*3.6,8).rotateX(-Math.PI/2);
    add(parent,jet,'light',[x,y,z-r*1.8-2.5]);
  };
  return {add,box,panel,ring,cylinder,vents,engine};
}

// Bake rigid details per material once. Each spawned enemy has a handful of
// meshes; geometry is shared, materials are private for damage tint/phase state.
function bake(group) {
  const byMaterial = new Map();
  for(const mesh of [...group.children]) {
    if(!mesh.isMesh)continue;
    mesh.updateMatrix();
    const geo=mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    geo.applyMatrix4(mesh.matrix);geo.deleteAttribute('uv');
    if(!byMaterial.has(mesh.material))byMaterial.set(mesh.material,[]);
    byMaterial.get(mesh.material).push(geo);
    mesh.geometry.dispose();group.remove(mesh);
  }
  for(const [mat,parts]of byMaterial) {
    const mesh=new T.Mesh(mergeGeometries(parts,false),mat);
    mesh.userData.bloom=mat.emissiveIntensity>1;
    mesh.castShadow=!mesh.userData.bloom;mesh.receiveShadow=true;
    group.add(mesh);parts.forEach(geo=>geo.dispose());
  }
}

function buildEnemy(kind,materials) {
  const root=new T.Group(), b=builder(materials), heavy=kind==='heavy';
  const points=silhouettes[kind], deck=heavy ? 6 : 4;
  b.panel(root,points,-1,deck,'dark',.8);
  b.panel(root,points.map(([x,z])=>[x*.95,z*.95]),deck-1,1.3,'shell',.65);
  b.add(root,hull([[-25,3,1,deck],[-14,8,4,deck],[4,7,4,deck],[21,3,2,deck],[31,.3,.3,deck-1]]),'paint');
  b.add(root,hull([[-6,2,.3,deck+4],[0,4,2,deck+5],[10,2.8,1.5,deck+4],[16,.4,.3,deck+3]]),'dark');
  b.add(root,hull([[-3,1.7,.3,deck+5],[1,3.1,1.6,deck+5.4],[9,2,1.1,deck+4.8],[12,.3,.2,deck+4]]),'glass');
  b.box(root,[.7,.5,10],[0,deck+4.1,21],'gold');
  b.vents(root,0,deck+5,-17,4,4,2);
  for(const side of [-1,1]) {
    const flank = kind==='dart'
      ? [[8,8],[19,-7],[22,-23],[12,-16],[7,-9]]
      : heavy ? [[12,16],[32,10],[33,-20],[24,-26],[13,-19]]
        : [[8,8],[27,-9],[30,-20],[15,-14],[9,-7]];
    const mirrored=flank.map(([x,z])=>[side*x,z]);
    b.panel(root,mirrored,deck+.7,1,'paint',.35);
    b.panel(root,[[side*12,1],[side*14,-1],[side*(heavy?29:25),-17],[side*(heavy?26:23),-17]],deck+2, .3,'edge',.1);
    b.box(root,[1.1,.5,6],[side*(heavy?28:21),deck+2.5,-12],'gold');
    if(heavy) {
      b.panel(root,[[side*25,9],[side*32,7],[side*32,-7],[side*27,-10]],deck+2,.6,'gun',.2);
      for(let j=0;j<3;j++)b.cylinder(root,1.35,.8,[side*(27+j*2.4),deck+3,-5+j*2],'dark',true);
      b.panel(root,[[side*23,13],[side*30,11],[side*29,8],[side*22,10]],deck+2,.4,'edge',.1);
    }
    const ex=side*(heavy?23:12);
    b.add(root,hull([[-24,3,2,deck],[-19,5,4,deck],[-6,4.7,3.8,deck],[5,2,1.5,deck]]),'gun',[ex,0,0]);
    b.panel(root,[[ex-3,-20],[ex+3,-20],[ex+3,-7],[ex,-3],[ex-3,-7]],deck+3.3,.8,'shell',.3);
    b.vents(root,ex,deck+4.5,-18,4,4,2.1);
    b.engine(root,ex,deck,-24,heavy?3.6:2.9);
    const gunX=side*(kind==='dart'?9:heavy?18:16);
    b.box(root,[5,3,13],[gunX,deck,6],'dark');
    b.cylinder(root,1.45,13,[gunX,deck,14],'gun');
    b.cylinder(root,2.1,3,[gunX,deck,19],'edge');
    b.cylinder(root,1.45,.4,[gunX,deck,20.7],'dark');
    b.ring(root,1.1,.23,[gunX,deck,21],'light');
    b.box(root,[1,.5,4],[side*7,deck+4,15],'light');
  }
  if(kind==='turret' || kind==='relay') {
    const radius=kind==='relay'?9:8;
    b.cylinder(root,radius+2,3,[0,deck+6,-1],'dark',true);
    b.ring(root,radius,.9,[0,deck+8,-1],'gold',true);
    b.ring(root,radius-2,.6,[0,deck+8.3,-1],'light',true);
    b.cylinder(root,radius-3,1,[0,deck+8.1,-1],'glass',true);
    if(kind==='turret')for(const x of [-3,3]) {
      b.cylinder(root,1.3,19,[x,deck+9,10],'gun');
      b.ring(root,1.2,.3,[x,deck+9,19.5],'light');
    }
    else b.panel(root,[[-2,-8],[2,-8],[3,7],[0,11],[-3,7]],deck+9,.6,'edge',.2);
  }
  bake(root);
  if(heavy)root.scale.setScalar(1.3);
  return root;
}


const chapterPaints = [
  [0x367a99,0x57cbef], [0x756148,0xed5947], [0x67352a,0xff771f],
  [0x36543e,0xafff65], [0x554188,0xaf9bff],
];

export function buildLegacyRegularAircraft(kind, config = {}) {
  const index = Math.min(4, Math.max(0, Math.floor(Number(config.stageIndex ?? config.index) || 0)));
  const [color, accent] = chapterPaints[index];
  const materials = palette(kind, false, {color, accent, ...config});
  const root = buildEnemy(kind, materials);
  root.userData.legacyRegularAircraft = true;
  return {root, materials};
}

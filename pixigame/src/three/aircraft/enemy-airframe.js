import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Container } from '../display.js';
import { buildChapterEnemy, animateChapterEnemy } from './chapter-enemy-models.js';
import { enemySolidHull, enemyArmorPod } from './enemy-solid-geometry.js';
import { buildBossModel } from './boss-models.js';
import { buildLegacyRegularAircraft } from './legacy-regular-aircraft.js';
import {ADVANCED_CHAPTERS} from '../../advanced-chapters.js';
import {createEnemyHitFeedback} from '../enemy-hit-feedback.js';

// Enemy hardware uses the same layered, bevelled construction as the fighters.
// Coordinates are aircraft-local: +Y is the deck, +Z points toward the player.
const templates = new Map();
const silhouettes = {
  scout: [[0,31],[-9,13],[-31,-9],[-35,-24],[-13,-17],[0,-24],[13,-17],[35,-24],[31,-9],[9,13]],
  dart: [[0,37],[-8,17],[-22,-9],[-25,-28],[-10,-19],[0,-28],[10,-19],[25,-28],[22,-9],[8,17]],
  heavy: [[0,30],[-15,25],[-19,17],[-37,14],[-37,-22],[-25,-31],[-12,-24],[12,-24],[25,-31],[37,-22],[37,14],[19,17],[15,25]],
  turret: [[0,27],[-12,17],[-27,10],[-29,-16],[-17,-26],[17,-26],[29,-16],[27,10],[12,17]],
  relay: [[0,29],[-11,17],[-29,8],[-29,-10],[-13,-23],[0,-29],[13,-23],[29,-10],[29,8],[11,17]],
};

function plate(points, y, depth, bevel = .5, detailed = false) {
  const shape = new T.Shape();
  if (detailed) {
    // Short quadratic corners retain the designed silhouette, without the
    // cookie-cutter corners of a straight extruded polygon.
    const corners = points.map(([x,z],i) => {
      const before=points[(i+points.length-1)%points.length],after=points[(i+1)%points.length];
      const amount=Math.min(1.8,Math.hypot(x-before[0],z-before[1])*.12,Math.hypot(x-after[0],z-after[1])*.12);
      const towards=p=>{const d=Math.hypot(p[0]-x,p[1]-z)||1;return [x+(p[0]-x)*amount/d,-z-(p[1]-z)*amount/d];};
      return {entry:towards(before),exit:towards(after),point:[x,-z]};
    });
    shape.moveTo(...corners[0].entry);
    for(const c of corners){shape.lineTo(...c.entry);shape.quadraticCurveTo(...c.point,...c.exit);}
  } else points.forEach(([x,z], i) => i ? shape.lineTo(x,-z) : shape.moveTo(x,-z));
  shape.closePath();
  return new T.ExtrudeGeometry(shape, {
    depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: detailed ? 3 : 1, steps: 1, curveSegments: detailed ? 5 : 1,
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
  geometry.userData.hullSections = sections;
  return geometry;
}

// Indexed longitudinal loft: shared normals across rings eliminate triangular
// shading facets. Positive, eased section interpolation avoids spline overshoot.
function smoothHull(sections) {
  const rings=[], radial=32, vertices=[], indices=[];
  for(let i=0;i<sections.length-1;i++)for(let step=0;step<6;step++){
    const t=step/6,e=t*t*(3-2*t),a=sections[i],b=sections[i+1];
    rings.push(a.map((v,k)=>v+(b[k]-v)*(k===0?t:e)));
  }
  rings.push(sections.at(-1));
  for(const [z,w,h,y] of rings)for(let j=0;j<radial;j++){
    const a=j/radial*Math.PI*2,c=Math.cos(a);
    vertices.push(Math.sin(a)*w,y+c*h*(c<0?.7:1),z);
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<radial;j++){
    const a=i*radial+j,b=i*radial+(j+1)%radial;
    indices.push(a,a+radial,b,b,a+radial,b+radial);
  }
  const cap=(ring,reverse)=>{
    const center=vertices.length/3,[z,,,y]=rings[ring];vertices.push(0,y,z);
    for(let j=0;j<radial;j++){const a=ring*radial+j,b=ring*radial+(j+1)%radial;indices.push(center,reverse?b:a,reverse?a:b);}
  };
  cap(0,false);cap(rings.length-1,true);
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

function material(color, metalness=.55, roughness=.38) {
  return new T.MeshStandardMaterial({color,metalness:metalness*.65,roughness:Math.max(.46,roughness),transparent:true});
}

const chapterStyles = [
  { id:'coast', shell:0x8099aa, edge:0xc1d2d9, dark:0x142938, gun:0x345166, paint:0x285b83, gold:0xcba65a, accent:0x57cbef },
  { id:'city', shell:0x8d795b, edge:0xc0ae8e, dark:0x292a27, gun:0x3d413e, paint:0x554638, gold:0xb15a32, accent:0xed5947 },
  { id:'forge', shell:0x3b3d43, edge:0x77716b, dark:0x171921, gun:0x505058, paint:0x67352a, gold:0xb26331, accent:0xff771f },
  { id:'sewer', shell:0x507d76, edge:0x9bb7ac, dark:0x172923, gun:0x304646, paint:0x254b4c, gold:0xd1a340, accent:0xffbf58 },
  { id:'space', shell:0x7495a9, edge:0xc3dbe6, dark:0x132b39, gun:0x354d5b, paint:0x3d647e, gold:0x91abb9, accent:0x61dfff },
];
function chapterStyle(config) {
  const index = Number(config.stageIndex ?? config.index) || 0;
  if(index>=5){const c=ADVANCED_CHAPTERS[index-5]||ADVANCED_CHAPTERS.at(-1);return {...chapterStyles.find(s=>s.id===c.model),id:c.id,model:c.model,paint:c.color,accent:c.accent,shell:c.color};}
  return chapterStyles[Math.min(chapterStyles.length - 1, Math.max(0, Math.floor(index)))];
}

function palette(kind,boss,config) {
  const theme = chapterStyle(config);
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
  for (const key of ['shell','edge','dark','gun','paint','gold']) materials[key].color.set(theme[key]);
  if (theme.id === 'city' || theme.id === 'sewer') for (const key of ['shell','paint','gold']) {
    materials[key].roughness = .88;
    materials[key].metalness = .3;
  }
  materials.light.emissive.set(theme.accent);
  materials.glass.color.set(theme.id==='space'?0x302451:0x09222b);
  materials.glass.metalness=.12;materials.glass.roughness=.22;
  materials.light.emissiveIntensity = 1.65;
  if(boss || kind==='heavy' || config.elite) {
    materials.shell.userData.detailed = true;
    materials.shell.roughness = theme.id==='city'||theme.id==='sewer' ? .64 : .42;
    materials.shell.metalness = .22;
    materials.paint = new T.MeshPhysicalMaterial({color:theme.paint,metalness:.32,roughness:.46,clearcoat:.22,clearcoatRoughness:.36,transparent:true});
    materials.edge.roughness=.38;materials.edge.metalness=.65;
    materials.dark.roughness=.72;materials.dark.metalness=.25;
    materials.glass = new T.MeshPhysicalMaterial({color:0x102936,metalness:.15,roughness:.18,clearcoat:.75,clearcoatRoughness:.15,transparent:true});
    materials.light.emissiveIntensity=.85;
  }
  // Restrained painted surfaces: readable color blocks, not tiny chrome glints.
  for(const key of ['shell','edge','dark','gun','paint','gold']) {
    materials[key].roughness=.8;
    materials[key].metalness=.12;
    materials[key].envMapIntensity=.25;
    if(materials[key].isMeshPhysicalMaterial)materials[key].clearcoat=.08;
  }
  materials.glass.color.set(theme.id==='space'?0x236477:0x20445a);
  materials.glass.envMapIntensity=.2;materials.glass.roughness=.38;
  if(materials.glass.isMeshPhysicalMaterial)materials.glass.clearcoat=.2;
  return materials;
}

function builder(materials) {
  const detailed=Boolean(materials.shell.userData.detailed);
  const add = (parent,geo,name,position=[0,0,0]) => {
    if(detailed && geo.userData.hullSections){const old=geo;geo=smoothHull(old.userData.hullSections);old.dispose();}
    const mesh=new T.Mesh(geo,materials[name]);
    mesh.position.fromArray(position);mesh.castShadow=name!=='light';
    mesh.receiveShadow=true;mesh.userData.bloom=name==='light';parent.add(mesh);
    return mesh;
  };
  const box = (parent,size,position,name) => add(parent,Math.min(...size)>1.5 ? new RoundedBoxGeometry(...size,detailed?2:1,Math.min(2,Math.min(...size)*.22)) : new T.BoxGeometry(...size),name,position);
  const panel = (parent,points,y,depth,name,bevel=.5) => add(parent,plate(points,y,depth,bevel,detailed),name);
  const ring = (parent,r,t,position,name,deck=false) => {
    const geo=new T.TorusGeometry(r,t,detailed?10:4,detailed?48:24);
    if(deck)geo.rotateX(-Math.PI/2);
    return add(parent,geo,name,position);
  };
  const cylinder = (parent,r,len,position,name,deck=false) => {
    const geo=new T.CylinderGeometry(r,r,len,detailed?40:12);
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
    const jet=new T.ConeGeometry(r*.38,r*(detailed?2.1:3.6),detailed?24:8).rotateX(-Math.PI/2);
    add(parent,jet,'light',[x,y,z-r*1.8-2.5]);
  };
  const solid=(parent,sections,name,position=[0,0,0])=>add(parent,enemySolidHull(sections,detailed?20:12),name,position);
  return {add,box,panel,ring,cylinder,vents,engine,solid};
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
  b.solid(root,[[-27,3,3,deck-2],[-16,9,7,deck],[2,9,8,deck+1],[22,4,4,deck],[33,.4,.7,deck-1]],'paint');
  b.solid(root,[[-8,2,1,deck+7],[0,5,4,deck+8],[11,3.7,3,deck+7],[17,.4,.5,deck+5]],'dark');
  b.solid(root,[[-5,1.5,.8,deck+10],[1,4,3.2,deck+10],[10,2.5,2.2,deck+9],[14,.3,.3,deck+7]],'glass');
  b.box(root,[.7,.5,10],[0,deck+4.1,21],'gold');
  b.vents(root,0,deck+5,-17,4,4,2);
  for(const side of [-1,1]) {
    const flank = kind==='dart'
      ? [[8,8],[19,-7],[22,-23],[12,-16],[7,-9]]
      : heavy ? [[12,16],[32,10],[33,-20],[24,-26],[13,-19]]
        : [[8,8],[27,-9],[30,-20],[15,-14],[9,-7]];
    const mirrored=flank.map(([x,z])=>[side*x,z]);
    b.add(root,enemyArmorPod(mirrored,deck+.7,heavy?5:3.8),'paint');
    b.panel(root,[[side*12,1],[side*14,-1],[side*(heavy?29:25),-17],[side*(heavy?26:23),-17]],deck+2, .3,'edge',.1);
    b.box(root,[1.1,.5,6],[side*(heavy?28:21),deck+2.5,-12],'gold');
    if(heavy) {
      b.panel(root,[[side*25,9],[side*32,7],[side*32,-7],[side*27,-10]],deck+2,.6,'gun',.2);
      for(let j=0;j<3;j++)b.cylinder(root,1.35,.8,[side*(27+j*2.4),deck+3,-5+j*2],'dark',true);
      b.panel(root,[[side*23,13],[side*30,11],[side*29,8],[side*22,10]],deck+2,.4,'edge',.1);
    }
    const ex=side*(heavy?23:12);
    b.solid(root,[[-26,3,3,deck],[-19,5.5,5.5,deck],[-6,5,5,deck],[6,2,2,deck]],'gun',[ex,0,0]);
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

function buildBoss(materials,pattern) {
  const root=new T.Group(),b=builder(materials);
  const broad=['walls','aegis','mountain'].includes(pattern);
  const spear=['charge','arrows','lances','war','thunder'].includes(pattern);
  const wing=broad ? 112 : 105, nose=spear?79:65;
  b.panel(root,[[0,nose],[-27,52],[-46,49],[-82,35],[-wing,3],[-wing+7,-40],[-72,-64],[-34,-42],[0,-53],[34,-42],[72,-64],[wing-7,-40],[wing,3],[82,35],[46,49],[27,52]],0,8,'dark',2);
  b.add(root,hull([[-55,9,3,9],[-35,26,8,10],[0,30,10,11],[38,21,7,9],[nose,1,1,7]]),'shell');
  b.add(root,hull([[-33,8,2,20],[-15,18,5,20],[15,14,4,19],[43,4,2,14],[nose-7,.5,.5,9]]),'paint');
  b.panel(root,[[-5,28],[5,28],[7,47],[0,nose-5],[-7,47]],17,1.2,'edge',.5);
  b.panel(root,[[-1.1,31],[1.1,31],[1.7,48],[0,nose-12],[-1.7,48]],19,.6,'gold',.2);
  b.vents(root,0,21,-40,12,5,3);
  for(const side of [-1,1]) {
    const flip=points=>points.map(([x,z])=>[side*x,z]);
    // Continuous shoulders support both weapon pods even in the final phase.
    b.panel(root,flip([[20,27],[45,41],[84,24],[wing-4,-4],[92,-40],[71,-56],[32,-34]]),8,5,'shell',1.6);
    b.add(root,hull([[-47,5,1,14],[-33,23,4.5,14],[-8,29,5.5,14],[16,24,4.2,14],[31,5,1,13]]),'paint',[side*65,0,0]);
    b.panel(root,flip([[82,17],[90,13],[103,-5],[89,-38],[86,-31],[96,-4]]),16.7,.8,'edge',.25);
    b.panel(root,flip([[77,20],[80,18],[94,-4],[88,-17],[85,-13],[88,-3]]),17.1,.45,'gold',.15);
    b.panel(root,flip([[69,18],[82,12],[87,2],[80,-3],[70,4]]),17,1.1,'dark',.3);
    b.panel(root,flip([[71,15],[80,11],[83,3],[79,0],[72,5]]),18.4,.7,'shell',.25);
    b.panel(root,flip([[47,-35],[61,-42],[65,-34],[59,-22],[49,-22]]),17,1,'gun',.4);
    for(let j=0;j<3;j++) {
      b.box(root,[6,.9,2],[side*55,18.5,-33+j*3],'dark');
      b.box(root,[3,.45,.65],[side*55,19.1,-33+j*3],'gold');
    }
    b.panel(root,flip([[28,-20],[38,-27],[41,-44],[34,-50],[28,-40]]),14,4,'dark',.6);
    b.vents(root,side*76,17.5,-30,14,5,3.1);
    for(let j=0;j<3;j++)b.box(root,[2,1.1,6],[side*(86+j*4),17,-9-j*3],'gun');
    for(const z of [-39,19])b.cylinder(root,1.4,.8,[side*69,18,z],'edge',true);
    b.add(root,hull([[-55,6,4,11],[-42,11,8,11],[-18,10,8,11],[-9,5,3,11]]),'dark',[side*42,0,0]);
    b.panel(root,flip([[35,-47],[49,-47],[51,-26],[43,-18],[34,-27]]),18,2,'shell',.7);
    b.vents(root,side*42,21,-42,9,4,3.2);
    b.engine(root,side*42,11,-55,7);
    b.engine(root,side*78,8,-42,4.5);
    const pod=new T.Group();pod.name=side<0?'cannon-left':'cannon-right';pod.position.x=side*61;
    b.add(pod,hull([[-18,5,3,17],[-6,11,7,17],[27,10,7,17],[40,6,4,16]]),'dark');
    b.panel(pod,[[-8,-10],[8,-10],[9,20],[5,30],[-5,30],[-9,20]],23,2,'shell',.7);
    b.panel(pod,[[-4,-7],[4,-7],[4,17],[0,25],[-4,17]],25.7,.7,'paint',.3);
    b.vents(pod,0,27,-5,5,4,2.6);
    b.cylinder(pod,4.8,21,[0,17,39],'gun');
    b.cylinder(pod,6.1,6,[0,17,46],'edge');
    b.cylinder(pod,4.8,.6,[0,17,49.5],'dark');
    b.ring(pod,3.4,.65,[0,17,50],'light');
    for(const x of [-7,7])b.box(pod,[1.1,.6,14],[x,25,10],'gold');
    bake(pod);root.add(pod);
    // Phase shutters lift over a solid connecting shoulder, never float away.
    const shutter=new T.Group();shutter.name=side<0?'shutter-left':'shutter-right';
    shutter.position.set(side*26,20,0);
    b.panel(shutter,flip([[0,-12],[8,-18],[13,-5],[10,13],[3,17],[0,7]]),0,2.3,'edge',.5);
    b.panel(shutter,flip([[3,-8],[5,-10],[8,-2],[6,9],[3,11]]),3,.6,'light',.2);
    bake(shutter);root.add(shutter);
  }
  // A machined recessed reactor replaces the old exposed glowing sphere.
  b.cylinder(root,18,3,[0,25,0],'dark',true);
  b.ring(root,16,1.5,[0,27,0],'gun',true);
  b.ring(root,13.4,.8,[0,27.5,0],'gold',true);
  b.cylinder(root,11.7,1,[0,27,0],'glass',true);
  b.ring(root,10.6,.7,[0,27.8,0],'light',true);
  b.panel(root,[[-2,-7],[2,-7],[5,0],[2,7],[-2,7],[-5,0]],28,.6,'light',.2);
  for(let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    const lug=b.box(root,[3,1.4,2],[Math.sin(a)*16,28,Math.cos(a)*16],'edge');lug.rotation.y=a;
  }
  if(spear)for(const side of [-1,1]) {
    b.panel(root,[[side*9,36],[side*18,29],[side*23,52],[side*13,70]],14,2,'paint',.6);
  }
  if(broad)for(const side of [-1,1]) {
    b.panel(root,[[side*89,12],[side*111,0],[side*108,-29],[side*96,-39]],13,5,'gun',1);
  }
  bake(root);
  return root;
}

// Chapter-specific hardware shares only the low-level mesh construction helpers.
// City machines have round pressure vessels and exposed articulated arms;
// forge machines have broad angular shells, vents and a recessed furnace core.
function buildCity(kind, materials, boss) {
  const root = new T.Group(), b = builder(materials);
  const heavy = kind === 'heavy', turret = kind === 'turret', dart = kind === 'dart';
  const detailed = Boolean(materials.shell.userData.detailed);
  const r = boss ? 48 : heavy ? 21 : turret ? 17 : dart ? 12 : 15;
  b.cylinder(root, r, boss ? 20 : 10, [0,5,0], 'dark', true);
  b.add(root, new T.SphereGeometry(r,detailed?48:16,detailed?24:8).scale(1,.62,1), 'shell', [0,12,0]);
  b.ring(root,r*.94,boss?2.2:1.1,[0,9,0],'gold',true);
  const crown = detailed ? 12+r*.62 : 24;
  b.cylinder(root,r*.49,2,[0,crown,0],'dark',true);
  b.ring(root,r*.41,.65,[0,crown+1.2,0],'gun',true);
  b.cylinder(root,r*.3,1.2,[0,crown+1,0],'glass',true);
  b.ring(root,r*.28,.45,[0,crown+1.7,0],'light',true);
  // Two recessed forward lenses make the machine's facing direction readable.
  for(const side of [-1,1]) {
    b.cylinder(root,boss?5:2,2,[side*r*.35,14,r*.87],'dark');
    b.cylinder(root,boss?3:1.3,2.3,[side*r*.35,14,r*.9],'light');
    const arm = new T.Group(); arm.name = side<0?'cannon-left':'cannon-right';
    arm.position.x = side * (boss ? 61 : r+9);
    b.box(arm,[boss?27:15,4,6],[-side*7,7,-4],'gun');
    b.cylinder(arm,boss?12:5,boss?13:8,[0,10,0],'gold',true);
    if (boss || turret || heavy) {
      if(detailed) {
        const w=boss?12:5,l=boss?24:12,h=boss?9:4;
        b.add(arm,hull([[-l,w*.35,h*.35,12],[-l*.6,w,h,12],[l*.6,w*.9,h*.85,12],[l,w*.6,h*.5,12]]),'paint');
        b.vents(arm,0,12+h,-l*.45,w*.9,4,boss?3:1.5);
        b.ring(arm,boss?7:3,.7,[0,12,-l*.65],'edge');
      } else b.box(arm,[10,8,20],[0,12,7],'paint');
      for(const x of boss?[-6,6]:[0]) {
        b.cylinder(arm,boss?3:1.8,boss?45:23,[x,13,boss?36:19],'gun');
        b.ring(arm,boss?2.7:1.5,.5,[x,13,boss?59:31],'light');
      }
    } else {
      b.ring(arm,dart?6:9,1.8,[0,7,0],'gun',true);
      b.box(arm,[dart?14:19,1,2],[0,7,0],'edge');
      b.box(arm,[2,1,dart?14:19],[0,7,0],'edge');
    }
    bake(arm);root.add(arm);
    if(boss) {
      const shutter=new T.Group();shutter.name=side<0?'shutter-left':'shutter-right';
      shutter.position.set(side*26,20,0);
      b.add(shutter,hull([[-33,2,1,9],[-25,9,4,10],[-6,8,4,10],[5,2,1,8]]),'paint');
      b.vents(shutter,0,14,-25,10,5,3);
      bake(shutter);root.add(shutter);
      b.cylinder(root,11,35,[side*27,8,-49],'gun');
      b.ring(root,9,2,[side*27,8,-66],'gold');
    } else {
      b.engine(root,side*r*.55,3,-r,2.5);
    }
  }
  // Uneven patch plates and rivets, rather than a uniform recolor.
  for(let i=0;i<5;i++) {
    const a=i*1.17,x=Math.sin(a)*r*.67,z=Math.cos(a)*r*.67;
    if(detailed) {
      // Conformal service hatches sit against the dome instead of hovering boxes.
      const y=12+Math.sqrt(Math.max(0,r*r-x*x-z*z))*.62;
      const hatch=b.add(root,new T.SphereGeometry(boss?6:2.5,24,12).scale(1,.13,.75),i%2?'gun':'paint',[x,y+.25,z]);
      hatch.rotation.x=Math.atan2(z*.62,r);hatch.rotation.z=-Math.atan2(x*.62,r);
      b.cylinder(root,boss?.9:.4,.5,[x,y+1,z],'edge',true);
    } else {
      b.box(root,[4,1.4,3],[x,21,z],i%2?'gold':'paint');
      b.cylinder(root,.6,1.6,[x,23,z],'edge',true);
    }
  }
  if(dart) b.box(root,[3,3,23],[0,8,20],'gun');
  bake(root);return root;
}

function buildForge(kind, materials, boss) {
  const root=new T.Group(),b=builder(materials),heavy=kind==='heavy',dart=kind==='dart';
  const w=boss?100:heavy?40:dart?24:32, l=boss?79:heavy?38:42;
  // Longitudinal fuselage + swept wings: readable aircraft, not a walking furnace.
  const outline=[[0,l],[-w*.14,l*.56],[-w*.2,l*.16],[-w*.94,-l*.36],[-w,-l*.58],
    [-w*.36,-l*.43],[-w*.24,-l*.78],[0,-l*.88],[w*.24,-l*.78],[w*.36,-l*.43],
    [w,-l*.58],[w*.94,-l*.36],[w*.2,l*.16],[w*.14,l*.56]];
  b.panel(root,outline,0,boss?5:2.5,'dark',.6);
  b.panel(root,outline.map(([x,z])=>[x*.94,z*.94]),boss?5:2.5,boss?2.5:1.2,'shell',.5);
  const deck=boss?15:7;
  b.add(root,hull([[-l*.82,w*.12,deck*.55,4],[-l*.32,w*.22,deck,4],
    [l*.26,w*.15,deck*.82,4],[l*.72,w*.065,deck*.35,3],[l,0.6,.7,1]]),'paint');
  b.add(root,hull([[l*.04,w*.1,deck*.6,deck],[l*.28,w*.08,deck*.72,deck],
    [l*.48,w*.025,1,deck*.7]]),'glass');
  b.cylinder(root,boss?13:4.8,1.5,[0,deck+5,-l*.3],'gun',true);
  b.cylinder(root,boss?9:3.2,1.8,[0,deck+5.4,-l*.3],'light',true);
  for(const side of [-1,1]) {
    b.panel(root,[[side*w*.24,-l*.05],[side*w*.82,-l*.4],[side*w*.7,-l*.47],
      [side*w*.28,-l*.3]],boss?8:4,1,'gold',.2);
    b.panel(root,[[side*w*.15,-l*.56],[side*w*.48,-l*.77],[side*w*.46,-l*.94],
      [side*w*.16,-l*.83]],boss?9:5,1.5,'paint',.3);
    const fin=b.add(root,plate([[0,-l*.42],[0,-l*.85],[deck*1.1,-l*.77],[deck*1.4,-l*.6]],0,1,.2),'shell');
    fin.rotation.z=side*Math.PI*.36;fin.position.set(side*w*.17,deck*.65,0);
    const arm=new T.Group();arm.name=side<0?'cannon-left':'cannon-right';
    arm.position.x=side*(boss?61:w*.63);
    b.add(arm,hull([[-l*.55,boss?11:3.5,4,4],[0,boss?9:3,5,4],
      [l*.25,boss?5:1.7,3,4]]),'paint');
    b.cylinder(arm,boss?4:1.6,boss?18:9,[0,4,l*.29],'gun');
    b.ring(arm,boss?3:1.2,.4,[0,4,l*.29+(boss?9:4.5)],'light');
    bake(arm);root.add(arm);
    b.add(root,hull([[-l*.86,w*.1,5,4],[-l*.4,w*.12,7,4],[-l*.1,w*.06,4,4]]),'dark',[side*w*.25,0,0]);
    b.engine(root,side*w*.25,5,-l*.87,boss?9:3.5);
    if(boss) {
      const shutter=new T.Group();shutter.name=side<0?'shutter-left':'shutter-right';
      shutter.position.set(side*26,20,0);
      b.panel(shutter,[[0,-20],[side*15,-30],[side*21,9],[side*5,20]],6,8,'edge',.6);
      b.box(shutter,[4,2,24],[side*9,15,-5],'light');
      bake(shutter);root.add(shutter);
      b.engine(root,side*61,4,-l*.61,7);
    }
  }
  if(kind==='turret'||kind==='relay') {
    for(const side of [-1,1])b.cylinder(root,1.8,18,[side*10,5,13],'gun');
  }
  if(dart)b.panel(root,[[0,l+5],[-3,l*.4],[0,l*.12],[3,l*.4]],5,1.5,'gold',.3);
  bake(root);return root;
}

export function createEnemyModel(kind,boss=false,config={}) {
  const type=boss?kind:(silhouettes[kind]?kind:'scout');
  const theme=chapterStyle(config);
  const regular=!boss&&!config.elite;
  const key=JSON.stringify([type,boss,Boolean(config.elite),theme.id,config.color,config.accent,config.pattern]);
  let template=templates.get(key);
  if(!template) {
    if(regular) template=buildLegacyRegularAircraft(type,config);
    else {
      const materials=palette(type,boss,config);
      const root=boss ? buildBossModel(theme.model||theme.id,builder(materials),bake)
        :buildChapterEnemy(theme.model||theme.id,type,'elite',builder(materials),bake);
      if(theme.model){
        root.userData.chapterVariant=theme.id;
        const variant=ADVANCED_CHAPTERS.find(chapter=>chapter.id===theme.id);
        const scale=variant?.modelScale || [theme.id==='iron-dock'?1.08:theme.id==='red-nest'?.9:1,1,theme.id==='frozen-rift'?1.12:theme.id==='sky-core'?.88:1];
        root.scale.multiply(new T.Vector3(...scale));
      }
      template={root,materials};
    }
    templates.set(key,template);
  }
  const view=new Container({label:boss?'three-boss':'three-enemy'});
  view.chapterTheme=theme.id;
  view.enemyTier=boss?'boss':config.elite?'elite':'regular';
  view.directional=regular;
  view.scaleDepth=true;
  const mount=new T.Group(),body=template.root.clone(true);
  const owned=new Map(Object.values(template.materials).map(mat=>[mat,mat.clone()]));
  body.traverse(mesh=>{if(mesh.isMesh)mesh.material=owned.get(mesh.material);});
  // A slight forward pitch exposes hull sides in the steep combat camera.
  // It is a rigid 3D attitude, never a camera-facing sprite/billboard.
  mount.rotation.x=Math.PI/2+(regular?0:.24);mount.scale.z=-1;
  view.modelMount=mount;
  mount.add(body);view.object3D.add(mount);
  const hitFeedback=createEnemyHitFeedback(Object.fromEntries(Object.entries(template.materials).map(([key,mat])=>[key,owned.get(mat)])),body,mount);
  view.reactToHit=(profile,angle)=>hitFeedback.trigger(profile,angle);
  view.hitFeedbackSnapshot=()=>hitFeedback.snapshot();
  const light=owned.get(template.materials.light);
  const normalColor=light.emissive.clone();
  const cannons=['left','right'].map(side=>body.getObjectByName(`cannon-${side}`));
  view.updateEnemy=(time,{phase=1,cannons:health,charging=false}={})=>{
    if(boss)phase=1; // Bosses have one form regardless of remaining health.
    view.phase=phase;
    mount.rotation.z=regular?0:Math.sin(time*.7)*(boss?.025:.045);
    if(body.userData.chapterModel)animateChapterEnemy(body,time,phase,charging);
    for(let i=0;i<2;i++)if(cannons[i])cannons[i].visible=!health||health[i?'right':'left']>0;
    if(view._phaseColor!==phase) {
      view._phaseColor=phase;
      light.emissive.copy(normalColor);
      if(phase>1)light.emissive.lerp(new T.Color(phase>=3?0xff6655:0xffd99c),.3);
    }
    light.emissiveIntensity=(regular ? 1.65 : .85)+(phase-1)*.12+(charging ? .35 : 0);
    hitFeedback.update(time);
  };
  view._disposeVisuals=()=>{owned.forEach(mat=>mat.dispose());};
  view.updateEnemy(0);
  return view;
}

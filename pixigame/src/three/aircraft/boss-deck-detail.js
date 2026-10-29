import * as T from 'three';

// Boss-only mid-scale structures. All are on exposed decks; no hidden plumbing
// or micro-rivets. Static pieces join the existing material bake.
export function addBossDeckDetail(theme,root,b,{roof,panel,optic,gun,group}) {
  const modules=[];
  const module=name=>modules.push(name);
  const hatch=(x,y,z,w,l,mat='paint')=>{
    b.box(root,[w+2,1,l+2],[x,y,z],'dark');
    b.box(root,[w,2,l],[x,y+1,z],mat);
    b.box(root,[w*.65,.8,2],[x,y+2.5,z],'edge');
  };
  const battery=(x,y,z)=>{
    b.box(root,[11,4,20],[x,y,z],'gun');
    b.box(root,[9,1,18],[x,y+2.6,z],'shell');
    for(const dx of [-2.3,2.3])for(const dz of [-5,0,5])
      b.cylinder(root,1.65,.6,[x+dx,y+3.5,z+dz],'dark',true);
  };
  const conduit=(points,r=1.5)=>{
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
    b.add(root,new T.TubeGeometry(curve,8,r,8,false),'gun');
  };
  if(theme==='coast') {
    module('paired-launch-bays');module('bridge-and-stern-turbines');module('deck-elevators');
    for(const s of [-1,1]) {
      battery(s*21,13,-13);
      b.cylinder(root,5.5,3,[s*32,12,-26],'gun',true);
      b.cylinder(root,3.8,1,[s*32,14,-26],'dark',true);
      b.box(root,[6,1.2,2],[s*32,15,-26],'edge');
      b.box(root,[2,2,34],[s*15,13,3],'gold');
      hatch(s*22,12,21,8,12,'shell');
    }
    b.box(root,[12,7,11],[-10,16,-20],'paint');
    b.box(root,[13,3,3],[-10,21,-13],'glass');
    b.box(root,[5,4,7],[8,15,-24],'shell');
    b.box(root,[3,1,6],[8,18,-24],'light');
  } else if(theme==='city') {
    module('pressure-collar');module('shoulder-mortar-banks');module('wing-hinges');
    b.ring(root,10,1.6,[0,21,6],'gun',true);
    for(const s of [-1,1]) {
      hatch(s*13,20,-4,7,10,'shell');
      b.cylinder(root,4,4,[s*19,18,-18],'gun',true);
      b.ring(root,3.4,.8,[s*19,20.4,-18],'gold',true);
      b.cylinder(root,2.5,1,[s*19,21,-18],'dark',true);
      conduit([[s*8,22,-19],[s*18,23,-13],[s*20,18,-5]],1.7);
      const wing=root.getObjectByName(`machine-wing-${s}`);
      b.cylinder(wing,5,3,[s*4,5,0],'gun',true);
      b.cylinder(wing,2.6,1,[s*4,7,0],'gold',true);
      b.vents(wing,s*22,8,-1,8,3,3);
      b.box(wing,[5,3,11],[s*24,7,13],'shell');
    }
    panel(root,[[-8,19],[8,19],[10,25],[-10,25]],13,2,'gun');
    b.box(root,[9,1,2],[0,16,23],'light');
  } else if(theme==='forge') {
    module('segmented-furnace-collar');module('press-drive-pistons');module('exhaust-manifold');
    b.ring(root,15,1.7,[0,15,0],'gun',true);
    for(let i=0;i<6;i++) {
      const a=i*Math.PI/3,m=b.box(root,[6,3,4],[Math.sin(a)*17,15,Math.cos(a)*17],'gold');m.rotation.y=a;
    }
    for(const s of [-1,1]) {
      const claw=root.getObjectByName(`claw-${s}`);
      b.box(claw,[10,4,16],[s*16,12,5],'paint');
      b.vents(claw,s*16,15,0,7,3,4);
      b.cylinder(claw,3.5,16,[s*7,9,-3],'gun');
      b.cylinder(claw,2.2,13,[s*7,9,9],'edge');
      conduit([[s*12,13,-16],[s*22,16,-18],[s*27,13,-5]],1.8);
      b.ring(root,6,1,[s*15,21,-24],'gold',true);
    }
    hatch(0,11,23,16,8,'paint');
  } else if(theme==='sewer') {
    module('pressure-manifold');module('float-armor-bands');module('pump-control-deck');
    for(const s of [-1,1]) {
      for(const z of [-23,22])b.box(root,[18,2,4],[s*32,14,z],'shell');
      conduit([[s*5,20,-6],[s*16,23,-12],[s*24,20,-4]],2);
      b.cylinder(root,4,2,[s*14,20,-9],'gun',true);
      const valve=group(`valve-${s}`,[s*14,22,-9]);
      b.box(valve,[8,1.5,2],[0,0,0],'gold');b.box(valve,[2,1.5,8],[0,0,0],'gold');
      hatch(s*31,16,-10,10,12,'paint');
      const cannon=root.getObjectByName(`cannon-${s<0?'left':'right'}`);
      b.box(cannon,[8,3,10],[0,6,-2],'gun');b.box(cannon,[4,1,8],[0,8,-2],'gold');
    }
    b.box(root,[17,3,9],[0,19,-24],'gun');
    b.box(root,[11,1,5],[0,21,-24],'glass');
    b.box(root,[5,1,2],[0,22,-24],'light');
  } else if(theme==='space') {
    module('dome-locking-collar');module('radial-power-tracks');module('petal-emitter-banks');
    b.ring(root,18,1.2,[0,11,0],'gun',true);
    for(let i=0;i<3;i++) {
      const a=i*Math.PI*2/3+Math.PI/3;
      const track=b.box(root,[7,2,17],[Math.sin(a)*29,8,Math.cos(a)*29],'paint');track.rotation.y=a;
      const core=b.box(root,[3,1,11],[Math.sin(a)*29,9.7,Math.cos(a)*29],'light');core.rotation.y=a;
      const petal=root.getObjectByName(`ufo-petal-${i}`);
      b.ring(petal,6.4,1.1,[0,7,6],'gun',true);
      for(const s of [-1,1]) {
        b.box(petal,[4,1.5,10],[s*8,5,-4],'shell');
        b.box(petal,[2,1,5],[s*8,6,-4],'dark');
      }
      const satellite=root.getObjectByName(`satellite-${i}`);
      b.ring(satellite,5.5,.7,[0,2,0],'paint',true);
    }
  }
  root.userData.bossDetailModules=modules;
}

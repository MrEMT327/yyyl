import * as T from 'three';
import {enemyDeckShell} from './enemy-solid-geometry.js';
import {addBossDeckDetail} from './boss-deck-detail.js';

// APK-informed density: broad shell + focal feature + major weapon modules.
// +Y faces the combat camera, +Z faces the player. No detailed undercarriages.
export function buildDeckFocusedMachine(theme,kind,tier,b,bake) {
  const root=new T.Group(),boss=tier==='boss',elite=tier==='elite',major=boss||elite;
  const group=(name,pos=[0,0,0],parent=root)=>{
    const g=new T.Group();g.name=name;g.position.fromArray(pos);parent.add(g);return g;
  };
  const roof=(parent,pos,size,mat='shell')=>{
    const m=b.add(parent,enemyDeckShell(boss?32:24),mat,pos);m.scale.fromArray(size);return m;
  };
  const panel=(parent,points,y,h,mat='paint')=>b.panel(parent,points,y,h,mat,.7);
  const optic=(parent,x,y,z,r,mat='light')=>{
    b.cylinder(parent,r+1.4,1.8,[x,y,z],'dark',true);
    return roof(parent,[x,y+1.1,z],[r,r*.32,r],mat);
  };
  const gun=(parent,x,y,z,r=3,len=15)=>{
    b.cylinder(parent,r,len,[x,y,z],'gun');
    b.cylinder(parent,r*1.2,3,[x,y,z+len/2-1],'shell');
    b.cylinder(parent,r*.77,.5,[x,y,z+len/2+.6],'dark');
  };
  const stripe=(parent,x,y,z,w=5,len=12)=>b.box(parent,[w,.6,len],[x,y,z],'gold');
  const canopy=(parent,x,y,z,w,l)=>{
    roof(parent,[x,y,z],[w+1.5,4,l+1.5],'dark');
    roof(parent,[x,y+1.6,z],[w,4,l],'glass');
    b.box(parent,[w*1.2,.6,2],[x,y+5.4,z+1],'edge');
  };
  const pump=(parent,x,y,z,r,name)=>{
    b.cylinder(parent,r+1,3,[x,y,z],'dark',true);
    b.ring(parent,r,1,[x,y+2,z],'shell',true);
    const rotor=group(`deck-rotor-${name}`,[x,y+2,z],parent);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3;
      const m=b.box(rotor,[r*.8,1.2,r*.32],[Math.sin(a)*r*.42,0,Math.cos(a)*r*.42],'gold');m.rotation.y=a+Math.PI/2;
    }
    b.cylinder(rotor,r*.22,2,[0,1,0],'gun',true);
  };

  if(theme==='coast') {
    if(!major) {
      const dart=kind==='dart',heavy=kind==='heavy',w=heavy?33:dart?23:29;
      roof(root,[0,0,0],[heavy?13:10,10,dart?31:27]);
      for(const side of [-1,1]) {
        panel(root,[[side*5,10],[side*w,-6],[side*(w-2),-18],[side*8,-9]],2,3,'paint');
        panel(root,[[side*8,-17],[side*17,-24],[side*16,-30],[side*6,-24]],3,2,'shell');
        stripe(root,side*(w-8),6,-8,4,9);
        if(heavy||kind==='turret')gun(root,side*17,5,10,2.6,15);
      }
      canopy(root,0,9,4,5,10);
      if(kind==='relay')optic(root,0,10,-12,5);
      else if(!heavy&&kind!=='turret')gun(root,0,2,26,2.5,10);
    } else {
      // Escort: open twin hulls + bridge. Boss: broad flight deck + turrets.
      const x=boss?32:29,l=boss?37:30;
      b.box(root,[x*2,7,boss?41:18],[0,1,-5],'gun');
      for(const side of [-1,1]) {
        roof(root,[side*x,3,0],[boss?13:11,11,l],'paint');
        roof(root,[side*x,11,-7],[8,4,17]);
        stripe(root,side*x,15,-10,4,15);
        const cannon=group(`cannon-${side<0?'left':'right'}`,[side*x,12,10]);
        roof(cannon,[0,0,0],[8,5,10]);
        gun(cannon,boss?-3:0,2,13,2.7,17);
        if(boss)gun(cannon,3,2,13,2.7,17);
      }
      if(boss) {
        panel(root,[[-19,-34],[19,-34],[22,24],[0,40],[-22,24]],7,3,'shell');
        panel(root,[[-12,-28],[12,-28],[12,25],[0,32],[-12,25]],11,1,'dark');
        for(const z of [-20,-6,8,22])b.box(root,[2,.6,7],[0,12.8,z],'edge');
        canopy(root,-10,15,-19,6,8);
        const radar=group('radar',[-10,24,-22]);b.box(radar,[11,2,3],[0,0,0],'paint');
      } else {
        roof(root,[0,5,-7],[19,7,13]);canopy(root,0,12,-5,7,6);
        gun(root,0,7,14,4,18);
      }
    }
  } else if(theme==='city') {
    const r=boss?24:elite?20:kind==='dart'?12:16;
    roof(root,[0,1,0],[r,r*.8,r*1.15],'shell');
    optic(root,0,r*.77,6,major?7:5);
    for(const side of [-1,1]) {
      const wing=group(`machine-wing-${side}`,[side*(r-3),3,-3]);
      const reach=boss?32:elite?27:19;
      b.box(wing,[11,5,8],[side*4,0,0],'gun');
      panel(wing,[[side*6,-10],[side*reach,-18],[side*(reach+2),3],[side*(reach-4),17],[side*7,8]],0,5,'paint');
      panel(wing,[[side*12,-8],[side*(reach-3),-11],[side*(reach-5),5],[side*12,3]],5.8,1,'shell');
      if(major)gun(wing,side*(reach-8),5,15,boss?4:3,16);
      if(boss) {
        roof(wing,[side*13,7,-13],[8,6,12],'shell');
        stripe(wing,side*13,13,-13,5,9);
      }
    }
    if(major||kind==='heavy')for(const side of [-1,1])roof(root,[side*r*.65,9,-r*.68],[major?7:5,major?7:5,major?15:10],'paint');
    if(kind==='turret'&&!major)gun(root,0,6,21,4,16);
    if(kind==='relay'&&!major)optic(root,0,15,-9,4,'gold');
    if(boss) {
      roof(root,[0,15,-21],[12,8,15],'paint');
      b.vents(root,0,23,-24,12,3,4);
      panel(root,[[-12,16],[12,16],[15,25],[0,31],[-15,25]],7,4,'gold');
      gun(root,0,5,32,5,13);
    }
  } else if(theme==='forge') {
    const r=boss?26:elite?22:kind==='dart'?13:19;
    roof(root,[0,0,0],[r,12,r],'shell');
    b.cylinder(root,r*.63,2,[0,11,0],'dark',true);optic(root,0,12,0,r*.48);
    for(let i=0;i<4;i++){
      const a=i*Math.PI/2+Math.PI/4;
      const p=b.box(root,[r*.55,5,r*.45],[Math.sin(a)*r*.77,10,Math.cos(a)*r*.77],'paint');p.rotation.y=a;
    }
    if(!major) {
      if(kind==='dart')b.add(root,new T.ConeGeometry(8,21,16).rotateX(Math.PI/2),'gold',[0,5,24]);
      if(kind==='heavy')for(const side of [-1,1])b.box(root,[9,7,25],[side*21,3,0],'gun');
      if(kind==='turret')for(const side of [-1,1])gun(root,side*12,6,20,3,13);
      if(kind==='relay')b.box(root,[6,3,27],[0,15,0],'gold');
    } else {
      for(const side of [-1,1]) {
        const claw=group(`claw-${side}`,[side*(r-4),4,0]);
        b.box(claw,[17,7,12],[side*7,0,0],'gun');
        panel(claw,boss?[[side*7,-9],[side*23,-7],[side*23,30],[side*10,30],[side*10,13],[side*4,7]]:
          [[side*7,-8],[side*19,0],[side*20,20],[side*7,30],[side*11,15],[side*5,7]],1,8,'shell');
        b.box(claw,[6,2,boss?25:14],[side*15,11,10],'gold');
        if(boss)for(const z of [8,22])b.box(claw,[9,3,6],[side*7,6,z],'edge');
      }
      if(boss) {
        for(const side of [-1,1]) {
          roof(root,[side*15,4,-24],[8,11,12],'gun');
          b.cylinder(root,6,8,[side*15,18,-24],'shell',true);
          optic(root,side*15,22,-24,4,'dark');
          b.box(root,[7,4,26],[side*17,15,0],'gun');
        }
      }
    }
  } else if(theme==='sewer') {
    if(!major) {
      const l=kind==='dart'?27:21;
      roof(root,[0,1,0],[kind==='heavy'?15:12,11,l],'shell');stripe(root,0,12,-5,8,13);
      for(const side of [-1,1]) {
        b.box(root,[10,5,9],[side*14,1,-3],'gun');roof(root,[side*20,2,-4],[7,7,12],'paint');
      }
      optic(root,0,10,9,4);
      if(kind==='turret')gun(root,0,7,22,4,13);
      if(kind==='relay')b.cylinder(root,5,3,[0,14,-8],'gun',true);
    } else {
      const x=boss?32:23;
      b.box(root,[x*2,7,boss?40:26],[0,1,0],'gun');roof(root,[0,5,0],[boss?19:15,12,boss?31:23]);
      for(const side of [-1,1]) {
        roof(root,[side*x,3,-4],[boss?13:10,12,boss?36:25],'paint');stripe(root,side*x,15,-11,boss?10:7,15);
        if(boss) {
          pump(root,side*25,16,12,10,String(side));
          const cannon=group(`cannon-${side<0?'left':'right'}`,[side*43,6,9]);
          roof(cannon,[0,0,0],[7,5,10]);gun(cannon,0,2,14,4,16);
        } else {
          const arm=group(`claw-${side}`,[side*23,6,13]);b.box(arm,[10,5,20],[0,0,7],'gun');
          if(side<0)pump(arm,0,4,17,8,'cutter');
          else panel(arm,[[-8,8],[-8,23],[-3,28],[-3,17],[3,17],[3,28],[8,23],[8,8]],2,4,'gold');
        }
      }
      optic(root,0,16,10,5);
      if(boss){b.vents(root,0,17,-16,16,3,5);stripe(root,0,17,23,10,8);}
      else stripe(root,0,17,-7,8,13);
    }
  } else if(theme==='space') {
    const r=boss?43:elite?26:kind==='dart'?19:kind==='heavy'?25:22;
    roof(root,[0,0,0],[r,r*.2,r]);b.ring(root,r*.91,1,[0,r*.085,0],'paint',true);
    if(major)for(let i=0;i<3;i++) {
      const a=i*Math.PI*2/3,petal=group(`ufo-petal-${i}`,[Math.sin(a)*r*.73,5,Math.cos(a)*r*.73]);petal.rotation.y=a;
      roof(petal,[0,0,0],[boss?15:11,6,boss?21:15],'paint');optic(petal,0,6,6,boss?5:3.5);
    }
    const dome=group('ufo-dome',[0,r*.2,0]);
    b.cylinder(dome,boss?18:elite?12:9,2,[0,0,0],'dark',true);
    roof(dome,[0,1,0],[boss?16:elite?10:8,boss?11:elite?8:6,boss?16:elite?10:8],'glass');
    if(!major) {
      const count=kind==='turret'?4:3;
      for(let i=0;i<count;i++){const a=i*Math.PI*2/count;optic(root,Math.sin(a)*r*.68,r*.17,Math.cos(a)*r*.68,2.7);}
    }
    if(boss) {
      const rim=group('ufo-rim',[0,12,0]);
      for(let i=0;i<3;i++){
        const a=i*Math.PI*2/3,m=b.box(rim,[5,1,7],[Math.sin(a)*22,0,Math.cos(a)*22],'edge');m.rotation.y=a;
        const s=a+Math.PI/3,satellite=group(`satellite-${i}`,[Math.sin(s)*56,3,Math.cos(s)*56]);
        roof(satellite,[0,0,0],[7,3,7]);optic(satellite,0,3,0,3);
      }
    }
  } else throw new Error(`Unknown enemy faction: ${theme}`);

  if(boss)addBossDeckDetail(theme,root,b,{roof,panel,optic,gun,group});
  root.scale.setScalar(boss?2.15:elite?1:.95);
  Object.assign(root.userData,{chapterModel:true,singleFormBoss:boss,topFocused:true,
    factionDesign:({coast:'naval-fleet',city:'boiler-aircraft',forge:'foundry-machines',sewer:'canal-machinery',space:'ufo-fleet'})[theme]});
  let parts=0;root.traverse(n=>{if(n.isMesh)parts++;});root.userData.authoredParts=parts;
  const bakeTree=g=>{for(const c of [...g.children])if(c.isGroup)bakeTree(c);bake(g);};bakeTree(root);
  return root;
}

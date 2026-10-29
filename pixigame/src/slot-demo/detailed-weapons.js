import * as T from 'three';
import { buildAdvancedWeapon } from './advanced-weapons.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { applyMachinedFinish } from '../three/aircraft/premium-finish.js';

export const DETAILED_WEAPON_IDS = new Set(['aux_cannon','aux_rail','aux_rocket','aux_laser','aux_scatter','aux_sidegun','aux_grenade','aux_mine','aux_beam','aux_lightning','aux_freeze','aux_orb','aux_toxin','aux_blades','aux_gravity','aux_lightmine','aux_pyro','aux_shield','aux_tail','aux_drone']);

// Full replacement assemblies, in the existing socket coordinates (muzzle = -Z).
// Small parts are merged by finish, keeping a mounted pair at 14 draw calls.
export function createDetailedWeapon(item) {
  const root = new T.Group(); root.name = `SlotDemo/${item.id}`;
  const surface = (name, color, metalness, roughness) => {
    const m = new T.MeshStandardMaterial({name,color,metalness,roughness,envMapIntensity:1.15});
    return applyMachinedFinish(m);
  };
  const m = {
    armor:surface('Ceramic titanium armor','#b7cbd6',.55,.3),
    dark:surface('Recessed graphite','#0c1b2a',.5,.38),
    steel:surface('Machined steel','#68879b',.86,.23),
    bright:surface('Polished edges','#c6d9e2',.82,.22),
    gold:surface('Brass fasteners','#bd9052',.8,.28),
    paint:surface('Weapon identity enamel',new T.Color(item.color).lerp(new T.Color('#203d58'),.42),.5,.28),
    glow:new T.MeshStandardMaterial({name:'Recessed emitter',color:item.color,emissive:item.color,emissiveIntensity:1.8,metalness:.3,roughness:.2}),
  };
  let serial=0;
  function mesh(g,mat,p=[0,0,0],r=[0,0,0],name='detail') {
    const o=new T.Mesh(g,mat);o.position.fromArray(p);o.rotation.fromArray(r);o.name=`${name}/${serial++}`;root.add(o);return o;
  }
  function cylinder(radius,length,p,mat=m.steel,endRadius=radius,segments=20) {
    return mesh(new T.CylinderGeometry(endRadius,radius,length,segments),mat,p,[Math.PI/2,0,0]);
  }
  function ring(radius,p,mat=m.gold,thickness=.025) {
    return mesh(new T.TorusGeometry(radius,thickness,6,32),mat,p);
  }
  function lathe(profile,p,mat=m.steel,segments=28) {
    return mesh(new T.LatheGeometry(profile.map(v=>new T.Vector2(...v)),segments),mat,p,[Math.PI/2,0,0]);
  }
  function sleeve(r,inner,len,p,mat=m.steel) {
    return lathe([[inner,len/2],[inner,-len/2],[r,-len/2],[r,len/2],[inner,len/2]],p,mat);
  }
  function strut(a,b,r=.045,mat=m.steel){
    const start=new T.Vector3(...a),end=new T.Vector3(...b),delta=end.clone().sub(start);
    const o=mesh(new T.CylinderGeometry(r,r,delta.length(),10),mat,start.add(end).multiplyScalar(.5).toArray());
    o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());return o;
  }
  function cable(points,r=.035,mat=m.dark){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),18,r,6,false),mat);}
  // Chamfered cross-sections lofted along Z: changing width/height forms a
  // manufactured taper rather than a scaled cube. Sections are [z,width,height,y].
  function hull(sections,mat=m.armor,x=0){
    const vertices=[],indices=[];
    const cross=[[-.72,-1],[.72,-1],[1,-.62],[1,.62],[.72,1],[-.72,1],[-1,.62],[-1,-.62]];
    for(const [z,w,h,y] of sections)for(const [a,b] of cross)vertices.push(x+a*w/2,y+b*h/2,z);
    for(let j=0;j<sections.length-1;j++)for(let i=0;i<8;i++){const a=j*8+i,b=j*8+(i+1)%8,c=b+8,d=a+8;indices.push(a,b,d,b,c,d);}
    for(let i=1;i<7;i++){indices.push(0,i+1,i);const a=(sections.length-1)*8;indices.push(a,a+i,a+i+1);}
    if(sections.at(-1)[0]<sections[0][0])for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.setIndex(indices);
    const flat=g.toNonIndexed();g.dispose();flat.computeVertexNormals();return mesh(flat,mat);
  }
  function plate(points,y,depth,mat=m.armor){
    const shape=new T.Shape(points.map(([x,z])=>new T.Vector2(x,-z)));
    const g=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.018,bevelThickness:.015,bevelSegments:1,steps:1});
    g.rotateX(-Math.PI/2);return mesh(g,mat,[0,y,0]);
  }
  function bolt(x,y,z,r=.038){
    const o=cylinder(r,.027,[x,y,z],m.gold,r,6);o.rotation.x=0;
    const slot=mesh(new T.BoxGeometry(r*1.1,.008,.012),m.dark,[x,y+.018,z]);return slot;
  }
  function boltRing(r,p,count=8){for(let i=0;i<count;i++){const a=i*Math.PI*2/count;cylinder(.03,.028,[p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r,p[2]],m.gold,.03,6);}}
  function vents(x,y,z,count=5,width=.24){for(let i=0;i<count;i++)hull([[z+i*.105,width,.035,y],[z+.045+i*.105,width*.9,.035,y+.01]],m.dark,x);}
  function drum(r,length,p){
    cylinder(r,length,p,m.dark);for(const z of [-1,1]){sleeve(r*1.05,r*.78,.09,[p[0],p[1],p[2]+z*length*.48],m.steel);boltRing(r*.87,[p[0],p[1],p[2]+z*length*.54]);}
    for(let i=0;i<12;i++){const a=i*Math.PI/6;strut([p[0]+r*Math.cos(a),p[1]+r*Math.sin(a),p[2]-length*.36],[p[0]+r*Math.cos(a),p[1]+r*Math.sin(a),p[2]+length*.36],.023,m.steel);}
  }
  function barrel(x,y,start,end,r=.14){
    const length=start-end;
    sleeve(r,r*.61,length,[x,y,(start+end)/2],m.steel);
    for(const z of [start-.08,end+.22])sleeve(r*1.26,r*.98,.10,[x,y,z],m.dark);
    sleeve(r*1.27,r*.62,.13,[x,y,end],m.bright);
    cylinder(r*.6,.025,[x,y,end+.19],m.dark);
    ring(r*1.08,[x,y,end-.07],m.gold,.018);
  }
  function capacitor(x,y,z,r=.16,len=.7){
    cylinder(r,len,[x,y,z],m.paint);
    for(const end of [-1,1]){cylinder(r*1.13,.09,[x,y,z+end*len*.48],m.steel);ring(r,[x,y,z+end*len*.36],m.gold,.018);}
    strut([x,y+r,z-len*.3],[x,y+r,z+len*.3],.022,m.glow);
  }
  // Recessed attachment shoe and a circular elevation bearing.
  hull([[-.35,.68,.16,-.1],[.55,.8,.16,-.1],[.72,.5,.13,-.08]],m.dark);
  const bearing=cylinder(.27,.22,[0,.12,.22],m.steel);bearing.rotation.x=0;
  const bearingRing=ring(.24,[0,.23,.22],m.gold,.026);bearingRing.rotation.x=Math.PI/2;
  for(const x of [-.27,.27])for(const z of [-.19,.47])bolt(x,.01,z);

  if(item.id==='aux_cannon') {
    hull([[.72,.65,.5,.52],[.38,1.12,.69,.57],[-.5,1.03,.63,.57],[-.89,.68,.48,.57]],m.dark);
    for(const side of [-1,1]) {
      hull([[.52,.29,.35,.76],[-.32,.34,.34,.79],[-.83,.17,.2,.68]],m.armor,side*.42);
      barrel(side*.29,.56,-.55,-2.92,.13);
      // Open heat jacket: ribs reveal the inner barrel through six long slots.
      for(let j=0;j<6;j++){const a=j*Math.PI/3;
        strut([side*.29+Math.cos(a)*.205,.56+Math.sin(a)*.205,-1.02],[side*.29+Math.cos(a)*.205,.56+Math.sin(a)*.205,-2.28],.028,m.dark);
      }
      for(const z of [-1.02,-1.64,-2.28])sleeve(.23,.17,.095,[side*.29,.56,z],m.steel);
      strut([side*.5,.37,.23],[side*.5,.37,-1.31],.065,m.bright);
      cylinder(.10,.43,[side*.5,.37,-.37],m.dark);
      vents(side*.4,.965,-.23,5,.23);bolt(side*.42,.97,.39);
    }
    drum(.34,.65,[.87,.48,.24]);
    cable([[.91,.82,.27],[.76,1.01,.18],[.43,1.02,.02],[.24,.84,-.1]],.09,m.dark);
    for(let i=0;i<7;i++){const t=i/6;cylinder(.053,.22,[.86-t*.57,.88+Math.sin(t*Math.PI)*.13,.13],m.gold);}
    hull([[-.24,.17,.15,1.01],[.28,.22,.15,1.01]],m.dark);
    cylinder(.052,.028,[0,1.01,-.26],m.glow);
  } else if(item.id==='aux_rail') {
    hull([[.85,.55,.45,.55],[.35,.94,.67,.61],[-.45,.76,.5,.57],[-1.1,.33,.28,.54]],m.dark);
    for(const side of [-1,1]){
      hull([[.55,.26,.25,.9],[-.32,.3,.3,.87],[-.85,.16,.13,.66]],m.armor,side*.29);
      hull([[-.65,.24,.34,.55],[-3.35,.2,.29,.56],[-3.98,.11,.13,.61]],m.steel,side*.36);
      hull([[-.88,.13,.12,.76],[-3.28,.11,.11,.75],[-3.89,.06,.06,.7]],m.armor,side*.4);
      strut([side*.245,.61,-.84],[side*.245,.61,-3.78],.023,m.glow);
      for(let i=0;i<7;i++){const z=-.97-i*.36;const coil=sleeve(.225,.174,.11,[side*.37,.55,z],m.gold);coil.scale.x=.78;
        hull([[z-.09,.14,.07,.8],[z+.09,.14,.07,.8]],m.dark,side*.4);
      }
      capacitor(side*.66,.52,.14,.19,.94);
      cable([[side*.65,.71,.45],[side*.79,.83,-.07],[side*.47,.7,-.84]],.033,m.gold);
      strut([side*.2,.33,.4],[side*.37,.32,-2.8],.045,m.dark);
      for(const z of [-.4,.2])bolt(side*.3,1.02,z);
    }
    sleeve(.21,.12,.19,[0,.56,-.78],m.bright);cylinder(.11,.05,[0,.56,-.8],m.glow);
  } else if(item.id==='aux_rocket') {
    hull([[.61,1.62,.6,.63],[.33,1.85,.84,.68],[-.65,1.8,.75,.69]],m.dark);
    for(const x of [-.56,0,.56])for(const y of [.43,1.02]){
      sleeve(.26,.215,1.62,[x,y,-.47],m.steel);
      sleeve(.285,.224,.14,[x,y,-1.23],m.dark);ring(.257,[x,y,-1.32],m.gold,.029);
      cylinder(.182,1,[x,y,-.64],m.paint);
      lathe([[0,-.34],[.07,-.28],[.155,-.1],[.182,.04],[.182,.16]],[x,y,-1.45],m.armor);
      ring(.181,[x,y,-1.37],m.paint,.025);
      for(const side of [-1,1])plate([[x+side*.14,-.97],[x+side*.235,-.75],[x+side*.235,-.50],[x+side*.14,-.58]],y,.028,m.gold);
    }
    // Split clamshell armor exposes the individual launch tubes.
    for(const side of [-1,1]){
      hull([[.58,.28,.78,.76],[.25,.34,1.06,.8],[-.73,.29,.91,.82],[-1.27,.11,.54,.8]],m.armor,side*.93);
      hull([[.38,.14,.23,1.34],[-.52,.18,.22,1.37],[-1.13,.09,.1,1.27]],m.paint,side*.66);
      vents(side*.94,1.32,-.42,6,.21);
      for(const z of [-.69,.32])bolt(side*.93,1.36,z);
    }
    hull([[.5,.34,.15,1.4],[-.4,.4,.16,1.42],[-1.2,.17,.1,1.3]],m.armor);
    capacitor(0,1.53,.04,.09,.54);
  } else if(item.id==='aux_laser') {
    drum(.43,.82,[0,.65,.27]);
    sleeve(.32,.22,1.95,[0,.65,-1.16],m.dark);
    cylinder(.175,1.64,[0,.65,-1.16],m.glow);
    for(let i=0;i<3;i++){
      const a=i*Math.PI*2/3+Math.PI/2,x=Math.cos(a)*.43,y=.65+Math.sin(a)*.43;
      const arm=hull([[.2,.28,.28,0],[-.75,.34,.28,0],[-1.79,.25,.20,0],[-2.25,.12,.12,0]],m.armor);
      arm.position.set(x,y,0);arm.rotation.z=a-Math.PI/2;
      strut([x*.7,.65+(y-.65)*.7,-.4],[x*.7,.65+(y-.65)*.7,-1.96],.035,m.glow);
      for(let j=0;j<5;j++) {const fin=sleeve(.19,.11,.045,[x,y,-.15-j*.12],m.steel);fin.scale.y=.66;}
      capacitor(x,y,.08,.105,.65);
    }
    for(const [z,r] of [[-.52,.41],[-1.65,.44],[-2.22,.45]])sleeve(r,r-.07,.12,[0,.65,z],m.steel);
    ring(.39,[0,.65,-2.30],m.gold,.028);ring(.30,[0,.65,-2.27],m.glow,.025);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const iris=plate([[.13,-.03],[.35,-.08],[.38,.06],[.21,.15]],0,.025,m.bright);iris.rotation.set(Math.PI/2,0,a,'ZYX');iris.position.set(0,.65,-2.3);}
    cylinder(.16,.04,[0,.65,-2.22],m.glow);boltRing(.415,[0,.65,-2.31]);
  } else if(item.id==='aux_scatter') {
    hull([[.65,.63,.5,.6],[.05,1.03,.68,.63],[-.64,.8,.48,.65]],m.dark);
    hull([[.55,.6,.2,.91],[-.12,.78,.21,.99],[-.73,.35,.15,.82]],m.armor);
    for(const [x,z] of [[-.66,-2.05],[0,-2.69],[.66,-2.05]]){
      cable([[x*.38,.6,-.45],[x,.65,-1.25],[x,.69,z+.12]],.12,m.steel);
      sleeve(.235,.14,.31,[x,.69,z+.29],m.armor);
      for(let i=0;i<5;i++)sleeve(.22,.13,.055,[x,.69,z+.43+i*.11],i%2?m.gold:m.steel);
      sleeve(.195,.12,.12,[x,.69,z],m.bright);cylinder(.116,.026,[x,.69,z+.04],m.glow);
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3;strut([x+Math.cos(a)*.17,.69+Math.sin(a)*.17,z+.08],[x+Math.cos(a)*.09,.69+Math.sin(a)*.09,z-.18],.026,m.gold);}
      cable([[x*.4,.95,-.15],[x,.97,-.9],[x,.84,z+.55]],.028,m.glow);
    }
    for(const side of [-1,1]){capacitor(side*.57,.55,.12,.19,.73);bolt(side*.24,1.13,-.12);vents(side*.2,1.10,.05,4,.16);}
  } else if(item.id==='aux_sidegun') {
    drum(.49,1.02,[0,.65,.19]);
    cylinder(.15,2.6,[0,.65,-1.41],m.dark);
    for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.cos(a)*.315,y=.65+Math.sin(a)*.315;
      barrel(x,y,-.35,-2.91,.085);
      for(const z of [-.65,-1.88])ring(.097,[x,y,z],m.gold,.016);
    }
    for(const z of [-.49,-1.65,-2.59]){
      sleeve(.47,.405,.13,[0,.65,z],m.steel);ring(.46,[0,.65,z-.07],m.gold,.022);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;strut([Math.cos(a)*.405,.65+Math.sin(a)*.405,z],[Math.cos(a)*.18,.65+Math.sin(a)*.18,z],.045,m.dark);}
    }
    drum(.41,.69,[.87,.61,.27]);
    cable([[.94,.98,.13],[.69,1.23,-.02],[.21,1.15,-.13]],.09,m.dark);
    for(let i=0;i<8;i++){const t=i/7;cylinder(.054,.25,[.86-t*.66,1.06+Math.sin(t*Math.PI)*.12,-.01],m.gold);}
    hull([[.67,.39,.18,1.01],[-.09,.54,.2,1.13],[-.48,.31,.12,1.01]],m.armor);
    capacitor(-.52,.6,.1,.18,.66);vents(0,1.24,-.12,5,.27);
  } else if(item.id==='aux_grenade') {
    // Short large-bore barrel, rotary chamber and twin recoil pistons.
    drum(.57,.94,[0,.72,-.19]);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;cylinder(.13,.91,[Math.cos(a)*.41,.72+Math.sin(a)*.41,-.18],m.paint);}
    barrel(0,.72,-.7,-2.49,.34);
    for(const z of [-.89,-1.5,-2.2])sleeve(.41,.33,.11,[0,.72,z],m.steel);
    sleeve(.46,.285,.26,[0,.72,-2.54],m.dark);ring(.397,[0,.72,-2.69],m.gold,.04);boltRing(.408,[0,.72,-2.69]);
    for(const side of [-1,1]){
      strut([side*.63,.52,.51],[side*.63,.52,-1.8],.075,m.bright);
      cylinder(.125,.72,[side*.63,.52,-.22],m.dark);
      hull([[.68,.31,.59,.72],[.23,.38,.8,.81],[-.57,.24,.69,.84],[-.87,.13,.34,.85]],m.armor,side*.65);
      for(const z of [-.35,.30])bolt(side*.65,1.24,z);
    }
    hull([[.67,.46,.2,1.12],[.20,.74,.2,1.3],[-.33,.55,.13,1.31]],m.armor);
    vents(0,1.40,-.15,5,.34);
    cable([[-.65,.53,.5],[-.81,.32,-.3],[-.52,.38,-1.42]],.035,m.gold);
  } else if(item.id==='aux_mine') {
    // Disc magazine and open ejection rails: deliberately no cannon barrel.
    hull([[.82,.73,.44,.48],[.34,1.25,.52,.48],[-.54,1.16,.42,.45],[-1.05,.76,.26,.38]],m.dark);
    for(const side of [-1,1]){
      hull([[.73,.25,.68,.71],[.30,.34,.86,.79],[-.51,.29,.72,.72],[-1.23,.15,.33,.5]],m.armor,side*.56);
      hull([[-.75,.16,.2,.34],[-1.85,.17,.18,.31],[-2.3,.22,.11,.35]],m.steel,side*.43);
      strut([side*.43,.43,-1.02],[side*.43,.4,-2.24],.026,m.glow);
      bolt(side*.57,1.26,.23);vents(side*.57,1.16,-.42,5,.22);
    }
    for(let i=0;i<3;i++){
      const y=.53+i*.24,z=-.1;
      const disc=cylinder(.48,.17,[0,y,z],m.dark);disc.rotation.x=0;
      const edge=ring(.435,[0,y+.09,z],m.gold,.027);edge.rotation.x=Math.PI/2;
      const core=cylinder(.145,.035,[0,y+.105,z],m.glow);core.rotation.x=0;
      for(let j=0;j<6;j++){const a=j*Math.PI/3;bolt(Math.cos(a)*.33,y+.105,z+Math.sin(a)*.33,.029);}
    }
    const loaded=cylinder(.37,.15,[0,.47,-1.59],m.paint);loaded.rotation.x=0;
    const light=ring(.27,[0,.55,-1.59],m.glow,.023);light.rotation.x=Math.PI/2;
    cylinder(.085,.18,[.64,1.12,-.79],m.glow);
    strut([-.43,.39,-2.23],[.43,.39,-2.23],.045,m.bright);
    cable([[.6,.39,.54],[.83,.3,-.35],[.48,.3,-1.36]],.036,m.gold);
  }

  if(!['aux_cannon','aux_rail','aux_rocket','aux_laser','aux_scatter','aux_sidegun','aux_grenade','aux_mine'].includes(item.id)) {
    buildAdvancedWeapon(item,{T,m,mesh,hull,plate,ring,sleeve,cylinder,strut,cable,capacitor,drum,barrel,bolt,boltRing,vents});
  }
  root.updateMatrixWorld(true);
  const parts=[...root.children];
  for(const mat of Object.values(m)){
    const shapes=parts.filter(p=>p.material===mat).map(p=>{const g=p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone();g.deleteAttribute('uv');return g.applyMatrix4(p.matrixWorld);});
    if(shapes.length){const g=mergeGeometries(shapes);shapes.forEach(v=>v.dispose());const batch=new T.Mesh(g,mat);batch.name=`${item.id}/${mat.name}`;root.add(batch);}
  }
  parts.forEach(p=>{p.geometry.dispose();p.removeFromParent();});
  root.userData.itemId=item.id;root.userData.detailVersion=2;root.userData.componentCount=parts.length;
  let disposed=false;
  root.userData.dispose=()=>{if(disposed)return;disposed=true;root.traverse(n=>n.geometry?.dispose());Object.values(m).forEach(v=>v.dispose());root.removeFromParent();root.clear();};
  return root;
}

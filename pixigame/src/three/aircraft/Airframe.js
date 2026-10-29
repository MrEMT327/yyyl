import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const TAU=Math.PI*2;
/** Faceted, authored cross sections; not a primitive proxy. Nose points -Z. */
function hull(sections){
 const vertices=[],ring=[];
 for(const [z,w,h,y]of sections)ring.push([[0,y+h,z],[w*.76,y+h*.50,z],[w,y-.03,z],[w*.72,y-h*.55,z],[0,y-h*.78,z],[-w*.72,y-h*.55,z],[-w,y-.03,z],[-w*.76,y+h*.50,z]]);
 const tri=(a,b,c)=>vertices.push(...a,...b,...c);
 for(let i=0;i<ring.length-1;i++)for(let j=0;j<8;j++){const k=(j+1)%8;tri(ring[i][j],ring[i+1][j],ring[i][k]);tri(ring[i][k],ring[i+1][j],ring[i+1][k]);}
 for(let j=1;j<7;j++){tri(ring[0][0],ring[0][j],ring[0][j+1]);const r=ring.at(-1);tri(r[0],r[j+1],r[j]);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}
function plate(points,y,thick=.16,bevel=.04){
 const shape=new T.Shape();points.forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();
 const g=new T.ExtrudeGeometry(shape,{depth:thick,bevelEnabled:bevel>0,bevelSegments:1,steps:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:1});
 g.rotateX(-Math.PI/2);g.translate(0,y-thick*.5,0);return g;
}
function cylinder(r,len,segments=16){return new T.CylinderGeometry(r,r,len,segments,1,false).rotateX(Math.PI/2);}
export class Airframe{
 constructor(group){
  this.group=group;this.materials={
   shell:new T.MeshStandardMaterial({color:'#b3c3c9',roughness:.50,metalness:.48,envMapIntensity:.60}),
   white:new T.MeshStandardMaterial({color:'#d5dedb',roughness:.48,metalness:.45,envMapIntensity:.62}),
   dark:new T.MeshStandardMaterial({color:'#172c3b',roughness:.42,metalness:.78}),
   black:new T.MeshStandardMaterial({color:'#060c16',roughness:.30,metalness:.50}),
   gun:new T.MeshStandardMaterial({color:'#516778',roughness:.27,metalness:.88}),
   gold:new T.MeshStandardMaterial({color:'#e39c3f',roughness:.36,metalness:.72}),
   glass:new T.MeshPhysicalMaterial({color:'#143d55',roughness:.11,metalness:.68,clearcoat:1,clearcoatRoughness:.08,envMapIntensity:1.0}),
   blue:new T.MeshStandardMaterial({color:'#064a68',emissive:'#45d9ff',emissiveIntensity:2.4,roughness:.35,metalness:.1}),
   amber:new T.MeshStandardMaterial({color:'#c96617',emissive:'#ffa645',emissiveIntensity:1.1,roughness:.35}),
   red:new T.MeshBasicMaterial({color:'#ff402c',toneMapped:false})
  };
  this.geometries=new Map();const m=this.materials;
  this.add(hull([[-7.2,.025,.05,-.19],[-5.6,.52,.16,-.08],[-3.8,1,.31,0],[-1.2,1.35,.53,.02],[1.8,1.62,.43,0],[3.55,1.23,.34,-.10],[4.38,.65,.24,-.12]]),m.shell);
  this.add(hull([[-5.2,.07,.02,.19],[-3.72,.47,.30,.32],[-2.15,.70,.67,.45],[-.66,.73,.52,.36],[.34,.59,.16,.31]]),m.dark);
  this.add(hull([[-4.6,.025,.025,.26],[-3.55,.40,.32,.38],[-2.13,.59,.58,.51],[-.82,.60,.45,.39],[-.17,.33,.025,.49]]),m.glass);
  // Canopy frames and spine break the long silhouette into manufactured panels.
  this.line([[-.6,.85,-1.20],[0,1.11,-1.20],[.6,.85,-1.20]],m.gun,.025);
  this.line([[0,.43,-4.3],[0,1.13,-2.15],[0,.96,-.9]],m.gun,.025);
  this.add(plate([[-.43,.2],[.43,.2],[.62,2.8],[.22,3.7],[-.22,3.7],[-.62,2.8]],.48,.14),m.dark);
  for(let i=0;i<7;i++)this.box([.62,.085,.16],[0,.60,.45+i*.32],m.gun);
  this.box([.10,.035,1.65],[0,.63,1.3],m.blue);
  this.box([.045,.03,1.0],[0,.16,-5.30],m.gold);
  this.rings=[];this.flaps=[];
  for(const s of [-1,1]){
   const side=pts=>pts.map(([x,z])=>[x*s,z]);
   this.add(plate(side([[.98,-3.0],[2.0,-2.12],[7.8,3.25],[7.1,3.72],[5.25,3.0],[4.03,4.0],[1.25,3.38]]),-.12,.23,.055),m.shell);
   this.add(plate(side([[1.58,-1.74],[2.38,-.71],[6.98,3.15],[5.18,2.53],[4.12,3.39],[2.97,3.1]]),.075,.055,.018),m.dark);
   this.add(plate(side([[3.55,.47],[4.01,.73],[6.86,3.16],[6.14,2.95]]),.17,.016,0),m.white);
   this.add(plate(side([[4.7,1.57],[4.95,1.79],[5.94,2.86],[5.56,2.70]]),.183,.025,0),m.gold);
   this.line(side([[1.35,-2.20],[2.98,-.28],[7.14,3.18]]).map(([x,z])=>[x,.06,z]),m.blue,.020);
   this.line(side([[4.12,3.84],[5.23,2.87],[7.52,3.34]]).map(([x,z])=>[x,.10,z]),m.gun,.032);
   this.add(plate(side([[.87,-4.20],[2.92,-2.51],[2.40,-2.07],[1.2,-2.7]]),.20,.12,.025),m.dark);
   this.add(plate(side([[1.03,-4.12],[2.81,-2.49],[2.4,-2.25],[1.35,-3.08]]),.30,.06,.02),m.white);
   // Twin independent engine nacelles, broad housing with visible intakes.
   const eng=this.add(hull([[-1.98,.32,.29,0],[-1.12,.69,.59,0],[1.40,.86,.72,0],[3.60,.72,.67,0],[4.38,.56,.52,0]]),m.dark);eng.position.set(s*2.45,-.12,0);
   const cover=this.add(hull([[-1.62,.14,.09,.32],[-.51,.52,.28,.51],[2.39,.66,.29,.52],[3.4,.41,.19,.40]]),m.white);cover.position.x=s*2.45;
   for(let j=0;j<6;j++)this.box([.66,.052,.12],[s*2.45,.83,.2+j*.37],m.black);
   this.box([.13,.022,.65],[s*2.45,.86,2.65],m.gold);
   // Nozzle throat, iris vanes and concentrically layered luminous rings.
   this.meshCylinder(.59,.56,[s*2.45,-.12,4.10],m.gun);
   this.meshCylinder(.52,.58,[s*2.45,-.12,4.33],m.black);
   for(const [r,z,mat]of [[.60,4.38,m.gun],[.51,4.64,m.gun],[.42,4.65,m.blue],[.23,4.63,m.blue]]){
    const o=this.add(new T.TorusGeometry(r,.034,6,40),mat);o.position.set(s*2.45,-.12,z);
   }
   const disk=this.add(new T.CircleGeometry(.385,32),m.blue);disk.position.set(s*2.45,-.12,4.65);
   for(let j=0;j<12;j++){const a=j/12*TAU,petal=this.box([.19,.10,.57],[s*2.45+Math.sin(a)*.515,-.12+Math.cos(a)*.515,4.33],m.gun);petal.rotation.z=-a;petal.rotation.x=Math.sin(a)*.08;}
   // Canted twin stabilizers: thick plates with clipped tips.
   const fin=this.add(plate([[0,0],[.12,-1.05],[1.62,-.32],[2.44,1.15],[1.92,1.61],[.06,1.68]],0,.10,.022),m.dark);
   fin.rotation.set(0,0,s*1.05);fin.position.set(s*2.4,.76,1.3);if(s<0)fin.scale.x=-1;
   const finStripe=this.add(plate([[.24,-.59],[.40,-.56],[1.88,1.15],[1.52,.92]],0,.016,0),m.gold);finStripe.rotation.copy(fin.rotation);finStripe.position.copy(fin.position);finStripe.position.z+=.02;if(s<0)finStripe.scale.x=-1;
   // Forward pulse cannons and recoil sleeves mounted under the wings.
   this.box([.58,.34,1.44],[s*4.13,-.24,-.42],m.dark);
   this.meshCylinder(.15,2.10,[s*4.13,-.37,-1.23],m.gun);
   this.meshCylinder(.215,.38,[s*4.13,-.37,-2.28],m.black);
   const muzzle=this.add(new T.TorusGeometry(.13,.020,6,20),m.blue);muzzle.position.set(s*4.13,-.37,-2.48);
   this.box([.12,.08,.56],[s*4.13,-.04,-1.20],m.gold);
   // Wing-end position lights and small fasteners, sparingly used.
   const nav=this.add(new T.SphereGeometry(.065,10,6),s<0?m.red:m.blue);nav.position.set(s*7.16,.09,3.21);
   for(let j=0;j<4;j++){const bolt=this.add(new T.CylinderGeometry(.045,.045,.025,8),m.gun);bolt.position.set(s*(1.15+j*.18),.30,1.1+j*.4);}
  }
  // Belly keel / radiator, visible when orbiting below the aircraft.
  this.add(hull([[-4.7,.025,.03,-.31],[-2.0,.48,.17,-.35],[2.5,.61,.19,-.4],[3.45,.15,.05,-.35]]),m.dark);

  // Extra silhouette passes: forward canards, dorsal armor, and ventral fins.
  for(const s of [-1,1]){
   const side=pts=>pts.map(([x,z])=>[x*s,z]);
   this.add(plate(side([[.72,-4.82],[1.82,-3.70],[1.36,-3.05],[.48,-3.98]]),.28,.08,.014),m.dark);
   this.add(plate(side([[.80,-4.72],[1.62,-3.78],[1.30,-3.34],[.66,-3.96]]),.36,.03,.01),m.white);
   const shoulder=this.add(plate(side([[1.92,-.52],[2.92,.38],[3.18,1.18],[2.46,1.04],[1.72,.16]]),.56,.09,.02),m.dark);
   const ventral=this.add(plate([[0,0],[.14,-.76],[.92,-.14],[1.22,.72],[.92,.92],[.04,.98]],0,.07,.016),m.dark);
   ventral.rotation.set(Math.PI,0,s*.95);ventral.position.set(s*1.18,-.54,-.38);if(s<0)ventral.scale.x=-1;
  }
  this.add(plate([[-.16,-2.45],[.16,-2.45],[.54,-.92],[.26,1.86],[0,2.24],[-.26,1.86],[-.54,-.92]],.84,.10,.016),m.dark);
  this.add(plate([[-.08,-2.18],[.08,-2.18],[.30,-.86],[.16,1.54],[0,1.90],[-.16,1.54],[-.30,-.86]],.96,.035,.008),m.gold);

    // Markings use geometry in the game; no DOM or runtime font dependency.
  this.batchStaticMeshes();
 }
 add(geo,mat){const o=new T.Mesh(geo,mat);o.castShadow=true;o.receiveShadow=true;this.group.add(o);return o;}
 box(size,pos,mat){const o=this.add(new T.BoxGeometry(...size),mat);o.position.fromArray(pos);return o;}
 meshCylinder(r,len,pos,mat){const o=this.add(cylinder(r,len),mat);o.position.fromArray(pos);return o;}
 line(points,mat,r=.02){const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)),false,'centripetal');return this.add(new T.TubeGeometry(curve,Math.max(3,points.length*3),r,5,false),mat);}
 batchStaticMeshes(){
  // All hardware is rigid. Bake per-part transforms once and batch by material;
  // the whole airframe needs ~12 draws rather than hundreds of small meshes.
  const groups=new Map(),originals=new Set();
  for(const o of [...this.group.children]){
   if(!o.isMesh)continue;o.updateMatrix();const g=o.geometry.index?o.geometry.toNonIndexed():o.geometry.clone();g.applyMatrix4(o.matrix);
   if(!g.attributes.uv)g.setAttribute('uv',new T.BufferAttribute(new Float32Array(g.attributes.position.count*2),2));
   if(o.matrix.determinant()<0){for(const a of Object.values(g.attributes)){for(let i=0;i<a.count;i+=3)for(let k=0;k<a.itemSize;k++){const ai=(i+1)*a.itemSize+k,bi=(i+2)*a.itemSize+k,v=a.array[ai];a.array[ai]=a.array[bi];a.array[bi]=v;}}}
   if(!groups.has(o.material))groups.set(o.material,[]);groups.get(o.material).push(g);originals.add(o.geometry);this.group.remove(o);
  }
  for(const [material,geos]of groups){const g=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());const o=this.add(g,material);o.castShadow=!material.transparent;}
  originals.forEach(g=>g.dispose());
 }
 update(c,g){this.materials.blue.emissive.set(c.engineColor);this.materials.blue.emissiveIntensity=0.70*c.engineGlow*(g.glow??1)*(c.boost?1.35:1);this.materials.shell.color.set(c.hullColor);}
}

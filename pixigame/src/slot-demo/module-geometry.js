import * as T from 'three';
import { DETAILED_WEAPON_IDS, createDetailedWeapon } from './detailed-weapons.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Authored mechanical silhouettes. Each kit owns its geometry/materials and
// batches rigid detail by material; thumbnails use these exact same meshes.
export function createModuleGeometry(item) {
  if (DETAILED_WEAPON_IDS.has(item.id)) return createDetailedWeapon(item);
  const root = new T.Group(); root.name = `SlotDemo/${item.id}`;
  const armor = new T.MeshStandardMaterial({ color: '#a0b2bd', metalness: .62, roughness: .36 });
  const dark = new T.MeshStandardMaterial({ color: '#233345', metalness: .6, roughness: .38 });
  const metal = new T.MeshStandardMaterial({ color: '#596d7e', metalness: .82, roughness: .28 });
  const tint = new T.MeshStandardMaterial({ color: item.color, metalness: .4, roughness: .34 });
  const glow = new T.MeshStandardMaterial({ color: item.color, emissive: item.color, emissiveIntensity: 1.4, roughness: .3, metalness: .25 });
  const materials = [armor, dark, metal, tint, glow];
  const add = (geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    const mesh = new T.Mesh(geometry, material); mesh.position.fromArray(position); mesh.rotation.fromArray(rotation); root.add(mesh); return mesh;
  };
  const box = (size, pos, mat = armor) => add(new T.BoxGeometry(...size), mat, pos);
  const tube = (r, length, pos, mat = metal, r2 = r) => add(new T.CylinderGeometry(r, r2, length, 12), mat, pos, [-Math.PI / 2, 0, 0]);
  const ring = (r, pos, mat = glow, thickness = .07, flat = false) => add(new T.TorusGeometry(r, thickness, 6, 28), mat, pos, [flat ? Math.PI / 2 : 0, 0, 0]);
  const orb = (r, pos, mat = glow) => add(new T.IcosahedronGeometry(r, 1), mat, pos);
  const line = (a, b, radius = .07, mat = metal) => {
    const start = new T.Vector3(...a), end = new T.Vector3(...b), mesh = add(new T.CylinderGeometry(radius, radius, start.distanceTo(end), 8), mat);
    mesh.position.copy(start).add(end).multiplyScalar(.5); mesh.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), end.sub(start).normalize()); return mesh;
  };
  const plate = (points, y, thickness, mat = armor) => {
    const shape = new T.Shape(points.map(([x, z]) => new T.Vector2(x, -z)));
    const geometry = new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: true, bevelSize: .04, bevelThickness: .035, bevelSegments: 1, steps: 1 });
    geometry.rotateX(-Math.PI / 2); return add(geometry, mat, [0, y, 0]);
  };

  if (item.kind === 'weapon') {
    box([.82, .26, 1.12], [0, -.12, .3], dark);
    box([.5, .36, .65], [0, .12, .3], metal);
    for (const x of [-.34, .34]) box([.10, .08, .72], [x, .04, .25], tint);
  } else {
    plate([[-.65, -.6], [.65, -.6], [.8, .4], [.45, .7], [-.45, .7], [-.8, .4]], -.12, .24, dark);
    ring(.32, [0, .16, 0], metal, .09, true);
  }

  switch (item.modelId || item.id) {
    case 'twin':
      box([1.12, .55, 1.4], [0, .5, -.2]);
      for (const x of [-.34, .34]) {
        tube(.17, 2.25, [x, .5, -1.65]); tube(.24, .38, [x, .5, -2.75], dark); ring(.17, [x, .5, -2.96]);
        box([.08, .08, 1], [x, .82, -.2], tint);
      }
      box([.5, .66, .85], [.79, .4, .15], dark); break;
    case 'rail':
      plate([[-.6, .9], [.6, .9], [.5, -.75], [0, -1.5], [-.5, -.75]], .25, .4);
      for (const x of [-.36, .36]) {
        box([.22, .38, 3.8], [x, .56, -2.05]); box([.06, .08, 3.5], [x * .63, .7, -2.1], glow);
        for (let i = 0; i < 5; i++) box([.4, .12, .13], [x, .83, -.7 - i * .53], dark);
      }
      tube(.16, 1, [0, .57, -.5], tint); break;
    case 'gatling':
      tube(.57, 1.5, [0, .7, .04], armor);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3, x = Math.cos(a) * .35, y = .7 + Math.sin(a) * .35;
        tube(.105, 2.45, [x, y, -1.65]); ring(.11, [x, y, -2.88], glow, .035);
      }
      ring(.49, [0, .7, -2.55], dark, .13); ring(.5, [0, .7, -.8], tint, .11);
      add(new T.CylinderGeometry(.62, .62, .75, 20), dark, [.88, .56, .1], [0, 0, Math.PI / 2]); break;
    case 'missile':
      box([1.85, 1.28, 2.05], [0, .71, -.45], dark); box([2.03, .13, 2.2], [0, 1.42, -.45]);
      for (const x of [-.58, 0, .58]) for (const y of [.4, 1]) {
        tube(.235, 1.8, [x, y, -.7]); tube(.025, .55, [x, y, -1.76], tint, .22); ring(.245, [x, y, -1.35], metal, .045);
      }
      for (const x of [-1, 1]) box([.1, .85, 1.5], [x, .82, -.3]); break;
    case 'prism':
      tube(.5, 1.35, [0, .7, .05], dark);
      for (let i = 0; i < 3; i++) {
        const a = i * Math.PI * 2 / 3;
        const petal = box([.35, .5, 2.35], [Math.cos(a) * .47, .7 + Math.sin(a) * .47, -1.4]); petal.rotation.z = a;
        tube(.07, 1.5, [Math.cos(a) * .35, .7 + Math.sin(a) * .35, -1.5], glow);
      }
      add(new T.OctahedronGeometry(.45), glow, [0, .7, -2.48], [0, 0, Math.PI / 4]); break;
    case 'plasma':
      tube(.46, 1.1, [0, .8, .05], dark);
      for (const z of [-.95, -2.13]) { ring(.7, [0, .8, z], metal, .16); ring(.57, [0, .8, z]); }
      for (const x of [-.65, .65]) box([.2, .24, 2], [x, .8, -1.1]);
      orb(.3, [0, .8, -1.65]); break;
    case 'blade':
      plate([[-.3, .65], [.55, .75], [2.8, -2.2], [2.85, -3.1], [1.18, -1.65], [.2, -1.85], [-.35, -.55]], .28, .24);
      plate([[.25, .46], [2.63, -2.39], [2.75, -2.9], [1.12, -1.4]], .58, .045, glow);
      box([.6, .55, .8], [0, .51, .1], dark); ring(.22, [0, .84, .05], tint, .07, true); break;
    case 'tesla':
      box([1.32, .7, 1.1], [0, .58, .05], dark);
      for (const [x, z] of [[-.7, -2.4], [0, -3], [.7, -2.4]]) {
        line([x * .5, .6, -.35], [x, .72, z], .14, armor); orb(.18, [x, .72, z]);
        for (let i = 0; i < 3; i++) ring(.19, [x, .72, z + .3 + i * .23], tint, .045);
      } break;
    case 'siege':
      box([1.44, 1, 1.6], [0, .73, .1]); tube(.43, 2.65, [0, .78, -1.8], metal);
      tube(.58, .7, [0, .78, -3], dark); ring(.4, [0, .78, -3.37], tint, .08);
      for (const x of [-.85, .85]) { box([.65, 1.35, .45], [x, .76, -.86]); line([x, .4, .65], [x, .4, -1.7], .12); }
      for (let i = 0; i < 4; i++) box([.9, .09, .12], [0, 1.27, -.4 + i * .3], dark); break;
    case 'drone':
      box([2.7, .22, .5], [0, .48, .35], metal);
      for (const x of [-1.03, 1.03]) {
        plate([[x - .25, .8], [x + .25, .8], [x + .2, -.7], [x, -1.35], [x - .2, -.7]], .64, .26);
        plate([[x, -.55], [x + .67, .2], [x + .6, .58], [x, .35], [x - .6, .58], [x - .67, .2]], .68, .1, dark);
        box([.16, .12, .55], [x, 1, -.1], glow); tube(.17, .4, [x, .77, .9], tint);
      } break;
    case 'relay':
      orb(.32, [0, .43, 0]);
      for (const [x, z] of [[-.7, .35], [.7, .35], [0, -.6]]) { line([0, .28, 0], [x, .3, z], .16, armor); ring(.17, [x, .38, z], glow, .065, true); } break;
    case 'capacitor':
      for (const [x, z] of [[-.4, .2], [.4, .2], [0, -.4]]) {
        add(new T.CylinderGeometry(.22, .25, .9, 12), armor, [x, .65, z]); ring(.2, [x, 1.12, z], glow, .065, true);
        box([.07, .55, .08], [x, .7, z - .22], tint);
      } break;
    case 'focus':
      plate([[-.68, .44], [.68, .44], [0, -.72]], .2, .18);
      add(new T.OctahedronGeometry(.54), glow, [0, .84, 0]);
      for (const x of [-.58, .58]) line([x, .3, .3], [x * .6, 1.05, .05], .09, metal); break;
    case 'bridge':
      for (const z of [-.36, .36]) { box([2.15, .24, .24], [0, .46, z]); box([1.85, .06, .07], [0, .62, z], glow); }
      for (const x of [-.9, .9]) box([.4, .57, 1.12], [x, .42, 0], dark);
      box([.58, .4, .62], [0, .36, 0], tint); break;
    case 'coil':
      ring(.68, [0, .46, 0], metal, .17, true); ring(.64, [0, .64, 0], glow, .07, true);
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const part = box([.15, .34, .34], [Math.cos(a) * .69, .46, Math.sin(a) * .69], dark); part.rotation.y = -a; }
      orb(.2, [0, .37, 0], tint); break;
    default: throw new Error(`Unknown demo module: ${item.id}`);
  }

  if(item.sourceId){
    const id=item.sourceId;
    // Source-specific feed, cooling and emitter hardware remains real geometry
    // in both the fitted aircraft and the thumbnails.
    if(['gun','assault_rifle','machine_gun','shotgun','shotgun_close','sidegun'].includes(id)){
      const magazines={gun:1,assault_rifle:3,machine_gun:6,shotgun:4,shotgun_close:2,sidegun:2}[id];
      for(let i=0;i<magazines;i++)tube(.095,.5,[.8,.3+i*.17,.7],tint);
      if(id==='sidegun')for(const side of [-1,1]){const p=tube(.2,1.7,[side*.85,.7,-.4],dark);p.rotation.z=side*1.1;}
      if(id==='shotgun_close')box([1.4,.3,.5],[0,.94,-2],dark);
    }else if(['harpoon','electric_harpoon','sniper'].includes(id)){
      for(const side of [-1,1])plate([[side*.3,-1.8],[side*.9,-1.2],[side*.8,-.6],[side*.25,-1.2]],.95,.12,id==='electric_harpoon'?tint:armor);
      ring(.35,[0,.75,.8],metal,.14);
      if(id==='electric_harpoon')for(const side of [-1,1])orb(.15,[side*.65,.85,-.25]);
    }else if(['continuous_laser','freeze_ray','chromatophore_gland'].includes(id)){
      for(let i=0;i<(id==='chromatophore_gland'?5:3);i++)box([1.25,.08,.12],[0,1.05,-.2-i*.25],metal);
      if(id==='freeze_ray')for(const side of [-1,1])tube(.24,1.3,[side*.75,.6,.2],tint);
      if(id==='chromatophore_gland')orb(.3,[0,1.35,-.3]);
    }else{
      const vessels={cannon:2,grenade_launcher:3,mine_launcher:4,orb_gun:1,staurolobber:4,flamethrower:2,plasma_whip:3,pyrocyst:6}[id]||2;
      for(let i=0;i<vessels;i++){const a=i*Math.PI*2/vessels;tube(.14,.65,[Math.cos(a)*.8,.8+Math.sin(a)*.3,.8],i%2?tint:metal);}
      if(id==='mine_launcher'||id==='staurolobber')box([1.4,.18,.8],[0,1.22,.5],armor);
    }
  }
  root.updateMatrixWorld(true);
  const rigid = [...root.children];
  for (const material of materials) {
    const geometries = rigid.filter(mesh => mesh.material === material).map(mesh => {
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      geometry.applyMatrix4(mesh.matrixWorld); return geometry;
    });
    if (geometries.length) {
      const merged = mergeGeometries(geometries); geometries.forEach(geometry => geometry.dispose());
      const mesh = new T.Mesh(merged, material); mesh.name = `${item.id}/${materials.indexOf(material)}`; root.add(mesh);
    }
  }
  rigid.forEach(mesh => { mesh.geometry.dispose(); mesh.removeFromParent(); });
  root.userData.itemId = item.id;
  let disposed = false;
  root.userData.dispose = () => {
    if (disposed) return; disposed = true;
    root.traverse(node => node.geometry?.dispose()); materials.forEach(material => material.dispose()); root.removeFromParent(); root.clear();
  };
  return root;
}

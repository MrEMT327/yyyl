import * as T from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { WING_DESIGNS } from './wing-designs.js';

export { WING_DESIGNS } from './wing-designs.js';

// Keep the original artwork, but build independent geometry for each family.
// Its texture stays shared and is never disposed by an equipment replacement.
export function createAuthoredWingKit(original) {
  let nameplateTemplate;
  original.traverse(node => {
    if (node.isMesh && /part\/123-/.test(node.name)) nameplateTemplate = node.material.clone();
  });
  if (!nameplateTemplate) throw new Error('游隼缺少 FOXPEN 原版铭牌');

  return {
    build(root, profile) {
      const design = WING_DESIGNS[profile.key];
      if (!design) throw new Error('机翼缺少结构设计：' + profile.key);
      const owned = [], tint = new T.Color(profile.color), stealth = profile.key === 'eclipse';
      const keep = material => { owned.push(material); return material; };
      const metal = (color, roughness = .38, metalness = .58) => keep(new T.MeshStandardMaterial({ color, roughness, metalness }));
      const m = {
        paint: metal(new T.Color('#d4e0e3').lerp(tint, .035), .34, .4),
        secondary: metal(stealth ? '#435466' : '#839eac', .38, .62),
        dark: metal('#1d303f', .43, .68),
        hardware: metal('#526776', .30, .82),
        black: metal('#080f18', .56, .45),
        trim: metal(new T.Color('#c8ac74').lerp(tint, .25), .30, .72),
        stealth: metal('#2c3c50', .34, .64),
        glow: keep(new T.MeshStandardMaterial({ color: tint.clone().multiplyScalar(.36), emissive: tint, emissiveIntensity: 3.4, roughness: .30, metalness: .25 })),
      };
      m.glow.userData.wingGlow = true;
      const decal = keep(nameplateTemplate.clone());
      decal.userData = {}; decal.polygonOffset = true;
      decal.polygonOffsetFactor = -2; decal.polygonOffsetUnits = -2;
      decal.depthWrite = false; decal.alphaTest = .015;

      function add(name, geometry, material) {
        const mesh = new T.Mesh(geometry, material);
        mesh.name = 'Wing/' + name;
        mesh.userData.equipmentSlot = 'wing';
        mesh.userData.bloom = material === m.glow;
        root.add(mesh); return mesh;
      }
      function solid(name, points, y, depth, material) {
        const shape = new T.Shape(points.map(([x,z]) => new T.Vector2(x, -z)));
        const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: .024, bevelSize: .026, bevelSegments: 1, steps: 1 });
        geometry.rotateX(-Math.PI/2); geometry.translate(0,y,0);
        return add(name, geometry, material);
      }
      function box(name, position, size, material, yaw = 0) {
        const geometry = new T.BoxGeometry(...size); geometry.rotateY(yaw); geometry.translate(...position);
        return add(name, geometry, material);
      }
      function cylinder(name, position, radius, length, material, rotation = [0,0,0], endRadius = radius) {
        const geometry = new T.CylinderGeometry(endRadius, radius, length, 12);
        geometry.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...position), new T.Quaternion().setFromEuler(new T.Euler(...rotation)), new T.Vector3(1,1,1)));
        return add(name, geometry, material);
      }
      function beam(name, a, b, width, thickness, material) {
        const start = new T.Vector3(...a), end = new T.Vector3(...b), delta = end.clone().sub(start);
        const geometry = new T.BoxGeometry(width, thickness, delta.length());
        geometry.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1), delta.normalize()));
        geometry.translate(...start.add(end).multiplyScalar(.5).toArray());
        return add(name, geometry, material);
      }

      for (const side of [-1,1]) {
        const prefix = side < 0 ? 'port' : 'starboard';
        const points = outline => outline.map(([x,z]) => [x*side,z]);
        const pos = (x,y,z) => [x*side,y,z];
        const plate = (name, outline, y, depth, mat) => solid(prefix+'-'+name,points(outline),y,depth,mat);
        const line = (name, a, b, width, thickness, mat) => beam(prefix+'-'+name,pos(...a),pos(...b),width,thickness,mat);
        const rivet = (x,y,z) => {
          cylinder(prefix+'-captive-fastener',pos(x,y,z),.043,.025,m.hardware);
          box(prefix+'-fastener-slot',pos(x,y+.017,z),[.053,.008,.012],m.black);
        };
        const vent = (x,y,z, count=5, yaw=0) => {
          box(prefix+'-heat-exchanger-bed',pos(x,y,z),[.67,.075,count*.13+.13],m.black,side*yaw);
          for(let i=0;i<count;i++) {
            const offset=(i-(count-1)/2)*.13;
            box(prefix+'-cooling-louvre-'+i,pos(x+Math.sin(yaw)*offset,y+.055,z+Math.cos(yaw)*offset),[.53,.045,.055],m.hardware,side*yaw);
          }
        };
        const hinge = (x,y,z, radius=.25) => {
          cylinder(prefix+'-articulation-collar',pos(x,y,z),radius,.22,m.hardware);
          cylinder(prefix+'-articulation-face',pos(x,y+.12,z),radius*.71,.035,m.black);
          cylinder(prefix+'-articulation-light',pos(x,y+.145,z),radius*.30,.035,m.glow);
        };

        // Only the short socket is common; all outboard surfaces are bespoke.
        plate('root-socket',[[.95,-1.8],[1.85,-1.5],[2.15,.35],[1.8,2.2],[.95,2.5]],-.34,.30,m.hardware);
        plate('root-fairing',[[1.06,-1.7],[1.68,-1.35],[1.82,.4],[1.53,1.4],[1.05,1.76]],-.02,.16,stealth?m.stealth:m.paint);
        for (let i=0;i<3;i++) rivet(1.3,.165,-1+i*.66);

        for (const part of design.panels) {
          const material=m[part.paint];
          plate(part.name,part.points,part.y,part.depth,material);
          // Separate inset skin and chamfered edges, with exposed panel seams.
          if (!part.frame && ['paint','secondary','stealth'].includes(part.paint)) {
            const centre=part.points.reduce((v,[x,z])=>[v[0]+x/part.points.length,v[1]+z/part.points.length],[0,0]);
            const inset=part.points.map(([x,z])=>[centre[0]+(x-centre[0])*.87,centre[1]+(z-centre[1])*.87]);
            plate(part.name+'-inset-skin',inset,part.y+part.depth+.028,.025,material);
          }
        }
        // Guides follow their own panels, including the raised upper deck.
        for (const [i,path] of design.seams.entries()) {
          let y=.405;
          if(profile.key==='razor') y=i===0?.325:.085;
          if(profile.key==='falcon') y=i===0?.4:.265;
          if(profile.key==='aegis') y=i===0?.565:.3;
          if(profile.key==='tempest') y=i===0?1.285:.015;
          if(profile.key==='vanguard') y=.745;
          if(profile.key==='eclipse') y=.265;
          if(profile.key==='reclaimer') y=.325;
          if(profile.key==='borealis') y=.17;
          for(let j=1;j<path.length;j++) {
            const [ax,az]=path[j-1],[bx,bz]=path[j];
            line('light-guide-bed-'+i+'-'+j,[ax,y-.025,az],[bx,y-.025,bz],.13,.04,m.black);
            line('light-guide-'+i+'-'+j,[ax,y+.005,az],[bx,y+.005,bz],.046,.033,m.glow);
          }
        }

        switch(profile.key) {
          case 'razor':
            hinge(3.08,.28,1.65,.29);
            line('exposed-flap-piston',[3.55,-.17,2.28],[4.55,-.09,3.78],.12,.13,m.hardware);
            vent(3.15,.295,-.12,4,-.42);
            plate('blade-tip-ceramic',[[6.55,2.62],[8.53,4.52],[7.19,3.67]],.255,.036,m.trim);
            break;
          case 'aegis':
            for(const x of [3.31,6.07]) for(const z of [-1.84,.85]) rivet(x,.6,z);
            vent(4.62,.385,2.74,6);
            for(let i=0;i<3;i++) box(prefix+'-armour-lock',pos(6.87,.33,.15+i*.52),[.46,.14,.18],m.hardware);
            plate('reinforced-front-lip',[[3.32,-2.63],[5.69,-2.63],[5.95,-2.34],[3.1,-2.33]],.54,.11,m.secondary);
            break;
          case 'falcon':
            hinge(3.27,.19,1.4,.23);
            line('feather-actuator',[3.47,-.23,1.9],[4.94,-.12,.92],.10,.10,m.hardware);
            plate('forward-tip-ceramic',[[6.85,-3.32],[7.92,-4.52],[7.63,-2.69],[7.27,-2.15]],.305,.035,m.trim);
            vent(3.55,.47,.25,4,.56);
            break;
          case 'prism': {
            line('crystal-forward-stay',[5.4,.05,-2.91],[5.4,.05,-.5],.075,.075,m.hardware);
            line('crystal-aft-stay',[5.4,.05,.95],[5.27,.05,2.87],.075,.075,m.hardware);
            cylinder(prefix+'-optic-seat',pos(5.4,.08,.25),.55,.22,m.hardware);
            const crystal=new T.OctahedronGeometry(.62);crystal.scale(.65,.68,1.42);crystal.translate(...pos(5.4,.37,.25));
            add(prefix+'-suspended-crystal',crystal,m.glow);
            for(const [x,z] of [[5.25,-3.25],[7.58,.18],[5.27,3.44]]) hinge(x,.375,z,.19);
            break;
          }
          case 'borealis':
            for(const angle of [40,134,220,316]) {
              const a=angle*Math.PI/180, x=5.3+2.23*Math.cos(a), z=.2+2.88*Math.sin(a);
              box(prefix+'-halo-segment-coupler',pos(x,.26,z),[.69,.34,.22],m.hardware,-side*a);
              hinge(x,.45,z,.13);
            }
            line('halo-front-fork',[2.2,-.12,-.9],[3.54,-.12,-1.89],.19,.17,m.hardware);
            break;
          case 'tempest':
            // Both decks are attached by visible, load-bearing angled struts.
            for(const z of [.75,2.11]) {
              line('fold-linkage',[3.27,.07,z],[3.85,1.02,z],.22,.22,m.hardware);
              line('fold-hydraulic',[3.06,-.08,z-.16],[3.81,1.01,z-.16],.09,.09,m.trim);
              hinge(3.82,1.21,z,.20);
            }
            line('outer-interplane-strut',[6.31,-.08,.2],[6.98,1.07,2.74],.16,.16,m.secondary);
            vent(4.2,1.34,1.54,4,-.42);
            break;
          case 'vanguard':
            for(const x of [5.24,5.73]) {
              cylinder(prefix+'-linear-accelerator',pos(x,.38,-3.68),.13,.94,m.hardware,[Math.PI/2,0,0]);
              cylinder(prefix+'-accelerator-aperture',pos(x,.38,-4.16),.087,.036,m.glow,[Math.PI/2,0,0]);
            }
            vent(5.52,.85,1.14,4);
            for(let i=0;i<3;i++) box(prefix+'-launch-deck-brace',pos(3.78+i*.27,.39,1.86),[.1,.09,.65],m.hardware,.31*side);
            hinge(4.26,.34,.87,.27);
            break;
          case 'reclaimer':
            hinge(5.4,.38,2.3,.43);
            hinge(7.43,.3,.64,.26);
            line('claw-piston-jacket',[3.58,-.18,.5],[5.25,-.18,1.68],.27,.23,m.hardware);
            line('claw-piston-rod',[4.3,-.16,1.04],[5.99,-.16,2.21],.12,.12,m.trim);
            for(let i=0;i<4;i++) box(prefix+'-hazard-inlay',pos(7.12,.36,-.14+i*.2),[.44,.025,.085],m.trim,-side*.35);
            plate('outer-jaw-tooth',[[6.45,-2.74],[6.32,-3.26],[6.94,-2.13]],.275,.08,m.hardware);
            plate('inner-jaw-tooth',[[4.68,-2.58],[4.93,-3.11],[4.73,-1.96]],.275,.08,m.hardware);
            break;
          case 'eclipse':
            for(let i=0;i<5;i++) box(prefix+'-flush-exhaust-slot',pos(3.15+i*.19,.245,1.4+i*.22),[.11,.04,.36],m.black,-side*.45);
            plate('leading-radar-strip',[[4.49,-1.48],[8.17,.65],[7.5,.43],[4.49,-1.17]],.268,.022,m.secondary);
            line('faceted-spine',[2.06,.32,-.78],[3.85,.32,-.3],.045,.035,m.hardware);
            break;
        }

        // A rigid mounting plaque keeps the original 4:1 decal seated on the
        // skin, also on open frames. Rotate the starboard label; never mirror UVs.
        const [x,z,y,angle,width]=design.plate, yaw=side*angle;
        const frame=new T.Matrix4().makeBasis(new T.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),new T.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),new T.Vector3(0,1,0)).setPosition(new T.Vector3(side*x,y,z));
        add(prefix+'-manufacturer-plaque',new T.BoxGeometry(width+.14,.055,width/4+.13).rotateY(yaw).translate(side*x,y-.047,z),m.black);
        const nameplate=add(prefix+'-FOXPEN',new T.PlaneGeometry(width,width/4).applyMatrix4(frame),decal);
        nameplate.userData.foxpenNameplate=true;
        for(const dx of [-width/2-.033,width/2+.033]) rivet(x+Math.cos(angle)*dx,y-.002,z-Math.sin(angle)*dx);
        for(let i=0;i<profile.grade;i++) box(prefix+'-grade-inlay-'+i,pos(1.63,.165,.25+i*.18),[.19,.028,.065],m.trim);
      }

      // Batch rigid parts by material for combat/mobile. Keep branded planes
      // separately inspectable. Generated buffers and materials are kit-owned.
      const batches=new Map(), partNames=[];
      for(const mesh of [...root.children]) {
        if(mesh.userData.foxpenNameplate) continue;
        partNames.push(mesh.name);
        if(!batches.has(mesh.material)) batches.set(mesh.material,[]);
        const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry;
        if(geometry!==mesh.geometry) mesh.geometry.dispose();
        batches.get(mesh.material).push(geometry);root.remove(mesh);
      }
      for(const [material,geometries] of batches) {
        const merged=mergeGeometries(geometries,false);
        if(!merged) throw new Error('机翼静态组件合批失败');
        geometries.forEach(geometry=>geometry.dispose());
        const mesh=add('assembly-'+Object.keys(m).find(key=>m[key]===material),merged,material);
        mesh.userData.componentCount=geometries.length;
      }
      root.userData.materials=owned;
      root.userData.wingDesign=design.detail;
      root.userData.componentNames=partNames;
    },
    dispose() { nameplateTemplate.dispose(); },
  };
}

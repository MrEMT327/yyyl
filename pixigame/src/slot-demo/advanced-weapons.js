// The second twelve assemblies share manufacturing helpers, not silhouettes.
export function buildAdvancedWeapon(item,b){
 const {m,mesh,hull,plate,ring,sleeve,cylinder,strut,cable,capacitor,drum,barrel,bolt,boltRing,vents,T}=b;
 const radial=(count,fn)=>{for(let i=0;i<count;i++){const a=i*Math.PI*2/count;fn(a,i);}};
 const housing=()=>{hull([[.75,.5,.36,.5],[.24,.95,.6,.57],[-.5,.7,.5,.59],[-.87,.4,.25,.57]],m.dark);for(const s of [-1,1]){hull([[.5,.24,.21,.84],[-.19,.28,.25,.9],[-.74,.1,.12,.69]],m.armor,s*.3);bolt(s*.28,.99,.18);}};
 const core=(p,r,mat=m.glow)=>mesh(new T.IcosahedronGeometry(r,2),mat,p);
 const collar=(r,z)=>{sleeve(r,r-.08,.12,[0,.7,z],m.steel);ring(r-.02,[0,.7,z-.07],m.gold,.025);boltRing(r-.04,[0,.7,z-.08],6);};
 const pairedTanks=(r=.2)=>{for(const s of [-1,1]){capacitor(s*.57,.55,.16,r,.98);cable([[s*.58,.76,.35],[s*.74,.85,-.32],[s*.3,.72,-1.06]],.035,m.gold);}};
 if(item.id==='aux_beam'){
   housing();pairedTanks();
   sleeve(.29,.19,1.9,[0,.7,-1.35],m.dark);cylinder(.14,1.95,[0,.7,-1.37],m.glow);
   for(const z of [-.62,-1.36,-2.18])collar(.38,z);
   for(const s of [-1,1]){
     hull([[-.55,.17,.36,.68],[-2.42,.14,.28,.68],[-2.72,.08,.12,.69]],m.armor,s*.38);
     for(let i=0;i<9;i++)hull([[-.65-i*.14,.26,.25,.74],[-.70-i*.14,.26,.25,.74]],m.steel,s*.46);
     strut([s*.25,.76,-.57],[s*.25,.76,-2.45],.025,m.glow);
   }
   collar(.31,-2.48);cylinder(.17,.03,[0,.7,-2.50],m.glow);
 }else if(item.id==='aux_lightning'){
   housing();pairedTanks(.23);
   for(const [x,z] of [[-.72,-1.97],[0,-2.76],[.72,-1.97]]){
     cable([[x*.4,.6,-.4],[x,.68,-1.06],[x,.76,z+.28]],.12,m.steel);
     for(let i=0;i<6;i++)sleeve(.24,.12,.065,[x,.76,z+.25+i*.13],i%2?m.paint:m.gold);
     core([x,.76,z],.21,m.bright);ring(.23,[x,.76,z],m.glow,.03);
     radial(3,a=>strut([x+Math.cos(a)*.14,.76+Math.sin(a)*.14,z+.13],[x+Math.cos(a)*.26,.76+Math.sin(a)*.26,z-.19],.035,m.gold));
   }
   core([0,1.06,-.05],.24);ring(.3,[0,1.05,-.03],m.steel,.055).rotation.x=Math.PI/2;
 }else if(item.id==='aux_freeze'){
   housing();pairedTanks(.27);
   sleeve(.36,.24,1.78,[0,.68,-1.35],m.steel);
   for(let i=0;i<8;i++)sleeve(.42,.34,.052,[0,.68,-.66-i*.16],i%2?m.bright:m.paint);
   radial(4,a=>{const x=Math.cos(a)*.36,y=.68+Math.sin(a)*.36;strut([x,y,-.54],[x,y,-1.89],.045,m.glow);});
   sleeve(.48,.32,.25,[0,.68,-2.18],m.armor);sleeve(.35,.25,.12,[0,.68,-2.35],m.steel);
   core([0,.68,-2.37],.23);radial(6,a=>{const crystal=mesh(new T.OctahedronGeometry(.12),m.bright,[Math.cos(a)*.38,.68+Math.sin(a)*.38,-2.28]);crystal.scale.z=1.8;});
 }else if(item.id==='aux_orb'){
   housing();pairedTanks(.16);
   core([0,.72,-1.4],.34);
   for(const z of [-.69,-1.98])collar(.56,z);
   radial(4,a=>{const x=Math.cos(a)*.5,y=.72+Math.sin(a)*.5;
     cable([[x*.55,.72+(y-.72)*.55,-.48],[x*1.18,.72+(y-.72)*1.18,-1.24],[x*.9,.72+(y-.72)*.9,-2.07]],.085,m.armor);
     strut([x,y,-.86],[x,y,-1.72],.028,m.gold);
   });
   const halo=ring(.43,[0,.72,-1.4],m.glow,.023);halo.rotation.y=.55;
   const orbit=ring(.48,[0,.72,-1.4],m.gold,.035);orbit.rotation.x=.6;
 }else if(item.id==='aux_toxin'){
   housing();
   for(const s of [-1,1]){
     cylinder(.29,1.2,[s*.54,.67,-.13],m.paint);
     for(const z of [-.78,.48])sleeve(.32,.23,.11,[s*.54,.67,z],m.steel);
     for(let i=0;i<5;i++)ring(.292,[s*.54,.67,-.54+i*.18],m.gold,.016);
     strut([s*.54,.96,-.5],[s*.54,.96,.21],.042,m.glow);
     cable([[s*.54,.65,-.72],[s*.63,.44,-1.26],[s*.25,.56,-1.7]],.075,m.dark);
     barrel(s*.25,.56,-1.38,-2.15,.14);
   }
   hull([[.57,.39,.22,1.03],[-.37,.5,.23,1.12],[-.8,.18,.11,.95]],m.armor);
   vents(0,1.25,-.26,5,.32);
   ring(.2,[0,1.28,.04],m.gold,.037).rotation.x=Math.PI/2;
 }else if(item.id==='aux_blades'){
   housing();
   const hub=cylinder(.36,.23,[0,.83,-.45],m.steel);hub.rotation.x=0;
   ring(.31,[0,.97,-.45],m.gold,.035).rotation.x=Math.PI/2;
   ring(.18,[0,.99,-.45],m.glow,.028).rotation.x=Math.PI/2;
   for(const s of [-1,1]){
     plate([[s*.13,-.65],[s*.56,-.74],[s*1.55,-1.5],[s*1.92,-2.4],[s*1.80,-1.05],[s*.67,.12],[s*.22,.02]],.69,.16,m.dark);
     plate([[s*.46,-.65],[s*1.50,-1.36],[s*1.88,-2.32],[s*1.58,-.97],[s*.62,-.02]],.88,.065,m.armor);
     plate([[s*.67,-.22],[s*1.58,-1.07],[s*1.84,-2.21],[s*1.42,-1.22]],.96,.028,m.glow);
     strut([s*.16,.64,.34],[s*.9,.64,-.53],.075,m.bright);
     for(const [x,z] of [[.56,-.37],[1.2,-1.0]])bolt(x*s,.98,z);
   }
 }else if(item.id==='aux_gravity'){
   housing();pairedTanks(.21);
   // A gimbal-supported spherical resonator, with three offset containment rings.
   core([0,.83,-1.34],.29,m.dark);core([0,.83,-1.34],.19,m.glow);
   for(const [r,rx,ry] of [[.52,0,0],[.64,.9,0],[.72,0,.8]]){
     const o=ring(r,[0,.83,-1.34],m.steel,.064);o.rotation.set(rx,ry,0);
     const e=ring(r-.075,[0,.83,-1.34],m.glow,.017);e.rotation.copy(o.rotation);
   }
   for(const s of [-1,1]){cable([[s*.28,.55,-.22],[s*.83,.59,-.75],[s*.82,.84,-1.73],[s*.49,.89,-2.03]],.09,m.armor);capacitor(s*.78,.65,-.9,.13,.53);}
   collar(.39,-2.04);
 }else if(item.id==='aux_lightmine'){
   housing();
   const base=cylinder(.59,.22,[0,.66,-.71],m.dark);base.rotation.x=0;
   ring(.51,[0,.79,-.71],m.gold,.035).rotation.x=Math.PI/2;
   core([0,.91,-.71],.18);
   radial(4,a=>{const dx=Math.sin(a),dz=Math.cos(a),x=dx*.52,z=-.71+dz*.52;
     strut([dx*.17,.81,-.71+dz*.17],[dx*.82,.81,-.71+dz*.82],.095,m.steel);
     const emitter=sleeve(.16,.09,.3,[x,.81,z],m.armor);emitter.rotation.y=a;
     const lens=cylinder(.088,.04,[dx*.70,.81,-.71+dz*.70],m.glow);lens.rotation.y=a;
     bolt(dx*.4,.82,-.71+dz*.4);
   });
   for(const s of [-1,1])hull([[.48,.15,.24,.67],[-1.34,.17,.22,.62],[-1.77,.08,.13,.6]],m.armor,s*.75);
 }else if(item.id==='aux_pyro'){
   housing();pairedTanks(.23);
   core([0,.71,-1.21],.33,m.paint);
   radial(6,a=>{const x=Math.cos(a)*.41,y=.71+Math.sin(a)*.41;
     cable([[x*.7,.71+(y-.71)*.7,-.45],[x*1.2,.71+(y-.71)*1.2,-1.16],[x,y,-1.84]],.072,m.dark);
     strut([x,y,-.78],[x,y,-1.58],.025,m.glow);
   });
   for(const z of [-.58,-1.82])collar(.49,z);
   sleeve(.39,.25,.46,[0,.71,-2.07],m.steel);ring(.35,[0,.71,-2.31],m.paint,.035);
   cylinder(.23,.025,[0,.71,-2.08],m.glow);
   for(let i=0;i<5;i++)sleeve(.45,.37,.047,[0,.71,-1.92+i*.14],m.gold);
 }else if(item.id==='aux_shield'){
   housing();
   sleeve(.29,.2,1.0,[0,.66,-.66],m.steel);
   radial(6,a=>{
     const petal=plate([[.13,-.24],[.49,-.33],[.73,-.14],[.69,.18],[.43,.32],[.14,.19]],0,.08,m.armor);
     petal.rotation.set(Math.PI/2,0,a,'ZYX');petal.position.set(0,.75,-1.26);
     const x=Math.cos(a)*.55,y=.75+Math.sin(a)*.55;
     strut([x*.5,.75+(y-.75)*.5,-.8],[x,y,-1.23],.07,m.gold);
     cylinder(.045,.02,[x,y,-1.35],m.glow);
   });
   sleeve(.25,.17,.11,[0,.75,-1.38],m.gold);core([0,.75,-1.39],.16);
   pairedTanks(.15);
 }else if(item.id==='aux_tail'){
   housing();drum(.35,.8,[0,.58,.15]);
   for(const s of [-1,1]){
     barrel(s*.3,.61,-.56,-1.72,.13);
     hull([[.31,.19,.28,.86],[-.68,.28,.27,.81],[-1.39,.1,.13,.67]],m.armor,s*.48);
     for(const z of [-.7,-1.2])ring(.17,[s*.3,.61,z],m.gold,.025);
     cable([[s*.51,.65,.31],[s*.7,.4,-.23],[s*.4,.42,-1.21]],.046,m.dark);
   }
   // Aft-directed reaction tubes are part of the model, not changed trajectories.
   for(const s of [-1,1]){
     sleeve(.16,.10,.4,[s*.37,.47,.73],m.steel);ring(.14,[s*.37,.47,.95],m.glow,.02);
   }
   vents(0,1.02,-.15,5,.32);
 }else if(item.id==='aux_drone'){
   hull([[.58,1.65,.22,.38],[-.45,1.55,.2,.38],[-1.03,1.3,.16,.4]],m.dark);
   for(const s of [-1,1]){
     strut([s*.65,.3,.5],[s*.65,.3,-1.41],.064,m.steel);
     hull([[.67,.26,.22,.66],[.22,.45,.35,.73],[-.64,.31,.27,.76],[-1.53,.045,.05,.71]],m.armor,s*.63);
     plate([[s*.62,-.84],[s*1.11,-.15],[s*1.17,.31],[s*.65,.1],[s*.16,.31],[s*.21,-.12]],.64,.075,m.paint);
     sleeve(.14,.085,.27,[s*.63,.73,.64],m.steel);ring(.12,[s*.63,.73,.8],m.glow,.02);
     hull([[.2,.12,.09,.96],[-.66,.09,.085,.96],[-.96,.04,.04,.82]],m.dark,s*.63);
     strut([s*.63,1.02,-.12],[s*.63,1.02,-.54],.018,m.glow);
     for(const z of [-.48,.2])bolt(s*.63,.99,z,.027);
   }
   capacitor(0,.58,-.1,.12,.73);
 }else throw new Error('No authored assembly for '+item.id);
}

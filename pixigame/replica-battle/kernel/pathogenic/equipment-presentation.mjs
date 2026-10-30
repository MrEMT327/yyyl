// Original equipment art, authored as bounded geometry. Live host snapshots own
// every birth, position, radius and expiry; drawing never advances combat or RNG.
const ROOT='host://project-equipment-v1/';
const BLUE=[.12,.72,1], GOLD=[1,.69,.16], ORANGE=[1,.37,.08], VIOLET=[.78,.3,1], WHITE=[.88,.98,1];
const WEAPONS=new Map([[400033,'charge-blue'],[400041,'charge-gold'],[400046,'strike-blue'],[400047,'strike-gold'],
  [400035,'holy-shield'],[400036,'star-shield'],[400037,'star-shield'],[400038,'holy-wave'],[400045,'rage-wave'],
  [400042,'blast'],[400043,'missile'],[400044,'missile-super']]);
const STATUSES=new Map([[214008,'holy'],[214009,'holy'],[214011,'barrier'],[214015,'barrier'],[214018,'rage'],[214020,'rage']]);
const EFFECTS=new Map([[110039,'blue'],[220029,'gold'],[210047,'shield'],[210016,'blast'],[160001,'heal']]);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const rgb=(c,a=1)=>[...c,clamp(a)];
export const equipmentProjectileKind=b=>b.owner==='player'?WEAPONS.get(b.weaponId):undefined;
export const equipmentStatusKind=b=>STATUSES.get(b.buffId);
export const equipmentEffectKind=f=>f.kind==='hit'?[110039,220029,210047].includes(f.modelId)?EFFECTS.get(f.modelId):undefined
  :f.kind==='explosion'&&f.modelId===210016?'blast':f.kind==='heal'&&f.modelId===160001?'heal':undefined;
export function withEquipmentResources(graph){return{...graph,resources:{...graph.resources,
  [ROOT+'solid']:{type:'CanvasItemMaterial',properties:{blend_mode:0,light_mode:1}},
  [ROOT+'light']:{type:'CanvasItemMaterial',properties:{blend_mode:1,light_mode:1}}}};}

function brush(point){
  const make=key=>({key,z:key==='light'?3:1,material:{$ref:ROOT+key},vertices:[],indices:[]});
  const layers={solid:make('solid'),light:make('light')};
  const api={
    polygon(points,color,layer='solid'){
      const m=layers[layer],base=m.vertices.length;
      for(const p of points){const q=point(p[0],p[1]);m.vertices.push({position:[q.x,q.y],uv:[.5,.5],color:[...color]});}
      for(let i=1;i<points.length-1;i++)m.indices.push(base,base+i,base+i+1);
    },
    radial(rx,ry,color,alpha,cx=0,cy=0){
      const m=layers.light,base=m.vertices.length,center=point(cx,cy);
      m.vertices.push({position:[center.x,center.y],uv:[.5,.5],color:rgb(color,alpha)});
      for(let i=0;i<=24;i++){const a=i*Math.PI/12,q=point(cx+Math.cos(a)*rx,cy+Math.sin(a)*ry);m.vertices.push({position:[q.x,q.y],uv:[.5,.5],color:rgb(color,0)});}
      for(let i=1;i<=24;i++)m.indices.push(base,base+i,base+i+1);
    },
    line(a,b,width,color,layer='light'){
      const x=b[0]-a[0],y=b[1]-a[1],l=Math.hypot(x,y);if(l<1e-7)return;
      const nx=-y/l*width/2,ny=x/l*width/2;
      api.polygon([[a[0]+nx,a[1]+ny],[b[0]+nx,b[1]+ny],[b[0]-nx,b[1]-ny],[a[0]-nx,a[1]-ny]],color,layer);
    },
    path(points,width,color,closed=false,layer='light'){
      for(let i=1;i<points.length;i++)api.line(points[i-1],points[i],width,color,layer);
      if(closed)api.line(points.at(-1),points[0],width,color,layer);
    },
    arc(rx,ry,start,end,width,color,cx=0,cy=0){
      const n=Math.max(2,Math.ceil(Math.abs(end-start)*7));
      const points=Array.from({length:n+1},(_,i)=>{const a=start+(end-start)*i/n;return[cx+Math.cos(a)*rx,cy+Math.sin(a)*ry];});
      api.path(points,width,color);
    },
    gem(x,y,r,color){api.polygon([[x,y+r],[x+r*.6,y],[x,y-r],[x-r*.6,y]],color,'light');},
    finish:()=>Object.values(layers).filter(m=>m.indices.length),
  };return api;
}
const valid=b=>!b.dead&&!b.visualHidden&&b.scale>0&&b.lifetime>0
  &&[b.x,b.z,b.age,b.scale,b.radiusX,b.radiusZ,b.angle??0,b.visualAngle??0,b.offsetX??0,b.offsetZ??0].every(Number.isFinite)
  &&b.age>=Math.max(0,b.warmup??0)&&b.age<b.lifetime;
function coordinates(b,screen,rotate=false){
  const yaw=rotate?(b.visualAngle??b.angle??0):0,c=Math.cos(yaw),s=Math.sin(yaw);
  const baseYaw=b.angle??0,ox=b.offsetX??0,oz=b.offsetZ??0;
  const x=b.x+Math.cos(baseYaw)*ox+Math.sin(baseYaw)*oz,z=b.z-Math.sin(baseYaw)*ox+Math.cos(baseYaw)*oz;
  return(a,f)=>screen(x+c*a+s*f,z-s*a+c*f);
}
function sparks(p,rx,rz,age,seed,color,count=9){
  for(let i=0;i<count;i++){
    const a=(i/count+hash(seed+i)*.07)*Math.PI*2,d=.42+clamp(age*3)*.7;
    const x=Math.cos(a)*rx*d,y=Math.sin(a)*rz*d,tail=.12+hash(seed+i+40)*.15;
    p.line([x*(1-tail),y*(1-tail)],[x,y],.025,rgb(color,(1-clamp(age))* .7));
  }
}
function starShield(p,b,alpha){
  const rx=Math.max(.3,b.radiusX),rz=Math.max(.35,b.radiusZ);
  const pulse=.92+.08*Math.sin(b.age*4.5);
  const shape=[[-.64,.66],[.64,.66],[.86,.24],[.5,-.48],[0,-1.03],[-.5,-.48],[-.86,.24]];
  const points=shape.map(([x,z])=>[x*rx,z*rz]);
  const cyan=[.12,.82,1],ice=[.79,.9,.96];
  // A translucent energy face and two pale shoulder plates retain a clear
  // silhouette at battle size without the old triple frame or stacked arrows.
  p.radial(rx*1.06,rz*1.24,BLUE,.085*alpha*pulse);
  p.polygon(points,rgb([.035,.17,.25],.46*alpha));
  p.polygon([points[0],points[1],[rx*.38,rz*.06],[-rx*.38,rz*.06]],rgb([.27,.62,.76],.3*alpha));
  p.polygon([points[2],points[3],points[4],[0,-rz*.12],[rx*.26,rz*.06]],rgb([.025,.09,.17],.28*alpha));
  p.polygon([points[6],points[5],points[4],[0,-rz*.12],[-rx*.26,rz*.06]],rgb([.12,.38,.5],.22*alpha));
  p.path(points,.095,rgb(cyan,.11*alpha*pulse),true);
  p.path(points,.038,rgb(cyan,.88*alpha),true);
  p.path([points[2],points[3],points[4],points[5],points[6]],.018,rgb(WHITE,.6*alpha));
  for(const side of [-1,1]){
    const panel=[[.52,.65],[.65,.68],[.87,.24],[.74,.17]].map(([x,z])=>[side*x*rx,z*rz]);
    p.polygon(panel,rgb(ice,.96*alpha));
    p.polygon([panel[1],panel[2],panel[3]],rgb([.34,.52,.65],.86*alpha));
    p.line([side*rx*.6,rz*.66],[side*rx*.82,rz*.25],.025,rgb(WHITE,.9*alpha));
    p.line([side*rx*.49,-rz*.57],[side*rx*.34,-rz*1.12],.04,rgb(cyan,.16*alpha*pulse));
  }
  p.line([-rx*.38,rz*.65],[rx*.38,rz*.65],.05,rgb(ice,.96*alpha),'solid');
  p.radial(rx*.22,rz*.42,cyan,.19*alpha*pulse,0,-rz*.13);
  p.gem(0,-rz*.13,Math.min(rx*.09,rz*.21),rgb(WHITE,.84*alpha));
}
function holyShield(p,b,alpha){
  const rx=Math.max(.3,b.radiusX),rz=Math.max(.35,b.radiusZ),age=b.age;
  const shape=[[-.58,.82],[0,1.12],[.58,.82],[.61,-.08],[0,-1.05],[-.61,-.08]];
  const points=shape.map(([x,y])=>[x*rx,y*rz]);
  const color=GOLD;
  p.radial(rx*1.22,rz*1.5,color,.18*alpha);
  p.polygon(points,rgb([.13,.11,.065],.94*alpha));
  p.polygon([points[0],points[1],points[2],[0,rz*.18]],rgb([.47,.37,.15],.75*alpha));
  p.polygon([points[2],points[3],points[4],[0,rz*.18]],rgb([.24,.17,.065],.88*alpha));
  p.polygon(points.map(([x,y])=>[x*.76,y*.76]),rgb(color,.16*alpha));
  p.path(points,.075,rgb(color,.27*alpha),true);
  p.path(points,.035,rgb(WHITE,.94*alpha),true);
  p.path(points.map(([x,y])=>[x*.84,y*.84]),.045,rgb(color,.8*alpha),true);
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const wing=[[side*rx*.56,rz*(.55-i*.29)],[side*rx*(1.08-i*.1),rz*(.85-i*.32)],
      [side*rx*(.88-i*.07),rz*(.1-i*.3)],[side*rx*.56,rz*(-.18-i*.21)]];
    p.polygon(wing,rgb([.48,.25,.045],.94*alpha));
    p.polygon([wing[0],wing[1],[wing[2][0],(wing[2][1]+wing[1][1])*.5]],rgb([.94,.77,.36],.86*alpha));
    p.path(wing,.04,rgb(GOLD,.85*alpha),true);
  }
  p.line([0,-rz*.49],[0,rz*.52],.055,rgb(WHITE,.9*alpha));
  p.line([-rx*.28,rz*.16],[rx*.28,rz*.16],.04,rgb(GOLD,alpha));
  p.radial(.33,.33,GOLD,.48*alpha,0,rz*.16);p.gem(0,rz*.16,.16,rgb([1,.94,.66],alpha));
  const sweep=(age*1.7%1)*1.3-.65;
  p.line([-rx*.46,rz*sweep],[rx*.46,rz*sweep],.022,rgb(WHITE,.32*alpha));
  for(const side of [-1,1])p.line([side*rx*.55,-rz*.5],[side*rx*.36,-rz*(1.05+.08*Math.sin(age*24))],.05,rgb(color,.23*alpha));
}
function lightning(p,b,gold,charge){
  const r=Math.max(.3,b.radiusX),age=b.age-(b.warmup??0),color=gold?GOLD:BLUE;
  const alpha=charge?.34:clamp(1-age/b.lifetime)*(.65+.35*Math.exp(-age*14));
  p.radial(r*1.2,r*.65,color,alpha*(charge?.04:.18));
  p.arc(r,r*.48,0,Math.PI*2,.035,rgb(color,alpha*.54));
  if(charge){for(let i=0;i<4;i++){const a=i*Math.PI/2;p.line([Math.cos(a)*r*.6,Math.sin(a)*r*.3],[Math.cos(a)*r*.9,Math.sin(a)*r*.45],.035,rgb(color,.6));}return;}
  const count=gold?3:1,height=Math.max(3.2,r*3.8);
  for(let branch=0;branch<count;branch++){
    const spread=(branch-(count-1)/2)*r*.85,points=[];
    for(let i=0;i<9;i++){const t=i/8,shift=(hash(b.uid*3+branch*17+i+Math.floor(age*18)*.1)-.5)*r*.6*Math.sin(Math.PI*t);
      points.push([spread*(1-t)+shift,height*(1-t)]);}
    p.path(points,gold?.3:.23,rgb(color,alpha*.1));
    p.path(points,gold?.095:.075,rgb(color,alpha*.9));
    p.path(points,.028,rgb(WHITE,alpha));
    for(const i of [3,5]){const q=points[i],side=(i+branch)%2?1:-1;
      p.path([q,[q[0]+side*r*.45,q[1]+r*.22],[q[0]+side*r*.72,q[1]+r*.12]],.022,rgb(color,alpha*.7));}
  }
  if(gold)p.arc(r*.74,r*.36,age*3,age*3+Math.PI*1.6,.045,rgb([1,.9,.42],alpha*.8));
  sparks(p,r,r*.55,age,b.uid,color,gold?14:8);
}
function explosion(p,b,wave=false,holy=false){
  const age=b.age,phase=clamp(age/b.lifetime),rx=b.radiusX,rz=b.radiusZ,color=wave?(holy?GOLD:VIOLET):ORANGE;
  const alpha=wave?Math.pow(1-phase,.55)*.95:(1-phase)*.85,ring=wave?1:.3+.68*Math.sin(phase*Math.PI/2);
  const width=wave?Math.max(.07,Math.min(.27,rx*.017)):.14;
  p.radial(rx*ring*1.08,rz*ring*1.08,color,alpha*(wave?.035:.18));
  if(wave)p.arc(rx,rz,0,Math.PI*2,width*2.8,rgb(color,alpha*.12));
  p.arc(rx*ring,rz*ring,0,Math.PI*2,width,rgb(color,alpha));
  p.arc(rx*ring*.85,rz*ring*.85,0,Math.PI*2,width*.45,rgb(WHITE,alpha*.56));
  if(wave){
    for(let i=0;i<8;i++){const a=i*Math.PI/4+phase*.25,dx=Math.cos(a),dy=Math.sin(a);
      p.line([dx*rx*.91,dy*rz*.91],[dx*rx,dy*rz],width*.8,rgb(WHITE,alpha*.7));}
  }else{
    for(let i=0;i<12;i++){
      const a=i*Math.PI/6,inner=.12+phase*.5,outer=inner+.18;
      p.line([Math.cos(a)*rx*inner,Math.sin(a)*rz*inner],[Math.cos(a)*rx*outer,Math.sin(a)*rz*outer],.04,rgb(i%3?ORANGE:WHITE,alpha));
    }
    // A brief six-sided flash has a clear center after the first 80 ms.
    if(age<.08)p.polygon(Array.from({length:6},(_,i)=>[Math.cos(i*Math.PI/3)*rx*.35,Math.sin(i*Math.PI/3)*rz*.35]),rgb([1,.78,.3],(1-age/.08)*.3),'light');
  }
}
function missile(p,b,supercharged){
  const r=Math.max(.18,b.radiusX),l=Math.max(.48,b.radiusZ),alpha=Math.min(1,b.age/.025+.2),color=supercharged?GOLD:ORANGE;
  const body=[[-r*.65,-l*.65],[-r*.65,l*.55],[0,l*1.05],[r*.65,l*.55],[r*.65,-l*.65]];
  p.polygon(body,rgb([.12,.18,.23],alpha));p.path(body,.025,rgb(WHITE,alpha*.84),true);
  p.polygon([[-r*.48,l*.51],[0,l*.9],[r*.48,l*.51]],rgb(color,alpha));
  for(const side of [-1,1])p.polygon([[side*r*.5,-l*.32],[side*r*1.12,-l*.87],[side*r*.5,-l*.68]],rgb(color,alpha));
  p.line([0,-l*.5],[0,l*.3],.055,rgb(color,alpha));
  const flame=l*(.9+.12*Math.sin(b.age*58+b.uid));
  p.polygon([[-r*.42,-l*.65],[r*.42,-l*.65],[0,-l*.65-flame]],rgb(color,alpha*.45),'light');
  p.polygon([[-r*.18,-l*.65],[r*.18,-l*.65],[0,-l*.65-flame*.65]],rgb(WHITE,alpha*.86),'light');
}
export function equipmentProjectileMeshes(b,screen){
  const kind=equipmentProjectileKind(b);if(!kind||!valid(b)||b.radiusX<=0||b.radiusZ<=0)return[];
  const p=brush(coordinates(b,screen,kind.includes('shield')||kind.startsWith('missile')));
  const alpha=clamp(b.age/.055+.12)*clamp((b.lifetime-b.age)/.2);
  if(kind.includes('shield'))(kind==='holy-shield'?holyShield:starShield)(p,b,alpha);
  else if(kind.startsWith('strike')||kind.startsWith('charge'))lightning(p,b,kind.endsWith('gold'),kind.startsWith('charge'));
  else if(kind.startsWith('missile'))missile(p,b,kind==='missile-super');
  else explosion(p,b,kind.endsWith('wave'),kind==='holy-wave');
  return p.finish();
}
export function equipmentStatusMeshes(b,screen){
  const kind=equipmentStatusKind(b),remaining=b.remaining??b.duration-b.age;
  if(!kind||b.dead||b.visualHidden||![b.age,b.x,b.z].every(Number.isFinite)||b.age<0||!(remaining>0))return[];
  const p=brush((x,z)=>screen(b.x+x,b.z+z)),a=clamp(b.age/.12+.1)*clamp(remaining/.18),time=b.age;
  if(kind==='barrier'){
    const r=2.05,points=Array.from({length:6},(_,i)=>{const t=i*Math.PI/3+Math.PI/6;return[Math.cos(t)*r,Math.sin(t)*r];});
    p.radial(2.25,2.25,BLUE,a*.09);
    p.path(points,.14,rgb(BLUE,a*.13),true);p.path(points,.06,rgb(BLUE,a*.8),true);p.path(points.map(([x,z])=>[x*.88,z*.88]),.035,rgb(WHITE,a*.4),true);
    for(let i=0;i<6;i++){const v=points[i],next=points[(i+1)%6];p.line([v[0]*.7,v[1]*.7],[next[0]*.7,next[1]*.7],.025,rgb(BLUE,a*(.14+.18*(.5+.5*Math.sin(time*3+i)))));}
    for(const side of [-1,1])p.gem(side*1.78,0,.11,rgb(WHITE,a*.7));
  }else if(kind==='holy'){
    p.radial(2.55,2.55,GOLD,a*.1);
    p.arc(2.25,2.25,0,Math.PI*2,.035,rgb(GOLD,a*.55));
    for(let i=0;i<6;i++){const angle=i*Math.PI/3+time*.22;p.arc(2.38,2.38,angle,angle+.5,.065,rgb(GOLD,a*.76));}
    for(const side of [-1,1])for(let i=0;i<3;i++)p.path([[side*(1.15+i*.2),.6-i*.45],[side*(1.95+i*.16),1.05-i*.5],[side*(1.73+i*.14),.3-i*.45]],.045,rgb(WHITE,a*.62));
  }else{
    p.radial(2.4,2.4,VIOLET,a*.12);
    for(let i=0;i<7;i++){
      const angle=i*Math.PI*2/7+time*.33;
      p.arc(2.25,2.25,angle,angle+.46,.065,rgb(VIOLET,a*.85));
      const x=Math.cos(angle)*2.2,z=Math.sin(angle)*2.2;p.radial(.3,.3,VIOLET,a*.3,x,z);p.gem(x,z,.16,rgb([1,.57,.88],a*.85));
    }
    for(const side of [-1,1])p.path([[side*1.55,-.5],[side*1.85,-.1],[side*1.55,.3]],.05,rgb(WHITE,a*.65));
  }
  return p.finish();
}
export function equipmentEffectMeshes(f,screen){
  const kind=equipmentEffectKind(f);if(!kind||f.age<0||f.age>=f.duration||![f.x,f.z,f.age,f.duration].every(Number.isFinite))return[];
  const p=brush((x,z)=>screen(f.x+x,f.z+z)),t=f.age/f.duration,color=kind==='gold'?GOLD:kind==='blast'?ORANGE:kind==='heal'?[.25,1,.56]:BLUE;
  if(kind==='blast')explosion(p,{...f,lifetime:f.duration,radiusX:1.6,radiusZ:1.6},false);
  else if(kind==='heal'){
    p.arc(1.15,1.15,0,Math.PI*2,.035,rgb(color,(1-t)*.6));
    for(const side of [-1,1]){const y=.4+f.age*1.5;p.line([side*.65-.12,y],[side*.65+.12,y],.04,rgb(color,1-t));p.line([side*.65,y-.12],[side*.65,y+.12],.04,rgb(color,1-t));}
  }else{sparks(p,kind==='gold'?1.2:.85,kind==='gold'?.8:.6,t,f.uid,color,kind==='gold'?12:7);p.arc(.3+t*.7,.15+t*.35,0,Math.PI*2,.03,rgb(color,(1-t)*.55));}
  return p.finish();
}
// Accents decorate the real projectile. They never replace its silhouette or
// create another apparent damage area, and disappear after the short flash.
export function equipmentAccentMeshes(b,style,screen){
  if(!style||!valid(b)||b.beam||b.held||b.age>.32||b.radiusX<=0||b.radiusZ<=0)return[];
  const p=brush(coordinates(b,screen,true)),rx=Math.min(.6,b.radiusX),rz=Math.min(1.2,b.radiusZ),a=(1-b.age/.32)*.64;
  const color=style==='charged'?GOLD:style==='area'?ORANGE:BLUE;
  for(const side of [-1,1])p.path([[side*rx*1.05,-rz*.5],[side*rx*1.15,rz*.28],[side*rx*.8,rz*.7]],.045,rgb(color,a));
  if(style==='charged')p.gem(0,rz*.7,.075,rgb(WHITE,a));
  return p.finish();
}

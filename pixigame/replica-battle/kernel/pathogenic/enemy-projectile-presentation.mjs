// Source metadata describes a mechanical fist, a brick, a short red missile,
// and an orange cone. They are travelling projectiles, not melee attack clips.
// The first three bodies below are original program geometry; the cone reuses
// the project's already generated art. Native collision and motion stay read-only.
const PREFIX = 'host://corrected-enemy-projectile-v1/';
const MODELS = new Set([1100003, 1100004, 1100012, 1100013, 1100014, 1100015, 1100017, 1100019, 1300001, 1300002]);
// Existing project art, using its already integrated world footprint. The long
// bullet's source particle is 15.8 x .5 at prefab scale .55 (not a short pellet).
const SPRITE_BODIES = {
  1100004:{art:'oval',width:992/3968*2,height:1586/3968*2},
  1100012:{art:'square',width:1047/654.375*2,height:1503/654.375*2},
  1100017:{art:'oval',width:.5*.55,height:15.8*.55},
  1100019:{art:'ring',width:2,height:2},
};
export const isCorrectedEnemyProjectile = b => b.owner === 'enemy' && MODELS.has(b.modelId) && !b.beam;

export function withCorrectedEnemyResources(graph) {
  return {...graph, resources: {...graph.resources,
    [PREFIX+'body']: {type:'CanvasItemMaterial',properties:{blend_mode:0,light_mode:1}},
    [PREFIX+'glow']: {type:'CanvasItemMaterial',properties:{blend_mode:1,light_mode:1}}},
    textures: {...graph.textures, [PREFIX+'cone']: {width:920,height:1708,file:'cone-orange-v1.png',
      url:'assets/original-projectiles/cone-orange-v1.png'},
      [PREFIX+'moon']: {width:1254,height:1254,file:'crescent-red-v1.png',url:'assets/original-projectiles/crescent-red-v1.png'},
      [PREFIX+'oval']: {width:992,height:1586,file:'oval-red-v1.png',url:'assets/original-projectiles/oval-red-v1.png'},
      [PREFIX+'square']: {width:1047,height:1503,file:'square-yellow-v1.png',url:'assets/original-projectiles/square-yellow-v1.png'},
      [PREFIX+'ring']: {width:1254,height:1254,file:'ring-red-v1.png',url:'assets/original-projectiles/ring-red-v1.png'}}};
}

const rgba = (hex, alpha = 1) => [(hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255,alpha];
function painter(point, material, key, z) {
  const mesh = {key,z,material:{$ref:PREFIX+material},vertices:[],indices:[]};
  return {mesh,
    polygon(points, color) {
      const start=mesh.vertices.length;
      for(const [x,y] of points){const p=point(x,y);mesh.vertices.push({position:[p.x,p.y],uv:[.5,.5],color:[...color]});}
      for(let i=1;i<points.length-1;i++)mesh.indices.push(start,start+i,start+i+1);
    },
    quad(x0,y0,x1,y1,color){this.polygon([[x0,y0],[x1,y0],[x1,y1],[x0,y1]],color);},
  };
}
function fist(body, glow, age) {
  const flame=.9+.1*Math.sin(age*35);
  glow.polygon([[-.58,-.6],[0,-1.7*flame],[.58,-.6]],rgba(0xff344d,.18));
  glow.polygon([[-.25,-.67],[0,-1.4*flame],[.25,-.67]],rgba(0xffb2bf,.48));
  body.polygon([[-.73,-.64],[-.93,-.13],[-.86,.74],[-.65,.97],[.57,.97],[.88,.7],[.93,-.16],[.6,-.64]],rgba(0x17243c));
  body.polygon([[-.65,-.52],[-.77,-.03],[-.71,.68],[.57,.78],[.77,.48],[.71,-.15],[.51,-.52]],rgba(0x536e93));
  body.quad(-.56,-.49,.52,.16,rgba(0x6e91b1));
  body.quad(-.56,-.49,.52,-.34,rgba(0x304765));
  // Four individually bevelled knuckles remain distinct at actual bullet size.
  for(let i=0;i<4;i++){
    const x=-.74+i*.36;
    body.polygon([[x,.36],[x+.025,.76],[x+.1,.88],[x+.27,.88],[x+.33,.7],[x+.32,.34],[x+.22,.24],[x+.08,.25]],rgba(0xa4c2d3));
    body.quad(x+.03,.36,x+.28,.57,rgba(0x6483a7));
    body.quad(x+.06,.72,x+.26,.78,rgba(0xd9e9ee));
  }
  body.polygon([[.48,.03],[.7,.25],[.91,.1],[.94,-.16],[.7,-.35],[.49,-.22]],rgba(0x7c9bb9));
  body.quad(-.45,-.23,.36,-.17,rgba(0xabc8df));
}
function brick(body) {
  body.polygon([[-.9,-.9],[.71,-1],[.96,-.8],[.96,.82],[.67,1],[-.9,.85]],rgba(0x58261f));
  body.polygon([[-.76,-.8],[.7,-.9],[.7,.8],[-.76,.71]],rgba(0xc66b4e));
  body.polygon([[.7,-.9],[.87,-.74],[.87,.75],[.7,.8]],rgba(0x8f3a2b));
  body.polygon([[-.76,.71],[.7,.8],[.87,.75],[.65,.91],[-.76,.81]],rgba(0xe58a62));
  body.quad(-.66,-.68,-.57,.58,rgba(0xdc8a69));
  for(const [x,y] of [[-.42,-.51],[.33,-.6],[.47,.43],[-.15,.26],[.18,-.05]])
    body.polygon([[x-.04,y],[x,y+.05],[x+.06,y+.015],[x+.03,y-.05]],rgba(0x9a4c3b));
}
function missile(body, glow, age) {
  const flare=.92+.08*Math.sin(age*42);
  glow.polygon([[-.4,-.7],[0,-1.65*flare],[.4,-.7]],rgba(0xffb622,.27));
  glow.polygon([[-.2,-.78],[0,-1.3*flare],[.2,-.78]],rgba(0xfff0a0,.7));
  body.polygon([[-.57,-.79],[-.65,.58],[-.44,.88],[0,1],[.44,.88],[.65,.58],[.57,-.79]],rgba(0x3b292d));
  body.polygon([[-.5,-.71],[-.52,.5],[-.36,.71],[.36,.71],[.52,.5],[.5,-.71]],rgba(0xc82c3d));
  body.quad(-.4,-.67,-.21,.49,rgba(0xf3656a));
  body.quad(.25,-.67,.49,.49,rgba(0x8b172b));
  body.polygon([[-.52,.5],[-.39,.81],[0,.93],[.39,.81],[.52,.5]],rgba(0x626c5b));
  body.polygon([[-.42,.55],[-.29,.78],[0,.86],[.15,.78],[.15,.55]],rgba(0xa3ae8a));
  body.polygon([[-.48,-.56],[-.92,-.88],[-.92,-.28],[-.48,-.06]],rgba(0x9e2034));
  body.polygon([[.48,-.56],[.92,-.88],[.92,-.28],[.48,-.06]],rgba(0xe94c55));
  body.quad(-.46,-.88,.46,-.73,rgba(0xf5c346));
  body.quad(-.28,-.9,.28,-.83,rgba(0xffee9c));
}

export function correctedEnemyProjectileMeshes(b, screen) {
  if(!isCorrectedEnemyProjectile(b)||b.dead||b.visualHidden||!(b.scale>0)
    ||![b.x,b.z,b.radiusX,b.radiusZ,b.age,b.lifetime].every(Number.isFinite)
    ||b.radiusX<=0||b.radiusZ<=0||b.age<0||b.age>=b.lifetime||b.age<(b.warmup??0))return [];
  const yaw=b.angle??0,ox=b.offsetX??0,oz=b.offsetZ??0;
  if(![yaw,ox,oz].every(Number.isFinite))return [];
  const dx=Math.sin(yaw),dz=Math.cos(yaw),x=b.x+dz*ox+dx*oz,z=b.z-dx*ox+dz*oz;
  const spriteBody=SPRITE_BODIES[b.modelId];
  if(spriteBody){
    // Native sprite/prefab dimensions, not collider radii. Scale is applied once.
    const rx=spriteBody.width*b.scale/2,rz=spriteBody.height*b.scale/2;
    const vertices=[[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]].map(([across,along,u,v])=>{
      const p=screen(b.x+dz*across*rx+dx*along*rz,b.z-dx*across*rx+dz*along*rz);
      return{position:[p.x,p.y],uv:[u,v],color:[1,1,1,1]};
    });
    return[{key:spriteBody.art,z:3,texture:{$external:PREFIX+spriteBody.art},material:{$ref:PREFIX+'body'},vertices,indices:[0,1,2,0,2,3]}];
  }
  // Radii already contain native Scale/ScaleAnimMod: never multiply them twice.
  const point=(across,along)=>screen(x+dz*across*b.radiusX+dx*along*b.radiusZ,
    z-dx*across*b.radiusX+dz*along*b.radiusZ);
  if([1300002,1100003,1100015].includes(b.modelId)){
    const art=b.modelId===1300002?'cone':'moon';
    const vertices=[[-1,-1,0,0],[1,-1,1,0],[1,1,1,1],[-1,1,0,1]].map(([x,y,u,v])=>{
      const p=point(x,y);return{position:[p.x,p.y],uv:[u,v],color:[1,1,1,1]};
    });
    return[{key:art,z:3,texture:{$external:PREFIX+art},material:{$ref:PREFIX+'body'},vertices,indices:[0,1,2,0,2,3]}];
  }
  const body=painter(point,'body','body',3),glow=painter(point,'glow','exhaust',2);
  if(b.modelId===1100013)fist(body,glow,b.age);
  else if(b.modelId===1100014)brick(body);
  else missile(body,glow,b.age);
  return [glow.mesh,body.mesh].filter(mesh=>mesh.indices.length);
}

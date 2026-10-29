const PREFIX='host://missile-v2/';
const ROCKET='res://scn/player/projectiles/rocket.tscn';
const BODY_HEIGHT=70;
const BODY_REGION=[295,56,361,1485];
const FLAME_REGION=[114,68,497,2037];

export function missilePresentation(projectile){
  const bodyScale=BODY_HEIGHT/BODY_REGION[3];
  const age=Number.isFinite(projectile.age)?projectile.age:0,phase=age*24+(projectile.uid??0)*2.4;
  const flutter=.94+.06*Math.sin(phase),flameLength=(projectile.held?24:40)*flutter;
  return{scale:1,retireImmediately:false,pose:{overrides:{
    'Visual/Circle':{position:[0,0],offset:[0,0],scale:[bodyScale,bodyScale],
      self_modulate:[1,1,1,1],modulate:[1,1,1,1],
      texture:{$ref:PREFIX+'body-frame'},material:{$ref:PREFIX+'body-material'}},
    'Visual/EngineFlame':{visible:!projectile.held||projectile.targetUid>0,
      position:[0,BODY_HEIGHT/2-2],offset:[0,FLAME_REGION[3]/2],
      scale:[(9.6+.4*Math.cos(phase*1.3))/FLAME_REGION[2],flameLength/FLAME_REGION[3]]},
  }}};
}

export function withMissilePresentationResources(graph){
  const resources={...graph.resources},textures={...graph.textures};
  const add=(name,type,properties)=>{const id=PREFIX+name;resources[id]={id,type,properties};};
  for(const [name,width,height,region]of [['body',948,1659,BODY_REGION],['exhaust',724,2172,FLAME_REGION]]){
    const file=name+'.png';
    textures[PREFIX+name]={width,height,file,url:'assets/missile-v2/'+file};
    add(name+'-frame','AtlasTexture',{atlas:{$external:PREFIX+name},region});
  }
  add('body-material','CanvasItemMaterial',{blend_mode:0,light_mode:1});
  add('flame-material','CanvasItemMaterial',{blend_mode:1,light_mode:1});
  const scene=graph.scenes[ROCKET];
  const flame={path:'Visual/EngineFlame',type:'Sprite2D',groups:[],origins:[],properties:{
    visible:false,z_index:-1,texture:{$ref:PREFIX+'exhaust-frame'},material:{$ref:PREFIX+'flame-material'},
  }};
  const nodes=[...scene.nodes.filter(node=>node.path!==flame.path),flame];
  return{...graph,resources,textures,scenes:{...graph.scenes,[ROCKET]:{...scene,nodes}}};
}

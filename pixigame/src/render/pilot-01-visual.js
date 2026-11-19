import { Container, Graphics, Rectangle, Sprite, Texture } from '../three/display.js';
import { registry, createVisualSwitch } from './entity-visual.js';

// Presentation only: follow the existing combat timer, including pauses and
// slow motion. Phase protection keeps its full shell until that state ends.
function protectionStrength(remaining, phase) {
  if (phase) return 1;
  const t = Math.max(0, Math.min(1, remaining / .5));
  return t * t * (3 - 2 * t);
}

export function pilot01Geometry(id='pilot-01') {
  const spec = registry[`airframe-${id}`];
  const [fx, fy, width, height] = spec.frame;
  const scale = Math.min(spec.size[0] / width, spec.size[1] / height);
  const anchor = [(spec.nose[0] - fx) / width, (spec.nose[1] - fy - spec.muzzle[1] / scale) / height];
  const local = (x, y) => ({ x: (x - spec.nose[0]) * scale, y: (y - spec.nose[1]) * scale + spec.muzzle[1] });
  return { scale, anchor, size: [width * scale, height * scale], muzzle: local(...spec.nose), nozzles: (spec.nozzles || [[484,826],[768,826]]).map(p=>local(...p)) };
}

export function cropPilotTexture(texture,id){
 if(!texture)return null;const frame=registry[id]?.frame;
 return frame?new Texture({source:texture.source,frame:new Rectangle(...frame)}):texture;
}
export function createPilot01Visual(player,texture,secondTexture=null,thirdTexture=null,extraTextures={}){
 if (player.aircraft?.model) {
   return { active: true, pilotId: 'pilot-01', nozzles: [], update(id,time,phase,invincible,disabled=false,pose={}) {
     this.pilotId=id;player.aircraft.model.setPilot?.(id);player.aircraft.root.visible=true;
     // Sprite alpha flashing exposes overlapping solid meshes as a cutaway.
     // Keep the hardware solid and use the volume shield for spawn protection.
     if(invincible>0&&!phase)player.view.alpha=1;
     for(const n of [player.weaponCore,player.rails,player.pilotMarkings,player.mountedModules,player.phaseAfterimages,player.sigil,player.glow])if(n)n.visible=false;
     player.aircraft.model.updateAircraft(time,{bank:player.flightBank??0,...pose,shielded:phase||invincible>0,shieldStrength:protectionStrength(invincible,phase),poseOnly:true});
   }};
 }
 const entries=[['pilot-01',texture],['pilot-02',secondTexture],['pilot-03',thirdTexture],...Object.entries(extraTextures)].filter(([,t])=>t);
 if(!entries.length)return {active:false,update(){},nozzles:[]};
 const root=new Container({label:texture?'pilot-01-retro-aircraft':'pilot-02-retro-aircraft'}),variants=new Map();
 for(const [id,source] of entries){
  const geometry=pilot01Geometry(id),cropped=cropPilotTexture(source,`airframe-${id}`),group=new Container({label:`${id}-variant`});
  const sprite=new Sprite(cropped);sprite.anchor.set(...geometry.anchor);sprite.scale.set(geometry.scale);
  const ghosts=[-1,1].map(side=>{const g=new Sprite(cropped);g.anchor.copyFrom(sprite.anchor);g.scale.copyFrom(sprite.scale);g.x=side*9;g.tint=id==='pilot-02'?0xb7d7be:0xb9a3ff;g.alpha=.2;group.addChild(g);return g;});
  const engines=new Graphics();for(const p of geometry.nozzles)engines.ellipse(p.x,p.y+3,2.2,6).fill({color:0xbcf5ff,alpha:.8});
  const marker=new Graphics().circle(0,0,4).fill(0xf5e7c9).circle(0,0,6).stroke({color:0x152c39,width:2});
  group.addChild(engines,sprite,marker);root.addChild(group);variants.set(id,{group,sprite,ghosts,engines,geometry});
 }
 const legacy=[player.aircraft.root,player.weaponCore,player.rails,player.pilotMarkings,player.mountedModules,player.sigil,player.glow,player.phaseAfterimages];
 const swap=createVisualSwitch(player.view,legacy,root);
 const result={active:false,root,nozzles:[],update(id,time,phase,invincible,disabled=false){
   const selected=variants.get(id);result.active=!!selected&&!disabled;swap.set(result.active);
   for(const [key,v] of variants)v.group.visible=result.active&&key===id;
   if(!result.active)return;
   result.sprite=selected.sprite;result.nozzles=selected.geometry.nozzles;result.pilotId=id;
   legacy.forEach(v=>v.visible=false);selected.ghosts.forEach(v=>v.visible=phase);selected.engines.alpha=.65+Math.sin(time*32)*.2;
   if(phase||invincible>0)player.view.alpha=Math.max(.55,player.view.alpha);
 }};
 return result;
}

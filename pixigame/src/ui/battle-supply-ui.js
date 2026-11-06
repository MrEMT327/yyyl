import {Container, Graphics} from '../three/display.js';
import {CanvasTexture, SRGBColorSpace, LinearFilter} from 'three';
import {SUPPLY_RING, supplyMotion} from './battle-supply-motion.js';
import {upgradeIconLayout} from './upgrade-icon-layout.js';
import {upgradeFeedbackProfile} from './upgrade-feedback-profile.js';
import {paintPsdPopup} from './psd-popup-art.js';
import {paintCombatArt} from './combat-art.js';

const lightTextures=new Map();
function lightTexture(kind) {
  if(lightTextures.has(kind))return lightTextures.get(kind);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=384;
  const c=canvas.getContext('2d');c.translate(192,192);
  if(kind==='glow'){
    const g=c.createRadialGradient(0,0,0,0,0,184);
    for(const[at,alpha]of [[0,.38],[.2,.65],[.42,.46],[.7,.13],[1,0]])g.addColorStop(at,'rgba(255,255,255,'+alpha+')');
    c.fillStyle=g;c.fillRect(-192,-192,384,384);
  }else{
    // A bright spine with transverse falloff gives the shafts soft sides.
    // Fade both ends as well; no polygon outline or broad petal-shaped cap.
    const beam=document.createElement('canvas');beam.width=64;beam.height=192;
    const b=beam.getContext('2d');
    const sides=b.createLinearGradient(0,0,64,0);
    for(const[at,alpha]of [[0,0],[.12,.035],[.28,.36],[.42,.9],[.5,1],[.58,.9],[.72,.36],[.88,.035],[1,0]])sides.addColorStop(at,'rgba(255,255,255,'+alpha+')');
    b.fillStyle=sides;b.fillRect(0,0,64,192);
    const ends=b.createLinearGradient(0,0,0,192);
    for(const[at,alpha]of [[0,0],[.12,.24],[.32,.76],[.56,1],[.8,.9],[.94,.3],[1,0]])ends.addColorStop(at,'rgba(255,255,255,'+alpha+')');
    b.globalCompositeOperation='destination-in';b.fillStyle=ends;b.fillRect(0,0,64,192);
    for(let i=0;i<12;i++){
      c.save();c.rotate(i*Math.PI/6+.12);
      const length=i%2?152:184,half=i%2?15:20;
      c.drawImage(beam,-half,-length,half*2,length-22);c.restore();
    }
  }
  const texture=new CanvasTexture(canvas);texture.colorSpace=SRGBColorSpace;
  texture.generateMipmaps=false;texture.minFilter=LinearFilter;lightTextures.set(kind,texture);return texture;
}
function weaponLight(center,surface,ready) {
  // Separate the bright spokes from the soft core; the outer layer travels out.
  const layer=(kind,size,alpha)=>{
    const node=new Container();node.position.set(145,118);node.eventMode='none';
    node.additive=true;node.tint=ready?0xffdc8b:0x9fe2ff;node.alpha=alpha;
    surface(node,s=>s.image(lightTexture(kind),-size/2,-size/2,size,size));
    center.addChild(node);return node;
  };
  return {glow:layer('glow',210,.5),rays:layer('rays',246,.88),wave:layer('rays',246,0)};
}
function updateWeaponLight(board,now,ready,reduced) {
  board.lightStartedAt??=now;
  const age=Math.max(0,(now-board.lightStartedAt)/1000);
  const unfold=reduced?1:1-Math.pow(1-Math.min(1,age/.6),3);
  const clock=now/1000,pulse=(age%1.8)/1.8;
  board.glow.alpha=(ready?.62:.5)*(reduced?1:.93+.07*Math.sin(clock*2));
  board.glow.scale.set(.78+.22*unfold);
  board.rays.rotation=reduced?0:clock*.24;
  board.rays.scale.set((.34+.66*unfold)*(reduced?1:.98+.035*Math.sin(clock*1.8)));
  board.rays.alpha=(ready?1:.88)*(.3+.7*unfold);
  board.wave.rotation=reduced?0:-clock*.16+Math.PI/12;
  board.wave.scale.set(.44+.58*(1-Math.pow(1-pulse,2)));
  board.wave.alpha=reduced?0:(ready?.6:.48)*Math.sin(Math.PI*pulse)*unfold;
}

export function renderBattleSupply({root:host,bridge,refs,art,place,text,button,backdrop,surface,symbol}) {
  const supply=bridge.game.battleSupply;
  if(!supply)return;
  const ready=supply.phase==='ready',rolling=supply.phase==='rolling';
  const gold=0xffda42;
  // Native UI_Punchboard has a stretched black Image with alpha 192/255.
  // The embedded battle owns its full-stage dimmer; no narrow black panel.
  backdrop(host,0x000000,192/255);
  const root=new Container();root.label='supply-entry-panel';host.addChild(root);
  const pickup=supply.pickupView;
  if(pickup&&!pickup.destroyed){
    host.addChild(pickup);pickup.eventMode='none';
    pickup.position.set(supply.pickupX,supply.pickupY);
  }
  const label=(parent,value,x,y,size=20,color=0xf3f5f7,maxWidth=480)=>{
    const node=text(value,{size,fill:color,weight:'900',anchorX:.5});
    place(parent,node,x,y);
    if(node.width>maxWidth)node.scale.set(maxWidth/node.width);
    return node;
  };
  const plate=(parent,kind,x,y,w,h)=>surface(parent,s=>paintCombatArt(s,kind,x,y,w,h));
  surface(root,s=>paintPsdPopup(s,'primary',28,190,544,676));
  place(root,text('战斗补给',{size:34,fill:0xf3f5f7,weight:'900'}),82,216);
  label(root,supply.subtitle || (supply.evolutionExhausted?'形态已满 · 获得武装强化':'精英击破 · 必得形态强化'),300,289,18,0x23415a);
  const icon=(parent,card,x,y,size)=>{
    const weapon=bridge.game.fixedLoadout.weapons.find(w=>w.id===card.ownerId);
    const texture=art?.get(weapon?.itemId);
    if(texture)surface(parent,s=>{
      const fit=upgradeIconLayout(texture,{x,y,width:size,height:size});
      s.image(texture,fit.x,fit.y,fit.width,fit.height,fit.crop);
    });
    else symbol(parent,card.key==='cadence'?'cadence':card.key==='power'?'power':'star',x+size*.2,y+size*.2,size*.6,'#ffdb64');
  };
  const cells=[];
  SUPPLY_RING.forEach(([col,row],i)=>{
    const card=supply.slots[i%supply.slots.length],cell=new Container();
    cell.position.set(48+col*102,338+row*94);
    plate(cell,'slot',0,0,96,88);
    icon(cell,card,11,7,74);
    const highlight=new Graphics().roundRect(0,0,96,88,7).fill({color:gold,alpha:.22}).stroke({color:0xffed9c,width:5});
    highlight.visible=false;highlight.__supplyIndex=i;cell.addChild(highlight);
    root.addChild(cell);cells.push(highlight);
  });
  const center=new Container();center.position.set(155,437);
  plate(center,'card',0,0,290,270);
  const {glow,rays,wave}=weaponLight(center,surface,ready);
  const hero=new Container();icon(hero,ready?supply.reward:supply.slots[0],0,0,216);hero.pivot.set(108,108);hero.position.set(145,113);center.addChild(hero);
  label(center,ready?'强化已锁定':'本局武装',145,221,23,ready?gold:0xe4edf7,264);
  root.addChild(center);
  const rewardProfile=upgradeFeedbackProfile(supply.reward);
  let result=null;
  if(ready){
    result=new Container();result.position.set(48,878);
    plate(result,'secondary',0,0,504,126);
    label(result,rewardProfile.label,252,12,17,rewardProfile.color);
    label(result,supply.rewardNames||supply.reward.name,252,43,25,0xf7f4df,468);
    label(result,supply.reward.ownerName,252,91,16,0xb4c7db,464);
    root.addChild(result);
  }
  const sparks=new Container();sparks.position.set(300,571);root.addChild(sparks);
  if(ready)for(let i=0;i<16;i++){
    const spark=new Graphics().poly([0,-5,2,0,0,5,-2,0]).fill({color:i%2?gold:0x99e6ff});
    sparks.addChild(spark);
  }
  root.addChild(button({x:104,y:ready?1032:922,width:392,height:92,variant:'primary',
    text:ready?'继续战斗':rolling?'点击跳过':'开始',fontSize:34,
    onPress:()=>{if(supply.disabled)return;return ready?bridge.claimBattleSupply():rolling?bridge.skipBattleSupply():bridge.startBattleSupply();}}));
  refs.battleSupplyBoard={cells,glow,rays,wave,hero,sparks,result,rewardProfile,lastStep:-1,entry:root,pickup,
    pickupScale:pickup?.scale.x||1,pickupX:supply.pickupX,pickupY:supply.pickupY};
}

export function updateBattleSupply(refs,supply,now,onTick) {
  const board=refs.battleSupplyBoard;
  if(!board||!supply)return;
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const entryT=reduced?1:Math.max(0,Math.min(1,(now-(supply.pickupAt??-Infinity))/360));
  board.entry.alpha=.2+.8*entryT;
  board.entry.pivot.set(300,650);board.entry.position.set(300,650);
  board.entry.scale.set(.96+.04*entryT);
  if(board.pickup&&!board.pickup.destroyed){
    const t=Math.min(1,entryT*1.6);
    board.pickup.position.set(board.pickupX+(300-board.pickupX)*t,board.pickupY+(570-board.pickupY)*t);
    board.pickup.scale.set(board.pickupScale*(1-t));board.pickup.alpha=1-t;
    if(t>=1){board.pickup.destroy({children:true});board.pickup=null;supply.pickupView=null;}
  }
  const motion=supply.presentationMotion || supplyMotion(supply,now);
  const revealT=Math.max(0,(now-(supply.revealedAt??now))/1000);
  board.cells.forEach((cell,i)=>{
    const distance=(motion.index-i+16)%16,active=i===motion.index;
    cell.visible=active||!reduced&&supply.phase==='rolling'&&distance<=2;
    cell.alpha=active?1:distance===1?.3:.12;
    const pop=supply.phase==='ready'&&!reduced&&active?1+.045*Math.exp(-7*revealT)*Math.sin(revealT*18):1;
    cell.scale.set(pop);
    if(reduced&&supply.phase==='rolling')cell.visible=false;
  });
  if(motion.step!==board.lastStep&&motion.step>=0){
    if(board.lastStep>=0&&!reduced)onTick?.();
    board.lastStep=motion.step;
  }
  const t=revealT;
  updateWeaponLight(board,now,supply.phase==='ready',reduced);
  const strong=board.rewardProfile?.stage>0;
  board.hero.scale.set(!reduced&&supply.phase==='ready'?1+(strong?.17:.1)*Math.exp(-5*t)*Math.sin(t*15):1);
  if(board.result)board.result.alpha=!reduced?Math.min(1,.35+t*4):1;
  board.sparks.children.forEach((spark,i)=>{
    const a=i*Math.PI/8,r=80+Math.min(t,1.2)*120;
    spark.position.set(Math.cos(a)*r,Math.sin(a)*r);
    spark.alpha=reduced?0:Math.max(0,1-t/1.2);
  });
}

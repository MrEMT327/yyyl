import {Container, Graphics} from '../three/display.js';
import {Color, DataTexture, LinearFilter} from 'three';
import {SUPPLY_RING, supplyMotion} from './battle-supply-motion.js';
import {upgradeIconLayout} from './upgrade-icon-layout.js';
import {upgradeFeedbackProfile} from './upgrade-feedback-profile.js';
import {paintPsdPopup,psdPopupArtTextures} from './psd-popup-art.js';
import {paintPsdPopupTitle} from './psd-popup-title.js';
import {combatArtTexture,combatArtworkReady,paintCombatArt,retryCombatArtwork} from './combat-art.js';
import {supplyResultRows,supplyResultLayout} from './battle-supply-results.js';

const SUPPLY_ART_WAIT_MS=5000;
const unavailable=Object.freeze({failed:true});
const iconKey=(card,weapons)=>card?.itemId??weapons?.find(weapon=>weapon.id===card?.ownerId)?.itemId;
const showsReceipts=supply=>supply.phase==='ready'&&Array.isArray(supply.rewards);

export function createBattleSupplyArtwork(textures,warmTexture,prepareTextures){
  let shared,request;
  const uploads=new Set();
  const priority=()=>request&&!request.result?2:-1;
  function prewarm(){
    if(!shared){
      const frame=psdPopupArtTextures('primary',priority);
      const card=combatArtTexture('card',priority),slot=combatArtTexture('slot',priority);
      const button=combatArtTexture('primary',priority);
      shared={frame,card,slot,button};
      if(warmTexture)for(const texture of [...frame,card,slot,button])uploads.add(texture);
    }
    for(const texture of uploads){
      if(!combatArtworkReady(texture))continue;
      uploads.delete(texture);
      warmTexture(texture);
    }
  }
  return {
    prewarm,
    reset(){request=undefined;},
    open(supply,weapons,now){
      if(!supply)return null;
      const id=supply.pickupAt??supply.chestId??supply;
      if(id!==request?.id){
        prewarm();
        const wheel=!showsReceipts(supply);
        const slots=supply.slots??[];
        const cards=wheel?[...slots,...(supply.reward?[supply.reward]:[]),...(supply.rewards??[])]:supply.rewards;
        const icons=new Map(cards.map(card=>{
          const key=iconKey(card,weapons);
          return [key,textures.get(key)];
        }));
        const {frame,card,slot,button}=shared;
        const required=[...new Set([button,...(wheel?frame:[]),...(cards.length?[card,slot]:[]),...icons.values()])];
        request={id,startedAt:now,required,icons,retried:new Set(),result:wheel&&!slots.length?unavailable:null};
      }
      if(request.result)return request.result;
      const decoded=request.required.filter(combatArtworkReady);
      const uploaded=prepareTextures?.(decoded)??true;
      if(decoded.length===request.required.length){
        if(!uploaded)return null;
        request.result={icons:request.icons,shownAt:now};
        return request.result;
      }
      if(now-request.startedAt>=SUPPLY_ART_WAIT_MS||request.required.some(texture=>!texture)){
        return request.result=unavailable;
      }
      for(const texture of request.required){
        if(!texture.userData.artworkFailed)continue;
        if(request.retried.has(texture)||!retryCombatArtwork(texture,priority)){
          return request.result=unavailable;
        }
        request.retried.add(texture);
      }
      return null;
    },
  };
}

function paintSupplyPlate(surface,width,height,gradient) {
  const mesh=paintCombatArt(surface,'card',0,0,width,height);
  if(!gradient)return;
  const {material}=mesh;
  const [left,right]=gradient.map(value=>new Color(value));
  // Keep the PSD highlights and cut corners. Blend out its original blue fill
  // before applying the new color so the darker text area stays neutral.
  material.onBeforeCompile=shader=>{
    shader.uniforms.supplyColorLeft={value:left};
    shader.uniforms.supplyColorRight={value:right};
    shader.fragmentShader='uniform vec3 supplyColorLeft;\nuniform vec3 supplyColorRight;\n'+
      shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float down = 1.0 - vMapUv.y;
        vec3 body = mix(diffuseColor.rgb, vec3(.006,.009,.015), smoothstep(.34,.59,down));
        vec3 tint = mix(supplyColorLeft, supplyColorRight, smoothstep(0.0,1.0,vMapUv.x));
        diffuseColor.rgb = mix(body, tint, smoothstep(.53,1.0,down));`);
  };
  material.customProgramCacheKey=()=> 'supply-plate-gradient';
}

function renderSupplyResults({host,bridge,refs,supply,icons,place,text,button,surface}) {
  const rows=supplyResultRows(supply.rewards),layout=supplyResultLayout(rows.length);
  const root=new Container();root.label='supply-result-summary';host.addChild(root);
  place(root,text('补给奖励',{size:34,weight:'900',fill:0xf4f7fb,anchorX:.5}),300,186);
  const cards=[];
  for(const [i,row] of rows.entries()){
    const node=new Container();node.label='supply-result-row';
    node.position.set(layout.x,layout.top+i*(layout.height+layout.gap));root.addChild(node);
    const h=layout.height,w=layout.width,{gradient,accent}=row.plate;
    const outline=[16,0,w-24,0,w,24,w,h-16,w-16,h,0,h,0,16];
    const glow=new Graphics();glow.eventMode='none';
    if(row.breakthrough)glow.poly(outline).stroke({color:accent,width:13,alpha:.12}).stroke({color:accent,width:6,alpha:.3});
    node.addChild(glow);
    surface(node,s=>paintSupplyPlate(s,w,h,gradient));
    const border=new Graphics().poly(outline).stroke({color:accent,width:2,alpha:.95});node.addChild(border);
    const size=Math.min(128,h-22),iconY=(h-size)/2;
    surface(node,s=>paintCombatArt(s,'slot',12,iconY,size,size));
    const texture=icons.get(iconKey(row.card,bridge.game.fixedLoadout?.weapons));
    surface(node,s=>{
      const fit=upgradeIconLayout(texture,{x:22,y:iconY+10,width:size-20,height:size-20});
      s.image(texture,fit.x,fit.y,fit.width,fit.height,fit.crop);
    });
    const left=158,contentWidth=w-left-18;
    const title=text(row.name,{size:27,fill:0xf5f8fa,weight:'900'});
    if(title.width>contentWidth)title.scale.set(contentWidth/title.width);
    place(node,title,left,12);
    const marks=new Graphics();node.addChild(marks);
    const step=Math.min(25,(contentWidth-16)/row.marks);
    for(let j=0;j<row.marks;j++){
      const x=left+9+j*step,y=h>=160?58:53;
      marks.poly([x,y-7,x+7,y,x,y+7,x-7,y]).fill({color:j<row.lit?[0xffd54c,0xff7166,0x9de9ff][row.tier]:0x526477}).stroke({color:0x10202f,width:2});
    }
    const desc=text(row.description,{size:h>=160?23:21,fill:row.breakthrough?0xffdc78:0xe5f0f6,weight:'800',maxWidth:contentWidth,lineHeight:h>=160?29:25});
    place(node,desc,left,h>=160?83:73);
    const available=h-(h>=160?83:73)-12;
    if(desc.height>available){const scale=available/desc.height;desc.scale.set(scale);}
    cards.push({node,glow,y:node.position.y});
  }
  if(!rows.length)place(root,text('当前武器已无可用强化',{size:26,anchorX:.5,fill:0xe5f0f6}),300,610);
  root.addChild(button({x:104,y:layout.buttonY,width:392,height:92,variant:'primary',text:'继续战斗',fontSize:34,
    onPress:()=>{if(!supply.disabled)return bridge.claimBattleSupply();}}));
  refs.battleSupplyBoard={summaryRows:cards};
}

const WEAPON_ICON_CENTER = {x:145,y:113};
let glowTexture;

function weaponGlowTexture() {
  if (glowTexture) return glowTexture;
  const size = 128;
  const pixels = new Uint8Array(size * size * 4).fill(255);
  // Smooth falloff stays visible across the card and fades before its frame.
  for (let y = 0; y < size; y++) {
    const v = (y + .5) * 2 / size - 1;
    for (let x = 0; x < size; x++) {
      const u = (x + .5) * 2 / size - 1;
      const falloff = Math.max(0, 1 - u * u - v * v);
      pixels[(y * size + x) * 4 + 3] = Math.round(255 * falloff ** 2.3);
    }
  }
  glowTexture = new DataTexture(pixels, size, size);
  glowTexture.minFilter = glowTexture.magFilter = LinearFilter;
  glowTexture.needsUpdate = true;
  return glowTexture;
}

function weaponLight(center, surface, ready) {
  const texture = weaponGlowTexture();
  const layer = (width, height, tint, alpha) => {
    const node = new Container();
    node.position.set(WEAPON_ICON_CENTER.x, WEAPON_ICON_CENTER.y);
    node.eventMode = 'none';
    node.additive = true;
    node.tint = tint;
    node.alpha = alpha;
    surface(node, s => s.image(texture, -width / 2, -height / 2, width, height));
    center.addChild(node);
    return node;
  };

  const halo = layer(308, 220, ready ? 0xdf8a40 : 0x56adf3, .45);
  const sweep = layer(208, 112, ready ? 0xffcc88 : 0x9bdfff, .27);
  const core = layer(160, 144, ready ? 0xffe9bf : 0xe2f4ff, .2);
  return {halo, sweep, core};
}

function updateWeaponLight(board, now, supply, reduced) {
  // The pickup timestamp stays the same when the board switches to rolling.
  board.lightStartedAt ??= supply.pickupAt ?? now;
  const age = Math.max(0, (now - board.lightStartedAt) / 1000);
  const unfold = reduced ? 1 : 1 - (1 - Math.min(1, age / .48)) ** 3;
  const breathAngle = (age % 2.8) * (2 * Math.PI / 2.8);
  const breath = reduced ? .55 : .5 - .5 * Math.cos(breathAngle);
  const sweepAngle = Math.PI / 5 + (reduced ? 0 : (age % 5.6) * (2 * Math.PI / 5.6));
  const brightness = (supply.phase === 'ready' ? 1 : .92) * unfold;
  const {halo, sweep, core} = board.light;

  halo.scale.set(.74 + .29 * breath, .82 + .18 * breath);
  halo.alpha = (.36 + .17 * breath) * brightness;
  sweep.rotation = sweepAngle;
  sweep.position.set(
    WEAPON_ICON_CENTER.x + (reduced ? 0 : 24 * Math.cos(sweepAngle)),
    WEAPON_ICON_CENTER.y + (reduced ? 0 : 8 * Math.sin(sweepAngle)),
  );
  sweep.alpha = (.23 + .08 * breath) * brightness;
  core.alpha = (.17 + .07 * breath) * brightness;
}

export function renderBattleSupply({root:host,bridge,refs,artwork,place,text,button,backdrop,surface}) {
  const supply=bridge.game.battleSupply;
  if(!supply||!artwork?.icons)return;
  const {icons,shownAt}=artwork;
  const ready=supply.phase==='ready',rolling=supply.phase==='rolling';
  const gold=0xffda42;
  // Native UI_Punchboard has a stretched black Image with alpha 192/255.
  // The embedded battle owns its full-stage dimmer; no narrow black panel.
  backdrop(host,0x000000,192/255);
  if(showsReceipts(supply)){
    renderSupplyResults({host,bridge,refs,supply,icons,place,text,button,surface});return;
  }
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
  surface(root,s=>paintPsdPopupTitle(s,'primary','战斗补给',28,190,544,676));
  label(root,supply.subtitle || (supply.evolutionExhausted?'形态已满 · 获得武装强化':'精英击破 · 必得形态强化'),300,289,18,0x23415a);
  const icon=(parent,card,x,y,size)=>{
    const texture=icons.get(iconKey(card,bridge.game.fixedLoadout.weapons));
    surface(parent,s=>{
      const fit=upgradeIconLayout(texture,{x,y,width:size,height:size});
      s.image(texture,fit.x,fit.y,fit.width,fit.height,fit.crop);
    });
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
  const light=weaponLight(center,surface,ready);
  const hero=new Container();icon(hero,ready?supply.reward:supply.slots[0],0,0,216);hero.pivot.set(108,108);hero.position.set(WEAPON_ICON_CENTER.x,WEAPON_ICON_CENTER.y);center.addChild(hero);
  label(center,ready?'强化已锁定':'本局武装',145,221,23,ready?gold:0xe4edf7,264);
  root.addChild(center);
  const rewardProfile=upgradeFeedbackProfile(supply.reward);
  const sparks=new Container();sparks.position.set(300,571);root.addChild(sparks);
  if(ready)for(let i=0;i<16;i++){
    const spark=new Graphics().poly([0,-5,2,0,0,5,-2,0]).fill({color:i%2?gold:0x99e6ff});
    sparks.addChild(spark);
  }
  root.addChild(button({x:104,y:922,width:392,height:92,variant:'primary',
    text:ready?'继续战斗':rolling?'点击跳过':'开始',fontSize:34,
    onPress:()=>{if(supply.disabled)return;return ready?bridge.claimBattleSupply():rolling?bridge.skipBattleSupply():bridge.startBattleSupply();}}));
  refs.battleSupplyBoard={cells,light,hero,sparks,rewardProfile,lastStep:-1,entry:root,shownAt,pickup,
    pickupScale:pickup?.scale.x||1,pickupX:supply.pickupX,pickupY:supply.pickupY};
}

export function updateBattleSupply(refs,supply,now,onTick) {
  const board=refs.battleSupplyBoard;
  if(!board||!supply)return;
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(board.summaryRows){
    const age=Math.max(0,(now-(supply.revealedAt??now))/1000);
    board.summaryRows.forEach(({node,glow,y},i)=>{
      const t=reduced?1:Math.max(0,Math.min(1,(age-i*.12)/.24));
      node.alpha=t;node.position.y=y+(1-t)*16;
      glow.alpha=reduced?1:.83+.17*Math.sin(age*3-i*.4);
    });return;
  }
  const entryT=reduced?1:Math.max(0,Math.min(1,(now-(board.shownAt??supply.pickupAt??-Infinity))/360));
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
  updateWeaponLight(board, now, supply, reduced);
  const strong=board.rewardProfile?.stage>0;
  board.hero.scale.set(!reduced&&supply.phase==='ready'?1+(strong?.17:.1)*Math.exp(-5*t)*Math.sin(t*15):1);
  board.sparks.children.forEach((spark,i)=>{
    const a=i*Math.PI/8,r=80+Math.min(t,1.2)*120;
    spark.position.set(Math.cos(a)*r,Math.sin(a)*r);
    spark.alpha=reduced?0:Math.max(0,1-t/1.2);
  });
}

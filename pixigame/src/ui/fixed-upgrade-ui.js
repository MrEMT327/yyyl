import { Container, Graphics } from '../three/display.js';
import { fixedUpgradeView } from './fixed-upgrade-view.js';
import { createThreeSurface } from './three-surface.js';
import { upgradeCardView } from './upgrade-attack-card.js';
import { drawUpgradeWeaponIcon } from './upgrade-weapon-icon.js';
import { upgradeSummary } from './upgrade-summary.js';
import { confirmUpgradeCard } from './run-growth-feedback.js';
import { COMBAT_UI } from './combat-theme.js';
import { upgradeIconLayout, fitUpgradeIcon } from './upgrade-icon-layout.js';
import choiceIconCrops from './psd-choice-icon-crops.json' with { type: 'json' };
import { paintPsdChoiceArt } from './psd-choice-art.js';
import { drawUiSymbol } from './ui-symbols.js';
import { upgradeChoiceSlot } from './upgrade-choice-slots.js';

function attachSurface(parent,surface){const node=new Container();node.object3D.add(surface.group);node._disposeVisuals=()=>surface.destroy();parent.addChild(node);return node;}

function renderAirframeChoices({ root, bridge, art, makeText, place, makeButton, backdrop, choose }) {
  const state = bridge.game.fixedGrowth.state;
  // 三选一.psd is a 750×1624 composition. Only its UI layers are drawn here;
  // the live battlefield, aircraft and HUD keep their existing renderers.
  const scaleX = 600 / 750, scaleY = 1300 / 1624;
  const px = value => value * scaleX, py = value => value * scaleY;
  backdrop(root, COMBAT_UI.ink, .55);
  const panel = new Container({ label: 'run-upgrade-choices' }); root.addChild(panel);
  const text = (parent, value, x, y, size, fill, extra = {}) =>
    place(parent, makeText(value, { size, fill, ...extra }), x, y);
  const banner = createThreeSurface();
  paintPsdChoiceArt(banner, 'banner', px(-3), py(253), px(756), py(239));
  attachSurface(panel, banner);
  text(panel, '强化升级', px(375), py(348), 38, COMBAT_UI.text, {anchorX:.5,weight:'900'});

  const offers = bridge.presentation?.choices || bridge.currentUpgradeChoices.slice(0, 3).map(skill => {
    const weapon = bridge.game.fixedLoadout.weapons.find(w => w.id === skill.ownerId);
    const model = upgradeCardView(skill, weapon, bridge.game.fixedGrowth);
    const lines = upgradeSummary(skill, model);
    const summary = (skill.key === 'evolve-1' ? lines.at(-1) : lines[0]) || '';
    return {skill, model, summary, slots: weapon.slots || []};
  });
  for (const offer of offers) offer.recipientMarker = offers.some(other =>
    other.model.itemId === offer.model.itemId && other.model.ownerId !== offer.model.ownerId)
    ? offer.slots.join('/') || offer.model.owner : '';

  const width = px(224), height = py(562);
  offers.forEach(({skill,model,summary,recipientMarker}, index) => {
    const frame = upgradeChoiceSlot(index,offers.length);
    const card = makeButton({x:px(frame.x),y:py(frame.y),width,height,
      fill:0x0d1521,fillAlpha:0,strokeAlpha:0,pressedFill:0x20384a,
      onPress:() => choose(card,width,height,skill)});
    card.__fixedCardId = skill.id; card.__fixedOwnerId = skill.ownerId;
    card.__upgradeConfirmRect = {x:3,y:3,width:width-6,height:height-6};
    card.__fixedUpgradeView = bridge.presentation ? model : fixedUpgradeView(skill,state);
    card.cardSnapshot = () => ({...model,summary,recipientMarker,presentation:'psd-three-choice'});
    const surface = createThreeSurface({textResolution:3});
    paintPsdChoiceArt(surface,frame.art,0,0,width,height);
    const texture = art?.get(model.itemId);
    if (texture) {
      const source=choiceIconCrops[model.itemId];
      const crop=source&&{x:source.crop[0],y:source.crop[1],width:source.crop[2],height:source.crop[3]};
      const icon=crop?{...fitUpgradeIcon(...source.size,crop,{x:15,y:92,width:148,height:134}),crop}
        :upgradeIconLayout(texture,{x:15,y:92,width:148,height:134});
      surface.image(texture,icon.x,icon.y,icon.width,icon.height,icon.crop)
        .material.toneMapped = !texture.userData.inventoryIcon;
    } else drawUpgradeWeaponIcon(surface,model.itemId,31,104,118);
    for(let i=0;i<(model.qualityKnown===false?0:Math.min(6,model.qualityRank+1));i++)
      drawUiSymbol(surface,'star',14+i*16,height-27,14,'#e9f5ff');
    attachSurface(card,surface);
    const name = text(card,model.name,width/2,19,23,COMBAT_UI.text,{anchorX:.5,weight:'900'});
    if(name.width>width-20)name.scale.set((width-20)/name.width);
    const badge = model.evolving ? '进化' : model.terminal ? '觉醒' : '强化';
    text(card,badge,width/2,44,14,0xc7e0f1,{anchorX:.5,weight:'800'});
    const label = text(card,bridge.presentation?'':model.change?.label || model.stat.label,width/2,268,19,COMBAT_UI.text,{anchorX:.5,weight:'800'});
    if(label.width>width-18)label.scale.set((width-18)/label.width);
    const value = bridge.presentation ? '' : model.evolving ? model.stat.after : model.change?.value || '效果增强';
    const valueNode = text(card,value,width/2,296,29,[0xff727b,0x6ac9fa,0xd09afa][index],{anchorX:.5,weight:'900'});
    if(valueNode.width>width-16)valueNode.scale.set((width-16)/valueNode.width);
    if(bridge.presentation && summary) {
      addEffectText(card,[{text:summary,strong:true}],13,276,width-26,13,COMBAT_UI.text,makeText,place);
    } else if(model.evolving && summary) {
      const shortEffect=summary.length>19?`${summary.slice(0,18)}…`:summary;
      addEffectText(card,[{text:shortEffect,strong:true}],13,334,width-26,13,COMBAT_UI.text,makeText,place);
    }
    if(recipientMarker) {
      const marker = text(card,recipientMarker,width/2,65,13,0xc5d5e5,{anchorX:.5});
      if(marker.width>width-16)marker.scale.set((width-16)/marker.width);
    }
    const footer = text(card,model.label || '技能强化',width-10,height-61,18,COMBAT_UI.text,{anchorX:1,weight:'900'});
    if(footer.width>width-24)footer.scale.set((width-24)/footer.width);
    text(card,`Lv.${model.level} → ${model.nextLevel}`,width-10,height-27,12,0xd3e7f6,{anchorX:1,weight:'800'});
    panel.addChild(card);
  });
  text(panel,state.pendingLevels>1?`从上方选择一个技能学习 · 待选 ${state.pendingLevels} 次`:'从上方选择一个技能学习',
    px(375),py(1115),22,COMBAT_UI.text,{anchorX:.5,weight:'900'});
  if(bridge.presentation?.reroll === false)return;
  const totalRerolls = state.totalRerolls ?? 2;
  const reroll = makeButton({x:px(262),y:py(1205),width:px(219),height:py(85),radius:0,
    fill:0x17274d,fillAlpha:0,strokeAlpha:0,
    text:`换一批 ${Math.max(0,totalRerolls-state.rerolls)}/${totalRerolls}`,
    textColor:COMBAT_UI.text,fontSize:24,disabled:!state.rerolls,
    onPress:()=>bridge.rerollFixedUpgrade()});
  const rerollSurface=createThreeSurface();
  paintPsdChoiceArt(rerollSurface,'reroll',0,0,px(219),py(85));
  const rerollSkin=attachSurface(reroll,rerollSurface);
  reroll.setChildIndex(rerollSkin,1);
  rerollSkin.alpha=state.rerolls?1:.45;
  reroll.__fixedReroll = true;
  panel.addChild(reroll);
}

// Wrap styled text with the same font metrics as the existing text renderer.
// Render a run per style rather than a separate mesh for every character.
function addEffectText(parent, runs, x, y, width, size, ink, makeText, place) {
  const style = makeText('', {size}).style;
  const context = (globalThis.wx?.createCanvas?.() || document.createElement('canvas')).getContext('2d');
  const lineHeight = Math.ceil(style.fontSize * 1.4);
  let cursor = 0, row = 0, buffer = '', activeColor = null, activeWeight = null, start = 0;
  const flush = () => {
    if (buffer && parent) place(parent, makeText(buffer,{size,fill:activeColor,weight:activeWeight}),x+start,y+row*lineHeight);
    buffer='';start=cursor;
  };
  for (const run of runs) {
    const fill = run.cost ? 0xa05b32 : run.strong ? ink : 0x42586a;
    const weight = run.strong || run.cost ? '900' : '600';
    if (fill!==activeColor || weight!==activeWeight) {flush();activeColor=fill;activeWeight=weight;}
    context.font = `${weight} ${style.fontSize}px ${style.fontFamily}`;
    for (const char of run.text) {
      const advance=context.measureText(char).width;
      if(cursor+advance>width) {flush();row++;cursor=0;start=0;}
      buffer+=char;cursor+=advance;
    }
  }
  flush();return (row+1)*lineHeight;
}

export function renderFixedUpgradeUi({ root, bridge, art, makeText, place, makeButton, backdrop }) {
  let confirming = false;
  const originalButton = makeButton;
  makeButton = options => originalButton({...options,onPress:()=>{if(!confirming)options.onPress?.();}});
  const choose = (card,width,height,skill) => {
    if (confirming || bridge.game.state !== 'levelup') return;
    confirming = true;
    if(bridge.presentation){bridge.chooseSkill(skill);confirmUpgradeCard(card,width,height,()=>{confirming=false;},()=>bridge.game.state==='levelup',skill);return;}
    confirmUpgradeCard(card,width,height,()=>{confirming=false;bridge.chooseSkill(skill);},()=>bridge.game.state==='levelup',skill);
  };
  if(bridge.presentation || bridge.currentUpgradeChoices.every(skill=>skill.airframe))return renderAirframeChoices({root,bridge,art,makeText,place,makeButton,backdrop,choose});
  const state=bridge.game.fixedGrowth.state;
  backdrop(root,0x050d18,.90);
  const text=(parent,value,x,y,size,fill,extra={})=>place(parent,makeText(value,{size,fill,...extra}),x,y);
  const plate=(parent,x,y,w,h,fill,radius=10)=>parent.addChild(new Graphics().roundRect(x,y,w,h,radius).fill({color:fill}));

  const cardWidth=536, bodyX=130, bodyWidth=cardWidth-bodyX-20, bodyTop=88, bodySize=19;
  const choices=bridge.currentUpgradeChoices.map(skill=>{
    const model=fixedUpgradeView(skill,state);
    const bodyHeight=model.lines.reduce((h,line)=>h+addEffectText(null,line,0,0,bodyWidth,bodySize,model.ink,makeText,place)+3,0);
    return {skill,model,bodyHeight,height:Math.max(150,bodyTop+bodyHeight+(model.restriction?27:0)+19)};
  });
  // Keep each offer centered as one panel. Cards grow only when their text
  // needs another line; short upgrades no longer leave a large empty block.
  const headerHeight=90, gap=14, footerHeight=102;
  const height=headerHeight+choices.reduce((h,c)=>h+c.height,0)+gap*Math.max(0,choices.length-1)+footerHeight;
  const top=Math.round((1300-height)/2);
  plate(root,16,top+8,568,height,0x020913,18);
  const panel=plate(root,16,top,568,height,0x132337,18);
  panel.stroke({color:0x41596d,width:1,alpha:.75});
  root.addChild(new Graphics().moveTo(40,top+73).lineTo(560,top+73).stroke({color:0x5d7285,width:1,alpha:.4}));
  text(root,'升级',40,top+20,34,0xf4f1e8,{weight:'900'});
  plate(root,454,top+22,106,40,0x25384a,8);
  text(root,`Lv.${state.level}`,507,top+27,22,0xf2d399,{anchorX:.5});
  if(state.pendingLevels>1)text(root,`还可选 ${state.pendingLevels} 次`,143,top+37,16,0xa9bdd0);

  let cardY=top+headerHeight;
  for(const {skill,model,bodyHeight,height:cardHeight} of choices) {
    const card=makeButton({x:32,y:cardY,width:cardWidth,height:cardHeight,radius:10,
      fill:0xeaf0ed,pressedFill:0xd8e3e7,stroke:model.tint,strokeAlpha:.5,onPress:()=>choose(card,cardWidth,cardHeight,skill)});
    card.__fixedCardId=skill.id;card.__fixedUpgradeView=model;
    card.addChild(new Graphics().roundRect(0,8,4,cardHeight-16,2).fill({color:model.tint}));
    const iconPlate=plate(card,16,20,96,96,0x142437,9);
    iconPlate.stroke({color:model.tint,alpha:.32,width:1});
    const texture=art.get(model.icon);
    if(texture) {
      const icon=new Container(), surface=createThreeSurface();
      surface.image(texture,-5,24,138,138*154/240).material.toneMapped=true;
      icon.object3D.add(surface.group);icon._disposeVisuals=()=>surface.destroy();card.addChild(icon);
    }
    text(card,model.owner,bodyX,17,18,0x617684);
    text(card,model.levelText,cardWidth-20,17,18,model.ink,{anchorX:1,weight:'900'});
    text(card,model.skillName,bodyX,46,25,0x182a3d,{weight:'900'});
    if(model.badge) {
      plate(card,34,128,60,25,skill.terminal?0xf0d6a2:0xdcd6ee,5);
      text(card,model.badge,64,131,13,skill.terminal?0x7b531c:0x665386,{anchorX:.5});
    }
    let y=bodyTop;
    for(const line of model.lines)y+=addEffectText(card,line,bodyX,y,bodyWidth,bodySize,model.ink,makeText,place)+3;
    if(model.restriction)text(card,model.restriction,bodyX,bodyTop+bodyHeight+7,13,skill.terminal?0x8e621f:0x738391);
    root.addChild(card);
    cardY+=cardHeight+gap;
  }
  const buttonY=top+height-footerHeight+24;
  const reroll=makeButton({x:32,y:buttonY,width:350,height:60,radius:8,text:`换一批 · 剩 ${state.rerolls} 次`,fontSize:21,
    fill:0xb7d7e4,pressedFill:0x94baca,stroke:0xd0e7ef,strokeAlpha:.4,textColor:0x183345,disabled:!state.rerolls,
    onPress:()=>bridge.rerollFixedUpgrade()});
  reroll.__fixedReroll=true;root.addChild(reroll);
  root.addChild(makeButton({x:396,y:buttonY,width:172,height:60,radius:8,text:'结束本局',fontSize:18,
    fill:0x1a2b3e,stroke:0x506479,strokeAlpha:.45,textColor:0xa8b8c8,onPress:()=>bridge.endGame(false,true)}));
}

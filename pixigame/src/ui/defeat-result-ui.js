import { Container, Rectangle } from '../three/display.js';
import { TextureLoader, CanvasTexture, SRGBColorSpace, LinearFilter } from 'three';
import { paintPsdPopup } from './psd-popup-art.js';
import { paintPsdPopupTitle } from './psd-popup-title.js';
import { drawUiSymbol } from './ui-symbols.js';
import { defeatResultModel } from './defeat-result-model.js';
import { upgradeIconLayout } from './upgrade-icon-layout.js';
import { defeatResultLayout } from './defeat-result-layout.js';
import { defeatMotion } from './defeat-result-motion.js';
import { paintRewardItemSlot } from './reward-item-slot.js';
import { cloudAssetBase } from './cloud-asset-base.js';
import { paintDefeatSection } from './defeat-section-frame.js';
import { nineSliceGeometry } from './nine-slice-geometry.js';
import { victoryResultModel } from './victory-result-model.js';
import { victoryMotion } from './victory-result-motion.js';

const textures = new Map();
const defeatHeaderUrl = `${cloudAssetBase}art/defeat-header-v1/damaged-aircraft.png`;
const defeatBadgeUrl = `${cloudAssetBase}art/defeat-wave-badge-v1/badge.png`;
const victoryHeaderUrl = `${cloudAssetBase}art/victory-result-v1/victory-aircraft.png`;
const victoryBadgeUrl = `${cloudAssetBase}art/victory-result-v1/wave-badge.png`;
const victoryStarUrl = `${cloudAssetBase}art/project-ui-icons-v1/star.png`;
const victoryRaysUrl = `${cloudAssetBase}art/project-research-draw-reference-v5/reveal-rays.png`;
export function preloadDefeatArt() {
  for (const url of [defeatHeaderUrl,defeatBadgeUrl,victoryHeaderUrl,victoryBadgeUrl,victoryStarUrl,victoryRaysUrl]) {
    if (textures.has(url)) continue;
    const texture = new TextureLoader().load(url);
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    textures.set(url, texture);
  }
}
let smokeTexture;
function smokeArt() {
  if(smokeTexture)return smokeTexture;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=96;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(48,48,3,48,48,47);
  gradient.addColorStop(0,'rgba(166,170,181,.8)');gradient.addColorStop(.45,'rgba(111,119,133,.5)');gradient.addColorStop(1,'rgba(64,74,89,0)');
  ctx.fillStyle=gradient;ctx.fillRect(0,0,96,96);smokeTexture=new CanvasTexture(canvas);smokeTexture.colorSpace=SRGBColorSpace;return smokeTexture;
}
export function icon(surface, url, x, y, width, height, fit = true) {
  if (!textures.has(url)) {
    const texture = new TextureLoader().load(url);
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    texture.userData.inventoryIcon = true;
    texture.userData.skillIconUrl = url;
    textures.set(url, texture);
  }
  const texture = textures.get(url);
  const mesh = surface.image(texture, x, y, width, height);
  if (!fit) return mesh;
  let fittedImage;
  mesh.onBeforeRender = () => {
    const image = texture.image;
    if (!image?.width || !image?.height || fittedImage === image) return;
    fittedImage = image;
    const fit = upgradeIconLayout(texture, {x,y,width,height});
    mesh.position.set(fit.x + fit.width / 2, fit.y + fit.height / 2, 0);
    mesh.scale.set(fit.width, -fit.height, 1);
    if (fit.crop) {
      const coordinates = mesh.geometry.attributes.uv, crop = fit.crop;
      for (let index = 0; index < coordinates.count; index++) coordinates.setXY(index,
        crop.x + coordinates.getX(index) * crop.width, 1 - crop.y - (1 - coordinates.getY(index)) * crop.height);
      coordinates.needsUpdate = true;
    }
  };
  return mesh;
}

export function renderDefeatResult(root, bridge, {surface, button, backdrop, victory=false}) {
  const key=bridge.presentation?.result?.runId??bridge.game.runId??(victory?bridge.game.completionSummary:bridge.game.defeatReward);
  if(bridge.ui.defeatReceiptKey!==key||bridge.ui.resultVictory!==victory){
    bridge.ui.resultVictory=victory;
    bridge.ui.defeatReceiptKey=key;bridge.ui.defeatRewardPage=0;bridge.ui.defeatStats=false;
    bridge.ui.defeatStartedAt=performance.now();
  }
  bridge.ui.defeatStartedAt??=performance.now();
  const model=(victory?victoryResultModel:defeatResultModel)(bridge,bridge.ui.defeatRewardPage),layout=defeatResultLayout(model);
  if(victory&&model.showAd){layout.ad={x:layout.rewards.x,y:layout.buttonTop,width:layout.rewards.width,height:66};layout.confirm.y+=80;layout.stats.y+=80;}
  backdrop(root,0x090d1e,.78);
  const panel=new Container();panel.label=victory?'battle-victory-panel':'battle-defeat-panel';panel.resultSnapshot=model;
  const fit=Math.min(1,1274/(layout.confirm.y+layout.confirm.height));panel.pivot.set(300,0);panel.position.x=300;panel.scale.set(fit);
  panel.motion={victory,layers:[],smoke:[],stars:[],sparks:[],buttons:[],start:bridge.ui.defeatStartedAt};root.addChild(panel);
  const layer=(name,delay,draw)=>{const n=new Container();n.label=name;panel.addChild(n);surface(n,draw);panel.motion.layers.push({n,delay});return n;};
  if(victory){
    const glow=layer('victory-rays',0,s=>{const mesh=icon(s,victoryRaysUrl,-285,-285,570,570,false);mesh.material.color.set('#ffd684');});
    panel.motion.glow=glow;
  }
  layer('result-body',victory?.38:.5,s=>{
    paintPsdPopup({image(...args){const mesh=s.image(...args);mesh.material.color.set('#536d82');return mesh;}},'primary',layout.x,layout.y,layout.width,layout.height);
  });
  const hero=layer('defeat-aircraft',0,s=>{
    // Original generated defeat insignia. Its plaque stays blank for live text.
    icon(s,victory?victoryHeaderUrl:defeatHeaderUrl,18,132,564,282,false);
  });
  panel.motion.hero=hero;
  for(let i=0;!victory&&i<6;i++){
    const puff=layer('defeat-smoke-'+i,.1,s=>s.image(smokeArt(),-35,-35,70,70));
    panel.motion.smoke.push({n:puff,index:i});
  }
  const banner=layer('defeat-banner',.18,s=>{
    s.text(victory?'战斗胜利':'战斗失败',300,367,{size:46,color:victory?'#fff0b2':'#edf3f7',weight:900,align:'center'});
  });panel.motion.banner=banner;
  layer('defeat-score',.72,s=>{
    if(victory){
      icon(s,victoryBadgeUrl,157,412,286,286*2/3,false);
      s.text(`第 ${model.chapter} 章`,300,452,{size:25,weight:900,align:'center',maxWidth:134});
      s.text(String(model.wave),300,509,{size:66,color:'#ffda76',weight:900,align:'center',maxWidth:118});
      s.text('波次',300,565,{size:23,weight:900,align:'center',maxWidth:80});
      return;
    }
    // Approved illustrated badge, with blank plates for live chapter/wave data.
    // Keep its 1536:1024 aspect ratio; do not reconstruct its silhouette in code.
    icon(s,defeatBadgeUrl,122,411,356,356*2/3,false);
    s.text(`第 ${model.chapter} 章`,300,461,{size:27,weight:900,align:'center',maxWidth:160});
    s.text(String(model.wave),301.5,535,{size:86,color:'#102b46',weight:900,align:'center',maxWidth:138});
    s.text(String(model.wave),300,533,{size:86,color:'#ffcf62',weight:900,align:'center',maxWidth:138});
    s.text('波次',300,602,{size:25,weight:900,align:'center',maxWidth:88});
  });
  if(victory){
    for(let i=0;i<3;i++){
      const earned=i<model.stars,size=i===1?60:52,cx=300+(i-1)*70;
      const star=layer('victory-star-'+i,.62+i*.18,s=>{
        const mesh=icon(s,victoryStarUrl,-size/2,-size/2,size,size,false);
        if(!earned)mesh.material.color.set('#34495b');
      });
      panel.motion.stars.push({n:star,index:i,cx,earned});
    }
    for(let i=0;i<14;i++){
      const size=7+i%4*3;
      const spark=layer('victory-spark-'+i,.3,s=>icon(s,victoryStarUrl,-size/2,-size/2,size,size,false));
      panel.motion.sparks.push({n:spark,index:i});
    }
  }
  layer('defeat-kills',.93,s=>{
    const k=layout.kills,r=layout.rewards,cy=k.y+k.height/2;
    paintDefeatSection(s,k,{cut:20,fill:'#142636'});
    drawUiSymbol(s,'target',145,cy-15,30,'#d5e4ef');
    s.text('击败敌人',190,cy,{size:28,weight:800});s.text(String(model.kills),423,cy,{size:32,weight:900,align:'center'});
    paintDefeatSection(s,r,{header:layout.rewardHeaderHeight});
    s.text(model.heading,300,r.y+23,{size:29,weight:800,align:'center'});
    if(!model.rewards.length)s.text(model.empty,layout.rewardContent.x+layout.rewardContent.width/2,
      layout.rewardContent.y+layout.rewardContent.height/2,{size:23,color:'#d1dce8',align:'center'});
  });
  model.rewards.forEach((row,i)=>{
    const columns=Math.min(5,model.rewards.length-Math.floor(i/5)*5),size=layout.rewardSize,gap=14;
    const x=layout.rewardContent.x+(layout.rewardContent.width-columns*size-(columns-1)*gap)/2+i%5*(size+gap),
      y=layout.rewardTop+Math.floor(i/5)*layout.rewardStride;
    const reward=layer('defeat-reward-'+i,1.05+i*.055,s=>paintRewardItemSlot(s,row,{x,y,size},icon));
    reward.eventMode='static';reward.cursor='pointer';reward.hitArea=new Rectangle(x,y,size,size);
    reward.on('pointertap',()=>{if(panel.motion.ready&&!bridge.ui.defeatStats)bridge.showItemDescription?.(row);});
  });
  layer('defeat-recommendations',1.3,s=>{
    const y=layout.recommendationTop;
    if(victory){
      paintDefeatSection(s,layout.recommendations);
      model.stats.slice(0,2).forEach(([name,value],i)=>{
        const cx=300+(i-(Math.min(2,model.stats.length)-1)/2)*240;
        s.text(`${name}  ${value}`,cx,y+44,{size:25,weight:700,align:'center',maxWidth:225});
      });
      model.unlocks.forEach((name,i)=>s.text(`已解锁 · ${name}`,300,y+88+i*32,{size:23,color:'#ffda76',align:'center',maxWidth:500}));
    }
    if(model.recommendations.length){
      paintDefeatSection(s,layout.recommendations);
      const stride=layout.recommendations.height/layout.recommendationRows;
      for(let rowIndex=0;rowIndex<layout.recommendationRows;rowIndex++){
        const rows=model.recommendations.slice(rowIndex*4,rowIndex*4+4),size=71,gap=6,labelWidth=140;
        const start=(600-labelWidth-rows.length*(size+gap))/2,top=y+rowIndex*stride;
        s.text(`${model.recommendationTitle}：`,start,top+stride/2,{size:25,weight:800,maxWidth:labelWidth});
        rows.forEach((row,i)=>{
          const x=start+labelWidth+i*(size+gap),y=top+(stride-size)/2;
          const frame=icon(s,`${cloudAssetBase}art/psd-equipment-v1/frame-gray.png`,x,y,size,size,false);
          frame.geometry.dispose();
          frame.geometry=nineSliceGeometry(size,size,128,128,18,size*.125);
          icon(s,row.image,x+size*.1,y+size*.1,size*.8,size*.8);
        });
      }
    }
    if(model.pageCount>1)s.text(`${model.page+1} / ${model.pageCount}`,300,layout.pagerTop+24,{size:22,align:'center'});
  });
  const control=o=>{const n=button({...o,onPress:()=>{if(panel.motion.ready&&!bridge.ui.defeatStats)o.onPress();}});panel.addChild(n);panel.motion.buttons.push({n,disabled:!!o.disabled});return n;};
  if(model.pageCount>1)for(const [text,dir,x]of[['‹',-1,164],['›',1,366]])control({x,y:layout.pagerTop+4,width:70,height:44,text,fontSize:30,variant:'secondary',disabled:model.page+dir<0||model.page+dir>=model.pageCount,onPress:()=>{bridge.ui.defeatRewardPage=model.page+dir;bridge.pixiCombatUi?.render();}});
  if(layout.ad)control({...layout.ad,text:model.adPending?'广告播放中…':'看广告 · 货币奖励翻倍',fontSize:25,variant:'secondary',disabled:model.adPending,onPress:()=>bridge.requestAdVictoryDouble?.()});
  control({...layout.confirm,text:model.pending?'保存并返回':'确定',fontSize:35,variant:'primary',disabled:model.adPending,onPress:()=>{bridge.ui.defeatRewardPage=0;bridge.finishBattleResult();}});
  const statsButton=control({...layout.stats,text:'',art:'statsControl',artCorner:14,variant:'secondary',onPress:()=>{bridge.ui.defeatStats=true;bridge.pixiCombatUi?.render();}});
  statsButton.hitArea=new Rectangle((layout.stats.width-112)/2,(layout.stats.height-112)/2,112,112);
  const statsIconSize=52;
  statsButton.__combatLabel=victory?'战斗统计':'伤害统计';
  surface(statsButton,s=>drawUiSymbol(s,'stats',(layout.stats.width-statsIconSize)/2,(layout.stats.height-statsIconSize)/2,statsIconSize,'#e0edff'));
  if(bridge.ui.defeatStats){
    backdrop(root,0x080e18,.6);const stats=new Container();stats.label='defeat-stats';root.addChild(stats);
    surface(stats,s=>{s.quad(-500,0,1600,1300,'#080e18',.56);paintPsdPopup(s,'primary',48,365,504,570);paintPsdPopupTitle(s,'primary',victory?'战斗统计':'伤害统计',48,365,504,570);
      if(victory)model.allStats.forEach(([name,value],i)=>{
        const x=80+(i%2)*230,y=480+Math.floor(i/2)*48;
        s.text(`${name}  ${value}`,x,y,{size:21,color:'#173449',maxWidth:215});
      });
      const rows=bridge.presentation?.damage||[],total=rows.reduce((sum,r)=>sum+r.damage,0);
      if(!rows.length)s.text('暂无伤害记录',300,610,{size:26,color:'#29465c',align:'center'});
      rows.slice(0,victory?5:6).forEach((r,i)=>{
        const y=(victory?592:486)+i*(victory?44:54);
        if(r.itemId)icon(s,r.itemId,80,y-21,42,42);
        s.text(r.name,136,y,{size:23,color:'#173449',maxWidth:190});
        s.text(`${Math.round(r.damage)} · ${Math.round(total?r.damage/total*100:0)}%`,518,y,{size:22,color:'#173449',align:'right',maxWidth:180});
      });
    });
    stats.addChild(button({x:190.5,y:812,width:219,height:85,text:'返回',fontSize:27,variant:'secondary',artCorner:18,
      onPress:()=>{bridge.ui.defeatStats=false;bridge.pixiCombatUi?.render();}}));
  }
  updateDefeatResult(panel,performance.now(),bridge);
  return panel;
}
export function updateDefeatResult(panel,now,bridge) {
  if(!panel?.motion)return;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,m=panel.motion;
  const p=(m.victory?victoryMotion:defeatMotion)((now-m.start)/1000,reduced);m.ready=p.ready;
  for(const {n,delay}of m.layers){const a=p.reveal(delay);n.alpha=a;n.position.y=16*(1-a);}
  // The generated crest includes its plaque; keep its edges level as it settles.
  m.hero.pivot.set(300,280);m.hero.position.set(300,280+p.heroY*(m.victory?1:.28));
  if(m.victory){
    m.hero.scale.set(p.heroScale);
    m.glow.position.set(300,230);m.glow.rotation=p.glowRotation;m.glow.alpha=p.glowAlpha;
    for(const {n,index,cx,earned} of m.stars){const star=p.star(index);n.position.set(cx,622);n.alpha=earned?star.alpha:.5;n.scale.set(earned?star.scale:1);}
    for(const {n,index} of m.sparks){
      const t=p.sparkTime-index*.025,life=Math.max(0,Math.min(1,t/1.5)),angle=-Math.PI+(index/13)*Math.PI;
      const distance=50+life*(160+index%3*25);
      n.position.set(300+Math.cos(angle)*distance,230+Math.sin(angle)*distance+life*life*110);
      n.rotation=life*(index%2?2:-2);n.alpha=t<0||t>1.5?0:Math.sin(life*Math.PI)*.85;n.scale.set(1-life*.5);
    }
  }
  m.banner.pivot.set(300,370);m.banner.position.set(300,370);m.banner.scale.set(p.bannerScale);
  for(const {n,index}of m.smoke){const f=(p.smokeTime*.24+index/6)%1;n.position.set(351+Math.sin(index*2+f*3)*9,213-f*76);n.scale.set(.23+f*.38);n.alpha=reduced?0:(1-f)*.36*p.reveal(.05);}
  for(const {n,disabled}of m.buttons){n.alpha=p.reveal(1.25);n.enabled=p.ready&&!disabled&&!bridge.ui.defeatStats&&!bridge.game.victoryRewardDoubleNotice;}
}

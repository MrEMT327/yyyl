import {updateBossHealth} from './boss-health.js';
import {updateBossHitMotion} from './boss-hit-motion.js';
import {BOSS_BAR,BOSS_WARNING_LAYER,bossWarningFrame,drawBossWarning,drawBossHealthBar} from './boss-encounter-hud.js';
import {projectBattleInterfaceIcon} from './project-battle-interface-art.js';
import { cloudAssetBase } from './cloud-asset-base.js';
import { Container, Rectangle, Sprite, Texture } from '../three/display.js';
import { releaseOwnedCanvas } from './release-owned-canvas.js';
import { battleProgress } from './battle-progress.js';
import { COMBAT_TYPE } from './combat-theme.js';
import { PLAYER_LOW_HEALTH_RATIO,PLAYER_LOW_HEALTH_COLOR,playerHealthFrame } from '../replica/player-health-display.js';
import { waveNoticeAlpha } from './wave-notice.js';
import { RESOURCE_ICONS } from './resource-icons.js';

// PSD coordinates are authoritative. Only the presentation is scaled to the
// existing 600 × 1300 combat scene; the world and flight input stay untouched.
const W = 750, H = 1624;
const PLAYER_HEALTH_FILL_WIDTH = 694;
const assets = new Map();
const loaded = new Set();
let loadedImages=new Map(), loadedImageCount=-1;
const lowHealthArt = new WeakMap();
// Pause/upgrade rebuilds the HUD. Keep only numerical tween state with its
// bridge so a rebuilt canvas resumes the same battle-clock animation.
const bossHealthStates = new WeakMap();
const bossHitStates = new WeakMap();
const definitions = {
  pause:[4,16,132,132], stats:[460,36,273,111], grade:[133,50,163,63],
  'stats-coins':[460,36,273,111], coins:[469,99,35,40],
  wave:[182,193,387,47], combo:[266,250,218,68],
  'progress-track':[472,152,248,14], 'progress-fill':[472,152,206,14],
  'health-track':[29,1550,688,39], 'health-fill':[31,1550,557,39],
  heart:[42,1542,58,50], 'level-decoration':[70,1518,34,35],
};
const extraAssets={
  'encounter-boss':projectBattleInterfaceIcon('bossProgress_icon'),
  'encounter-warning':`${cloudAssetBase}art/project-enemy-markers-v1/warning.svg`,
  'encounter-frame':`${cloudAssetBase}art/weapon-catalog-psd-v1/frame-blue.png`,
};
function loadAssets() {
  const loadImageSurface = globalThis.__THUNDER_RUNTIME_GLOBALS__?.loadImageSurface;
  for (const name of [...Object.keys(definitions),...Object.keys(extraAssets)]) {
    if (assets.has(name)) continue;
    const url = name === 'coins' ? RESOURCE_ICONS.coins.url : extraAssets[name] || `${cloudAssetBase}art/psd-combat-v1/${name}.png`;
    if (loadImageSurface) {
      // Reserve the slot while the shared loader resolves the package or CDN.
      assets.set(name, null);
      loadImageSurface(url).then(image => {
        assets.set(name, image);
        loaded.add(name);
      }, () => assets.delete(name));
      continue;
    }
    const image = new Image();
    assets.set(name, image);
    image.onload = () => loaded.add(name);
    image.onerror = () => assets.delete(name);
    image.src = url;
  }
}
function canvasLayer(parent, y, height, width = W, nativeTile = false) {
  // Native HUD tiles share their backing surface with the screen painter.
  const canvas = (!nativeTile && globalThis.wx?.createCanvas?.()) || document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const sprite = new Sprite(Texture.from(canvas));
  const destroy = sprite.destroy.bind(sprite);
  sprite.destroy = options => {
    if (sprite.destroyed) return;
    sprite.texture.destroy(true); destroy(options); releaseOwnedCanvas(canvas);
  };
  sprite.y = y; sprite.eventMode = 'none'; parent.addChild(sprite);
  return {canvas, ctx:canvas.getContext('2d'), sprite, key:null};
}
// Cache one recoloured copy of the supplied PSD fill. Preserve its alpha,
// bevel, dark outline and bright highlights; the source image stays untouched.
function lowHealthFill(image) {
  if(lowHealthArt.has(image))return lowHealthArt.get(image);
  const canvas=globalThis.wx?.createCanvas?.()||document.createElement('canvas');
  canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
  const red=PLAYER_LOW_HEALTH_COLOR>>16&255,green=PLAYER_LOW_HEALTH_COLOR>>8&255,blue=PLAYER_LOW_HEALTH_COLOR&255;
  for(let i=0;i<data.length;i+=4){
    if(!data[i+3])continue;
    const r=data[i],g=data[i+1],b=data[i+2];
    const light=Math.sqrt((.2126*r+.7152*g+.0722*b)/255),highlight=(Math.min(r,g,b)/255)**4;
    data[i]=Math.round(red*light);
    data[i+1]=Math.round((green+(255-green)*highlight)*light);
    data[i+2]=Math.round((blue+(255-blue)*highlight)*light);
  }
  ctx.putImageData(pixels,0,0);lowHealthArt.set(image,canvas);return canvas;
}
function artwork(ctx, name, offsetY = 0, ratio = 1, critical = false) {
  const image = assets.get(name);
  if (!loaded.has(name)) return;
  const [x,y,w,h] = definitions[name];
  ctx.save();
  if (['combo','level-decoration'].includes(name)) {
    ctx.shadowColor='#28dcff';ctx.shadowBlur=8;
  }
  ctx.drawImage(critical&&name==='health-fill'?lowHealthFill(image):image,x,y-offsetY,w*ratio,h);
  ctx.restore();
}
function drawPlayerHealthBar(ctx, ratio, offsetY) {
  artwork(ctx,'health-track',offsetY);
  if(ratio<=0)return;
  const [x,y]=definitions['health-track'],top=y-offsetY;
  // The PSD fill has a black tail beyond its highlight. Align the highlight
  // with the full track and clip the texture to the inside of its bevel.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x+6,top+8);
  ctx.lineTo(x+682,top+8);
  ctx.lineTo(x+667,top+27);
  ctx.lineTo(x+662,top+30);
  ctx.lineTo(x+21,top+30);
  ctx.lineTo(x+18,top+27);
  ctx.closePath();
  ctx.clip();
  artwork(ctx,'health-fill',offsetY,PLAYER_HEALTH_FILL_WIDTH*ratio/definitions['health-fill'][2],ratio<=PLAYER_LOW_HEALTH_RATIO);
  ctx.restore();
}
function text(ctx, value, x, y, size, {align='left', color='#fff', glow='', stroke=0}={}) {
  ctx.save();
  // Dynamic HUD values share the lobby's upright font family.
  ctx.font = `700 ${size}px ${COMBAT_TYPE.family}`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = color;
  const baseline = y + (ctx.measureText(String(value)).actualBoundingBoxAscent ?? size * .8);
  if (glow) {ctx.shadowColor=glow;ctx.shadowBlur=7;}
  if (stroke) {ctx.lineWidth=stroke;ctx.lineJoin='round';ctx.strokeStyle='#000';ctx.strokeText(value,x,baseline);}
  ctx.fillText(value,x,baseline);ctx.restore();
}
// Combat can be wider than the 600 x 1300 HUD safe area. Project the actual
// renderer edges into the warning layer; only the backdrop grows, not its title/badge.
function fitWarningViewport(layer,mount,bridge) {
  const screenWidth=Number(bridge.app?.screen?.width??bridge.app?.renderer?.screen?.width);
  if(!(screenWidth>0))return;
  const left=mount.toLocal({x:0,y:0}).x,right=mount.toLocal({x:screenWidth,y:0}).x;
  const width=right-left;if(!Number.isFinite(width)||width<=0)return;
  const pixels=Math.max(1,Math.ceil(width));
  if(layer.canvas.width!==pixels){
    const previous=layer.sprite.texture;
    layer.canvas.width=pixels;
    layer.sprite.texture=Texture.from(layer.canvas);previous.destroy(true);layer.key=null;
  }
  layer.sprite.x=left;layer.sprite.scale.x=width/pixels;
}
function repaint(layer,key,draw) {
  if (layer.key===key) return;
  layer.key=key;layer.ctx.clearRect(0,0,layer.canvas.width,layer.canvas.height);draw(layer.ctx);
  layer.sprite.texture.source.update();
}
export function createPsdCombatHud(root, bridge, gradeFor, stageDuration = () => 300) {
  loadAssets();
  const mount = new Container(); mount.label='psd-combat-hud';
  mount.scale.set(600/W,1300/H);root.addChild(mount);
  const nativeTiles=bridge.nativeHudTiles;
  const top=canvasLayer(mount,0,460,W,nativeTiles), bottom=canvasLayer(mount,1500,124,W,nativeTiles);
  const warningLayer=canvasLayer(mount,BOSS_WARNING_LAYER.y,BOSS_WARNING_LAYER.height,W,nativeTiles);
  warningLayer.sprite.visible=false;
  const pause = new Container(); pause.label='暂停';pause.position.set(4,16);
  pause.hitArea=new Rectangle(0,0,132,132);pause.enabled=true;pause.eventMode='static';
  pause.__pixiUiAction=()=>bridge.showPauseMenu();mount.addChild(pause);
  const pauseFace=canvasLayer(pause,0,132,132,nativeTiles);
  let tileLayout;
  function showNativeTiles(){
    if(!nativeTiles)return false;
    const {width,height}=bridge.app.renderer.screen;
    if(!(width>0&&height>0))return false;
    const origin=mount.toGlobal({x:0,y:0});
    const press=pause.visualScale;
    const factor=press?.factor??1;
    const warning=warningLayer.sprite;
    const warningWidth=warning.visible?warningLayer.canvas.width*warning.scale.x:0;
    const warningX=warning.visible?warning.x:0;
    if(tileLayout&&tileLayout.width===width&&tileLayout.height===height&&tileLayout.x===origin.x&&tileLayout.y===origin.y&&
      tileLayout.factor===factor&&tileLayout.warningWidth===warningWidth&&tileLayout.warningX===warningX)return true;
    tileLayout={width,height,x:origin.x,y:origin.y,factor,warningWidth,warningX};
    const sx=100*mount.scale.x/width,sy=100*mount.scale.y/height;
    const place=(layer,x,y,scaleX=1,scaleY=scaleX)=>{
      const tile=layer.canvas;
      const style=`position:absolute;left:${100*origin.x/width+x*sx}%;top:${100*origin.y/height+y*sy}%;width:${tile.width*sx*scaleX}%;height:${tile.height*sy*scaleY}%;pointer-events:none`;
      if(layer.style!==style){layer.style=style;tile.style.cssText=style;}
      if(tile.parentNode!==nativeTiles)nativeTiles.append(tile);
    };
    place(top,0,0);
    place(bottom,0,bottom.sprite.y);
    place(pauseFace,pause.x+(press?.x??0)*(1-factor),pause.y+(press?.y??0)*(1-factor),factor);
    if(warning.visible)place(warningLayer,warningX,warning.y,warning.scale.x,1);
    else warningLayer.canvas.remove();
    return true;
  }
  let lastUpdate=-Infinity,healthDisplay=null,bossDisplay=bossHealthStates.get(bridge)??null;
  let bossMotion=bossHitStates.get(bridge)??null;
  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  return {mount,showNativeTiles,update(now) {
    const game=bridge.game, boss=bridge.boss, stats=bridge.runStats||{};
    if(loadedImageCount!==loaded.size){
      loadedImages=new Map([...loaded].map(name=>[name,assets.get(name)]));
      loadedImageCount=loaded.size;
    }
    const images=loadedImages;
    repaint(pauseFace,loaded.has('pause'),ctx=>{
      if(loaded.has('pause'))ctx.drawImage(assets.get('pause'),0,0,132,132);
    });
    const warning=game.state==='playing'?bossWarningFrame(bridge.presentation?.bossWarning,reducedMotion?.matches??false):null;
    warningLayer.sprite.visible=Boolean(warning);
    if(warning)fitWarningViewport(warningLayer,mount,bridge);
    repaint(warningLayer,warning?`${loaded.size}:${warning.type}:${Math.floor(warning.elapsed*(nativeTiles?30:60))}`:'',ctx=>drawBossWarning(ctx,warning,images,warningLayer.canvas.width));
    const bossActive=!!boss&&!boss.dead&&boss.hp>0&&!['ready','victory_result','fixed_result','defeat_result'].includes(game.state);
    const nextBoss=updateBossHealth(bossDisplay,bossActive?boss:null,Number.isFinite(game.elapsed)?game.elapsed*1000:now,reducedMotion?.matches??false);
    const nextMotion=updateBossHitMotion(bossMotion,bossActive?boss:null,Number.isFinite(game.elapsed)?game.elapsed*1000:now,reducedMotion?.matches??false);
    const bossChanged=bossDisplay?.boss!==nextBoss.boss||bossDisplay?.ratio!==nextBoss.ratio||(bossMotion?.active&&!nextMotion.active);
    bossMotion=nextMotion;bossHitStates.set(bridge,nextMotion);
    bossDisplay=nextBoss;bossHealthStates.set(bridge,nextBoss);
    const maxHp=Math.max(1,Number(stats.maxHp)||100),hp=Math.min(maxHp,Math.max(0,Number(game.hp)||0));
    const healthChanged=!healthDisplay||healthDisplay.hp!==hp||healthDisplay.maxHp!==maxHp;
    healthDisplay=playerHealthFrame(healthDisplay,hp,maxHp,Number(game.elapsed)||0,game.fixedGrowth?.state?.runId??game.peripheralSnapshot?.id??null,reducedMotion?.matches??false);
    if (!healthChanged&&!bossChanged&&now-lastUpdate<(healthDisplay.animating||bossDisplay.animating||bossMotion.active?1000/30:80)) return;lastUpdate=now;
    const ready=loaded.size;
    const seconds=Math.max(0,Math.floor(game.elapsed||0));
    const time=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    const coins=bridge.presentation?.hudCoins;
    const score=Number.isFinite(coins)?String(Math.max(0,Math.floor(coins))):bridge.presentation?.score ?? String(Math.round(game.score||0)).padStart(6,'0');
    const kills=String(Math.round(game.kills||0)).padStart(3,'0');
    const grade=bridge.presentation?.grade ?? gradeFor(game.flightQuality).id;
    const combo=game.flightChainTimer>0 && game.flightQuality>0;
    const progress=bridge.presentation?.progress ?? battleProgress(game,boss,stageDuration());
    if(bossActive&&images.has('health-fill'))images.set('boss-health-fill',lowHealthFill(images.get('health-fill')));
    const bossRatio=bossDisplay.ratio;
    const notice=game.battleNotice;
    const showNotice=game.state==='playing'&&notice&&game.elapsed-notice.at>=0&&game.elapsed-notice.at<notice.duration;
    const waveAlpha=waveNoticeAlpha(game);
    const values=[ready,time,score,kills,grade,combo,game.flightQuality,game.flightChain,game.flightLastPoints,game.waveIndex,game.waveStatus?.total,waveAlpha,progress,bossActive,bossRatio,Math.round(bossDisplay.bar*BOSS_BAR.width),Math.round(bossDisplay.trail*BOSS_BAR.width),boss?.visualSpec?.name,showNotice?notice.text:'',...['x','y','iconX','iconY'].map(key=>Math.round(bossMotion[key]*BOSS_BAR.width*4))];
    repaint(top,JSON.stringify(values),ctx=>{
      for(const name of [Number.isFinite(coins)?'stats-coins':'stats','grade'])artwork(ctx,name);
      if(Number.isFinite(coins))artwork(ctx,'coins');
      if(!bossActive){
        artwork(ctx,'progress-track');
        ctx.save();ctx.beginPath();ctx.rect(472,152,248*progress,14);ctx.clip();artwork(ctx,'progress-fill',0,248/206);ctx.restore();
      }
      text(ctx,time,713,49,36,{align:'right',glow:'#00cfff'});
      text(ctx,score,510,106,24);text(ctx,kills,713,106,24,{align:'right'});
      text(ctx,grade,255,59,48,{align:'center',glow:'#00cfff'});
      if(waveAlpha>0){
        ctx.save();ctx.globalAlpha=waveAlpha;
        artwork(ctx,'wave');
        text(ctx,`波次 ${game.waveIndex}/${game.waveStatus?.total||1}`,375,201,24,{align:'center'});
        ctx.restore();
      }
      if(combo){
        artwork(ctx,'combo');
        text(ctx,Math.round(game.flightQuality),395,251,50,{align:'right',color:'#fff100',glow:'#fbff00'});
        text(ctx,`x${Math.max(1,game.flightChain||1)}`,408,268,26,{glow:'#00eaff'});
        text(ctx,`本次+${Math.round(game.flightLastPoints||0)}`,375,309,24,{align:'center',glow:'#00eaff'});
      }
      if(bossActive)drawBossHealthBar(ctx,boss,bossDisplay,images,bossMotion);
      if(showNotice)text(ctx,notice.text,375,354,24,{align:'center',glow:'#00cfff'});
    });
    const ratio=healthDisplay.value,shownHp=Math.ceil(ratio*maxHp),level=Math.max(1,Math.round(game.level||1));
    repaint(bottom,JSON.stringify([ready,shownHp,maxHp,level,Math.round(ratio*PLAYER_HEALTH_FILL_WIDTH)]),ctx=>{
      drawPlayerHealthBar(ctx,ratio,1500);
      artwork(ctx,'heart',1500);artwork(ctx,'level-decoration',1500);
      text(ctx,`等级  ${level}`,105,17,30,{glow:'#00cfff'});
      text(ctx,`生命 ${shownHp}/${Math.ceil(maxHp)}`,705,24,24,{align:'right',glow:'#ff4568'});
      text(ctx,`${Math.round(ratio*100)}%`,375,49,36,{align:'center',stroke:7});
    });
  }};
}

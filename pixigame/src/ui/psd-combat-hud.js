import {updateBossHealth} from './boss-health.js';
import {updateBossHitMotion} from './boss-hit-motion.js';
import {BOSS_BAR,BOSS_WARNING_LAYER,bossWarningFrame,drawBossHealthBar,prepareBossHealthIcon} from './boss-encounter-hud.js';
import {projectBattleInterfaceIcon} from './project-battle-interface-art.js';
import { cloudAssetBase } from './cloud-asset-base.js';
import { Container, Rectangle, Sprite, Texture } from '../three/display.js';
import { releaseOwnedCanvas } from './release-owned-canvas.js';
import { drawNineSlice } from './canvas-surface.js';
import { battleProgress } from './battle-progress.js';
import { COMBAT_TYPE } from './combat-theme.js';
import { PLAYER_LOW_HEALTH_RATIO,PLAYER_LOW_HEALTH_COLOR,playerHealthFrame } from '../replica/player-health-display.js';
import { waveNoticeAlpha } from './wave-notice.js';
import { RESOURCE_ICONS } from './resource-icons.js';
import { leftOfMenuCenterY } from '../three/game-screen/home-navigation.js';

// PSD coordinates are authoritative. Only the presentation is scaled to the
// existing 600 × 1300 combat scene; the world and flight input stay untouched.
const W = 750, H = 1624, TOP_HEIGHT = 460, PLAYER_HUD_TOP = 1500;
const PLAYER_HEALTH_FILL_WIDTH = 694;
// Include the title, icon and their hit recoil around the bar.
const BOSS_STRIP_TOP = BOSS_BAR.y - 40, BOSS_STRIP_HEIGHT = 96;
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
  'health-track':[29,1550,688,39], 'health-fill':[31,1550,557,39],
  heart:[42,1542,58,50], 'level-decoration':[70,1518,34,35],
};
const extraAssets={
  'progress-track':`${cloudAssetBase}art/psd-combat-v1/progress-track.png`,
  'progress-fill':`${cloudAssetBase}art/psd-combat-v1/progress-fill.png`,
  'encounter-boss':projectBattleInterfaceIcon('bossProgress_icon'),
  'warning-boss':`${cloudAssetBase}art/project-encounter-warnings-v3/boss-dark-edge.png`,
  'warning-elite':`${cloudAssetBase}art/project-encounter-warnings-v3/elite.png`,
};
function loadAssets(loadImageSurface) {
  for (const name of [...Object.keys(definitions),...Object.keys(extraAssets)]) {
    if (assets.has(name)) continue;
    const url = name === 'coins' ? RESOURCE_ICONS.coins.url : extraAssets[name] || `${cloudAssetBase}art/psd-combat-v1/${name}.png`;
    const accept=image=>{
      assets.set(name,image);
      if(name==='encounter-boss')assets.set('boss-health-icon',prepareBossHealthIcon(image));
      loaded.add(name);
    };
    if (loadImageSurface) {
      // Reserve the slot while the shared loader resolves the package or CDN.
      assets.set(name, null);
      loadImageSurface(url).then(accept, () => assets.delete(name));
      continue;
    }
    const image = new Image();
    assets.set(name, image);
    image.onload = () => accept(image);
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
function drawPlayerExperienceBar(ctx, fillWidth) {
  const [x, healthY, width, healthHeight] = definitions['health-track'];
  const y = healthY + healthHeight + 8 - PLAYER_HUD_TOP, height = 14;
  const slices = [0, 14, 0, 14];
  if (loaded.has('progress-track')) drawNineSlice(ctx, assets.get('progress-track'), x, y, width, height, slices);
  if (fillWidth <= 0 || !loaded.has('progress-fill')) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, fillWidth, height);
  ctx.clip();
  drawNineSlice(ctx, assets.get('progress-fill'), x, y, width, height, slices);
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
const defaultTopLayout = {
  surface:{x:0,y:0,width:W,height:TOP_HEIGHT,scaleX:1},
  pause:{x:definitions.pause[0],y:definitions.pause[1],scale:1},
  grade:[0,0],stats:[0,0],centerX:0,waveY:0,bossY:0,bossWaveY:0,
};

function topHudLayout(mount, viewport, screen) {
  if(!viewport?.menuButton)return defaultTopLayout;
  const {width,height,safeTop,menuButton}=viewport;
  const origin=mount.toLocal({x:0,y:0}),corner=mount.toLocal({x:screen.width,y:screen.height});
  const span=corner.x-origin.x,unitX=span/width,unitY=(corner.y-origin.y)/height;
  const edge=10,buttonSize=44,pauseSize=buttonSize*unitX;
  const gradeLeft=edge+buttonSize+4;
  const [gradeX,gradeY,gradeWidth,gradeHeight]=definitions.grade;
  const center=leftOfMenuCenterY(viewport,gradeLeft+gradeWidth/unitX);
  if(center===null)return defaultTopLayout;
  const pauseTop=center-pauseSize/(2*unitY),gradeTop=center-gradeHeight/(2*unitY);
  const surfaceTop=Math.min(pauseTop,gradeTop)-2;
  if(surfaceTop<0)return defaultTopLayout;

  // Use screen edges for the header while the authored safe area still
  // positions menus, warnings and the bottom health bar.
  const canvasWidth=Math.ceil(span),pixelX=canvasWidth/width;
  const statsTop=(Math.max(safeTop,menuButton.bottom)+6-surfaceTop)*unitY;
  const [statsX,statsY,statsWidth,statsHeight]=definitions.stats;
  const gap=6*unitY,waveTop=definitions.wave[1];
  const waveY=statsTop+statsHeight+gap-waveTop;
  const bossY=statsTop+statsHeight+gap-(BOSS_BAR.y-28);
  const bossWaveY=bossY+BOSS_BAR.y+BOSS_BAR.height+gap-waveTop;
  return {
    surface:{x:origin.x,y:origin.y+surfaceTop*unitY,width:canvasWidth,
      height:Math.max(TOP_HEIGHT,Math.ceil(TOP_HEIGHT+Math.max(waveY,bossWaveY))),scaleX:span/canvasWidth},
    pause:{x:origin.x+edge*unitX,y:origin.y+pauseTop*unitY,scale:pauseSize/definitions.pause[2]},
    grade:[gradeLeft*pixelX-gradeX,(gradeTop-surfaceTop)*unitY-gradeY],
    stats:[canvasWidth-edge*pixelX-statsX-statsWidth,statsTop-statsY],
    centerX:(canvasWidth-W)/2,waveY,bossY,bossWaveY,
  };
}

function resizeLayer(layer,width,height) {
  if(layer.canvas.width===width&&layer.canvas.height===height)return;
  const previous=layer.sprite.texture;
  layer.canvas.width=width;layer.canvas.height=height;
  layer.sprite.texture=Texture.from(layer.canvas);previous.destroy(true);layer.key=null;
}

// Keep both rails at the screen edges throughout the entrance pulse.
function fitWarningViewport(sprite,mount,bridge,{offsetY,scale}) {
  const {y,height}=BOSS_WARNING_LAYER;
  const screenWidth=Number(bridge.app?.screen?.width??bridge.app?.renderer?.screen?.width);
  const left=screenWidth>0?mount.toLocal({x:0,y:0}).x:0;
  const right=screenWidth>0?mount.toLocal({x:screenWidth,y:0}).x:W;
  const span=right-left;if(!Number.isFinite(span)||span<=0)return;
  const scaleX=span/sprite.texture.width;
  const scaleY=Math.min(scaleX,height/sprite.texture.height);
  sprite.position.set((left+right)/2,y+height/2+offsetY*Math.min(1,span/W));
  sprite.scale.set(scaleX,scaleY*scale);
}
function repaint(layer,key,draw) {
  if (layer.key===key) return;
  layer.key=key;layer.ctx.clearRect(0,0,layer.canvas.width,layer.canvas.height);draw(layer.ctx);
  layer.sprite.texture.source.update();
}
export function createPsdCombatHud(root, bridge, gradeFor, stageDuration = () => 300) {
  loadAssets(bridge.loadImageSurface ?? globalThis.__THUNDER_RUNTIME_GLOBALS__?.loadImageSurface);
  const mount = new Container(); mount.label='psd-combat-hud';
  mount.scale.set(600/W,1300/H);root.addChild(mount);
  const nativeTiles=bridge.nativeHudTiles;
  const top=canvasLayer(mount,0,TOP_HEIGHT,W,nativeTiles);
  const bottom=canvasLayer(mount,PLAYER_HUD_TOP,H-PLAYER_HUD_TOP,W,nativeTiles);
  const bossLayer=canvasLayer(mount,BOSS_STRIP_TOP,BOSS_STRIP_HEIGHT,W,nativeTiles);
  bossLayer.sprite.visible=false;
  if(nativeTiles)bossLayer.canvas.hidden=true;
  const warningSprite=new Sprite(),warningTextures=new Map();
  warningSprite.label='encounter-warning';
  warningSprite.anchor.set(.5);warningSprite.visible=false;
  const destroyWarning=warningSprite.destroy.bind(warningSprite);
  warningSprite.destroy=options=>{
    for(const texture of warningTextures.values())texture.destroy(true);
    warningTextures.clear();destroyWarning(options);
  };
  mount.addChild(warningSprite);
  const [pauseX,pauseY,pauseWidth,pauseHeight]=definitions.pause;
  const pause = new Container(); pause.label='暂停';pause.position.set(pauseX,pauseY);
  pause.hitArea=new Rectangle(0,0,pauseWidth,pauseHeight);pause.enabled=true;pause.eventMode='static';
  pause.__pixiUiAction=()=>bridge.showPauseMenu();mount.addChild(pause);
  const pauseFace=canvasLayer(pause,0,pauseHeight,pauseWidth,nativeTiles);
  let tileLayout,viewport,layout=defaultTopLayout;
  let bossOffsetX=0,bossOffsetY=-BOSS_STRIP_TOP;
  function reflow() {
    if(viewport===bridge.hudViewport)return false;
    viewport=bridge.hudViewport;
    layout=topHudLayout(mount,viewport,bridge.app?.renderer?.screen);
    const {surface,pause:button}=layout;
    resizeLayer(top,surface.width,surface.height);
    top.sprite.position.set(surface.x,surface.y);
    top.sprite.scale.x=surface.scaleX;
    // Use the top canvas pixel grid so moving the bar to its own surface preserves its rasterization.
    const bossLeft=Math.floor(layout.centerX),bossTop=Math.floor(layout.bossY)+BOSS_STRIP_TOP;
    bossLayer.sprite.position.set(surface.x+bossLeft*surface.scaleX,surface.y+bossTop);
    bossLayer.sprite.scale.x=surface.scaleX;
    bossOffsetX=layout.centerX-bossLeft;bossOffsetY=layout.bossY-bossTop;
    bossLayer.key=null;
    pause.position.set(button.x,button.y);pause.scale.set(button.scale);
    top.key=null;tileLayout=null;
    return true;
  }
  function showNativeTiles(){
    if(!nativeTiles||warningSprite.visible)return false;
    const {width,height}=bridge.app.renderer.screen;
    if(!(width>0&&height>0))return false;
    const origin=mount.toGlobal({x:0,y:0});
    const press=pause.visualScale;
    const factor=press?.factor??1;
    if(tileLayout&&tileLayout.width===width&&tileLayout.height===height&&tileLayout.x===origin.x&&tileLayout.y===origin.y&&tileLayout.factor===factor)return true;
    tileLayout={width,height,x:origin.x,y:origin.y,factor};
    const sx=100*mount.scale.x/width,sy=100*mount.scale.y/height;
    const place=(layer,x,y,scaleX=1,scaleY=scaleX)=>{
      const tile=layer.canvas;
      tile.style.cssText=`position:absolute;left:${100*origin.x/width+x*sx}%;top:${100*origin.y/height+y*sy}%;width:${tile.width*sx*scaleX}%;height:${tile.height*sy*scaleY}%;pointer-events:none`;
      if(tile.parentNode!==nativeTiles)nativeTiles.append(tile);
    };
    place(top,top.sprite.x,top.sprite.y,top.sprite.scale.x,1);
    place(bossLayer,bossLayer.sprite.x,bossLayer.sprite.y,bossLayer.sprite.scale.x,1);
    place(bottom,0,bottom.sprite.y);
    place(pauseFace,pause.x+(press?.x??0)*(1-factor)*pause.scale.x,
      pause.y+(press?.y??0)*(1-factor)*pause.scale.y,factor*pause.scale.x);
    return true;
  }
  let lastUpdate=-Infinity,healthDisplay=null,bossDisplay=bossHealthStates.get(bridge)??null;
  let bossMotion=bossHitStates.get(bridge)??null;
  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  return {mount,showNativeTiles,update(now) {
    const layoutChanged=reflow();
    const game=bridge.game, boss=bridge.boss, stats=bridge.runStats||{};
    if(loadedImageCount!==loaded.size){
      loadedImages=new Map([...loaded].map(name=>[name,assets.get(name)]));
      const fill=loadedImages.get('health-fill'),icon=assets.get('boss-health-icon');
      if(fill)loadedImages.set('boss-health-fill',lowHealthFill(fill));
      if(icon)loadedImages.set('boss-health-icon',icon);
      loadedImageCount=loaded.size;
    }
    const images=loadedImages;
    repaint(pauseFace,loaded.has('pause'),ctx=>{
      if(loaded.has('pause'))ctx.drawImage(assets.get('pause'),0,0,pauseWidth,pauseHeight);
    });
    const warning=game.state==='playing'?bossWarningFrame(bridge.presentation?.bossWarning,bridge.reducedMotion?.()??reducedMotion?.matches??false):null;
    const warningImage=warning&&images.get(warning.type===2?'warning-boss':'warning-elite');
    warningSprite.visible=Boolean(warningImage&&warning.alpha>0);
    if(warningSprite.visible){
      if(!warningTextures.has(warning.type))warningTextures.set(warning.type,Texture.from(warningImage));
      warningSprite.texture=warningTextures.get(warning.type);
      warningSprite.alpha=warning.alpha;
      fitWarningViewport(warningSprite,mount,bridge,warning);
    }
    const bossActive=!!boss&&!boss.dead&&boss.hp>0&&!['ready','victory_result','fixed_result','defeat_result'].includes(game.state);
    const nextBoss=updateBossHealth(bossDisplay,bossActive?boss:null,Number.isFinite(game.elapsed)?game.elapsed*1000:now,reducedMotion?.matches??false);
    const nextMotion=updateBossHitMotion(bossMotion,bossActive?boss:null,Number.isFinite(game.elapsed)?game.elapsed*1000:now,reducedMotion?.matches??false);
    const bossChanged=bossLayer.sprite.visible!==bossActive;
    bossLayer.sprite.visible=bossActive;
    if(bossChanged&&nativeTiles)bossLayer.canvas.hidden=!bossActive;
    bossMotion=nextMotion;bossHitStates.set(bridge,nextMotion);
    bossDisplay=nextBoss;bossHealthStates.set(bridge,nextBoss);
    const ready=loaded.size;
    if(bossActive){
      const name=boss.visualSpec?.name||boss.config?.title||boss.config?.name;
      const {x,y,iconX,iconY}=bossMotion;
      const key=JSON.stringify([ready,name,Math.ceil(bossDisplay.ratio*100),Math.round(bossDisplay.bar*BOSS_BAR.width),
        Math.round(bossDisplay.trail*BOSS_BAR.width),...[x,y,iconX,iconY].map(offset=>Math.round(offset*BOSS_BAR.width*4))]);
      repaint(bossLayer,key,ctx=>drawBossHealthBar(ctx,boss,bossDisplay,images,bossMotion,bossOffsetX,bossOffsetY));
    }
    const maxHp=Math.max(1,Number(stats.maxHp)||100),hp=Math.min(maxHp,Math.max(0,Number(game.hp)||0));
    const healthChanged=!healthDisplay||healthDisplay.hp!==hp||healthDisplay.maxHp!==maxHp;
    healthDisplay=playerHealthFrame(healthDisplay,hp,maxHp,Number(game.elapsed)||0,game.fixedGrowth?.state?.runId??game.peripheralSnapshot?.id??null,reducedMotion?.matches??false);
    if (!layoutChanged&&!healthChanged&&!bossChanged&&now-lastUpdate<(healthDisplay.animating?1000/30:80)) return;lastUpdate=now;
    const seconds=Math.max(0,Math.floor(game.elapsed||0));
    const time=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    const coins=bridge.presentation?.hudCoins;
    const score=Number.isFinite(coins)?String(Math.max(0,Math.floor(coins))):bridge.presentation?.score ?? String(Math.round(game.score||0)).padStart(6,'0');
    const kills=String(Math.round(game.kills||0)).padStart(3,'0');
    const grade=bridge.presentation?.grade ?? gradeFor(game.flightQuality).id;
    const combo=game.flightChainTimer>0 && game.flightQuality>0;
    const notice=game.battleNotice;
    const showNotice=game.state==='playing'&&notice&&game.elapsed-notice.at>=0&&game.elapsed-notice.at<notice.duration;
    const waveAlpha=waveNoticeAlpha(game);
    const values=[ready,time,score,kills,grade,combo,game.flightQuality,game.flightChain,game.flightLastPoints,
      game.waveIndex,game.waveStatus?.total,waveAlpha,bossActive,showNotice?notice.text:''];
    repaint(top,JSON.stringify(values),ctx=>{
      ctx.save();ctx.translate(...layout.stats);
      artwork(ctx,Number.isFinite(coins)?'stats-coins':'stats');
      if(Number.isFinite(coins))artwork(ctx,'coins');
      text(ctx,time,713,49,36,{align:'right',glow:'#00cfff'});
      text(ctx,score,510,106,24);text(ctx,kills,713,106,24,{align:'right'});
      ctx.restore();
      ctx.save();ctx.translate(...layout.grade);
      artwork(ctx,'grade');text(ctx,grade,255,59,48,{align:'center',glow:'#00cfff'});
      ctx.restore();
      ctx.save();ctx.translate(layout.centerX,bossActive?layout.bossWaveY:layout.waveY);
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
      if(showNotice)text(ctx,notice.text,375,354,24,{align:'center',glow:'#00cfff'});
      ctx.restore();
    });
    const ratio=healthDisplay.value,shownHp=Math.ceil(ratio*maxHp),level=Math.max(1,Math.round(game.level||1));
    const progress=bridge.presentation?.progress ?? battleProgress(game,boss,stageDuration());
    const experienceWidth=Math.round(definitions['health-track'][2]*Math.max(0,Math.min(1,Number(progress)||0)));
    repaint(bottom,JSON.stringify([ready,shownHp,maxHp,level,Math.round(ratio*PLAYER_HEALTH_FILL_WIDTH),experienceWidth]),ctx=>{
      drawPlayerHealthBar(ctx,ratio,PLAYER_HUD_TOP);
      drawPlayerExperienceBar(ctx,experienceWidth);
      artwork(ctx,'heart',PLAYER_HUD_TOP);artwork(ctx,'level-decoration',PLAYER_HUD_TOP);
      text(ctx,`等级  ${level}`,105,17,30,{glow:'#00cfff'});
      text(ctx,`生命 ${shownHp}/${Math.ceil(maxHp)}`,705,24,24,{align:'right',glow:'#ff4568'});
      text(ctx,`${Math.round(ratio*100)}%`,375,49,36,{align:'center',stroke:7});
    });
  }};
}

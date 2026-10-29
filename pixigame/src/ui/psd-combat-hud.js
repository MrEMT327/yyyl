import { cloudAssetBase } from './cloud-asset-base.js';
import { Container, Rectangle, Sprite, Texture } from '../three/display.js';
import { battleProgress } from './battle-progress.js';
import { COMBAT_TYPE } from './combat-theme.js';

// PSD coordinates are authoritative. Only the presentation is scaled to the
// existing 600 × 1300 combat scene; the world and flight input stay untouched.
const W = 750, H = 1624;
const assets = new Map();
const loaded = new Set();
const definitions = {
  pause:[4,16,132,132], stats:[460,36,273,111], grade:[133,50,163,63],
  wave:[182,193,387,47], combo:[266,250,218,68],
  'progress-track':[472,152,248,14], 'progress-fill':[472,152,206,14],
  'health-track':[29,1550,688,39], 'health-fill':[31,1550,557,39],
  heart:[42,1542,58,50], 'level-decoration':[70,1518,34,35],
};
function loadAssets() {
  for (const name of Object.keys(definitions)) {
    if (assets.has(name)) continue;
    const image = globalThis.wx?.createImage?.() || new Image();
    image.onload = () => loaded.add(name);
    image.src = `${(cloudAssetBase)}art/psd-combat-v1/${name}.png`;
    assets.set(name, image);
  }
}
function canvasLayer(parent, y, height) {
  const canvas = globalThis.wx?.createCanvas?.() || document.createElement('canvas');
  canvas.width = W; canvas.height = height;
  const sprite = new Sprite(Texture.from(canvas));
  const destroy = sprite.destroy.bind(sprite);
  sprite.destroy = options => { sprite.texture.destroy(true); destroy(options); };
  sprite.y = y; sprite.eventMode = 'none'; parent.addChild(sprite);
  return {canvas, ctx:canvas.getContext('2d'), sprite, key:null};
}
function artwork(ctx, name, offsetY = 0, ratio = 1) {
  const image = assets.get(name);
  if (!loaded.has(name)) return;
  const [x,y,w,h] = definitions[name];
  ctx.save();
  if (['combo','level-decoration'].includes(name)) {
    ctx.shadowColor='#28dcff';ctx.shadowBlur=8;
  }
  ctx.drawImage(image,x,y-offsetY,w*ratio,h);
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
function repaint(layer,key,draw) {
  if (layer.key===key) return;
  layer.key=key;layer.ctx.clearRect(0,0,W,layer.canvas.height);draw(layer.ctx);
  layer.sprite.texture.source.update();
}
export function createPsdCombatHud(root, bridge, gradeFor, stageDuration = () => 300) {
  loadAssets();
  const mount = new Container(); mount.label='psd-combat-hud';
  mount.scale.set(600/W,1300/H);root.addChild(mount);
  const top=canvasLayer(mount,0,460), bottom=canvasLayer(mount,1500,124);
  const pause = new Container(); pause.label='暂停';pause.position.set(4,16);
  pause.hitArea=new Rectangle(0,0,132,132);pause.enabled=true;pause.eventMode='static';
  pause.__pixiUiAction=()=>bridge.showPauseMenu();mount.addChild(pause);
  let lastUpdate=-Infinity;
  return {update(now) {
    if (now-lastUpdate<80) return;lastUpdate=now;
    const game=bridge.game, boss=bridge.boss, stats=bridge.runStats||{};
    const ready=loaded.size;
    const seconds=Math.max(0,Math.floor(game.elapsed||0));
    const time=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
    const score=bridge.presentation?.score ?? String(Math.round(game.score||0)).padStart(6,'0');
    const kills=String(Math.round(game.kills||0)).padStart(3,'0');
    const grade=bridge.presentation?.grade ?? gradeFor(game.flightQuality).id;
    const combo=game.flightChainTimer>0 && game.flightQuality>0;
    const progress=bridge.presentation?.progress ?? battleProgress(game,boss,stageDuration());
    const bossActive=!!boss&&!boss.dead;
    const bossRatio=bossActive?Math.max(0,Math.min(1,boss.hp/Math.max(1,boss.maxHp))):0;
    const notice=game.battleNotice;
    const showNotice=game.state==='playing'&&notice&&game.elapsed-notice.at>=0&&game.elapsed-notice.at<notice.duration;
    const values=[ready,time,score,kills,grade,combo,game.flightQuality,game.flightChain,game.flightLastPoints,game.waveIndex,game.waveStatus?.total,progress,bossActive,bossRatio,showNotice?notice.text:''];
    repaint(top,JSON.stringify(values),ctx=>{
      for(const name of ['pause','stats','grade','wave','progress-track'])artwork(ctx,name);
      ctx.save();ctx.beginPath();ctx.rect(472,152,248*progress,14);ctx.clip();artwork(ctx,'progress-fill',0,248/206);ctx.restore();
      text(ctx,time,713,49,36,{align:'right',glow:'#00cfff'});
      text(ctx,score,510,106,24);text(ctx,kills,713,106,24,{align:'right'});
      text(ctx,grade,255,59,48,{align:'center',glow:'#00cfff'});
      text(ctx,`波次 ${Math.max(1,game.waveIndex||1)}/${game.waveStatus?.total||1}`,375,201,24,{align:'center'});
      if(combo){
        artwork(ctx,'combo');
        text(ctx,Math.round(game.flightQuality),395,251,50,{align:'right',color:'#fff100',glow:'#fbff00'});
        text(ctx,`x${Math.max(1,game.flightChain||1)}`,408,268,26,{glow:'#00eaff'});
        text(ctx,`本次+${Math.round(game.flightLastPoints||0)}`,375,309,24,{align:'center',glow:'#00eaff'});
      }
      // Boss and entry notices are transient game states absent from the PSD.
      // Reuse the supplied progress housing below the score feedback.
      if(bossActive){
        ctx.save();ctx.translate(-172,214);artwork(ctx,'progress-track');
        ctx.beginPath();ctx.rect(472,152,248*bossRatio,14);ctx.clip();artwork(ctx,'progress-fill',0,248/206);ctx.restore();
        text(ctx,`${boss.visualSpec?.name||boss.config?.title||boss.config?.name||'旗舰'} ${Math.ceil(bossRatio*100)}%`,375,338,22,{align:'center',glow:'#00cfff'});
      }
      if(showNotice)text(ctx,notice.text,375,bossActive?396:354,24,{align:'center',glow:'#00cfff'});
    });
    const hp=Math.max(0,Number(game.hp)||0),maxHp=Math.max(1,Number(stats.maxHp)||100);
    const ratio=Math.min(1,hp/maxHp),level=Math.max(1,Math.round(game.level||1));
    repaint(bottom,JSON.stringify([ready,hp,maxHp,level]),ctx=>{
      artwork(ctx,'health-track',1500);
      if(ratio>0) artwork(ctx,'health-fill',1500,684*ratio/557);
      artwork(ctx,'heart',1500);artwork(ctx,'level-decoration',1500);
      text(ctx,`等级  ${level}`,105,17,30,{glow:'#00cfff'});
      text(ctx,`生命 ${Math.ceil(hp)}/${Math.ceil(maxHp)}`,705,24,24,{align:'right',glow:'#ff4568'});
      text(ctx,`${Math.round(ratio*100)}%`,375,49,36,{align:'center',stroke:7});
    });
  }};
}
